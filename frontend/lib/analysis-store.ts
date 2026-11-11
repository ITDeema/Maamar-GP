import { createClient } from "@/lib/supabase/client";
import type { IndicatorsData } from "@/lib/analysis-detail";

// The indicators of a finished analysis are kept in the database (Analysis.results), so opening a result
// from the history shows exactly what was calculated then, without calculating again.
// Row level security makes sure each user only reads and writes their own analyses.

// Raise it when the shape of IndicatorsData changes, so older saved results are calculated again.
export const RESULTS_VERSION = 2; // 2: the neighbours measured from each side of the plot

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
// renew: the analysis was calculated again for an old project, so its date becomes today (it is no longer old).
// Resolves to true when saved.
export async function saveResults(
  projectId: string,
  data: IndicatorsData,
  options: { renew?: boolean } = {},
): Promise<boolean> {
  if (data.complete !== true) return false;
  const supabase = createClient();
  const project = await supabase
    .from("Project")
    .select("analysisID")
    .eq("projectID", projectId)
    .maybeSingle();
  const analysisId = (project.data as { analysisID?: string } | null)?.analysisID;
  if (project.error || !analysisId) {
    console.error("Save results error:", project.error?.message ?? "project has no analysis");
    return false;
  }
  const stored: Stored = { version: RESULTS_VERSION, savedAt: new Date().toISOString(), data };
  // .select() returns the updated rows, so a policy that blocks the update (0 rows) is noticed.
  const { data: updated, error } = await supabase
    .from("Analysis")
    .update(options.renew ? { results: stored, analysisDate: stored.savedAt } : { results: stored })
    .eq("analysisID", analysisId)
    .select("analysisID");
  if (error || !updated || updated.length === 0) {
    console.error("Save results error:", error?.message ?? "no row updated (check the update policy)");
    return false;
  }
  return true;
}