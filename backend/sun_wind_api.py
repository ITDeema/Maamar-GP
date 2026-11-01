"""Sun path and wind for the results page, calculated the same way as the dataset notebook.

Add it to the app in main.py with two lines:
    from sun_wind_api import router as sun_wind_router
    app.include_router(sun_wind_router)

Endpoints
    GET /sunpath?latitude=&longitude=   hourly sun positions on 21 June, 21 March, 21 December
    GET /wind                           wind frequency per direction (ERA5-Land), same for every plot

Notebook rules that are kept on purpose
  Sun path ("Sun path and Shadow"):
    * year 2025, time zone Asia/Riyadh, one point per hour from 00:00 to 23:00
    * pvlib.solarposition.get_solarposition, altitude = "apparent_elevation", only points above the horizon
    * one fixed Riyadh point (24.71 N, 46.67 E) for every parcel, as in the dataset
      (set SUNPATH_USE_REQUEST_LOCATION=1 to use the plot's own coordinates instead)
  Wind ("Wind frequencies after leaving out calm hours"):
    * ERA5-Land hourly u10 / v10, the same CSV file the notebook reads
    * direction the wind comes FROM: (270 - degrees(arctan2(v, u))) % 360, eight 45-degree sectors
    * calm hours (speed < 0.5 m/s) are left out; frequency = share of the remaining hours, in percent
    * meanSpeed is an addition for the website (mean over all hours); the notebook does not use it
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import pvlib
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# ------------------------------------------------------------------ sun path

DATASET_LAT = 24.71
DATASET_LON = 46.67
TIMEZONE = "Asia/Riyadh"
YEAR = 2025

# key used by the frontend -> (month, day)
SEASON_DAYS: dict[str, tuple[int, int]] = {
    "summer": (6, 21),
    "equinox": (3, 21),
    "winter": (12, 21),
}


@lru_cache(maxsize=256)
def sun_path(lat: float = DATASET_LAT, lon: float = DATASET_LON) -> dict:
    """{"arcs": {"summer": [...], "equinox": [...], "winter": [...]}}, each point being
    {"hour": local hour 0-23, "azimuth": degrees clockwise from north, "altitude": degrees}."""
    arcs: dict[str, list[dict]] = {}
    for key, (month, day) in SEASON_DAYS.items():
        times = pd.date_range(
            f"{YEAR}-{month:02d}-{day:02d} 00:00", periods=24, freq="h", tz=TIMEZONE
        )
        position = pvlib.solarposition.get_solarposition(times, lat, lon)
        arcs[key] = [
            {"hour": int(hour), "azimuth": round(float(az), 3), "altitude": round(float(alt), 3)}
            for hour, az, alt in zip(times.hour, position["azimuth"], position["apparent_elevation"])
            if alt > 0
        ]
    return {"arcs": arcs}


# ------------------------------------------------------------------ wind

DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
CALM_THRESHOLD = 0.5  # m/s
_DEFAULT_CSV = "data/reanalysis-era5-land-timeseries-sfc-wind35kmvbe_.csv"


class WindDataError(RuntimeError):
    """The ERA5 wind file is missing or does not look like the notebook's file."""


def era5_csv_path() -> Path:
    path = Path(os.environ.get("ERA5_WIND_CSV", _DEFAULT_CSV))
    return path if path.is_absolute() else Path(__file__).resolve().parent / path


def wind_from_components(u, v) -> dict:
    """The notebook's calculation on u and v arrays (m/s)."""
    u = np.asarray(u, dtype=float)
    v = np.asarray(v, dtype=float)
    finite = np.isfinite(u) & np.isfinite(v)  # the notebook assumes a clean file; drop gaps if any
    u, v = u[finite], v[finite]
    if u.size == 0:
        raise WindDataError("The wind file has no valid rows")

    direction = (270 - np.degrees(np.arctan2(v, u))) % 360
    speed = np.hypot(u, v)
    calm = speed < CALM_THRESHOLD
    if calm.all():
        raise WindDataError("Every hour in the wind file is calm")

    sector = np.floor(((direction + 22.5) % 360) / 45).astype(int)
    frequencies = 100 * np.bincount(sector[~calm], minlength=8) / (~calm).sum()

    return {
        "frequencies": {d: round(float(f), 2) for d, f in zip(DIRECTIONS, frequencies)},
        "dominant": DIRECTIONS[int(np.argmax(frequencies))],
        "meanSpeed": round(float(speed.mean()), 1),
        "calmShare": round(float(100 * calm.mean()), 1),
        "hours": int(u.size),
    }


@lru_cache(maxsize=1)
def wind_stats() -> dict:
    """Read the ERA5 file once (it is one point for the whole city) and keep the result."""
    path = era5_csv_path()
    if not path.is_file():
        raise WindDataError(f"ERA5 wind file not found: {path.name}")

    era = pd.read_csv(path)
    era.columns = era.columns.str.strip().str.lower()
    u_cols = [c for c in era.columns if "u-component" in c or "u_component" in c or "u10" in c]
    v_cols = [c for c in era.columns if "v-component" in c or "v_component" in c or "v10" in c]
    if not u_cols or not v_cols:
        raise WindDataError("Could not find the u and v wind columns in the ERA5 file")

    return wind_from_components(era[u_cols[0]].to_numpy(), era[v_cols[0]].to_numpy())


# ------------------------------------------------------------------ routes


@router.get("/sunpath")
def get_sun_path(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
) -> dict:
    if os.environ.get("SUNPATH_USE_REQUEST_LOCATION") == "1":
        return sun_path(round(latitude, 3), round(longitude, 3))
    return sun_path(DATASET_LAT, DATASET_LON)  # like the dataset: one fixed point for Riyadh


@router.get("/wind")
def get_wind() -> dict:
    try:
        return wind_stats()
    except WindDataError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
