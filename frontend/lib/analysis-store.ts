import { createClient } from "@/lib/supabase/client";
import { FACADES, METRICS } from "@/lib/analysis-detail";
import type { IndicatorsData, MetricKey } from "@/lib/analysis-detail";
import type { Service } from "@/lib/neighbourhood";

// The indicators of a finished analysis are kept in the database (Analysis.results), so opening a result
// from the history shows exactly what was calculated then, without calculating again.
// Row level security makes sure each user only reads and writes their own analyses.

// Raise it when the shape of IndicatorsData changes, so older saved results are calculated again.
export const RESULTS_VERSION = 3; // 2: the building is the user's design (their land area and height); 3: services saved

// One row of Site_Indicator (the ER diagram keeps every indicator in its own row).
export type IndicatorRow = {
  indicatorName: string;
  facade: string | null;
  value: number;
  unit: string;
};

const METRIC_UNITS: Record<MetricKey, string> = {
  radiation: "kWh/m2/day",
  shade: "ratio",
  wind: "deg",
  sky: "ratio",
};
const NOISE_NUMBER = { low: 1, medium: 2, high: 3 } as const;

// The indicators of an analysis as Site_Indicator rows. Empty values (no wall, no data) are left out.
export function indicatorRows(data: IndicatorsData): IndicatorRow[] {
  const rows: IndicatorRow[] = [];
  const add = (indicatorName: string, facade: string | null, value: number | null | undefined, unit: string) => {
    if (typeof value === "number" && Number.isFinite(value)) rows.push({ indicatorName, facade, value, unit });
  };

  for (const facade of FACADES) {
    for (const metric of METRICS) add(metric, facade, data.facades[facade]?.[metric], METRIC_UNITS[metric]);
  }

  const site = data.site;
  add("windSpeed", site.windFrom, site.windSpeed, "m/s"); // the facade is the side the wind comes from
  add("temperature", null, site.temperature, "C");
  add("density", null, site.density, "people/km2");
  add("avgHeight", null, site.avgHeight, "m");
  add("maxHeight", null, site.maxHeight, "m");
  if (site.noise) add("noiseLevel", null, NOISE_NUMBER[site.noise], "level (1 low, 2 medium, 3 high)");
  add("noiseDistance", site.noiseReason?.roadClass ?? null, site.noiseReason?.distance, "m"); // facade = road class
  if (data.neighbours) rows.push(...neighbourRows(data.neighbours));
  if (data.services) rows.push(...serviceRows(data.services));
  return rows;
}

// The neighbours of each façade (the neighbours card): from this side of the plot, the distance to the street
// in front of it and its width, and the distance to the nearest building straight in front of it and its height.
// 300 m = no building within 300 m; height 0 = none. A value the backend did not send has no row.
export function neighbourRows(neighbours: NonNullable<IndicatorsData["neighbours"]>): IndicatorRow[] {
  const rows: IndicatorRow[] = [];
  const add = (indicatorName: string, facade: string, value: number | null | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) rows.push({ indicatorName, facade, value, unit: "m" });
  };
  for (const facade of FACADES) {
    const n = neighbours[facade];
    if (!n) continue;
    add("streetDistance", facade, n.streetDistance);
    add("streetWidth", facade, n.streetWidth);
    add("nearestBuildingDistance", facade, n.nearestDistance);
    add("nearestBuildingHeight", facade, n.nearestHeight);
  }
  return rows;
}

// The nearest services as Site_Indicator rows: for each kind (in the facade column) the distance to the
// nearest one and how many there are. No distance row when there is none of that kind nearby.
export function serviceRows(services: Service[]): IndicatorRow[] {
  const rows: IndicatorRow[] = [];
  for (const service of services) {
    if (typeof service.distance === "number" && Number.isFinite(service.distance)) {
      rows.push({ indicatorName: "serviceDistance", facade: service.kind, value: service.distance, unit: "m" });
    }
    rows.push({ indicatorName: "serviceCount", facade: service.kind, value: service.count, unit: "count" });
  }
  return rows;
}

type Stored = { version: number; savedAt: string; data: IndicatorsData };

// A saved value is accepted only when it has the shape the dashboard needs.
function isStored(value: unknown): value is Stored {
  if (typeof value !== "object" || value === null) return false;
  const stored = value as Partial<Stored>;
  const data = stored.data as Partial<IndicatorsData> | undefined;
  return (
    stored.version === RESULTS_VERSION &&
    typeof data === "object" &&
    data !== null &&
    typeof data.facades === "object" &&
    data.facades !== null &&
    typeof data.site === "object" &&
    data.site !== null &&
    data.complete === true
  );
}

// A project points to its analysis (Project.analysisID -> Analysis.analysisID).
// Returns null when nothing complete is saved for this project (or it could not be read).
export async function loadSavedResults(projectId: string): Promise<IndicatorsData | null> {
  const { data, error } = await createClient()
    .from("Project")
    .select("Analysis(results)")
    .eq("projectID", projectId)
    .maybeSingle();
  if (error) {
    console.error("Saved results error:", error.message);
    return null;
  }
  const analysis = (data as { Analysis?: { results?: unknown } | null } | null)?.Analysis;
  const results = analysis?.results;
  return isStored(results) ? results.data : null;
}

// Saves a COMPLETE analysis. An incomplete one (the backend did not answer) is never saved.
// Resolves to true when saved.
export async function saveResults(
  projectId: string,
  data: IndicatorsData,
  options: { renew?: boolean } = {},
): Promise<boolean> {
  if (data.complete !== true) return false;
  const supabase = createClient();
  let analysisId: string | undefined;
  if (options.renew) {
    // Copy-on-write: when other projects use the same analysis, this project gets its own copy first,
    // so updating it never changes what the other users see (see supabase/analysis-reuse.sql).
    const own = await supabase.rpc("own_analysis", { p_project: projectId });
    if (own.error || typeof own.data !== "string") {
      console.error("Save results error:", own.error?.message ?? "no analysis for this project");
      return false;
    }
    analysisId = own.data;
  } else {
    const project = await supabase
      .from("Project")
      .select("analysisID")
      .eq("projectID", projectId)
      .maybeSingle();
    analysisId = (project.data as { analysisID?: string } | null)?.analysisID;
    if (project.error || !analysisId) {
      console.error("Save results error:", project.error?.message ?? "project has no analysis");
      return false;
    }
  }
  const stored: Stored = { version: RESULTS_VERSION, savedAt: new Date().toISOString(), data };
  // .select() returns the updated rows, so a policy that blocks the update (0 rows) is noticed.
  const { data: updated, error } = await supabase
    .from("Analysis")
    .update(options.renew ? { results: stored, analysisDate: new Date().toISOString() } : { results: stored })
    .eq("analysisID", analysisId)
    .select("analysisID");
  if (error || !updated || updated.length === 0) {
    console.error("Save results error:", error?.message ?? "no row updated (check the update policy)");
    return false;
  }

  // The same indicators as Site_Indicator rows. The results above are what the history opens, so a
  // failure here is only logged (for example when supabase/site-indicators.sql was not run yet).
  const rows = await supabase.rpc("save_site_indicators", {
    p_project: projectId,
    p_rows: indicatorRows(data),
  });
  if (rows.error) console.error("Site indicators error:", rows.error.message);
  return true;
}

// The services arrived after the analysis was saved (the homeowner's card loaded them on its own):
// they are added to the saved analysis, only when it has none yet. Resolves to true when added.
export async function saveServices(projectId: string, services: Service[]): Promise<boolean> {
  const { data, error } = await createClient().rpc("add_services", {
    p_project: projectId,
    p_services: services,
    p_rows: serviceRows(services),
  });
  if (error) console.error("Save services error:", error.message);
  return data === true;
}

// Is there an analysis to reuse (the same plot, villa type, area and height, less than 6 months old)?
// The analysis page then does not calculate again. False when it cannot tell.
export async function hasReusableAnalysis(input: {
  boundary: unknown;
  villaType: string;
  area: number;
  height: number | null;
}): Promise<boolean> {
  if (!input.boundary) return false;
  const { data, error } = await createClient().rpc("has_reusable_analysis", {
    p_boundary: input.boundary,
    p_villa_type: input.villaType,
    p_area: input.area,
    p_height: input.height,
  });
  if (error) {
    console.warn("Reuse check error:", error.message);
    return false;
  }
  return data === true;
}
