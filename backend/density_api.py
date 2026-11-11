import csv
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/density", tags=["Density"])

CSV_PATH = Path(__file__).resolve().parent / "data" / "Density.csv"


def normalize_name(name: str) -> str:
    """Normalize Arabic neighborhood names for matching ("حي الملقا" and "الملقا" are the same)."""
    name = name.strip()
    if name.startswith("حي "):
        name = name[3:].strip()
    return (
        name
        .replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ى", "ي")
        .replace("ـ", "")
    )


def find_density(neighborhood: str):
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as file:
        sample = file.read(2048)
        file.seek(0)
        delimiter = ";" if sample.count(";") > sample.count(",") else ","

        reader = csv.DictReader(file, delimiter=delimiter)

        for row in reader:
            name = row["HARA_NAME"].strip()

            if normalize_name(name) == normalize_name(neighborhood):
                return {
                    "neighborhood": name,
                    "density": float(row["DENSITY_KM2"]),
                    "level": row["DENSITY_LEVEL"].strip().upper(),
                }

    return None


@router.get("")
def get_density(
    neighborhood: str = Query(..., min_length=1),
):
    try:
        result = find_density(neighborhood)
    except (OSError, KeyError, ValueError) as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to read density data",
        ) from error

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Neighborhood density not found",
        )

    return result