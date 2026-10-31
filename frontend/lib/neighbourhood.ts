import type { Facade, Level, Tone } from "@/lib/analysis-detail";

/* ---------- gauges (noise and density) ---------- */

// Noise (dB) levels. These thresholds are a first guess, adjust them with the team.
export function noiseLevelOf(db: number): Level {
  return db < 50 ? "low" : db < 60 ? "medium" : "high";
}

export function densityLevelOf(density: number): Level {
  return density < 0.35 ? "low" : density < 0.6 ? "medium" : "high";
}

// For noise and density, a higher level is worse.
export function badnessTone(level: Level): Tone {
  return level === "low" ? "success" : level === "medium" ? "caution" : "danger";
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// Needle position, 0 (far left) to 1 (far right). Noise is drawn from 35 to 75 dB.
export function noiseFraction(db: number): number {
  return clamp((db - 35) / 40);
}

export function densityFraction(density: number): number {
  return clamp(density);
}

/* ---------- neighbours of the selected façade ---------- */

export type NeighbourKind = "street" | "villa" | "building" | "land";
export type Neighbour = { kind: NeighbourKind; height: number | null; distance: number }; // m

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
