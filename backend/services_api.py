"""Surrounding services API (الخدمات المحيطة).

Same calculation as the team's dataset notebook (Preparing_dataset, the "activities" cell):
  * places come from pois_riyadh_merged.parquet (Foursquare + OSM + Overture, duplicates removed),
  * each place has a group (grp): mosque, education, hospital, government, park, auto, nuisance, commercial,
  * for each group: n_<group>_800m = places within 800 m, dist_<group> = nearest distance,
  * distances are measured in EPSG:32638 (UTM 38N, meters).

Difference from the dataset: the notebook measures from the parcel boundary; the site only
sends a point (the selected location), so the distance is measured from that point.
When nothing is found within 800 m the notebook stores 800; here we return null.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely
from fastapi import APIRouter, HTTPException, Query
from pyproj import Transformer

RADIUS_M = 800  # same R as the notebook
METRIC_CRS = 32638  # same as the notebook
POIS_FILE = Path(os.environ.get("POIS_FILE", Path(__file__).parent / "data" / "pois_riyadh_merged.parquet"))

router = APIRouter()
_to_metric = Transformer.from_crs(4326, METRIC_CRS, always_xy=True)


@lru_cache(maxsize=1)
def _load():
    if not POIS_FILE.exists():
        raise FileNotFoundError(POIS_FILE)
    poi = gpd.read_parquet(POIS_FILE).to_crs(METRIC_CRS)
    geoms = poi.geometry.to_numpy()
    groups = poi["grp"].to_numpy(object)
    return geoms, groups, shapely.STRtree(geoms), sorted(set(groups))


def surrounding_services(lat: float, lon: float) -> dict:
    geoms, groups, tree, names = _load()
    x, y = _to_metric.transform(lon, lat)
    point = shapely.Point(x, y)
    idx = tree.query(point.buffer(RADIUS_M))
    dist = shapely.distance(geoms[idx], point) if len(idx) else np.array([])
    grp = groups[idx] if len(idx) else np.array([], dtype=object)

    out = {}
    for name in names:
        mask = (grp == name) & (dist <= RADIUS_M)
        out[name] = {
            "count": int(mask.sum()),
            "nearest": round(float(dist[mask].min()), 1) if mask.any() else None,
        }
    return {"radius": RADIUS_M, "services": out}


@router.get("/services")
def services(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    try:
        return surrounding_services(latitude, longitude)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail=f"Places file not found: {POIS_FILE.name}")
