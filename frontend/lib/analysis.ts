import type { LatLng } from "@/lib/geo";
import type { Lang } from "@/lib/i18n";
import { fetchStreetsAround, findFacades, streetsForPlot } from "@/lib/plot-facade";
import type { Facade } from "@/lib/plot-facade";
import { pointKey, shared } from "@/lib/shared-request";

/*
 * TEMPORARY MOCK DATA LAYER.
 * Every function here pretends to be the backend. When the API exists,
 * replace the bodies of lookupPlot() and runAnalysis() with real requests.
 * The screens will not need to change.
 */

export const USE_MOCK_DATA = true;

/* ---------- plot lookup ---------- */

export type Direction8 =
  | "north"
  | "northEast"
  | "east"
  | "southEast"
  | "south"
  | "southWest"
  | "west"
  | "northWest";

// The neighborhood is real: it comes from OpenStreetMap (Nominatim reverse geocoding), in the screen language.
// When Nominatim gives no neighborhood, Photon (another OpenStreetMap service) is asked.
// null means neither could find it for this point.
const NEIGHBORHOOD_KEYS = ["neighbourhood", "suburb", "quarter", "city_district"] as const;

// "Al Malqa District" → "Al Malqa", "حي الملقا" → "الملقا": only the name of the neighborhood is shown
function cleanNeighborhood(name: string): string {
  return (
    name
      .replace(/^\s*district\s+/i, "")
      .replace(/\s+district\s*$/i, "")
      .replace(/^\s*حي\s+/, "")
      .trim() || name
  );
}

// Shared, so the plot page, the analysis and the results ask Nominatim only once per point.
export function fetchNeighborhood(point: LatLng, lang: Lang): Promise<string | null> {
  return shared(`neighborhood:${lang}:${pointKey(point.lat, point.lng)}`, () => loadNeighborhood(point, lang));
}

async function loadNeighborhood(point: LatLng, lang: Lang): Promise<string | null> {
  return (await fromNominatim(point, lang)) ?? (await fromPhoton(point, lang));
}

async function fromNominatim(point: LatLng, lang: Lang): Promise<string | null> {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1" +
    `&lat=${point.lat}&lon=${point.lng}&accept-language=${lang}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string | undefined> };
    for (const key of NEIGHBORHOOD_KEYS) {
      const name = data.address?.[key];
      if (name) return cleanNeighborhood(name);
    }
    return null;
  } catch {
    return null;
  }
}

// Photon has no Arabic option: without "lang" it gives the local names, which in Riyadh are Arabic.
const PHOTON_KEYS = ["district", "locality", "suburb"] as const;

async function fromPhoton(point: LatLng, lang: Lang): Promise<string | null> {
  const url =
    `https://photon.komoot.io/reverse?lat=${point.lat}&lon=${point.lng}&limit=1` + (lang === "en" ? "&lang=en" : "");
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { properties?: Record<string, string | undefined> }[] };
    const props = data.features?.[0]?.properties;
    for (const key of PHOTON_KEYS) {
      const name = props?.[key];
      if (name) return cleanNeighborhood(name);
    }
    return null;
  } catch {
    return null;
  }
}

export type PlotInfo = {
  width: number; // meters
  depth: number; // meters
  area: number; // square meters
  outline: LatLng[] | null; // the real plot boundary, when the parcel was found
  orientation: Direction8 | null; // the main facade; null when the plot was not found
  landUse: string | null; // the plot's use in the Riyadh parcels layer (ParcelSub), e.g. "سكني"; null when unknown
};

// Only residential plots are analyzed. A plot with several uses is accepted when one of them is residential
// (e.g. "سكني تجاري"), and so is a plot with no use recorded; "متعددة الاستخدام", commercial and the other uses are not.
export function isResidential(landUse: string | null): boolean {
  return landUse === null || landUse.includes("سكني");
}

function hashPoint(point: LatLng): number {
  const text = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

// The real plot under the point, from the Riyadh parcels layer (ArcGIS):
// its land area and its boundary. Same request as the dataset notebook, plus the boundary.
// Returns null when no parcel is found.
const PARCELS_URL =
  "https://services-ap1.arcgis.com/if9krLUYaMWhxyMO/ArcGIS/rest/services/Riyadh_Parcel/FeatureServer/0/query";

type Parcel = { area: number; outline: LatLng[] | null; landUse: string | null };
type ParcelFeature = { attributes?: { Area?: unknown; ParcelSub?: unknown }; geometry?: { rings?: number[][][] } };

async function fetchParcel(point: LatLng): Promise<Parcel | null> {
  const params = new URLSearchParams({
    geometry: `${point.lng},${point.lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "Area,ParcelSub",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });
  try {
    const res = await fetch(`${PARCELS_URL}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: ParcelFeature[] };
    return pickParcel(point, data.features ?? []);
  } catch {
    return null;
  }
}

// Several parcels can touch the same point (an original land and the smaller plots
// it was divided into, or two plots sharing a border). Keep only the parcels whose
// boundary really contains the point, and take the smallest one: that is the plot clicked.
function insideRing(point: LatLng, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pickParcel(point: LatLng, features: ParcelFeature[]): Parcel | null {
  let best: Parcel | null = null;
  for (const feature of features) {
    const area = Number(feature.attributes?.Area);
    // the first ring is the outer boundary; ArcGIS gives [longitude, latitude] pairs
    const ring = feature.geometry?.rings?.[0];
    if (!Number.isFinite(area) || area <= 0 || !ring || ring.length < 4) continue;
    if (!insideRing(point, ring)) continue;
    if (!best || area < best.area) {
      const use = feature.attributes?.ParcelSub;
      best = {
        area: Math.round(area),
        outline: ring.map(([lng, lat]) => ({ lat, lng })),
        landUse: typeof use === "string" && use.trim() !== "" ? use.trim() : null,
      };
    }
  }
  return best;
}

const FACADE_DIRECTION: Record<Facade, Direction8> = {
  N: "north",
  NE: "northEast",
  E: "east",
  SE: "southEast",
  S: "south",
  SW: "southWest",
  W: "west",
  NW: "northWest",
};

// Looks up the plot under a point: its real land area, boundary and main facade
// (the facade on the widest street, found the same way as the dataset notebook).
// The area falls back to a sample value when no parcel is found at the point.
// The neighborhood is loaded separately (fetchNeighborhood) so a slow answer there
// never delays drawing the plot.
// Shared: the plot page looks it up once, and the results page reuses it.
export function lookupPlot(point: LatLng): Promise<PlotInfo> {
  return shared(`plot:${pointKey(point.lat, point.lng)}`, () => loadPlot(point));
}

async function loadPlot(point: LatLng): Promise<PlotInfo> {
  // the streets around the point load at the same time as the plot
  const [parcel, nearbyStreets] = await Promise.all([fetchParcel(point), fetchStreetsAround(point)]);
  const parcelArea = parcel?.area ?? null;
  const hash = hashPoint(point);
  const sampleWidth = 16 + (hash % 13);
  const sampleDepth = 20 + ((hash >>> 4) % 12);
  const area = parcelArea ?? Math.round(sampleWidth * sampleDepth);
  // the plot drawn on the map keeps the same proportions as the results page (depth = 1.15 × width)
  const width = parcelArea ? Math.round(Math.sqrt(parcelArea / 1.15) * 10) / 10 : sampleWidth;
  const depth = parcelArea ? Math.round(width * 1.15 * 10) / 10 : sampleDepth;

  let orientation: Direction8 | null = null;
  if (parcel?.outline) {
    const streets = await streetsForPlot(point, parcel.outline, nearbyStreets);
    const { main } = findFacades(parcel.outline, streets ?? []);
    orientation = main ? FACADE_DIRECTION[main] : null;
  }

  return { width, depth, area, outline: parcel?.outline ?? null, orientation, landUse: parcel?.landUse ?? null };
}

/* ---------- running an analysis ---------- */

export type AnalysisStep = "environment" | "buildings" | "model" | "compliance";

export const ANALYSIS_STEPS: AnalysisStep[] = [
  "environment",
  "buildings",
  "model",
  "compliance",
];

export type AnalysisInput = {
  lat: number;
  lng: number;
  area: number;
  demo?: string | null; // "fail" simulates a data source that cannot be reached
  data?: Promise<unknown>; // the real calculation, started when the user pressed "start analysis"
};

export class AnalysisError extends Error {
  step: AnalysisStep;
  constructor(step: AnalysisStep) {
    super(`Analysis failed at step: ${step}`);
    this.step = step;
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

// Runs the analysis. Calls onStep(i) when step i starts.
// The real calculation (input.data) runs from the start; the steps only show progress,
// and the last step ends when the calculation is done, so the results page opens with its data ready.
// A calculation that fails does not stop the analysis: the results page shows that section's own error.
export async function runAnalysis(
  input: AnalysisInput,
  onStep: (index: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const data = (input.data ?? Promise.resolve()).catch(() => undefined);
  const last = ANALYSIS_STEPS.length - 1;
  for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
    onStep(i);
    await wait(600, signal);
    if (input.demo === "fail" && i === 1) throw new AnalysisError(ANALYSIS_STEPS[i]);
    if (i === last) await Promise.race([data, wait(120_000, signal)]);
  }
}