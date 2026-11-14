"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import SegmentedControl from "@/components/SegmentedControl";
import StatusMessage from "@/components/analysis/StatusMessage";
import { usePlotCopy } from "@/components/analysis/usePlotCopy";
import type { MapFocus } from "@/components/map/PlotPickerMap";
import { MAX_BUILDING_HEIGHT, fetchNeighborhood, isResidential, lookupPlot } from "@/lib/analysis";
import { useT } from "@/lib/i18n";
import type { PlotInfo } from "@/lib/analysis";
import { formatCoordinates, isInsideRiyadh, parseCoordinates } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";

function MapLoading() {
  const c = usePlotCopy().select;
  return (
    <div className="flex h-full items-center justify-center bg-navy-50 text-sm text-navy-900/70">
      {c.mapLoading}
    </div>
  );
}

// The map needs the browser, so it is loaded only on the client.
const PlotPickerMap = dynamic(() => import("@/components/map/PlotPickerMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

type Mode = "map" | "coords";
type VillaType = "attachedBoth" | "attachedOne" | "detached";
type Message = { tone: "error" | "success"; text: string } | null;

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-navy-900/70">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

// Only numbers in the area and height fields: Arabic digits become 0-9, the Arabic decimal mark becomes
// ".", and anything else (letters, spaces, a second decimal mark) is dropped as it is typed.
function numbersOnly(text: string): string {
  const latin = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".")
    .replace(/[^0-9.]/g, "");
  const dot = latin.indexOf(".");
  return dot === -1 ? latin : latin.slice(0, dot + 1) + latin.slice(dot + 1).replace(/\./g, "");
}

// "New analysis" from a result opens this page with the same plot already chosen:
// /select-plot?lat=..&lng=..&villaType=..
function initialPlot(params: URLSearchParams): { point: LatLng | null; villaType: VillaType | "" } {
  const type = params.get("villaType");
  const villaType = type === "attachedBoth" || type === "attachedOne" || type === "detached" ? type : "";
  const latText = params.get("lat");
  const lngText = params.get("lng");
  if (!latText || !lngText) return { point: null, villaType };
  const point = { lat: Number(latText), lng: Number(lngText) };
  const valid = Number.isFinite(point.lat) && Number.isFinite(point.lng) && isInsideRiyadh(point);
  return { point: valid ? point : null, villaType };
}

export default function SelectPlotPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense>
      <SelectPlotContent />
    </Suspense>
  );
}

function SelectPlotContent() {
  const c = usePlotCopy().select;
  const { lang } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [initial] = useState(() => initialPlot(params));
  const [mode, setMode] = useState<Mode>("map");
  const [villaType, setVillaType] = useState<VillaType | "">(initial.villaType);
  const [villaTypeError, setVillaTypeError] = useState("");
  const [latText, setLatText] = useState(initial.point ? initial.point.lat.toFixed(6) : "");
  const [lngText, setLngText] = useState(initial.point ? initial.point.lng.toFixed(6) : "");
  const [message, setMessage] = useState<Message>(null);
  const [point, setPoint] = useState<LatLng | null>(initial.point);
  const [plot, setPlot] = useState<PlotInfo | null>(null);
  // undefined while loading, null when no neighborhood was found
  const [neighborhood, setNeighborhood] = useState<string | null | undefined>(undefined);
  const [focus, setFocus] = useState<MapFocus | null>(
    initial.point ? { point: initial.point, zoom: 17, nonce: 0 } : null,
  );
  const [optionalArea, setOptionalArea] = useState("");
  const [expectedHeight, setExpectedHeight] = useState("");
  const lookupId = useRef(0);
  const [optionalError, setOptionalError] = useState("");



  // the plot and the neighborhood load in parallel; each shows as soon as it arrives
  function loadPlot(next: LatLng) {
    const id = ++lookupId.current;
    lookupPlot(next).then((info) => {
      if (id === lookupId.current) setPlot(info); // ignore answers for an older click
    });
    fetchNeighborhood(next, lang).then((name) => {
      if (id === lookupId.current) setNeighborhood(name);
    });
  }

  function selectPoint(next: LatLng) {
    setPoint(next);
    setPlot(null);
    setNeighborhood(undefined);
    setFocus({ point: next, zoom: 17, nonce: Date.now() });
    loadPlot(next);
  }

  // the plot chosen from the address (a new analysis of the same plot) loads once, when the page opens
  useEffect(() => {
    if (initial.point) loadPlot(initial.point);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A point outside Riyadh clears the point chosen before, so it cannot be analyzed by mistake.
  function clearPoint() {
    lookupId.current++; // answers still on their way are ignored
    setPoint(null);
    setPlot(null);
    setNeighborhood(undefined);
  }

  function handlePick(next: LatLng) {
    if (!isInsideRiyadh(next)) {
      clearPoint();
      setMessage({ tone: "error", text: c.errOutside });
      return;
    }
    setMessage(null);
    setLatText(next.lat.toFixed(6));
    setLngText(next.lng.toFixed(6));
    selectPoint(next);
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const result = parseCoordinates(latText, lngText);
    if (!result.ok) {
      const text =
        result.error === "missing"
          ? c.errMissing
          : result.error === "invalid"
            ? c.errInvalid
            : c.errOutside;
      if (result.error === "outside") clearPoint();
      setMessage({ tone: "error", text });
      return;
    }
    setMessage({ tone: "success", text: c.found });
    selectPoint(result.point);
  }

  
  // Only a residential plot from the Riyadh parcels layer can be analyzed (a street or another use is refused).
  const plotProblem = plot && (!plot.outline || !isResidential(plot.landUse)) ? c.errNotResidential : null;

  // The municipality's limits, checked as the user types: the height cannot pass the allowed maximum,
  // and the area cannot be larger than the plot itself (its area from the parcels layer).
  const plotArea = plot?.outline ? plot.area : null;
  const heightError =
    expectedHeight !== "" && Number(expectedHeight) > MAX_BUILDING_HEIGHT
      ? c.errHeightMax.replace("{max}", String(MAX_BUILDING_HEIGHT))
      : "";
  const areaError =
    optionalArea !== "" && plotArea !== null && Number(optionalArea) > plotArea
      ? c.errAreaMax.replace("{max}", plotArea.toLocaleString())
      : "";

  function start() {
    if (!point || !plot || plotProblem || heightError || areaError) return;
   if (!villaType) {
   setVillaTypeError(c.villaTypeRequired);
   return;
   }

   setVillaTypeError("");



    const areaText = optionalArea.trim();
    const heightText = expectedHeight.trim();

    const validArea =
      areaText === "" ||
      (Number.isFinite(Number(areaText)) && Number(areaText) > 0);

    const validHeight =
      heightText === "" ||
      (Number.isFinite(Number(heightText)) && Number(heightText) > 0);

    
    if (!validArea || !validHeight) {
      setOptionalError(c.optionalInfoError);
      return;
    }


    setOptionalError("");

    const query = new URLSearchParams({
     lat: String(point.lat),
     lng: String(point.lng),
     area: String(areaText === "" ? plot.area : Number(areaText)),
     villaType: villaType,
   });

    if (heightText !== "") {
      query.set("height", String(Number(heightText)));
    }

    router.push(`/analyzing?${query.toString()}`);
  }


  const selected = point
  ? {
      point,
      width: plot?.width ?? 20,
      depth: plot?.depth ?? 24,
      rotation: 0,
      outline: plot?.outline ?? null,
      pending: !plot, // draw only the pin until the real plot arrives
    }
  : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold">{c.title}</h1>
      <p className="mt-1 text-sm text-navy-900/70">{c.subtitle}</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <SegmentedControl<Mode>
              label={c.method}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setMessage(null);
              }}
              options={[
                { value: "map", label: c.modeMap },
                { value: "coords", label: c.modeCoords },
              ]}
            />

            {mode === "map" ? (
              <p className="text-sm leading-7 text-navy-900/70">{c.mapHint}</p>
            ) : (
              <form onSubmit={handleSearch} noValidate className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={c.latitude}
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="24.7136"
                    value={latText}
                    onChange={(e) => setLatText(e.target.value)}
                  />
                  <Input
                    label={c.longitude}
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="46.6753"
                    value={lngText}
                    onChange={(e) => setLngText(e.target.value)}
                  />
                </div>
                <p className="text-xs text-navy-900/70">{c.coordsHint}</p>
                <Button type="submit" variant="secondary">
                  {c.search}
                </Button>
              </form>
            )}

            {message && <StatusMessage tone={message.tone}>{message.text}</StatusMessage>}
          </Card>
                    <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">{c.plotTitle}</h2>
            </div>
            {!point ? (
              <p className="text-sm text-navy-900/70">{c.plotEmpty}</p>
            ) : (
              <dl className="grid gap-2.5 text-sm">
                <Row
                  label={c.coordinates}
                  value={<bdi dir="ltr">{formatCoordinates(point)}</bdi>}
                />
                {plot && plotProblem ? (
                  // a refused plot (a street or another use): only the reason, no sample area or details
                  <StatusMessage tone="error">{plotProblem}</StatusMessage>
                ) : plot ? (
                  <>
                    <Row
                      label={c.area}
                      value={
                        <bdi>
                          {plot.area} {c.areaUnit}
                        </bdi>
                      }
                    />
                    <Row label={c.neighborhood} value={neighborhood === undefined ? "…" : (neighborhood ?? c.unknown)} />
                    <Row label={c.orientation} value={plot.orientation ? c.directions[plot.orientation] : c.unknown} />
                  </>
                ) : (
                  <p className="text-navy-900/70">{c.plotLoading}</p>
                )}
              </dl>
            )}
          </Card>
          
          <Card className="flex flex-col gap-3">
             <label htmlFor="villa-type" className="text-sm font-bold">
             {c.villaTypeTitle} <span className="text-danger-500">*</span>
           </label>

            <select
             id="villa-type"
             value={villaType}
             onChange={(e) => {
              setVillaType(e.target.value as VillaType | "");
              setVillaTypeError("");
             }}
             required
             aria-invalid={!!villaTypeError}
             className="w-full rounded-control border border-navy-900/20 bg-white px-4 py-3 text-sm text-navy-900"
             >
             <option value="">{c.villaTypePlaceholder}</option>
             <option value="attachedBoth">{c.villaTypes.attachedBoth}</option>
             <option value="attachedOne">{c.villaTypes.attachedOne}</option>
               <option value="detached">{c.villaTypes.detached}</option>
           </select>

            {villaTypeError && (
             <StatusMessage tone="error">
              {c.villaTypeRequired}
               </StatusMessage>
            )}
          </Card>

          
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold">
                {c.optionalInfoTitle}
              </h2>
              <p className="mt-1 text-xs leading-6 text-navy-900/70">
                {c.optionalInfoHint}
              </p>
            </div>

            <Input
              label={c.optionalAreaLabel}
              dir="ltr"
              inputMode="decimal"
              placeholder="450"
              value={optionalArea}
              onChange={(e) => setOptionalArea(numbersOnly(e.target.value))}
              error={areaError || undefined}
            />

            <Input
              label={c.expectedHeightLabel}
              dir="ltr"
              inputMode="decimal"
              placeholder="12"
              value={expectedHeight}
              onChange={(e) => setExpectedHeight(numbersOnly(e.target.value))}
              error={heightError || undefined}
            />
            
            {optionalError && (
              <StatusMessage tone="error">
                {optionalError}
              </StatusMessage>
            )}

          </Card>




          <Button fullWidth disabled={!point || !plot || plotProblem !== null || heightError !== "" || areaError !== ""} onClick={start}>
            {c.start}
          </Button>
        </div>

        <div className="relative isolate z-0 h-[60vh] min-h-[420px] overflow-hidden rounded-card border border-navy-900/15 lg:h-[calc(100vh-190px)] lg:min-h-[520px]">
          <PlotPickerMap
            selected={selected}
            focus={focus}
            onPick={handlePick}
            label={c.mapLabel}
            layerLabels={{ street: c.layerStreet, satellite: c.layerSatellite }}
          />
        </div>
      </div>
    </main>
  );
}