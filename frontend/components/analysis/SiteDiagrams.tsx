"use client";

import { useEffect, useState } from "react";
import LandUseDiagram from "@/components/diagrams/LandUseDiagram";
import RoadsDiagram from "@/components/diagrams/RoadsDiagram";
import SunWindDiagram from "@/components/diagrams/SunWindDiagram";
import type { Loadable } from "@/lib/loadable";
import { useResultsCopy } from "@/lib/results-copy";
import { fetchSunPath, fetchWind } from "@/lib/site-api";
import type { SunPath, Wind } from "@/lib/site-api";
import { isEmptySurroundings, loadSurroundings } from "@/lib/site-surroundings";
import type { Surroundings } from "@/lib/site-surroundings";

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

// Architects: three plans of the site and its surroundings.
// The sun path and the surroundings load on their own, so one failing does not hide the others.
export default function SiteDiagrams({ lat, lng }: { lat: number; lng: number }) {
  const c = useResultsCopy();
  const [sun, setSun] = useState<Loadable<SunPath>>({ status: "loading" });
  const [around, setAround] = useState<Loadable<Surroundings>>({ status: "loading" });
  const [sunAttempt, setSunAttempt] = useState(0);
  const [aroundAttempt, setAroundAttempt] = useState(0);
  // the hot (summer) and cool (winter) winds for the sun and wind diagram (shared with the rest of the page)
  const [wind, setWind] = useState<Wind | null>(null);

  useEffect(() => {
    let active = true;
    fetchWind()
      .then((data) => {
        if (active) setWind(data);
      })
      .catch((error: unknown) => console.warn("Wind error:", error));
    return () => {
      active = false;
    };
  }, [lat, lng]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSunPath(lat, lng, controller.signal)
      .then((data) => setSun({ status: "ready", data }))
      .catch((error: unknown) => {
        if (isAbort(error) && controller.signal.aborted) return;
        console.warn("Sun path error:", error);
        setSun({ status: "error" });
      });
    return () => controller.abort();
  }, [lat, lng, sunAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    loadSurroundings(lat, lng, controller.signal)
      .then((data) =>
        setAround(isEmptySurroundings(data) ? { status: "error" } : { status: "ready", data }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("Surroundings error:", error);
        setAround({ status: "error" });
      });
    return () => controller.abort();
  }, [lat, lng, aroundAttempt]);

  function retrySun() {
    setSun({ status: "loading" });
    setSunAttempt((value) => value + 1);
  }

  function retryAround() {
    setAround({ status: "loading" });
    setAroundAttempt((value) => value + 1);
  }

  return (
    <section>
      <h2 className="text-sm font-bold">{c.diagrams.title}</h2>
      <p className="mb-3 mt-1 text-xs leading-6 text-navy-900/70">{c.diagrams.hint}</p>
      <div className="grid gap-5 lg:grid-cols-3">
        <SunWindDiagram lat={lat} lng={lng} sun={sun} around={around} wind={wind} onRetry={retrySun} />
        <LandUseDiagram lat={lat} lng={lng} around={around} onRetry={retryAround} />
        <RoadsDiagram lat={lat} lng={lng} around={around} onRetry={retryAround} />
      </div>
    </section>
  );
}
