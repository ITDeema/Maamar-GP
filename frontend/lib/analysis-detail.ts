/*
 * TEMPORARY MOCK DATA for the results dashboard.
 * When the API exists, replace fetchIndicators() and getConstraints()
 * with real requests. The dashboard will not need to change.
 */

import { fetchDensity, fetchFacadeIndicators, fetchNoise, fetchWind } from "@/lib/site-api";import type { FacadeNeighbours, NoiseRoadClass, WindDirection } from "@/lib/site-api";
import { fetchNeighborhood } from "@/lib/analysis";
// The four sides of the plot. Setbacks are set per side.
export type Side = "north" | "east" | "south" | "west";
export const SIDES: Side[] = ["north", "east", "south", "west"];

// The eight directions a façade can face, clockwise from north.
export type Facade = Side | "northeast" | "southeast" | "southwest" | "northwest";
export const FACADES: Facade[] = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
];

export function isSide(facade: Facade): facade is Side {
  return (SIDES as Facade[]).includes(facade);
}

const WIND_FACADE: Record<WindDirection, Facade> = {
  N: "north", NE: "northeast", E: "east", SE: "southeast",
  S: "south", SW: "southwest", W: "west", NW: "northwest",
};

export type FacadeIndicators = {
  radiation: number | null; // kWh/m²/day in summer (June–August); null when no wall faces this way
  shade: number | null; // 0..1 share of the façade shaded by neighbours, summer (21 June); null when no wall
  wind: number | null; // degrees, wind shelter of the wall (0 = fully exposed to the wind that hits it); null when no wall
  sky: number | null; // 0..1, sky view of the wall (SVF_wall, 1 = nothing blocks the sky); null when no wall
};
export type MetricKey = keyof FacadeIndicators;
export const METRICS: MetricKey[] = ["radiation", "shade", "wind", "sky"];

export type SiteIndicators = {
  windSpeed: number; // m/s
  windFrom: Facade;
  temperature: number; // °C, mean daily maximum in summer (June–August)
  density: number | null; // Population density: people/km²
  densityLevel?: "L" | "M" | "H" | null;
  avgHeight: number | null; // m, mean of the neighbouring buildings within 300 m; null when none
  maxHeight: number | null; // m, tallest of the neighbours per direction; null when none
  noise: Level | null; // road noise level; null when it could not be loaded
  noiseReason?: { roadClass: NoiseRoadClass; distance: number } | null; // the road that decided it (m)
};

export type IndicatorsData = {
  // True only when the wind, the façade indicators and the noise all came from the backend.
  // Only a complete analysis is saved in the database (sample values are never saved as real ones).
  complete?: boolean;
  facades: Record<Facade, FacadeIndicators>;
  site: SiteIndicators;
  neighbours: Record<Facade, FacadeNeighbours> | null; // null until the backend answers (the card shows samples)
};


export type DecisionCode =
  | "orientation"
  | "windows"
  | "shading"
  | "garden"
  | "materials";

export const DECISIONS: DecisionCode[] = [
  "orientation",
  "windows",
  "shading",
  "garden",
  "materials",
];

export type Constraints = {
  maxCoverage: number; // %
  maxHeight: number; // m
  setbacks: Record<Side, number>; // m
};

/* ---------- mock generators ---------- */

// The four diagonal directions sit between their two neighbours.
const BASE: Record<Facade, FacadeIndicators> = {
  north: { radiation: 1.3, shade: 0.62, wind: 12, sky: 0.95 },
  northeast: { radiation: 2.1, shade: 0.48, wind: 10, sky: 0.95 },
  east: { radiation: 2.6, shade: 0.35, wind: 8, sky: 0.95 },
  southeast: { radiation: 2.0, shade: 0.26, wind: 7, sky: 0.95 },
  south: { radiation: 1.2, shade: 0.18, wind: 6, sky: 0.95 },
  southwest: { radiation: 2.0, shade: 0.2, wind: 7, sky: 0.95 },
  west: { radiation: 2.6, shade: 0.22, wind: 9, sky: 0.95 },
  northwest: { radiation: 2.1, shade: 0.42, wind: 11, sky: 0.95 },
};

function seed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

// A small, repeatable variation so each analysis looks a little different.
function jitter(hash: number, slot: number, spread: number): number {
  return (((hash >>> (slot * 3)) % 100) / 100) * spread - spread / 2;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, digits: number) => Number(value.toFixed(digits));

export function buildIndicators(id: string): IndicatorsData {
  const hash = seed(id);
  const facades = {} as Record<Facade, FacadeIndicators>;
  FACADES.forEach((facade, i) => {
    const base = BASE[facade];
    facades[facade] = {
      radiation: round((base.radiation ?? 0) + jitter(hash, i, 0.3), 1),
      shade: round(clamp01((base.shade ?? 0) + jitter(hash, i + 4, 0.08)), 2),
      wind: round(Math.max(0, (base.wind ?? 0) + jitter(hash, i + 1, 4)), 1),
      sky: round(clamp01((base.sky ?? 0) + jitter(hash, i + 2, 0.04)), 2),
    };
  });
  return {
    facades,
    neighbours: null,
    site: {
      windSpeed: round(3.4 + jitter(hash, 1, 1), 1),
      windFrom: "north",
      temperature: round(43 + jitter(hash, 2, 1), 1),
      density: round(clamp01(0.42 + jitter(hash, 3, 0.2)), 2),
      avgHeight: round(6.5 + jitter(hash, 4, 2), 1),
      maxHeight: round(14 + jitter(hash, 5, 4), 1),
      noise: null, // never a sample value: the real level comes from the backend
    },
  };
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

// Loaded separately from the rest of the dashboard, so a failure here
// shows an error only inside the indicators section.
export async function fetchIndicators(
  id: string,
  options: { fail: boolean; signal: AbortSignal; lat?: number; lng?: number },
): Promise<IndicatorsData> {
  await wait(700, options.signal);
  if (options.fail) throw new Error("Indicators could not be loaded");
    const data = buildIndicators(id);
    // Do not show the mock density as real population data.
     data.site.density = null;
    data.site.densityLevel = null;
    let windOk = false;
    let facadesOk = false;
    let noiseOk = false;

  // The wind is real: it comes from our backend (ERA5-Land). If the backend is
  // not running we keep the sample values, and the rest of the dashboard still works.
  try {
    const wind = await fetchWind(options.signal);
    data.site.windFrom = WIND_FACADE[wind.dominant];
    data.site.windSpeed = wind.meanSpeed;
    windOk = true;
  } catch (error) {
    if (options.signal.aborted) throw error;
    console.warn("Wind error:", error);
  }
  
  // Population density: match the selected plot to its Arabic neighborhood.
  if (options.lat !== undefined && options.lng !== undefined) {
    try {
      const neighborhood = await fetchNeighborhood(
        { lat: options.lat, lng: options.lng },
        "ar"
      );

      if (neighborhood) {
        const result = await fetchDensity(
          neighborhood,
          options.signal
        );

        data.site.density = result.density;
        data.site.densityLevel = result.level;
      }
    } catch (error) {
      if (options.signal.aborted) throw error;
      console.warn("Density error:", error);
    }
  }


  // Road noise level: real, from our backend (the same road measures as the dataset).
  if (options.lat !== undefined && options.lng !== undefined) {
    try {
      const noise = await fetchNoise(options.lat, options.lng, options.signal);
      data.site.noise = noise.level;
      data.site.noiseReason = noise.reason
        ? { roadClass: noise.reason.class, distance: noise.reason.distance }
        : null;
      noiseOk = true;
    } catch (error) {
      if (options.signal.aborted) throw error;
      console.warn("Noise error:", error);
    }
  }

  // Radiation, shade, wind shelter and sky view are real: they come from our backend, the same
  // calculation as the dataset (radiation: summer per day; shade: 21 June; wind shelter and sky view: of each wall).
  // If the backend is not running we keep the sample values.
  if (options.lat !== undefined && options.lng !== undefined) {
    try {
      const real = await fetchFacadeIndicators(options.lat, options.lng, options.signal);
      facadesOk = true;
      // A value the backend did not send (an older backend file) keeps the sample value.
      const take = (value: number | null | undefined, fallback: number | null) =>
        value === undefined ? fallback : value;
      (Object.keys(real.facades) as WindDirection[]).forEach((d) => {
        const facade = data.facades[WIND_FACADE[d]];
        const got = real.facades[d];
        facade.radiation = take(got.radiation?.summer?.perDay, facade.radiation);
        facade.shade = take(got.shade?.summer, facade.shade);
        facade.wind = take(got.windBlock, facade.wind);
        facade.sky = take(got.sky, facade.sky);
      });
      if (real.site) {
        data.site.temperature = real.site.summerMaxTemp;
        data.site.avgHeight = real.site.avgHeight;
        data.site.maxHeight = real.site.maxHeight;
      }
      if ((Object.values(real.facades) as { neighbours?: FacadeNeighbours }[]).every((f) => f.neighbours)) {
        const neighbours = {} as Record<Facade, FacadeNeighbours>;
        (Object.keys(real.facades) as WindDirection[]).forEach((d) => {
          neighbours[WIND_FACADE[d]] = real.facades[d].neighbours;
        });
        data.neighbours = neighbours;
      }
    } catch (error) {
      if (options.signal.aborted) throw error;
      console.warn("Facade indicators error:", error);
    }
  }
  data.complete = windOk && facadesOk && noiseOk;
  return data;
}

export function getConstraints(): Constraints {
  return {
    maxCoverage: 60,
    maxHeight: 12,
    setbacks: { north: 3, south: 2, east: 1.5, west: 1.5 },
  };
}

// A plot's width and depth (meters) from its area, for drawing it on the map.
export function plotDimensions(area: number): { width: number; depth: number } {
  const width = Math.sqrt(area / 1.15);
  return { width, depth: width * 1.15 };
}

/* ---------- display helpers ---------- */

// Summer radiation on a wall in Riyadh is about 1 (north, south) to 3 (east, west) kWh/m²/day.
// The bar and the map colors are drawn up to this value.
export const MAX_RADIATION = 3.5;
// Wind shelter (degrees): the bar is drawn up to this value.
export const MAX_WIND_BLOCK = 45;

export type Level = "low" | "medium" | "high";
const THRESHOLDS: Record<MetricKey, [number, number]> = {
  radiation: [1.81, 2.4], // summer, kWh/m²/day: low < 1.81, medium 1.81–2.40, high > 2.40 (team values)
  shade: [0.3, 0.55], // TEMPORARY: replace with the team values from the dataset (Shaded_Pct_Summer)
  wind: [1.4, 11.5], // degrees: low < 1.4, medium 1.4–11.5, high > 11.5 (sample of 110 plots, to update)
  sky: [0.77, 0.97], // TEMPORARY: thirds of a 110-plot sample after the wall formula fix (Dozier & Frew); update from the dataset
};

export function levelOf(metric: MetricKey, value: number): Level {
  const [medium, high] = THRESHOLDS[metric];
  return value < medium ? "low" : value > high ? "high" : "medium";
}

export type Tone = "success" | "caution" | "danger" | "neutral";


// Radiation colors are shades, not three flat colors: green for low values, yellow at the
// low/medium border (1.81), orange through the medium range (yellow-orange near 1.81, red-orange near 2.40),
// red from 2.40, darker for the highest values. The colors come from globals.css
// (success-500, warning-400, danger-500); the shades in between are mixed from them.
// Leaflet and inline styles need the color values themselves.
const RADIATION_STOPS: [number, [number, number, number]][] = [
  [1.2, [47, 125, 79]], // success-500 #2F7D4F
  [1.81, [226, 174, 31]], // warning-400 #E2AE1F
  [2.4, [179, 64, 46]], // danger-500 #B3402E
  [3.2, [122, 40, 28]], // danger-500, darker
];

export function radiationColor(value: number): string {
  const stops = RADIATION_STOPS;
  if (value <= stops[0][0]) return `rgb(${stops[0][1].join(", ")})`;
  for (let i = 1; i < stops.length; i++) {
    const [v1, c1] = stops[i];
    const [v0, c0] = stops[i - 1];
    if (value <= v1) {
      const k = (value - v0) / (v1 - v0);
      return `rgb(${c0.map((from, n) => Math.round(from + (c1[n] - from) * k)).join(", ")})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(", ")})`;
}

// The legend: the same shades from the lowest to the highest value, as a CSS gradient
// that starts on the reading side (right in Arabic, left in English).
export function radiationGradient(rtl: boolean): string {
  const min = RADIATION_STOPS[0][0];
  const max = RADIATION_STOPS[RADIATION_STOPS.length - 1][0];
  const steps = RADIATION_STOPS.map(([v, c]) => `rgb(${c.join(", ")}) ${(((v - min) / (max - min)) * 100).toFixed(1)}%`);
  return `linear-gradient(${rtl ? 270 : 90}deg, ${steps.join(", ")})`;
}

// How much of the legend each level takes, from the level borders (THRESHOLDS.radiation).
export function radiationLegendShares(): Record<Level, number> {
  const min = RADIATION_STOPS[0][0];
  const max = RADIATION_STOPS[RADIATION_STOPS.length - 1][0];
  const at = (value: number) => clamp01((value - min) / (max - min));
  const [medium, high] = THRESHOLDS.radiation;
  return { low: at(medium), medium: at(high) - at(medium), high: 1 - at(high) };
}

// Green = good, orange = in between, red = bad.
// High sun exposure is bad; high shade and high wind shelter (protection from wind and dust) are good.
// Sky view has its own colors (green, yellow, orange: no red), see SKY_FILL.
export function toneOf(metric: MetricKey, level: Level): Tone {
  if (metric === "sky") return level === "low" ? "success" : "caution";
  if (level === "medium") return "caution";
  const good: Level = metric === "radiation" ? "low" : "high";
  return level === good ? "success" : "danger";
}

export const METRIC_UNITS: Record<MetricKey, string> = {
  radiation: "kWh/m²/day",
  shade: "",
  wind: "",
  sky: "",
};

export function formatMetric(metric: MetricKey, value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text =
    metric === "radiation"
      ? value.toFixed(1)
      : metric === "shade"
        ? `${Math.round(value * 100)}%`
        : metric === "wind"
          ? `${value.toFixed(1)}°`
          : value.toFixed(2);
  const unit = METRIC_UNITS[metric];
  return unit ? `${text} ${unit}` : text;
}

// How full a bar should be, 0..1.
export function metricFraction(metric: MetricKey, value: number): number {
  if (metric === "radiation") return clamp01(value / MAX_RADIATION);
  if (metric === "wind") return clamp01(value / MAX_WIND_BLOCK);
  return clamp01(value);
}

