"""Road noise level for the results page (منخفض / متوسط / عالي).

The dataset notebook (Preparing_dataset, "noise_row") does not estimate decibels. It measures, for the plot:
  * dist_road_<class>  distance from the plot to the EDGE of the nearest road of each class
                       (distance to the road line minus half its width, never below 0, empty after 1000 m)
  * len_<class>_<R>m   length of the roads of that class inside buffers of 50, 100, 200, 300, 500, 1000 m
for the classes motorway, arterial, main, collector, local, footway (rail: distance only), from the
Streets_NEW layer (SUBTYPECLASS), road width = STREETWIDTH or the median width of its class.
This file calculates the same measures, then adds ONE rule to turn them into a level.

!! The level rule (THRESHOLDS below) is NOT in the notebook. It is a first proposal that uses only the
!! distance to the nearest road of each class. The team should confirm or change the numbers.

Endpoint
    GET /noise?latitude=&longitude=
        {"level": "low" | "medium" | "high", "reason": {"class": ..., "distance": ...} | null,
         "distances": {class: metres or null}, "lengths": {class: {"50": m, ...}}}
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import shapely
from fastapi import APIRouter, HTTPException, Query
from shapely.geometry import LineString, Point

from facade_indicators_api import METRIC_SR, STREETS_URL, _get_json, fetch_parcel

router = APIRouter()

# Same as the notebook
BUFFERS = [50, 100, 200, 300, 500, 1000]  # m (Helbich et al., table 1)
MAXD = 1000  # m, farther than this the distance stays empty
CLASSES = {
    "motorway": ["طريق سريع"],
    "arterial": ["طريق رئيسي"],
    "main": ["شارع رئيسي"],
    "collector": ["شارع مجمع"],
    "local": ["شارع فرعي"],
    "footway": ["ممر مشاه", "ممر"],
    "rail": ["سكة حديد"],
}

# Level rule (a proposal, see the top of the file): the plot is at a level when a road of that class
# is at most this far (metres, from the road edge). "high" is checked first, then "medium".
THRESHOLDS = {
    "high": {"motorway": 150, "arterial": 100, "main": 50},
    "medium": {"motorway": 400, "arterial": 250, "main": 120, "collector": 50},
}


def fetch_roads(parcel) -> list[dict]:
    w, s, e, n = parcel.buffer(max(BUFFERS) + 20).bounds
    data = _get_json(STREETS_URL, {
        "geometry": f"{w},{s},{e},{n}", "geometryType": "esriGeometryEnvelope", "inSR": METRIC_SR,
        "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
        "outFields": "STREETWIDTH,SUBTYPECLASS", "returnGeometry": "true", "outSR": METRIC_SR, "f": "json",
    })
    return data.get("features", [])


def road_table(features: list[dict]) -> pd.DataFrame:
    rows = []
    for f in features:
        a = f.get("attributes") or {}
        paths = [p for p in (f.get("geometry") or {}).get("paths", []) if len(p) >= 2]
        if not paths:
            continue
        geom = LineString(paths[0]) if len(paths) == 1 else shapely.MultiLineString(paths)
        rows.append({"STREETWIDTH": a.get("STREETWIDTH"), "SUBTYPECLASS": a.get("SUBTYPECLASS"), "geometry": geom})
    st = pd.DataFrame(rows, columns=["STREETWIDTH", "SUBTYPECLASS", "geometry"])
    st["STREETWIDTH"] = pd.to_numeric(st["STREETWIDTH"], errors="coerce")
    median = st.groupby("SUBTYPECLASS")["STREETWIDTH"].median()
    # the notebook: the recorded width, else the median of its class, else 0
    st["W"] = st["STREETWIDTH"].fillna(st["SUBTYPECLASS"].map(median)).fillna(0)
    return st


def noise_measures(parcel, roads: pd.DataFrame) -> dict:
    """The same measures as noise_row in the notebook."""
    rings = {R: parcel.buffer(R) for R in BUFFERS}
    distances: dict[str, float | None] = {}
    lengths: dict[str, dict[str, float]] = {}
    for k, subs in CLASSES.items():
        s = roads[roads["SUBTYPECLASS"].isin(subs)]
        g = s.geometry.to_numpy()
        if len(g):
            dist = np.clip(shapely.distance(g, parcel) - s["W"].to_numpy(float) / 2, 0, None)
            dmin = float(dist.min())
            distances[k] = round(dmin, 1) if dmin <= MAXD else None
        else:
            distances[k] = None
        if k == "rail":
            continue  # the rail: distance only, as in the notebook
        lengths[k] = {
            str(R): round(float(shapely.length(shapely.intersection(g, rings[R])).sum()), 1) if len(g) else 0.0
            for R in BUFFERS
        }
    return {"distances": distances, "lengths": lengths}


def noise_level(distances: dict[str, float | None]) -> tuple[str, dict | None]:
    for level in ("high", "medium"):
        for road_class, limit in THRESHOLDS[level].items():
            d = distances.get(road_class)
            if d is not None and d <= limit:
                return level, {"class": road_class, "distance": d}
    return "low", None


def noise_for(lat: float, lon: float) -> dict:
    from pyproj import Transformer

    x, y = Transformer.from_crs(4326, METRIC_SR, always_xy=True).transform(lon, lat)
    parcel = fetch_parcel(Point(x, y))
    if parcel is None:
        raise LookupError("No parcel at this point")
    measures = noise_measures(parcel, road_table(fetch_roads(parcel)))
    level, reason = noise_level(measures["distances"])
    return {"level": level, "reason": reason, **measures}


@router.get("/noise")
def get_noise(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    try:
        return noise_for(latitude, longitude)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except OSError as error:  # ArcGIS could not be reached
        raise HTTPException(status_code=502, detail=f"Data source unavailable: {error}")
