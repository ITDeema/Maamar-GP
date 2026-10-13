"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import SegmentedControl from "@/components/SegmentedControl";
import { BookmarkIcon, ExportIcon } from "@/components/analysis/ActionIcons";
import ConstraintsCard from "@/components/analysis/ConstraintsCard";
import DecisionList from "@/components/analysis/DecisionList";
import ExportModal from "@/components/analysis/ExportModal";
import IndicatorsPanel, { SiteIndicatorsCard } from "@/components/analysis/IndicatorsPanel";
import type { IndicatorsState } from "@/components/analysis/IndicatorsPanel";
import StatusMessage from "@/components/analysis/StatusMessage";
import WindCard from "@/components/analysis/WindCard";
import NeighbourhoodCard from "@/components/analysis/NeighbourhoodCard";
import NeighboursCard from "@/components/analysis/NeighboursCard";
import { usePlotCopy } from "@/components/analysis/usePlotCopy";
import {
  FACADES,
  MAX_RADIATION,
  fetchIndicators,
  formatMetric,
  getConstraints,
  heatColor,
  levelOf,
  plotDimensions,
} from "@/lib/analysis-detail";
import type { Facade } from "@/lib/analysis-detail";
import FacadePicker from "@/components/analysis/FacadePicker";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useResults } from "@/lib/results";
import { fill, useResultsCopy } from "@/lib/results-copy";
import { mockUser } from "@/lib/user";
import type { Role } from "@/lib/user";
import { MAX_RESULT_NAME_LENGTH } from "@/lib/validation";

function MapLoading() {
  const text = usePlotCopy().select.mapLoading;
  return (
    <div className="flex h-full items-center justify-center bg-navy-50 text-sm text-navy-900/70">
      {text}
    </div>
  );
}

// The map needs the browser, so it is loaded only on the client.
const ResultMap = dynamic(() => import("@/components/map/ResultMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

// The diagrams need the browser (maps), so they are loaded only on the client.
const SiteDiagrams = dynamic(() => import("@/components/analysis/SiteDiagrams"), {
  ssr: false,
});

const linkButton =
  "rounded-control border border-navy-900/15 bg-white px-5 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-navy-50";

type Message = { tone: "success" | "info"; text: string } | null;

function ResultsContent() {
  const c = useResultsCopy();
  const { t, lang } = useT();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const demo = params.get("demo"); // "indicators-error" or "export-error" (for testing) 
  const { results, setSaved, rename, markOpened } = useResults();
  const result = results.find((r) => r.id === id);
  
  useEffect(() => {
    markOpened(id);
  }, [id, markOpened]);


  const [role, setRole] = useState<Role>(mockUser.role);
  const [facade, setFacade] = useState<Facade>("south");
  const [indicators, setIndicators] = useState<IndicatorsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // The indicators load on their own, so a failure only affects their section.
  useEffect(() => {
    const controller = new AbortController();
    fetchIndicators(id, {
      fail: demo === "indicators-error" && attempt === 0,
      signal: controller.signal,
    })
      .then((data) => setIndicators({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setIndicators({ status: "error" });
      });
    return () => controller.abort();
  }, [id, demo, attempt]);

  function retryIndicators() {
    setIndicators({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  const architect = role === "architect";
  const ready = indicators.status === "ready" ? indicators.data : null;
  const constraints = useMemo(() => getConstraints(), []);
  const area = result?.area ?? 0;
  const lat = result?.lat ?? 0;
  const lng = result?.lng ?? 0;
  const dims = plotDimensions(area);

  const heat = useMemo(() => {
    if (!ready) return null;
    const values = {} as Record<Facade, number>;
    FACADES.forEach((f) => (values[f] = ready.facades[f].radiation / MAX_RADIATION));
    return values;
  }, [ready]);

  const tips = useMemo(() => {
    const values = {} as Record<Facade, string>;
    FACADES.forEach((f) => {
      const radiation = ready?.facades[f].radiation;
      const text =
        radiation === undefined
          ? "…"
          : architect
            ? formatMetric("radiation", radiation)
            : c.indicators.levels[levelOf("radiation", radiation)];
      values[f] = `${c.facade.names[f]}: ${text}`;
    });
    return values;
  }, [ready, architect, c]);

  if (!result) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold">{c.notFound.title}</h1>
        <p className="mt-3 text-sm text-navy-900/70">{c.notFound.text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/history" className={linkButton}>
            {c.notFound.history}
          </Link>
          <Link href="/select-plot" className={linkButton}>
            {c.actions.newAnalysis}
          </Link>
        </div>
      </main>
    );
  }

  function handleSave() {
    if (!result) return;
    const next = !result.saved;
    setSaved(result.id, next);
    setMessage({
      tone: next ? "success" : "info",
      text: next ? fill(c.messages.saved, { name: result.name }) : c.messages.unsaved,
    });
  }

  function commitName() {
    const name = draft.trim();
    if (result && name && name !== result.name) rename(result.id, name);
    setEditing(false);
  }

  // null blocks the export until the analysis data is complete
  const report = ready
    ? {
        role,
        name: result.name,
        date: result.date,
        area: result.area,
        lat: result.lat,
        lng: result.lng,
        indicators: ready,
        constraints,
        parcelNote: result.parcelNote,
      }
    : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {editing ? (
              <input
                autoFocus
                value={draft}
                maxLength={MAX_RESULT_NAME_LENGTH}
                aria-label={c.actions.rename}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="rounded-control border border-navy-900/15 px-2 font-heading text-2xl font-bold"
              />
            ) : (
              <h1
                title={c.actions.renameHint}
                className="cursor-text font-heading text-2xl font-bold"
                onDoubleClick={() => {
                  setDraft(result.name);
                  setEditing(true);
                }}
              >
                {result.name}
              </h1>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-900/70">
            <span>
              {c.header.area}:{" "}
              <bdi>
                {result.area} {t("unit.sqm")}
              </bdi>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {c.header.date}: {formatDate(result.date, lang)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {c.header.coordinates}:{" "}
              <bdi dir="ltr">
                {result.lat.toFixed(5)}, {result.lng.toFixed(5)}
              </bdi>
            </span>
          </p>
        </div> 

        
          <div className="flex flex-wrap gap-3">
           <Button
             variant="secondary"
    onClick={handleSave}
    aria-pressed={result.saved}
    className="inline-flex items-center gap-2"
             >
             <BookmarkIcon filled={result.saved} />
              {result.saved ? c.actions.saved : c.actions.save}
            </Button>

            <Button
             disabled={report === null}
             title={report === null ? c.actions.exportWait : undefined}
             onClick={() => setExportOpen(true)}
             className="inline-flex items-center gap-2"
              >
             <ExportIcon />
             {c.actions.export}
            </Button>
         </div>

      </div>

      {message && (
        <div className="mt-4">
          <StatusMessage tone={message.tone}>{message.text}</StatusMessage>
        </div>
      )}

      {result.parcelNote && (
        <p className="mt-4 rounded-card border border-caution-500/40 bg-caution-50 p-4 text-sm leading-7 text-caution-700">
          {fill(c.parcelNote, { area: result.area })}
        </p>
      )}

      {architect && (
        <div className="mt-6">
          <SiteDiagrams lat={lat} lng={lng} />
        </div>
      )}
      
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold">{c.map.title}</h2>
            <p className="mt-1 text-xs text-navy-900/70">{c.map.hint}</p>
          </div>
          <div className="relative isolate z-0 h-[380px] overflow-hidden rounded-card border border-navy-900/15 sm:h-[440px]">
            <ResultMap
              lat={lat}
              lng={lng}
              width={dims.width}
              depth={dims.depth}
              setbacks={constraints.setbacks}
              heat={heat}
              selected={facade}
              tips={tips}
              label={c.map.label}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-navy-900/70">
            <span>{c.map.legendLow}</span>
            <span
              className="h-2 flex-1 rounded-pill"
              style={{
                background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})`,
              }}
            />
            <span>{c.map.legendHigh}</span>
          </div>
          <FacadePicker
            label={c.facade.label}
            value={facade}
            onChange={setFacade}
            names={c.facade.names}
          />
          </Card>
          {architect && ready && <SiteIndicatorsCard site={ready.site} />}
        </div>

        <div className="flex flex-col gap-5">
          <IndicatorsPanel state={indicators} facade={facade} role={role} onRetry={retryIndicators} />
          {architect && ready && <NeighboursCard facade={facade} />}
          {ready && <WindCard site={ready.site} />}
        </div>
      </div>

      {!architect && ready && (
        <div className="mt-5">
          <NeighbourhoodCard site={ready.site} />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <DecisionList role={role} indicators={ready} constraints={constraints} />
        <ConstraintsCard constraints={constraints} />
      </div>

      <p className="mt-8 text-xs leading-6 text-navy-900/70">{c.disclaimer}</p>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-6 max-w-sm rounded-card border border-dashed border-navy-900/25 p-4">
          <SegmentedControl<Role>
            label={c.dev.label}
            value={role}
            onChange={setRole}
            options={[
              { value: "homeowner", label: t("role.homeowner") },
              { value: "architect", label: t("role.architect") },
            ]}
          />
        </div>
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        report={report}
        fileName={`maamar-report-${result.id}.html`}
        failOnce={demo === "export-error"}
      />
    </main>
  );
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  // key={id}: opening another result starts with a clean state
  return (
    <Suspense>
      <ResultsContent key={id} />
    </Suspense>
  );
}
