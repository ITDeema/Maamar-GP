"""Per-façade indicators for the results page, calculated the same way as the dataset notebook.

Add it to the app in main.py with two lines:
    from facade_indicators_api import router as facade_router
    app.include_router(facade_router)

Endpoint
    GET /facade-indicators?latitude=&longitude=
        the plot under the point, its façades, and on each façade: solar radiation, shade and sky view

Notebook cells that are kept on purpose (Preparing_dataset):
  * the plot: Riyadh_Parcel (ArcGIS), the smallest parcel that contains the point
  * the façades: facades_for "v8" (street layer Streets_NEW): a plot edge is on a street when the street
    edge is within 3 m of it and the street runs within 30 degrees of the edge; corner cut-offs are skipped;
    eight 45-degree directions; per direction the widest street, then the longest edge
  * the building ("شكل المبنى"): the building measured by GBA when the plot is built
    (its footprint and measured height), otherwise the envelope allowed by the 2024 residential
    regulations (setback = street width / 5 with the minimums 3 / 6 / 2 / 1.5 m, coverage <= 75 %, 14 m)
  * the neighbours: GBA buildings within 300 m (height < 2 m left out, no height = 14 m)
  * radiation (Dorman Eq. 5-9): a point every 2 m along each wall and every 2 m in height,
    horizon angle in 72 sectors of 5 degrees, direct sun only when the sun is above the horizon of
    that sector, diffuse light weighted by the wall's sky view, EPW hours of June-August (summer)
    and December-February (winter), sun position at the middle of each hour shifted by EPW_SHIFT
    (0.5 h, from the dataset's EPW timing check)

  * sky view of the plot (SVF): at ground level in the middle of the plot, 72 sectors, mean of 1 - sin^2(horizon)
  * shade (Shaded_Pct): every daylight hour of 21 June, 21 March and 21 December, a point is shaded when
    the sun is below the horizon of its sector; share of the points facing the sun (1.0 if none face it)

Additions for the website (the notebook does not have them):
  * sky view of each wall: SVF_wall = mean of wall_svf over the wall's points x 2 (0..1); not a dataset column
  * wind shelter of each wall: Wind_block = sum(f_k x beta_k) / sum(f_k) over the 5-degree sectors in front of
    the wall (WSI_Total's method, only the wind that hits the wall), in degrees; not a dataset column
  * radiation is also given per day (season total / number of days in the season), the unit the
    results page shows (kWh/m2/day); the season total is kept as in the dataset
  * a direction with no wall facing it has null values (the dataset leaves it empty as well)
  * a street without a width uses the median width of its class among the streets loaded around the plot
    (the notebook uses the median of the whole city)

Data files (see data/README.txt):
  * EPW weather file   EPW_FILE, default data/*Riyadh*Khalid*.epw
  * GBA buildings      GBA_FILE, default data/gba_riyadh.parquet (made once with tools/clip_gba.py)
"""

from __future__ import annotations

import glob
import json
import os
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import pvlib
import shapely
from fastapi import APIRouter, HTTPException, Query
from shapely.geometry import LineString, Point, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

router = APIRouter()

HERE = Path(__file__).parent
ARCGIS = "https://services-ap1.arcgis.com/if9krLUYaMWhxyMO/ArcGIS/rest/services"
PARCELS_URL = f"{ARCGIS}/Riyadh_Parcel/FeatureServer/0/query"
STREETS_URL = f"{ARCGIS}/Streets_NEW/FeatureServer/0/query"
METRIC_SR = 32638  # UTM 38N, meters (same as the notebook)

DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

# ---- façades ("v8")
TOL, MAX_ANGLE, CAND_RADIUS = 3.0, 30, 80
EXCLUDE_CLASS = {"سكة حديد", "طريق مقترح", "نفق", "كوبري"}

# ---- building and radiation ("شكل المبنى")
RES = 2.0
H_DESIGN = 14.0
NSEC, SEC_W = 72, 5.0
SEC_C = np.arange(NSEC) * SEC_W
SITE_NEAR = 2.0
COVER_MAX = 0.75
SEARCH_RADIUS = 300.0
IMPUTED_NEIGHBOR_H = 14.0
SEASON_MONTHS = {"Summer": [6, 7, 8], "Winter": [12, 1, 2]}
EPW_SHIFT = 0.5  # hours, same as the dataset (timing check, cell 2)
SHADE_DAYS = {"Summer": (6, 21), "Equinox": (3, 21), "Winter": (12, 21)}


class DataFileError(RuntimeError):
    """A data file the calculation needs is missing."""


# ------------------------------------------------------------------ requests (ArcGIS)


def _get_json(url: str, params: dict) -> dict:
    with urllib.request.urlopen(f"{url}?{urllib.parse.urlencode(params)}", timeout=30) as res:
        data = json.load(res)
    if "error" in data:
        raise RuntimeError(data["error"])
    return data


def _ring_signed_area(ring) -> float:
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:])) / 2.0


def esri_to_shapely(geometry: dict | None):
    """Notebook esri_to_shapely: outer rings are clockwise (negative area), holes counter-clockwise."""
    outers, holes = [], []
    for ring in (geometry or {}).get("rings", []):
        if len(ring) < 4:
            continue
        poly = Polygon(ring)
        if not poly.is_valid:
            poly = poly.buffer(0)
        (outers if _ring_signed_area(ring) < 0 else holes).append(poly)
    if not outers:
        return None
    geom = unary_union(outers)
    if holes:
        geom = geom.difference(unary_union(holes))
    return geom if geom.is_valid else geom.buffer(0)


def pick_parcel(point: Point, features: list[dict]):
    """The smallest parcel that really contains the point (the plot that was clicked)."""
    best = None
    for feature in features:
        geom = esri_to_shapely(feature.get("geometry"))
        if geom is None or geom.is_empty or not geom.buffer(0.01).contains(point):
            continue
        if best is None or geom.area < best.area:
            best = geom
    if best is not None and best.geom_type == "MultiPolygon":
        best = max(best.geoms, key=lambda g: g.area)
    return best


def fetch_parcel(point: Point):
    data = _get_json(PARCELS_URL, {
        "geometry": f"{point.x},{point.y}", "geometryType": "esriGeometryPoint", "inSR": METRIC_SR,
        "spatialRel": "esriSpatialRelIntersects", "outFields": "Area", "returnGeometry": "true",
        "outSR": METRIC_SR, "f": "json",
    })
    return pick_parcel(point, data.get("features", []))


def fetch_streets(parcel) -> list[dict]:
    w, s, e, n = parcel.buffer(CAND_RADIUS + 20).bounds
    data = _get_json(STREETS_URL, {
        "geometry": f"{w},{s},{e},{n}", "geometryType": "esriGeometryEnvelope", "inSR": METRIC_SR,
        "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
        "outFields": "STREETWIDTH,STREETCLASS,SUBTYPECLASS,STREETANAME",
        "returnGeometry": "true", "outSR": METRIC_SR, "f": "json",
    })
    return data.get("features", [])


# ------------------------------------------------------------------ façades ("v8")


def _sec(az: float) -> int:
    return int(((az + 22.5) % 360) // 45)


def _adiff_scalar(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


def street_table(features: list[dict]) -> pd.DataFrame:
    rows = []
    for f in features:
        a = f.get("attributes") or {}
        paths = [p for p in (f.get("geometry") or {}).get("paths", []) if len(p) >= 2]
        if not paths:
            continue
        geom = LineString(paths[0]) if len(paths) == 1 else shapely.MultiLineString(paths)
        rows.append({
            "STREETWIDTH": a.get("STREETWIDTH"), "STREETCLASS": a.get("STREETCLASS"),
            "SUBTYPECLASS": a.get("SUBTYPECLASS"), "STREETANAME": a.get("STREETANAME"), "geometry": geom,
        })
    st = pd.DataFrame(rows, columns=["STREETWIDTH", "STREETCLASS", "SUBTYPECLASS", "STREETANAME", "geometry"])
    st["STREETWIDTH"] = pd.to_numeric(st["STREETWIDTH"], errors="coerce")
    st = st[~st["STREETCLASS"].isin(EXCLUDE_CLASS) & ~st["SUBTYPECLASS"].isin(EXCLUDE_CLASS)].copy()
    class_median = st.groupby("SUBTYPECLASS")["STREETWIDTH"].median()
    st["W_DETECT"] = st["STREETWIDTH"].fillna(st["SUBTYPECLASS"].map(class_median))
    return st[st["W_DETECT"].notna()].reset_index(drop=True)


def street_dir_at(line, pt: Point) -> float:
    if line.geom_type == "MultiLineString":
        line = min(line.geoms, key=lambda g: g.distance(pt))
    s = line.project(pt)
    a, b = line.interpolate(max(s - 1, 0)), line.interpolate(min(s + 1, line.length))
    return float(np.degrees(np.arctan2(b.x - a.x, b.y - a.y)) % 180)


def facades_for(parcel, st: pd.DataFrame) -> dict:
    """Notebook facades_for (v8), without the nearest main road (not used here)."""
    ring = list(orient(parcel, 1.0).exterior.coords)
    geoms = st["geometry"].to_numpy()
    wdet = st["W_DETECT"].to_numpy(float)
    widths = st["STREETWIDTH"].to_numpy(float)
    classes = st["SUBTYPECLASS"].to_numpy(object)
    names = st["STREETANAME"].to_numpy(object)
    edges = []
    for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:]):
        dx, dy = x2 - x1, y2 - y1
        length = float(np.hypot(dx, dy))
        if length < 0.5:
            continue
        mid = Point((x1 + x2) / 2, (y1 + y2) / 2)
        normal_az = float(np.degrees(np.arctan2(dy, -dx)) % 360)
        edge_dir = float(np.degrees(np.arctan2(dx, dy)) % 180)
        best = None
        if len(geoms):
            dist = shapely.distance(geoms, mid)
            idx = np.nonzero(dist <= CAND_RADIUS)[0]
            resid = dist[idx] - wdet[idx] / 2
            ok = resid <= TOL
            for j in idx[ok][np.argsort(np.abs(resid[ok]))]:
                par = _adiff_scalar(street_dir_at(geoms[j], mid), edge_dir)
                if min(par, 180 - par) <= MAX_ANGLE:
                    best = {"width": widths[j], "class": classes[j], "name": names[j]}
                    break
        edges.append({"len": length, "normal": normal_az, "street": best})
    n = len(edges)
    for i, e in enumerate(edges):
        if e["street"] is None:
            continue
        p, q = edges[(i - 1) % n], edges[(i + 1) % n]
        if p["street"] and q["street"]:
            if 30 <= _adiff_scalar(e["normal"], p["normal"]) <= 60 and 30 <= _adiff_scalar(e["normal"], q["normal"]) <= 60:
                e["chamfer"] = True
    res = {}
    for d in DIRS:
        res[f"facade_{d}"] = 0
        res[f"street_width_{d}"] = 0.0
        res[f"street_class_{d}"] = None
        res[f"street_name_{d}"] = None
    best_len = {d: 0.0 for d in DIRS}
    for e in edges:
        if e["street"] is None or e.get("chamfer"):
            continue
        d = DIRS[_sec(e["normal"])]
        s = e["street"]
        w_new = -1 if np.isnan(s["width"]) else s["width"]
        w_old = -1 if pd.isna(res[f"street_width_{d}"]) else res[f"street_width_{d}"]
        if res[f"facade_{d}"] == 0 or (w_new, e["len"]) > (w_old, best_len[d]):
            res[f"facade_{d}"] = 1
            res[f"street_width_{d}"] = np.nan if np.isnan(s["width"]) else float(s["width"])
            res[f"street_class_{d}"] = s["class"]
            res[f"street_name_{d}"] = s["name"]
            best_len[d] = e["len"]
    res["street_count"] = sum(res[f"facade_{d}"] for d in DIRS)
    res["_edge_len"] = best_len
    return res


def main_facade(parcel, row: dict) -> str:
    """The façade on the widest street (then the longest edge); with no street, the longest edge."""
    on_street = [d for d in DIRS if row[f"facade_{d}"] == 1]
    if on_street:
        def key(d):
            w = row[f"street_width_{d}"]
            return (w if pd.notna(w) else -1, row["_edge_len"][d])
        return max(on_street, key=key)
    ring = np.asarray(orient(parcel, 1.0).exterior.coords)
    best = max(zip(ring[:-1], ring[1:]), key=lambda e: np.hypot(*(e[1] - e[0])))
    (x1, y1), (x2, y2) = best
    return DIRS[_sec(float(np.degrees(np.arctan2(y2 - y1, -(x2 - x1))) % 360))]


# ------------------------------------------------------------------ data files


def _find(patterns: list[str]) -> str | None:
    for pattern in patterns:
        hits = sorted(glob.glob(str(HERE / "data" / pattern)))
        if hits:
            return hits[0]
    return None


@lru_cache(maxsize=1)
def epw_seasons() -> dict:
    """Notebook: EPW hours of each season, sun position at the middle of each hour + EPW_SHIFT."""
    path = os.environ.get("EPW_FILE") or _find(["*Riyadh*Khalid*.epw", "*.epw"])
    if not path or not Path(path).exists():
        raise DataFileError("EPW weather file not found (data/*Riyadh*Khalid*.epw)")
    epw, meta = pvlib.iotools.read_epw(path)
    tm = epw.index - pd.Timedelta(minutes=30) + pd.Timedelta(hours=EPW_SHIFT)
    sp = pvlib.solarposition.get_solarposition(tm, meta["latitude"], meta["longitude"])
    seasons = {}
    for name, months in SEASON_MONTHS.items():
        m = np.isin(tm.month, months)
        seasons[name] = (
            sp["apparent_elevation"].values[m], sp["azimuth"].values[m],
            epw["dni"].values[m].astype(float), epw["dhi"].values[m].astype(float),
            int(m.sum()) / 24.0,  # days in the season
        )
    return seasons


@lru_cache(maxsize=1)
def wind_sector_frequency() -> np.ndarray:
    """Share of the wind hours coming from each of the 72 sectors of 5 degrees (ERA5-Land, the same file
    as /wind), calm hours (< 0.5 m/s) left out. The sectors are the horizon sectors (sec_of), so they
    line up with B."""
    from sun_wind_api import CALM_THRESHOLD, era5_csv_path

    path = era5_csv_path()
    if not path.is_file():
        raise DataFileError(f"ERA5 wind file not found: {path.name}")
    era = pd.read_csv(path)
    era.columns = era.columns.str.strip().str.lower()
    u_col = [c for c in era.columns if "u-component" in c or "u_component" in c or "u10" in c][0]
    v_col = [c for c in era.columns if "v-component" in c or "v_component" in c or "v10" in c][0]
    u, v = era[u_col].to_numpy(float), era[v_col].to_numpy(float)
    ok = np.isfinite(u) & np.isfinite(v)
    u, v = u[ok], v[ok]
    wdir = (180 + np.degrees(np.arctan2(u, v))) % 360  # the direction the wind comes FROM (ECMWF)
    wdir = wdir[np.hypot(u, v) >= CALM_THRESHOLD]
    return np.bincount(sec_of(wdir), minlength=NSEC) / len(wdir)


@lru_cache(maxsize=1)
def shade_hours() -> pd.DataFrame:
    """Notebook SUN_H: every hour from sunrise to sunset on 21 June, 21 March and 21 December
    (2025, Asia/Riyadh, one Riyadh point 24.71 N 46.67 E)."""
    rows = []
    for season, (month, day) in SHADE_DAYS.items():
        t = pd.date_range(f"2025-{month:02d}-{day:02d} 00:00", periods=24, freq="h", tz="Asia/Riyadh")
        p = pvlib.solarposition.get_solarposition(t, 24.71, 46.67)
        rows += [(season, a, z) for a, z in zip(p["apparent_elevation"], p["azimuth"]) if a > 0]
    return pd.DataFrame(rows, columns=["season", "alt", "az"])


@lru_cache(maxsize=1)
def summer_max_temperature() -> float:
    """Mean daily maximum air temperature in June-August (EPW Dry Bulb Temperature, temp_air), deg C.
    Same file as the radiation; one value for Riyadh."""
    path = os.environ.get("EPW_FILE") or _find(["*Riyadh*Khalid*.epw", "*.epw"])
    if not path or not Path(path).exists():
        raise DataFileError("EPW weather file not found (data/*Riyadh*Khalid*.epw)")
    epw, _ = pvlib.iotools.read_epw(path)
    daily_max = epw["temp_air"].resample("D").max()
    return round(float(daily_max[daily_max.index.month.isin([6, 7, 8])].mean()), 1)


@lru_cache(maxsize=1)
def gba_buildings():
    """Notebook GBA rules: EPSG:32638, height < 2 m left out, no height -> 14 m (height_raw keeps it empty)."""
    import geopandas as gpd

    path = os.environ.get("GBA_FILE") or str(HERE / "data" / "gba_riyadh.parquet")
    if not Path(path).exists():
        raise DataFileError("GBA buildings file not found (data/gba_riyadh.parquet, see tools/clip_gba.py)")
    gba = gpd.read_parquet(path)
    if gba.crs is None:
        gba = gba.set_crs(4326)
    gba = gba.to_crs(METRIC_SR)
    gba = gba[gba.geometry.notna() & ~gba.geometry.is_empty].reset_index(drop=True)
    gba["height_raw"] = gba["height"].where(gba["height"] > 0)
    gba = gba[~(gba["height_raw"] < 2.0)].reset_index(drop=True)
    gba["height"] = gba["height_raw"].fillna(IMPUTED_NEIGHBOR_H)
    geoms = gba.geometry.to_numpy()
    return geoms, gba["height"].to_numpy(float), gba["height_raw"].to_numpy(float), shapely.STRtree(geoms)


# ------------------------------------------------------------------ building and radiation (notebook functions)


def sec_of(az):
    return (np.floor((np.asarray(az) + SEC_W / 2) / SEC_W).astype(int)) % NSEC


def dir_of(az):
    return (np.floor(((np.asarray(az) + 22.5) % 360) / 45)).astype(int)


def adiff(a, b):
    return np.abs(((np.asarray(a) - b + 180) % 360) - 180)


def setback(width, cls, is_main):
    if isinstance(cls, str) and "ممر" in cls:
        mn = 1.5
    elif is_main:
        mn = 6.0 if (pd.notna(width) and width >= 30) else 3.0
    else:
        mn = 2.0
    return max(mn, width / 5) if pd.notna(width) and width > 0 else mn


def envelope(P, row):
    if P.geom_type == "MultiPolygon":
        P = max(P.geoms, key=lambda g: g.area)
    ring = np.asarray(orient(P, 1.0).exterior.coords)
    widths = {d: row.get(f"street_width_{d}") for d in DIRS}
    on_st = {d: row.get(f"facade_{d}", 0) == 1 for d in DIRS}
    main_d = max((d for d in DIRS if on_st[d]), key=lambda d: (widths[d] if pd.notna(widths[d]) else -1), default=None)
    cut, nb_edges = [], []
    for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:]):
        dx, dy = x2 - x1, y2 - y1
        if np.hypot(dx, dy) < 0.5:
            continue
        d = DIRS[int(dir_of(np.degrees(np.arctan2(dy, -dx)) % 360))]
        seg = LineString([(x1, y1), (x2, y2)])
        if on_st[d]:
            cut.append(seg.buffer(setback(widths[d], row.get(f"street_class_{d}"), d == main_d), cap_style=3))
        else:
            nb_edges.append(seg)
    E = P.difference(shapely.union_all(cut)) if cut else P
    if E.geom_type == "MultiPolygon":
        E = max(E.geoms, key=lambda g: g.area)
    if E.is_empty or E.area < 0.2 * P.area:
        E = P
    target = COVER_MAX * P.area
    if E.area > target and nb_edges:
        nb = shapely.union_all(nb_edges)
        lo, hi = 0.0, 10.0
        for _ in range(25):
            mid = (lo + hi) / 2
            Em = E.difference(nb.buffer(mid, cap_style=3))
            Em = max(Em.geoms, key=lambda g: g.area) if Em.geom_type == "MultiPolygon" else Em
            lo, hi = (mid, hi) if Em.area > target else (lo, mid)
        Em = E.difference(nb.buffer(hi, cap_style=3))
        E = max(Em.geoms, key=lambda g: g.area) if Em.geom_type == "MultiPolygon" else Em
    return E


def facade_points(E, Hb):
    hs = np.arange(RES / 2, Hb, RES) if Hb > RES else np.array([Hb / 2])
    ring = np.asarray(orient(E, 1.0).exterior.coords)
    X, Y, Hh, NZ = [], [], [], []
    for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:]):
        dx, dy = x2 - x1, y2 - y1
        L = np.hypot(dx, dy)
        if L < 1.0:
            continue
        nx, ny = dy / L, -dx / L
        n = max(1, int(L // RES))
        t = (np.arange(n) + 0.5) / n
        px, py = x1 + t * dx + nx * 0.05, y1 + t * dy + ny * 0.05
        nz = np.degrees(np.arctan2(nx, ny)) % 360
        for h in hs:
            X.append(px)
            Y.append(py)
            Hh.append(np.full(n, h))
            NZ.append(np.full(n, nz))
    return np.concatenate(X), np.concatenate(Y), np.concatenate(Hh), np.concatenate(NZ)


def obstacle_coords(cx, cy, geoms, heights):
    if len(geoms) == 0:
        return np.zeros(0), np.zeros(0), np.zeros(0)
    d0 = shapely.distance(geoms, shapely.Point(cx, cy))
    step = np.clip(d0 * 0.04, 0.25, 6.0)
    xy, idx = shapely.get_coordinates(shapely.segmentize(shapely.boundary(geoms), step), return_index=True)
    return xy[:, 0], xy[:, 1], heights[idx]


def horizon_at(px, py, ph, ox, oy, oh):
    P = len(px)
    beta = np.zeros((P, NSEC))
    if len(ox) == 0:
        return beta
    dx = ox[None, :] - px[:, None]
    dy = oy[None, :] - py[:, None]
    dist = np.hypot(dx, dy)
    dh = oh[None, :] - ph[:, None]
    ok = (dist > 0.05) & (dist <= 300) & (dh > 0)
    r, c = np.nonzero(ok)
    ang = np.degrees(np.arctan2(dh[r, c], dist[r, c]))
    s = sec_of(np.degrees(np.arctan2(dx[r, c], dy[r, c])) % 360)
    np.maximum.at(beta, (r, s), ang)
    return beta


def wall_svf(beta, nz):
    """Sky view of a vertical wall at each point, Dozier & Frew (1990), slope = 90 degrees
    (https://doi.org/10.1109/36.58986). Direction weight: cos of the angle between the sector and the
    wall's direction (sectors behind the wall count 0). Elevation weight: pi/2 - beta - sin(beta)cos(beta)
    instead of the ground's cos^2(beta). A fully open wall gives 0.5 (it sees half the sky).
    (Corrected from the first dataset version, which used the ground formula 1 - sin^2(beta).)"""
    c = np.clip(np.cos(np.radians(SEC_C[None, :] - nz[:, None])), 0, None)
    b = np.radians(beta)
    t = np.pi / 2 - b - np.sin(b) * np.cos(b)
    return 0.5 * (c * t).sum(axis=1) / (c.sum(axis=1) * np.pi / 2)


def site_mask(parcel, pc, geoms):
    if len(geoms) == 0:
        return np.zeros(0, bool)
    area = shapely.area(geoms)
    inter = shapely.area(shapely.intersection(geoms, parcel))
    frac = np.divide(inter, area, out=np.zeros_like(area), where=area > 0)
    site = (shapely.within(shapely.centroid(geoms), parcel) | (frac >= 0.5)
            | shapely.contains(geoms, pc) | (shapely.distance(geoms, pc) <= SITE_NEAR))
    if not site.any():
        cover = inter / parcel.area
        j = int(np.argmax(cover))
        if cover[j] > 0.10:
            site[j] = True
    return site


def radiation_for(
    P, row: dict, buildings, seasons: dict,
    sun_hours: pd.DataFrame | None = None, wind_f72: np.ndarray | None = None,
) -> dict:
    """Notebook row_3d: Rad_<season>_<dir> (kWh/m2 per season), Rad_block_<season>_<dir>,
    Shaded_Pct_<season>_<dir> (share of the sunlit-facing wall points in the neighbours' shade),
    and, for the website only, SVF_wall_<dir> (sky view of the wall, 0..1)."""
    G_ALL, H_ALL, HRAW_ALL, tree = buildings
    pc = P.centroid if P.contains(P.centroid) else P.representative_point()
    idx = tree.query(P.buffer(SEARCH_RADIUS), predicate="intersects")
    g, H = G_ALL[idx], H_ALL[idx]
    site = site_mask(P, pc, g)
    keep = ~site & (H > 0)
    ox, oy, oh = obstacle_coords(pc.x, pc.y, g[keep], H[keep])

    hr = HRAW_ALL[idx][site] if len(idx) else np.zeros(0)
    hr = hr[~np.isnan(hr)] if len(hr) else hr
    if site.any() and len(hr):
        E = shapely.union_all(g[site]).intersection(P.buffer(1.0))
        if E.geom_type == "MultiPolygon":
            E = max(E.geoms, key=lambda q: q.area)
        Hb, source = float(hr.max()), "measured_footprint"
        if E.is_empty or E.area < 20:
            E, source = envelope(P, row), "envelope_measured_h"
    else:
        E, Hb, source = envelope(P, row), H_DESIGN, "regulation_envelope"

    px, py, ph, nz = facade_points(E, Hb)
    B = horizon_at(px, py, ph, ox, oy, oh)
    svw = wall_svf(B, nz)
    fdir = dir_of(nz)
    out: dict = {"building_source": source, "building_height": Hb, "building": E}
    for sname, (alt, az, dni, dhi, days) in seasons.items():
        u = alt > 0
        alt_, az_, dni_ = alt[u], az[u], dni[u]
        lit = alt_[None, :] >= B[:, sec_of(az_)]
        th = np.clip(np.cos(np.radians(az_[None, :] - nz[:, None])) * np.cos(np.radians(alt_))[None, :], 0, None)
        rad = ((dni_[None, :] * th * lit).sum(axis=1) + svw * dhi.sum()) / 1000
        open_ = ((dni_[None, :] * th).sum(axis=1) + 0.5 * dhi.sum()) / 1000
        for j, d in enumerate(DIRS):
            m = fdir == j
            out[f"Rad_{sname}_{d}"] = float(rad[m].mean()) if m.any() else np.nan
            out[f"Rad_block_{sname}_{d}"] = float(1 - rad[m].sum() / open_[m].sum()) if m.any() else np.nan
        out[f"days_{sname}"] = days

    # shade on each wall: every daylight hour of the three days, at each point (notebook, unchanged;
    # a wall that never faces the sun that day counts as fully shaded = 1.0, as in the dataset)
    sun_hours = shade_hours() if sun_hours is None else sun_hours
    for sname, gS in sun_hours.groupby("season", sort=False):
        alt_, az_ = gS["alt"].to_numpy(), gS["az"].to_numpy()
        facing = adiff(az_[None, :], nz[:, None]) < 90
        shaded = alt_[None, :] < B[:, sec_of(az_)]
        for j, d in enumerate(DIRS):
            m = fdir == j
            if not m.any():
                out[f"Shaded_Pct_{sname}_{d}"] = np.nan
                continue
            f = facing[m].sum()
            out[f"Shaded_Pct_{sname}_{d}"] = float((facing[m] & shaded[m]).sum() / f) if f else 1.0

    # sky view of the plot (dataset column SVF): at ground level in the middle of the plot (notebook, unchanged)
    b0 = horizon_at(np.array([pc.x]), np.array([pc.y]), np.array([0.0]), ox, oy, oh)[0]
    out["SVF"] = float((1 - np.sin(np.radians(b0)) ** 2).mean())

    # sky view of each wall, for the website only (not a dataset column, the model does not use it):
    # wall_svf is at most 0.5 (a wall sees half the sky), so x 2 gives 0..1 (1 = nothing blocks the sky)
    for j, d in enumerate(DIRS):
        m = fdir == j
        out[f"SVF_wall_{d}"] = float(svw[m].mean()) * 2 if m.any() else np.nan

    # wind shelter of each wall, for the website only (not a dataset column, the model does not use it):
    # like WSI_Total (TOPEX, Ruel et al. 2002, weighted by the ERA5 wind frequency), but only the wind
    # that hits the wall: sectors in front of it (less than 90 degrees from the wall's direction, the
    # same rule as the shade). Degrees: 0 = fully exposed, larger = more sheltered by the neighbours.
    f72 = wind_sector_frequency() if wind_f72 is None else wind_f72
    front = (adiff(SEC_C[None, :], nz[:, None]) < 90) * f72[None, :]
    total = front.sum(axis=1)
    wind_pt = np.divide((front * B).sum(axis=1), total, out=np.full(len(total), np.nan), where=total > 0)
    for j, d in enumerate(DIRS):
        m = fdir == j
        out[f"Wind_block_{d}"] = float(np.nanmean(wind_pt[m])) if m.any() and np.isfinite(wind_pt[m]).any() else np.nan
    return out


# ------------------------------------------------------------------ neighbours (notebook: land use level 1 + nearest building)

MIN_EDGE, OUT_STEP, ACROSS_MAX = 2.0, 1.5, 150  # m, same as the notebook (level1)
TOUCH_TOL, SITE_OVERLAP, COVER_THRESHOLD = 0.05, 0.5, 0.10  # same as the notebook (compute_fixed)


def fetch_parcels_around(parcel) -> tuple[np.ndarray, np.ndarray]:
    """The Riyadh parcels around the plot (geometry + ParcelSub), for the adjoining and across land use."""
    w, s, e, n = parcel.buffer(ACROSS_MAX + 10).bounds
    geoms, subs, offset = [], [], 0
    while True:
        data = _get_json(PARCELS_URL, {
            "geometry": f"{w},{s},{e},{n}", "geometryType": "esriGeometryEnvelope", "inSR": METRIC_SR,
            "spatialRel": "esriSpatialRelIntersects", "where": "1=1", "outFields": "ParcelSub",
            "returnGeometry": "true", "outSR": METRIC_SR, "f": "json",
            "resultOffset": offset, "resultRecordCount": 2000,
        })
        feats = data.get("features", [])
        for f in feats:
            g = esri_to_shapely(f.get("geometry"))
            if g is not None and not g.is_empty:
                geoms.append(g)
                subs.append((f.get("attributes") or {}).get("ParcelSub") or "غير محدد")
        if not data.get("exceededTransferLimit") or not feats:
            break
        offset += len(feats)
    return np.array(geoms, dtype=object), np.array(subs, dtype=object)


def land_use_level1(P, ap_g: np.ndarray, ap_sub: np.ndarray) -> dict:
    """Notebook level1: for each edge, the adjoining parcel's use, or "شارع" and the parcel across the street."""
    tree = shapely.STRtree(ap_g) if len(ap_g) else None
    self_i = -1
    if tree is not None:
        idx = tree.query(P, predicate="intersects")
        if len(idx):
            iou = shapely.area(shapely.intersection(ap_g[idx], P)) / shapely.area(shapely.union(ap_g[idx], P))
            k = int(np.argmax(iou))
            self_i = int(idx[k]) if iou[k] > 0.8 else -1

    def parcel_at(pts):
        out = np.full(len(pts), -1)
        if tree is None:
            return out
        pi, gi = tree.query(pts, predicate="within")
        for p, g in zip(pi, gi):
            if g != self_i and out[p] == -1:
                out[p] = g
        return out

    ring = np.asarray(orient(P, 1.0).exterior.coords)
    best = {}
    for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:]):
        dx, dy = x2 - x1, y2 - y1
        L = np.hypot(dx, dy)
        if L < MIN_EDGE:
            continue
        nx, ny = dy / L, -dx / L
        d = DIRS[_sec(np.degrees(np.arctan2(nx, ny)) % 360)]
        t = np.linspace(0.15, 0.85, 7)
        bx, by = x1 + t * dx, y1 + t * dy
        hits = parcel_at(shapely.points(bx + nx * OUT_STEP, by + ny * OUT_STEP))
        if (hits >= 0).sum() >= 4:
            vals, cnt = np.unique(hits[hits >= 0], return_counts=True)
            nb, ac = ap_sub[vals[np.argmax(cnt)]], "لا يوجد"
        else:
            nb, ac = "شارع", "لا يوجد"
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            steps = np.arange(OUT_STEP + 1, ACROSS_MAX + 1, 1.0)
            h = parcel_at(shapely.points(mx + nx * steps, my + ny * steps))
            if (h >= 0).any():
                ac = ap_sub[h[np.argmax(h >= 0)]]
        if d not in best or L > best[d][0]:
            best[d] = (L, nb, ac)
    out = {}
    for d in DIRS:
        _, nb, ac = best.get(d, (0, "لا يوجد", "لا يوجد"))
        out[f"neighbor_use_{d}"], out[f"across_use_{d}"] = nb, ac
    return out


def neighbour_heights(P, buildings) -> float | None:
    """Mean height of the neighbouring buildings within 300 m of the plot (the plot's own building left out,
    the same buildings as the nearest neighbours; a building with no GBA height counts as 14 m, as in the dataset)."""
    G_ALL, H_ALL, _, tree = buildings
    pc = P.centroid if P.contains(P.centroid) else P.representative_point()
    idx = tree.query(P.buffer(SEARCH_RADIUS), predicate="intersects")
    g, h = G_ALL[idx], H_ALL[idx]
    if not len(g):
        return None
    area = shapely.area(g)
    inter = shapely.area(shapely.intersection(g, P))
    frac = np.divide(inter, area, out=np.zeros_like(area), where=area > 0)
    is_site = shapely.within(shapely.centroid(g), P) | (frac >= SITE_OVERLAP) | shapely.contains(g, pc)
    cover = inter / P.area
    if not is_site.any() and cover.max() > COVER_THRESHOLD:
        is_site[np.argmax(cover)] = True
    keep = (~is_site) & (h > 0) & (shapely.distance(g, P) <= SEARCH_RADIUS)
    return round(float(h[keep].mean()), 1) if keep.any() else None


def nearest_buildings(P, buildings) -> dict:
    """Notebook compute_fixed, nearest neighbour per direction: from the plot boundary, within 300 m
    (dist_<dir> = 300 and height_<dir> = 0 when there is none)."""
    G_ALL, H_ALL, _, tree = buildings
    out = {}
    for d in DIRS:
        out[f"dist_{d}"], out[f"height_{d}"] = float(SEARCH_RADIUS), 0.0
    pc = P.centroid if P.contains(P.centroid) else P.representative_point()
    idx = tree.query(P.buffer(SEARCH_RADIUS), predicate="intersects")
    g, h = G_ALL[idx], H_ALL[idx]
    if not len(g):
        return out
    area = shapely.area(g)
    inter = shapely.area(shapely.intersection(g, P))
    frac = np.divide(inter, area, out=np.zeros_like(area), where=area > 0)
    is_site = shapely.within(shapely.centroid(g), P) | (frac >= SITE_OVERLAP) | shapely.contains(g, pc)
    cover = inter / P.area
    if not is_site.any() and cover.max() > COVER_THRESHOLD:
        is_site[np.argmax(cover)] = True
    nb = (~is_site) & (h > 0)
    gn, hn = g[nb], h[nb]
    if not len(gn):
        return out
    db = shapely.distance(gn, P)
    line = shapely.shortest_line(P, gn)
    s0, e0 = shapely.get_point(line, 0), shapely.get_point(line, 1)
    dx = shapely.get_x(e0) - shapely.get_x(s0)
    dy = shapely.get_y(e0) - shapely.get_y(s0)
    touch = db <= TOUCH_TOL
    c, pcen = shapely.centroid(gn), P.centroid
    dx = np.where(touch, shapely.get_x(c) - pcen.x, dx)
    dy = np.where(touch, shapely.get_y(c) - pcen.y, dy)
    sec = ((np.degrees(np.arctan2(dx, dy)) % 360 + 22.5) % 360 // 45).astype(int)
    within = db <= SEARCH_RADIUS
    for k, d in enumerate(DIRS):
        m = within & (sec == k)
        if m.any():
            j = np.flatnonzero(m)[np.argmin(db[m])]
            out[f"dist_{d}"] = round(float(db[j]), 2)
            out[f"height_{d}"] = round(float(hn[j]), 1)
    return out


# ------------------------------------------------------------------ neighbours card (per side of the plot)

NEIGHBOUR_RADIUS = 300.0  # m in front of a side


def _sides(parcel, d: str) -> list:
    """The sides of the plot boundary that face direction d, with each side's outward normal (unit)."""
    p = max(parcel.geoms, key=lambda g: g.area) if parcel.geom_type == "MultiPolygon" else parcel
    ring = list(orient(p, 1.0).exterior.coords)
    out = []
    for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:]):
        dx, dy = x2 - x1, y2 - y1
        length = float(np.hypot(dx, dy))
        if length < 0.5:
            continue
        nx, ny = dy / length, -dx / length  # outward normal
        if DIRS[_sec(float(np.degrees(np.arctan2(nx, ny)) % 360))] == d:
            out.append(((x1, y1), (x2, y2), nx, ny))
    return out


def _corridor(a, b, nx, ny, reach: float) -> Polygon:
    """The area straight in front of a side (perpendicular to it), up to `reach` metres."""
    return Polygon([a, b, (b[0] + nx * reach, b[1] + ny * reach), (a[0] + nx * reach, a[1] + ny * reach)])


def side_distances(parcel, d: str, streets, buildings, reach: float = NEIGHBOUR_RADIUS) -> dict:
    """From the side of the plot facing d: the distance to the edge of the street in front of it,
    and to the nearest building in front of it with its height (NaN when there is none)."""
    out = {"dist_street": np.nan, "dist_bldg": np.nan, "bldg_h": np.nan}
    st_geom, st_wdet, st_tree = streets
    g_all, h_all, _, tree = buildings
    for a, b, nx, ny in _sides(parcel, d):
        seg = LineString([a, b])
        corridor = _corridor(a, b, nx, ny, reach)
        # 1) the street: its centre line inside the corridor; distance to its edge = to the centre line - half the width
        if st_tree is not None:
            idx = st_tree.query(corridor, predicate="intersects")
            if len(idx):
                part = shapely.intersection(st_geom[idx], corridor)
                dist = np.clip(shapely.distance(part, seg) - st_wdet[idx] / 2, 0, None)
                k = int(np.argmin(dist))
                if np.isnan(out["dist_street"]) or dist[k] < out["dist_street"]:
                    out["dist_street"] = round(float(dist[k]), 2)
        # 2) the buildings: any part inside the plot is left out (the plot's own house, or a merged GBA block),
        #    and the part in front of the side is measured
        idx = tree.query(corridor, predicate="intersects")
        if len(idx):
            part = shapely.intersection(shapely.difference(g_all[idx], parcel), corridor)
            ok = (shapely.area(part) >= 1.0) & (h_all[idx] > 0)  # under 1 m2 = drawing leftovers, not a building
            if ok.any():
                dist = shapely.distance(part[ok], seg)
                h = h_all[idx][ok]
                k = int(np.argmin(dist))
                if np.isnan(out["dist_bldg"]) or dist[k] < out["dist_bldg"]:
                    out["dist_bldg"], out["bldg_h"] = round(float(dist[k]), 2), round(float(h[k]), 1)
    return out


def street_index(st: pd.DataFrame):
    """The streets (centre lines and widths) with a spatial index, for side_distances."""
    if not len(st):
        return np.array([], dtype=object), np.array([]), None
    geoms = st["geometry"].to_numpy()
    return geoms, st["W_DETECT"].to_numpy(float), shapely.STRtree(geoms)


# ------------------------------------------------------------------ endpoint


def _clean(value):
    return None if value is None or (isinstance(value, float) and np.isnan(value)) else value


def facade_indicators(lat: float, lon: float) -> dict:
    from pyproj import Transformer

    to_m = Transformer.from_crs(4326, METRIC_SR, always_xy=True)
    x, y = to_m.transform(lon, lat)
    point = Point(x, y)
    parcel = fetch_parcel(point)
    if parcel is None:
        raise LookupError("No parcel at this point")
    st = street_table(fetch_streets(parcel))
    row = facades_for(parcel, st)
    buildings = gba_buildings()
    rad = radiation_for(parcel, row, buildings, epw_seasons())
    # the neighbours card: from each side of the plot, straight in front of it
    streets = street_index(st)
    sides = {d: side_distances(parcel, d, streets, buildings) for d in DIRS}
    adjoining = [s["bldg_h"] for s in sides.values() if not np.isnan(s["bldg_h"])]
    try:
        uses = land_use_level1(parcel, *fetch_parcels_around(parcel))
    except (OSError, RuntimeError):  # the land use is optional: without it the rest still loads
        uses = {f"{k}_{d}": None for d in DIRS for k in ("neighbor_use", "across_use")}

    facades = {}
    for d in DIRS:
        per_season = {}
        for season in SEASON_MONTHS:
            total = rad[f"Rad_{season}_{d}"]
            per_season[season.lower()] = {
                "total": _clean(round(total, 2) if not np.isnan(total) else np.nan),
                "perDay": _clean(round(total / rad[f"days_{season}"], 2) if not np.isnan(total) else np.nan),
                "blocked": _clean(round(rad[f"Rad_block_{season}_{d}"], 3) if not np.isnan(total) else np.nan),
            }
        facades[d] = {
            "onStreet": bool(row[f"facade_{d}"]),
            "streetWidth": _clean(row[f"street_width_{d}"] if row[f"facade_{d}"] else None),
            "radiation": per_season,
            "shade": {
                season.lower(): _clean(round(rad[f"Shaded_Pct_{season}_{d}"], 3)
                                       if not np.isnan(rad[f"Shaded_Pct_{season}_{d}"]) else np.nan)
                for season in SHADE_DAYS
            },
            "sky": _clean(round(rad[f"SVF_wall_{d}"], 3) if not np.isnan(rad[f"SVF_wall_{d}"]) else np.nan),
            "windBlock": _clean(round(rad[f"Wind_block_{d}"], 2) if not np.isnan(rad[f"Wind_block_{d}"]) else np.nan),
            "neighbours": {
                "use": uses[f"neighbor_use_{d}"],  # adjoining parcel use, "شارع", or "لا يوجد" (no edge this way)
                "across": uses[f"across_use_{d}"],  # use across the street, or "لا يوجد"
                "streetWidth": _clean(row[f"street_width_{d}"] if row[f"facade_{d}"] else None),
                "streetClass": row[f"street_class_{d}"] if row[f"facade_{d}"] else None,
                "streetName": row[f"street_name_{d}"] if row[f"facade_{d}"] else None,
                # m from this side of the plot to the edge of the street in front of it (None = no street)
                "streetDistance": _clean(sides[d]["dist_street"]),
                # the nearest building straight in front of this side: m from the side (300 = none), height (0 = none)
                "nearestDistance": NEIGHBOUR_RADIUS if np.isnan(sides[d]["dist_bldg"]) else sides[d]["dist_bldg"],
                "nearestHeight": 0.0 if np.isnan(sides[d]["bldg_h"]) else sides[d]["bldg_h"],
            },
        }
    return {
        "mainFacade": main_facade(parcel, row),
        "buildingSource": rad["building_source"],
        "buildingHeight": round(rad["building_height"], 2),
        "skyView": round(rad["SVF"], 3),  # dataset SVF: the plot's sky view at ground level, 0..1
        "site": {
            "summerMaxTemp": summer_max_temperature(),  # deg C, mean daily maximum in June-August (EPW)
            "avgHeight": neighbour_heights(parcel, buildings),  # m, all neighbouring buildings within 300 m
            "maxHeight": max(adjoining) if adjoining else None,  # m, tallest of the neighbours per direction
        },
        "facades": facades,
    }


@router.get("/facade-indicators")
def get_facade_indicators(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    try:
        return facade_indicators(latitude, longitude)
    except DataFileError as error:
        raise HTTPException(status_code=503, detail=str(error))
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except OSError as error:  # ArcGIS could not be reached
        raise HTTPException(status_code=502, detail=f"Data source unavailable: {error}")