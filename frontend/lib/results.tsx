"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type AnalysisResult = {
  id: string;
  villaType?: "attachedBoth" | "attachedOne" | "detached";
  name: string; // the title the user can rename
  area: number; // square meters
  lat: number;
  lng: number;
  date: string; // ISO date of the analysis
  saved: boolean;
  parcelNote: boolean; // true when the plot itself is near a regulatory limit
  lastOpenedAt?: string;
};

// TEMPORARY sample data until the API exists.
// When the backend is ready, load this list from the API instead, and make
// rename() / setSaved() call the API. The screens will not need to change.
const initialResults: AnalysisResult[] = [
  { id: "r1", name: "حي الملقا", area: 450, lat: 24.815, lng: 46.628, date: "2026-09-16", saved: true, parcelNote: true },
  { id: "r2", name: "حي النرجس", area: 600, lat: 24.837, lng: 46.683, date: "2026-09-12", saved: true, parcelNote: false },
  { id: "r3", name: "حي الياسمين", area: 380, lat: 24.82, lng: 46.65, date: "2026-09-05", saved: true, parcelNote: false },
  { id: "r4", name: "حي حطين", area: 720, lat: 24.765, lng: 46.615, date: "2026-08-28", saved: true, parcelNote: false },
  { id: "r5", name: "حي الواحة", area: 510, lat: 24.79, lng: 46.64, date: "2026-08-20", saved: false, parcelNote: false },
  { id: "r6", name: "حي العارض", area: 340, lat: 24.745, lng: 46.73, date: "2026-08-14", saved: false, parcelNote: true },
];

type NewResult = {
  namePrefix: string;
  area: number;
  lat: number;
  lng: number;
  villaType: "attachedBoth" | "attachedOne" | "detached";
};

type ResultsContextValue = {
  results: AnalysisResult[];
  rename: (id: string, name: string) => void;
  setSaved: (id: string, saved: boolean) => void;
  markOpened: (id: string) => void;
  addResult: (input: NewResult) => string; // returns the new result's id
};

const ResultsContext = createContext<ResultsContextValue | null>(null);

export function ResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState(initialResults);
  const projectCount = useRef(initialResults.length);

  const rename = useCallback((id: string, name: string) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  }, []);

  const setSaved = useCallback((id: string, saved: boolean) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, saved } : r)));
  }, []);

  
  const markOpened = useCallback((id: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, lastOpenedAt: new Date().toISOString() }
          : r
      )
    );
  }, []);


  // A finished analysis goes into the history automatically (it is not "saved" yet).
  const addResult = useCallback((input: NewResult) => {
    const id = `r${Date.now()}`;
    projectCount.current += 1;
    const result: AnalysisResult = {
      id,
      villaType: input.villaType,
      name: `${input.namePrefix} ${projectCount.current}`, // "Project 1", "Project 2", ...
      area: input.area,
      lat: input.lat,
      lng: input.lng,
      date: new Date().toISOString().slice(0, 10),
      saved: false,
      parcelNote: false,
    };
    setResults((prev) => [result, ...prev]);
    return id;
  }, []);

  
  const value = useMemo(
    () => ({ results, rename, setSaved, addResult, markOpened }),
    [results, rename, setSaved, addResult, markOpened],
  );


  return (
    <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>
  );
}

export function useResults() {
  const context = useContext(ResultsContext);
  if (!context) {
    throw new Error("useResults must be used inside <ResultsProvider>");
  }
  return context;
}