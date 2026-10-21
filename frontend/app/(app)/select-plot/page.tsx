"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import SegmentedControl from "@/components/SegmentedControl";
import StatusMessage from "@/components/analysis/StatusMessage";
import { usePlotCopy } from "@/components/analysis/usePlotCopy";
import type { MapFocus } from "@/components/map/PlotPickerMap";
import { USE_MOCK_DATA, lookupPlot } from "@/lib/analysis";
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

export default function SelectPlotPage() {
  const c = usePlotCopy().select;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("map");
  const [villaType, setVillaType] = useState<VillaType | "">("");
  const [villaTypeError, setVillaTypeError] = useState("");
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [plot, setPlot] = useState<PlotInfo | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [optionalArea, setOptionalArea] = useState("");
  const [expectedHeight, setExpectedHeight] = useState("");
  const lookupId = useRef(0);
  const [optionalError, setOptionalError] = useState("");


  function selectPoint(next: LatLng) {
    setPoint(next);
    setPlot(null);
    setFocus({ point: next, zoom: 17, nonce: Date.now() });
    const id = ++lookupId.current;
    lookupPlot(next).then((info) => {
      if (id === lookupId.current) setPlot(info); // ignore answers for an older click
    });
  }

  function handlePick(next: LatLng) {
    if (!isInsideRiyadh(next)) {
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
      setMessage({ tone: "error", text });
      return;
    }
    setMessage({ tone: "success", text: c.found });
    selectPoint(result.point);
  }

  
  function start() {
    if (!point || !plot) return;
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
              {USE_MOCK_DATA && plot && <Badge tone="caution">{c.mockTag}</Badge>}
            </div>
            {!point ? (
              <p className="text-sm text-navy-900/70">{c.plotEmpty}</p>
            ) : (
              <dl className="grid gap-2.5 text-sm">
                <Row
                  label={c.coordinates}
                  value={<bdi dir="ltr">{formatCoordinates(point)}</bdi>}
                />
                {plot ? (
                  <>
                    <Row
                      label={c.area}
                      value={
                        <bdi>
                          {plot.area} {c.areaUnit}
                        </bdi>
                      }
                    />
                    <Row label={c.neighborhood} value={plot.neighborhood} />
                    <Row label={c.orientation} value={c.directions[plot.orientation]} />
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
              onChange={(e) => setOptionalArea(e.target.value)}
            />

            <Input
              label={c.expectedHeightLabel}
              dir="ltr"
              inputMode="decimal"
              placeholder="12"
              value={expectedHeight}
              onChange={(e) => setExpectedHeight(e.target.value)}
            />
            
            {optionalError && (
              <StatusMessage tone="error">
                {optionalError}
              </StatusMessage>
            )}

          </Card>




          <Button fullWidth disabled={!point || !plot} onClick={start}>
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
