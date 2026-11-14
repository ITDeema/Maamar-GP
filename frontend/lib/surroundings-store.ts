import { createClient } from "@/lib/supabase/client";
import type { Surroundings } from "@/lib/site-surroundings";

// The architect's diagrams (land use and roads) are saved per plot in "Plot_Surroundings" and reused for
// 6 months by every architect who analyses the same plot (see supabase/plot-surroundings.sql).
// The sun and wind diagram is not saved: it is the same for all of Riyadh.

type LandUseData = Pick<Surroundings, "buildings" | "areas" | "stops" | "presentUses" | "siteBuilding" | "counts">;
type RoadsData = Pick<Surroundings, "roads" | "casings" | "fills" | "paths" | "rails">;

// Coordinates to 6 decimals (about 10 cm), so the saved data stays small.
function rounded<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === "number" ? Number(v.toFixed(6)) : v))) as T;
}

function split(data: Surroundings): { landUse: LandUseData; roads: RoadsData } {
  return {
    landUse: rounded({
      buildings: data.buildings,
      areas: data.areas,
      stops: data.stops,
      presentUses: data.presentUses,
      siteBuilding: data.siteBuilding,
      counts: data.counts,
    }),
    roads: rounded({
      roads: data.roads,
      casings: data.casings,
      fills: data.fills,
      paths: data.paths,
      rails: data.rails,
    }),
  };
}

// The saved data back in the shape the diagrams draw. null when something is missing.
function join(landUse: Partial<LandUseData> | null, roads: Partial<RoadsData> | null): Surroundings | null {
  if (!landUse || !roads || !Array.isArray(landUse.buildings) || !Array.isArray(roads.roads)) return null;
  return {
    buildings: landUse.buildings,
    areas: landUse.areas ?? [],
    stops: landUse.stops ?? [],
    presentUses: landUse.presentUses ?? [],
    siteBuilding: landUse.siteBuilding ?? null,
    counts: landUse.counts ?? { buildings: landUse.buildings.length, places: 0, source: "OSM", osm: true },
    roads: roads.roads,
    casings: roads.casings ?? [],
    fills: roads.fills ?? [],
    paths: roads.paths ?? [],
    rails: roads.rails ?? [],
  };
}

// The surroundings saved for this project's plot (architects only). null when none are saved yet,
// or they could not be read: the diagrams then fetch them.
export async function loadSavedSurroundings(projectId: string): Promise<Surroundings | null> {
  const { data, error } = await createClient().rpc("project_surroundings", { p_project: projectId });
  if (error) {
    console.warn("Saved surroundings error:", error.message);
    return null;
  }
  const saved = data as { landUseData?: Partial<LandUseData>; roadsData?: Partial<RoadsData> } | null;
  return saved ? join(saved.landUseData ?? null, saved.roadsData ?? null) : null;
}

// Saves the surroundings that were just fetched. Not saved again when the plot already has recent ones.
export async function saveSurroundings(projectId: string, data: Surroundings): Promise<boolean> {
  const { landUse, roads } = split(data);
  const { data: saved, error } = await createClient().rpc("save_surroundings", {
    p_project: projectId,
    p_land_use: landUse,
    p_roads: roads,
  });
  if (error) console.error("Save surroundings error:", error.message);
  return saved === true;
}

// For the analysis page: true when the plot already has surroundings less than 6 months old,
// so they are not fetched again. False when it cannot tell.
export async function hasRecentSurroundings(boundary: unknown): Promise<boolean> {
  if (!boundary) return false;
  const { data, error } = await createClient().rpc("has_recent_surroundings", { p_boundary: boundary });
  if (error) {
    console.warn("Surroundings check error:", error.message);
    return false;
  }
  return data === true;
}
