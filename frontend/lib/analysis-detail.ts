/*
 * TEMPORARY MOCK DATA for the results dashboard.
 * When the API exists, replace fetchIndicators() and getConstraints()
 * with real requests. The dashboard will not need to change.
 */

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

export type FacadeIndicators = {
  radiation: number; // kWh/m²/day
  shade: number; // 0..1 share of the façade shaded by neighbours
  wind: number; // 0..1 wind openness
  sky: number; // 0..1 sky view factor
};
export type MetricKey = keyof FacadeIndicators;
export const METRICS: MetricKey[] = ["radiation", "shade", "wind", "sky"];

export type SiteIndicators = {
  windSpeed: number; // m/s
  windFrom: Facade;
  temperature: number; // °C
  density: number; // 0..1 urban density
  avgHeight: number; // m, neighbouring buildings
  maxHeight: number; // m
  noise: number; // dB
};

export type IndicatorsData = {
  facades: Record<Facade, FacadeIndicators>;
  site: SiteIndicators;
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
  north: { radiation: 3.1, shade: 0.62, wind: 0.71, sky: 0.58 },
  northeast: { radiation: 3.9, shade: 0.48, wind: 0.63, sky: 0.64 },
  east: { radiation: 4.8, shade: 0.35, wind: 0.55, sky: 0.69 },
  southeast: { radiation: 5.6, shade: 0.26, wind: 0.48, sky: 0.75 },
  south: { radiation: 6.4, shade: 0.18, wind: 0.42, sky: 0.81 },
  southwest: { radiation: 6.2, shade: 0.2, wind: 0.45, sky: 0.78 },
  west: { radiation: 5.9, shade: 0.22, wind: 0.48, sky: 0.74 },
  northwest: { radiation: 4.5, shade: 0.42, wind: 0.6, sky: 0.66 },
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
      radiation: round(base.radiation + jitter(hash, i, 0.6), 1),
      shade: round(clamp01(base.shade + jitter(hash, i + 4, 0.08)), 2),
      wind: round(clamp01(base.wind + jitter(hash, i + 1, 0.08)), 2),
      sky: round(clamp01(base.sky + jitter(hash, i + 2, 0.08)), 2),
    };
  });
  return {
    facades,
    site: {
      windSpeed: round(3.4 + jitter(hash, 1, 1), 1),
      windFrom: "north",
      temperature: round(31 + jitter(hash, 2, 2), 1),
      density: round(clamp01(0.42 + jitter(hash, 3, 0.2)), 2),
      avgHeight: round(6.5 + jitter(hash, 4, 2), 1),
      maxHeight: round(14 + jitter(hash, 5, 4), 1),
      noise: Math.round(52 + jitter(hash, 6, 8)),
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
  options: { fail: boolean; signal: AbortSignal },
): Promise<IndicatorsData> {
  await wait(700, options.signal);
  if (options.fail) throw new Error("Indicators could not be loaded");
  return buildIndicators(id);
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

export const MAX_RADIATION = 7;

const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [62, 124, 177]],
  [0.5, [227, 185, 127]],
  [1, [179, 64, 46]],
];

// 0 = cool blue, 1 = hot red.
export function heatColor(t: number): string {
  const value = clamp01(t);
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [t1, c1] = HEAT_STOPS[i];
    const [t0, c0] = HEAT_STOPS[i - 1];
    if (value <= t1) {
      const k = (value - t0) / (t1 - t0);
      const [r, g, b] = c0.map((from, n) => Math.round(from + (c1[n] - from) * k));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return "rgb(179, 64, 46)";
}

export type Level = "low" | "medium" | "high";
const THRESHOLDS: Record<MetricKey, [number, number]> = {
  radiation: [4, 5.5],
  shade: [0.3, 0.55],
  wind: [0.45, 0.65],
  sky: [0.55, 0.75],
};

export function levelOf(metric: MetricKey, value: number): Level {
  const [medium, high] = THRESHOLDS[metric];
  return value < medium ? "low" : value < high ? "medium" : "high";
}

export type Tone = "success" | "caution" | "danger" | "neutral";

// Green = good, yellow = in between, red = bad.
// High sun exposure is bad; high shade and wind openness are good.
// Sky view has no good or bad side, so it stays neutral.
export function toneOf(metric: MetricKey, level: Level): Tone {
  if (metric === "sky") return "neutral";
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

export function formatMetric(metric: MetricKey, value: number): string {
  const text =
    metric === "radiation"
      ? value.toFixed(1)
      : metric === "shade"
        ? `${Math.round(value * 100)}%`
        : value.toFixed(2);
  const unit = METRIC_UNITS[metric];
  return unit ? `${text} ${unit}` : text;
}

// How full a bar should be, 0..1.
export function metricFraction(metric: MetricKey, value: number): number {
  return clamp01(metric === "radiation" ? value / MAX_RADIATION : value);
}

