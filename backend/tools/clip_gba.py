"""Makes data/gba_riyadh.parquet once: the GBA buildings (height + footprint) around Riyadh.

The two GBA tiles are large (a few GB), so the backend reads this smaller file instead.
Same tiles and reading as the dataset notebook (Preparing_dataset, the GBA cell).

Run from the backend folder:
    python tools/clip_gba.py                    # downloads the two tiles into data/gba_tiles/
    python tools/clip_gba.py path/to/tiles      # or uses tiles you already have (e.g. from Drive: Mammar/GBA)
"""
from __future__ import annotations

import sys
from pathlib import Path
import urllib.request

import geopandas as gpd
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import shapely

BASE_URL = "https://data.source.coop/tge-labs/globalbuildingatlas-lod1"
TILES = ["e045_n25_e050_n20.parquet", "e045_n30_e050_n25.parquet"]
# Riyadh, with a margin for the 300 m search around plots near the edge (degrees)
WEST, SOUTH, EAST, NORTH = 46.15, 24.25, 47.35, 25.25

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "data" / "gba_riyadh.parquet"


def main() -> None:
    tiles_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "data" / "gba_tiles"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    parts = []
    for name in TILES:
        local = tiles_dir / name
        if not local.exists():
            print(f"downloading {name} ...")
            urllib.request.urlretrieve(f"{BASE_URL}/{name}", local)
        for batch in pq.ParquetFile(local).iter_batches(batch_size=200_000, columns=["height", "geometry"]):
            geoms = shapely.from_wkb(batch.column("geometry").to_numpy(zero_copy_only=False))
            heights = batch.column("height").to_numpy(zero_copy_only=False)
            b = shapely.bounds(geoms)
            with np.errstate(invalid="ignore"):
                keep = (b[:, 2] >= WEST) & (b[:, 0] <= EAST) & (b[:, 3] >= SOUTH) & (b[:, 1] <= NORTH)
            if keep.any():
                parts.append(gpd.GeoDataFrame({"height": np.asarray(heights[keep], dtype=float)},
                                              geometry=geoms[keep], crs="EPSG:4326"))
        print(f"{name}: done")
    gba = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), geometry="geometry", crs="EPSG:4326")
    gba.to_parquet(OUT)
    print(f"saved {len(gba):,} buildings to {OUT} ({OUT.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
