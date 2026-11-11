"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { isStale } from "@/lib/refresh-notice";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/user";

export type VillaType = "attachedBoth" | "attachedOne" | "detached";

export type AnalysisResult = {
  id: string; // the project (projects.projectID)
  villaType?: VillaType;
  name: string; // the title the user can rename
  area: number; // square meters
  lat: number;
  lng: number;
  date: string; // ISO date of the analysis
  saved: boolean; // in the favorites
  parcelNote: boolean; // true when the plot itself is near a regulatory limit
  role: Role; // the user's role when the analysis was made
  stale: boolean; // more than 6 months old when the history was loaded
  lastOpenedAt?: string;
};

// The history comes from Supabase (the Project table, with its Analysis).
// Row level security makes sure each user only gets their own projects.
const HISTORY_SELECT =
  "projectID, projectName, isFavorited, roleAtAnalysis, lastOpenedAt, projectDate, lat, lng, Analysis(villaType, landArea, analysisDate)";

type HistoryRow = {
  projectID: string;
  projectName: string;
  isFavorited: boolean;
  roleAtAnalysis: string;
  lastOpenedAt: string | null;
  projectDate: string;
  lat: number;
  lng: number;
  Analysis: { villaType: string; landArea: number; analysisDate: string } | null;
};

type Client = ReturnType<typeof createClient>;

function isVillaType(value: string): value is VillaType {
  return value === "attachedBoth" || value === "attachedOne" || value === "detached";
}

function toResult(row: HistoryRow, now: number): AnalysisResult | null {
  if (!row.Analysis) return null;
  return {
    id: row.projectID,
    villaType: isVillaType(row.Analysis.villaType) ? row.Analysis.villaType : undefined,
    name: row.projectName,
    area: row.Analysis.landArea,
    lat: row.lat,
    lng: row.lng,
    date: row.projectDate.slice(0, 10),
    saved: row.isFavorited,
    parcelNote: false, // the database has no plot-level note yet
    role: row.roleAtAnalysis === "architect" ? "architect" : "homeowner",
    stale: isStale(row.Analysis.analysisDate, now), // the age of the analysis itself
    lastOpenedAt: row.lastOpenedAt ?? undefined,
  };
}

async function fetchHistory(supabase: Client): Promise<AnalysisResult[]> {
  const { data, error } = await supabase
    .from("Project")
    .select(HISTORY_SELECT)
    .order("projectDate", { ascending: false });
  if (error) throw new Error(error.message);
  const now = Date.now();
  return (data as unknown as HistoryRow[])
    .map((row) => toResult(row, now))
    .filter((result): result is AnalysisResult => result !== null);
}

type NewResult = {
  namePrefix: string;
  area: number;
  lat: number;
  lng: number;
  villaType: VillaType;
};

type ResultsContextValue = {
  results: AnalysisResult[];
  loaded: boolean; // false until the history has been read from Supabase
  loadError: boolean; // true when the history could not be read
  rename: (id: string, name: string) => void;
  setSaved: (id: string, saved: boolean) => void;
  markOpened: (id: string) => void;
  // Shows an analysis with another account type from now on (Project.roleAtAnalysis).
  // Resolves to false when Supabase refused it (the analysis keeps its role).
  setRole: (id: string, role: Role) => Promise<boolean>;
  // The analysis was calculated again (and saved), so it is no longer more than 6 months old.
  markRenewed: (id: string) => void;
  // Saves a finished analysis in the history (it is not a favorite yet).
  // Returns the new result's id. Throws when it could not be saved.
  addResult: (input: NewResult) => Promise<string>;
};

const ResultsContext = createContext<ResultsContextValue | null>(null);

export function ResultsProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Always the latest list, so a change can be undone when Supabase refuses it.
  const latest = useRef<AnalysisResult[]>([]);
  const commit = useCallback((next: AnalysisResult[]) => {
    latest.current = next;
    setResults(next);
  }, []);
  const patch = useCallback(
    (id: string, changes: Partial<AnalysisResult>) => {
      commit(latest.current.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    },
    [commit],
  );

  useEffect(() => {
    let active = true;
    fetchHistory(supabase)
      .then((rows) => {
        if (!active) return;
        commit(rows);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        console.error("History error:", error);
        if (!active) return;
        setLoadError(true);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [supabase, commit]);

  const rename = useCallback(
    (id: string, name: string) => {
      const before = latest.current.find((r) => r.id === id);
      if (!before) return;
      patch(id, { name });
      supabase
        .from("Project")
        .update({ projectName: name })
        .eq("projectID", id)
        .then(({ error }) => {
          if (!error) return;
          console.error("Rename error:", error.message);
          patch(id, { name: before.name });
        });
    },
    [supabase, patch],
  );

  const setSaved = useCallback(
    (id: string, saved: boolean) => {
      const before = latest.current.find((r) => r.id === id);
      if (!before) return;
      patch(id, { saved });
      supabase
        .from("Project")
        .update({ isFavorited: saved })
        .eq("projectID", id)
        .then(({ error }) => {
          if (!error) return;
          console.error("Favorite error:", error.message);
          patch(id, { saved: before.saved });
        });
    },
    [supabase, patch],
  );

  const markOpened = useCallback(
    (id: string) => {
      if (!latest.current.some((r) => r.id === id)) return;
      const openedAt = new Date().toISOString();
      patch(id, { lastOpenedAt: openedAt });
      supabase
        .from("Project")
        .update({ lastOpenedAt: openedAt })
        .eq("projectID", id)
        .then(({ error }) => {
          if (error) console.error("Opened time error:", error.message);
        });
    },
    [supabase, patch],
  );

  const setRole = useCallback(
    async (id: string, role: Role) => {
      const before = latest.current.find((r) => r.id === id);
      if (!before) return false;
      patch(id, { role });
      const { error } = await supabase.from("Project").update({ roleAtAnalysis: role }).eq("projectID", id);
      if (!error) return true;
      console.error("Role update error:", error.message);
      patch(id, { role: before.role });
      return false;
    },
    [supabase, patch],
  );

  const markRenewed = useCallback((id: string) => patch(id, { stale: false }), [patch]);

  const addResult = useCallback(
    async (input: NewResult) => {
      const name = `${input.namePrefix} ${latest.current.length + 1}`; // "Project 1", "Project 2", ...
      const created = await supabase.rpc("create_analysis", {
        p_lat: input.lat,
        p_lng: input.lng,
        p_area: input.area,
        p_villa_type: input.villaType,
        p_name: name,
      });
      if (created.error || typeof created.data !== "string") {
        throw new Error(created.error?.message ?? "The analysis could not be saved");
      }

      // Read it back, so the screens show exactly what is stored.
      const row = await supabase
        .from("Project")
        .select(HISTORY_SELECT)
        .eq("projectID", created.data)
        .single();
      const result = row.error ? null : toResult(row.data as unknown as HistoryRow, Date.now());
      if (!result) throw new Error(row.error?.message ?? "The saved analysis could not be read");

      commit([result, ...latest.current.filter((r) => r.id !== result.id)]);
      return result.id;
    },
    [supabase, commit],
  );

  const value = useMemo(
    () => ({ results, loaded, loadError, rename, setSaved, addResult, markOpened, setRole, markRenewed }),
    [results, loaded, loadError, rename, setSaved, addResult, markOpened, setRole, markRenewed],
  );

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}

export function useResults() {
  const context = useContext(ResultsContext);
  if (!context) {
    throw new Error("useResults must be used inside <ResultsProvider>");
  }
  return context;
}