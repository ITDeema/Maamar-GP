import type { Facade, Level, Tone } from "@/lib/analysis-detail";
import type { FacadeNeighbours } from "@/lib/site-api";

/* ---------- gauges (noise and density) ---------- */

export function densityLevelOf(
  density: number,
  densityLevel?: "L" | "M" | "H" | null,
): Level {
  if (densityLevel === "L") return "low";
  if (densityLevel === "M") return "medium";
  if (densityLevel === "H") return "high";

  return density <= 4000 ? "low" : density <= 10000 ? "medium" : "high";
}

// For noise and density, a higher level is worse.
export function badnessTone(level: Level): Tone {
  return level === "low" ? "success" : level === "medium" ? "caution" : "danger";
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// Needle position, 0 (far left) to 1 (far right). The noise level points at the middle of its colored arc.
export function noiseFraction(level: Level): number {
  return level === "low" ? 0.17 : level === "medium" ? 0.5 : 0.83;
}

export function densityFraction(density: number): number {
  const min = 100;
  const max = 20000;

  return clamp((density - min) / (max - min));
}

/* ---------- neighbours of the selected façade ---------- */

export type NeighbourKind =
  | "street"
  | "villa"
  | "building"
  | "land"
  // land uses of the Riyadh parcels (ParcelSub), as in the dataset
  | "residential"
  | "commercial"
  | "public_services"
  | "public_utilities"
  | "mixed_use"
  | "industrial"
  | "agricultural"
  | "unplanned"
  | "historic"
  | "unknown";
export type Neighbour = { kind: NeighbourKind; height: number | null; distance: number | null }; // m

const KIND_ORDER: NeighbourKind[] = ["street", "villa", "building", "land"];

// TEMPORARY MOCK. Replace with the real request when the API exists.
// Only the kinds that exist next to a façade are listed, so the table never shows empty rows.
const MOCK_NEIGHBOURS: Record<Facade, Neighbour[]> = {
  north: [
    { kind: "street", height: null, distance: 15 },
    { kind: "building", height: 12.5, distance: 2 },
  ],
  east: [
    { kind: "street", height: null, distance: 12 },
    { kind: "villa", height: 9, distance: 1.5 },
  ],
  south: [
    { kind: "street", height: null, distance: 20 },
    { kind: "villa", height: 9, distance: 3 },
    { kind: "building", height: 12.5, distance: 4 },
  ],
  west: [
    { kind: "land", height: null, distance: 6 },
    { kind: "building", height: 12.5, distance: 2 },
  ],
  northeast: [
    { kind: "street", height: null, distance: 18 },
    { kind: "building", height: 12.5, distance: 3 },
  ],
  southeast: [
    { kind: "street", height: null, distance: 16 },
    { kind: "villa", height: 9, distance: 2.5 },
  ],
  southwest: [
    { kind: "street", height: null, distance: 17 },
    { kind: "land", height: null, distance: 8 },
  ],
  northwest: [
    { kind: "villa", height: 9, distance: 2 },
    { kind: "building", height: 12.5, distance: 3 },
  ],
};

// The dataset's land use names (ParcelSub) -> neighbour kinds.
const LAND_USE: Record<string, NeighbourKind> = {
  "سكني": "residential",
  "تجاري": "commercial",
  "خدمات عامة": "public_services",
  "مرافق عامة": "public_utilities",
  "متعددة الاستخدام": "mixed_use",
  "صناعي": "industrial",
  "زراعي": "agricultural",
  "غير مخططه": "unplanned",
  "معالم تاريخية": "historic",
  "أرض فضاء": "land",
};
const kindOf = (use: string): NeighbourKind => LAND_USE[use.trim()] ?? "unknown";

// The real neighbours of one façade, from the dataset columns of its direction:
// the street (and what is across it) or the adjoining parcel, with the nearest building's height and distance.
// "noWall" when the plot has no edge facing this way (the dataset's "لا يوجد").
export function neighboursFrom(data: FacadeNeighbours): Neighbour[] | "noWall" {
  if (!data.use || data.use === "لا يوجد") return "noWall";
  const hasBuilding = data.nearestHeight > 0 && data.nearestDistance < 300;
  const building = {
    height: hasBuilding ? data.nearestHeight : null,
    distance: hasBuilding ? data.nearestDistance : null,
  };
  if (data.use === "شارع") {
    // the street's distance: from this side of the plot to the edge of the street in front of it
    const rows: Neighbour[] = [{ kind: "street", height: null, distance: data.streetDistance ?? null }];
    if (data.across && data.across !== "لا يوجد") rows.push({ kind: kindOf(data.across), ...building });
    return rows;
  }
  return [{ kind: kindOf(data.use), ...building }];
}

export function neighboursFor(facade: Facade): Neighbour[] {
  return [...MOCK_NEIGHBOURS[facade]].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
}

/* ---------- nearest services ---------- */

// Same groups as the dataset notebook (the other groups, auto and nuisance, are not shown to homeowners).
export const SERVICE_KINDS = ["mosque", "education", "hospital", "commercial", "park", "government"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];
export type Service = { kind: ServiceKind; distance: number | null; count: number }; // m, null = none within 800 m