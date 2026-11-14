"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { BookmarkIcon, ExportIcon } from "@/components/analysis/ActionIcons";
import ConstraintsCard from "@/components/analysis/ConstraintsCard";
import DecisionList from "@/components/analysis/DecisionList";
import ExportModal from "@/components/analysis/ExportModal";
import IndicatorsPanel, { SiteIndicatorsCard } from "@/components/analysis/IndicatorsPanel";
import type { IndicatorsState } from "@/components/analysis/IndicatorsPanel";
import UpdateProjectDialog from "@/components/analysis/UpdateProjectDialog";
import StatusMessage from "@/components/analysis/StatusMessage";
import WindCard from "@/components/analysis/WindCard";
import NeighbourhoodCard from "@/components/analysis/NeighbourhoodCard";
import NeighboursCard from "@/components/analysis/NeighboursCard";
import { usePlotCopy } from "@/components/analysis/usePlotCopy";
import {
  FACADES,
  fetchIndicators,
  formatMetric,
  getConstraints,
  levelOf,
  mainFacades,
  plotDimensions,
  radiationGradient,
} from "@/lib/analysis-detail";
import type { Facade } from "@/lib/analysis-detail";
import { loadSavedResults, saveResults, saveServices } from "@/lib/analysis-store";
import type { Service } from "@/lib/neighbourhood";
import { lookupPlot } from "@/lib/analysis";
import type { LatLng } from "@/lib/geo";
import FacadePicker from "@/components/analysis/FacadePicker";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useResults } from "@/lib/results";
import { fill, useResultsCopy } from "@/lib/results-copy";
import { useProfileRole } from "@/lib/profile-role";
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
  const router = useRouter();
  const { results, loaded, setSaved, rename, markOpened, setRole, markRenewed } = useResults();
  const result = results.find((r) => r.id === id);
  
  const exists = result !== undefined;
  useEffect(() => {
    if (exists) markOpened(id);
  }, [id, exists, markOpened]);


  // An analysis is shown with the account type it was made with (Project.roleAtAnalysis),
  // even after the account type in the profile changes. A pop-up then offers to update it or analyze again
  // (the same pop-up as for an analysis more than 6 months old).
  const profile = useProfileRole();
  const role = result?.role ?? profile.role ?? "homeowner";
  const [dialogClosed, setDialogClosed] = useState(false);
  const [facade, setFacade] = useState<Facade>("south");
  // the real plot boundary for the facade map; the map opens on the plot's main facade
  const [outline, setOutline] = useState<LatLng[] | null>(null);
  const resultLat = result?.lat;
  const resultLng = result?.lng;
  const resultArea = result?.area;
  const resultHeight = result?.height;
  useEffect(() => {
    if (resultLat === undefined || resultLng === undefined) return;
    let active = true;
    lookupPlot({ lat: resultLat, lng: resultLng }).then((plot) => {
      if (!active) return;
      setOutline(plot.outline);
      // open on the main façade; when it is not one of the four shown, on the first shown one
      const shownNow = mainFacades(plot.outline);
      const mainFacade = plot.orientation ? (plot.orientation.toLowerCase() as Facade) : null; // "northEast" → "northeast"
      if (mainFacade && (!shownNow || shownNow.includes(mainFacade))) setFacade(mainFacade);
      else if (shownNow) setFacade(shownNow[0]);
    });
    return () => {
      active = false;
    };
  }, [resultLat, resultLng]);
  // only the four longest walls of the plot are shown (its real tilt); all eight until the outline is known
  const shown = useMemo(() => mainFacades(outline), [outline]);
  const [indicators, setIndicators] = useState<IndicatorsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [servicesStatus, setServicesStatus] = useState<"loading" | "ready" | "error">("loading");
 

  // The indicators load on their own, so a failure only affects their section.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      // A result opened from the history shows what was saved, without calculating again.
      // "Try again" (attempt > 0) always calculates again and saves the new values.
      if (attempt === 0 && demo === null && exists) {
        const saved = await loadSavedResults(id);
        if (controller.signal.aborted) return;
        if (saved) {
          setIndicators({ status: "ready", data: saved });
          return;
        }
      }
      const data = await fetchIndicators(id, {
        fail: demo === "indicators-error" && attempt === 0,
        signal: controller.signal,
        lat: resultLat,
        lng: resultLng,
        design: { area: resultArea, height: resultHeight }, // the building is the user's design
      });
      if (controller.signal.aborted) return;
      setIndicators({ status: "ready", data });
      // Only a complete analysis is saved; a failure to save does not affect the dashboard.
      if (exists && demo === null) void saveResults(id, data);
    }
    load().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setIndicators({ status: "error" });
    });
    return () => controller.abort();
  }, [id, demo, attempt, resultLat, resultLng, resultArea, resultHeight, exists]);

  // The services arrived after the analysis (the card loaded them): they are shown and added to the saved analysis.
  function servicesLoaded(services: Service[]) {
    setIndicators((state) =>
      state.status === "ready" ? { status: "ready", data: { ...state.data, services } } : state,
    );
    if (exists && demo === null) void saveServices(id, services);
  }

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
    const values = {} as Record<Facade, number | null>;
    FACADES.forEach((f) => {
      const radiation = ready.facades[f].radiation;
      values[f] = radiation;
    });
    return values;
  }, [ready]);

  const tips = useMemo(() => {
    const values = {} as Record<Facade, string>;
    FACADES.forEach((f) => {
      const radiation = ready?.facades[f].radiation;
      const text =
        radiation === undefined
          ? "…"
          : radiation === null
            ? c.indicators.noWall
            : architect
            ? formatMetric("radiation", radiation)
            : c.indicators.levels[levelOf("radiation", radiation)];
      values[f] = `${c.facade.names[f]}: ${text}`;
    });
    return values;
  }, [ready, architect, c]);

  if (!loaded || !profile.ready) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="status" className="text-sm text-navy-900/70">
          {c.loading}
        </p>
      </main>
    );
  }

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

const canSave =
  result.saved || (ready !== null && ready.complete === true && (architect || servicesStatus === "ready") && result.complete);

  async function handleSave() {
    if (!result || !canSave) return;
    setNotice(null);
    if (!(await setSaved(result.id, !result.saved))) setNotice(c.actions.saveFailed);
  }
  
  async function commitName() {
    const name = draft.trim();
    if (!result || !name || name === result.name) return setEditing(false);
    const outcome = await rename(result.id, name);
    if (outcome === "ok") {
      setNameError(null);
      setEditing(false);
    } else {
      setNameError(t(outcome === "duplicate" ? "rename.errorDuplicate" : "rename.errorFailed"));
      setEditing(true);
    }
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
        indicators: { ...ready, shown },
        constraints,
        parcelNote: result.parcelNote,
      }
    : null;

  // The account type changed since this analysis, or it is more than 6 months old: a pop-up (see UpdateProjectDialog).
  const newRole = profile.role !== null && profile.role !== result.role ? profile.role : null;
  const old = result.stale;

  // "Update this project": the new account type, and when it is old, the indicators calculated again and saved
  // with today's date. Resolves to false when something could not be saved (the project stays as it was).
  async function updateProject(): Promise<boolean> {
    if (!result) return false;
    if (old) {
      const controller = new AbortController();
      try {
        const fresh = await fetchIndicators(result.id, {
          fail: false,
          signal: controller.signal,
          lat: result.lat,
          lng: result.lng,
          design: { area: result.area, height: result.height },
        });
        if (!(await saveResults(result.id, fresh, { renew: true }))) return false;
        setIndicators({ status: "ready", data: fresh });
        markRenewed(result.id);
      } catch {
        return false;
      }
    }
    if (newRole && !(await setRole(result.id, newRole))) return false;
    return true;
  }

  // "New analysis": the plot page opens with the same plot (and villa type) already chosen;
  // this project stays as it is.
  function analyzeAgain() {
    if (!result) return;
    const query = new URLSearchParams({ lat: String(result.lat), lng: String(result.lng) });
    if (result.villaType) query.set("villaType", result.villaType);
    router.push(`/select-plot?${query.toString()}`);
  }

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
                onChange={(e) => { setDraft(e.target.value); setNameError(null); }}
               onBlur={() => { if (!nameError) void commitName(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitName();
                  if (e.key === "Escape") { setNameError(null); setEditing(false); }
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

          {nameError && <p role="alert" className="mt-1 text-sm text-danger-500">{nameError}</p>}
          {notice && <p role="alert" className="mt-1 text-sm text-danger-500">{notice}</p>}
          
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
            disabled={!canSave}                                       
            title={!canSave ? c.actions.saveWait : undefined}  
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

      


      {result.parcelNote && (
        <p className="mt-4 rounded-card border border-caution-500/40 bg-caution-50 p-4 text-sm leading-7 text-caution-700">
          {fill(c.parcelNote, { area: result.area })}
        </p>
      )}

      {architect && (
        <div className="mt-6">
          {/* key: after "Update this project" the project is new again and takes recent surroundings */}
          <SiteDiagrams
            key={old ? "old" : "new"}
            lat={lat}
            lng={lng}
            projectId={demo === null ? result.id : undefined}
          />
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
              outline={outline}
              shown={shown}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-navy-900/70">
            <span>{c.map.legendLow}</span>
            <span className="h-2 flex-1 rounded-pill" style={{ background: radiationGradient(lang === "ar") }} />
            <span>{c.map.legendHigh}</span>
          </div>
          <FacadePicker
            label={c.facade.label}
            value={facade}
            onChange={setFacade}
            names={c.facade.names}
            options={shown}
          />
          </Card>
          {architect && ready && <SiteIndicatorsCard site={ready.site} />}
        </div>

        <div className="flex flex-col gap-5">
          <IndicatorsPanel state={indicators} facade={facade} role={role} onRetry={retryIndicators} />
          {architect && ready && <NeighboursCard facade={facade} data={ready.neighbours?.[facade] ?? null} />}
          {!architect && ready && <WindCard site={ready.site} />}
        </div>
      </div>

      {!architect && ready && (
        <div className="mt-5">
          <NeighbourhoodCard
            site={ready.site}
            lat={lat}
            lng={lng}
            services={ready.services}
            onStatus={setServicesStatus}
            onLoaded={servicesLoaded}
          />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <DecisionList role={role} indicators={ready} constraints={constraints} />
        <div className="self-start">
          <ConstraintsCard constraints={constraints} />
       </div>
      </div>

      <p className="mt-8 text-xs leading-6 text-navy-900/70">{c.disclaimer}</p>

      {(newRole || old) && (
        <UpdateProjectDialog
          open={!dialogClosed}
          oldRole={newRole ? result.role : null}
          old={old}
          onUpdate={updateProject}
          onNewAnalysis={analyzeAgain}
          onClose={() => setDialogClosed(true)}
        />
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
