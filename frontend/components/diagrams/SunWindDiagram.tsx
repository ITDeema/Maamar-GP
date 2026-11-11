"use client";

import { useEffect } from "react";
import DiagramFrame from "@/components/diagrams/DiagramFrame";
import LegendBox, { LegendRow } from "@/components/diagrams/LegendBox";
import { drawPlan } from "@/components/diagrams/draw";
import { useElementSize } from "@/components/diagrams/useElementSize";
import { useStaticMap } from "@/components/diagrams/useStaticMap";
import type { Facade } from "@/lib/analysis-detail";
import { SUN } from "@/lib/diagram-palette";
import { sunOverlay, waveArrow } from "@/lib/diagram-svg";
import type { WindArrow } from "@/lib/diagram-svg";
import type { Loadable } from "@/lib/loadable";
import type { SunPath, Wind, WindDirection } from "@/lib/site-api";
import type { Surroundings } from "@/lib/site-surroundings";
import { fill, useResultsCopy } from "@/lib/results-copy";

const SUN_ZOOM = 17;

const DEGREES: Record<WindDirection, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const FACADE_OF: Record<WindDirection, Facade> = {
  N: "north", NE: "northeast", E: "east", SE: "southeast",
  S: "south", SW: "southwest", W: "west", NW: "northwest",
};

type SunWindDiagramProps = {
  lat: number;
  lng: number;
  sun: Loadable<SunPath>;
  around: Loadable<Surroundings>;
  wind: Wind | null; // the hot (summer) and cool (winter) winds; null while loading or when it failed
  onRetry: () => void;
};

// The hot wind comes from the most frequent direction in summer, the cool wind from the most frequent in winter.
// The thicker arrow is the more frequent of the two.
function windArrows(wind: Wind | null): WindArrow[] {
  const summer = wind?.seasons?.summer;
  const winter = wind?.seasons?.winter;
  if (!summer || !winter) return [];
  const hotShare = summer.frequencies[summer.dominant];
  const coolShare = winter.frequencies[winter.dominant];
  const top = Math.max(hotShare, coolShare) || 1;
  let hot = DEGREES[summer.dominant];
  let cool = DEGREES[winter.dominant];
  if (hot === cool) {
    hot -= 10; // the same direction in both seasons: keep the two arrows apart
    cool += 10;
  }
  return [
    { from: hot, type: "hot", strength: 0.7 + 0.3 * (hotShare / top) },
    { from: cool, type: "cool", strength: 0.7 + 0.3 * (coolShare / top) },
  ];
}

// The sun's path over the site and the hot and cool winds (from the wind data), on a black and white plan.
// North is up; every arrow comes from its true direction and points at the site in the centre.
export default function SunWindDiagram({ lat, lng, sun, around, wind, onRetry }: SunWindDiagramProps) {
  const c = useResultsCopy();
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const { elRef, mapRef, layerRef } = useStaticMap();

  // frame the site and draw the plan under the sun and wind symbols
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || size.w === 0) return;
    map.invalidateSize();
    map.setView([lat, lng], SUN_ZOOM, { animate: false });
    layer.clearLayers();
    if (around.status === "ready") drawPlan(layer, around.data);
  }, [lat, lng, size, around, mapRef, layerRef]);

  const winds = windArrows(wind);
  const markup =
    sun.status === "ready" && size.w > 0 ? sunOverlay(size.w, size.h, sun.data, c.diagrams.north, winds) : "";
  const summer = wind?.seasons?.summer;
  const winter = wind?.seasons?.winter;

  const wave = (color: string) =>
    waveArrow(0, 7, 46, 7, { amp: 3, waves: 1.5, w0: 0.6, w1: 3, color });

  return (
    <DiagramFrame title={c.diagrams.sun.title} status={sun.status} onRetry={onRetry} boxRef={boxRef} legend={<>{sun.status === "ready" && (
        <LegendBox>
          <LegendRow
            swatch={
              <span
                className="block h-2 w-12 rounded-pill"
                style={{ background: `linear-gradient(90deg, ${SUN.end}, ${SUN.top}, ${SUN.end})` }}
              />
            }
            label={c.diagrams.sun.sunPath}
          />
          {summer && winter && (
            <>
              <LegendRow
                swatch={
                  <svg width="46" height="14" viewBox="0 0 46 14" aria-hidden="true" dangerouslySetInnerHTML={{ __html: wave(SUN.hot) }} />
                }
                label={fill(c.diagrams.sun.hotWindFrom, { dir: c.facade.names[FACADE_OF[summer.dominant]] })}
              />
              <LegendRow
                swatch={
                  <svg width="46" height="14" viewBox="0 0 46 14" aria-hidden="true" dangerouslySetInnerHTML={{ __html: wave(SUN.cool) }} />
                }
                label={fill(c.diagrams.sun.coolWindFrom, { dir: c.facade.names[FACADE_OF[winter.dominant]] })}
              />
            </>
          )}
        </LegendBox>
      )}</>}>
      {/* the map and the plan must not flip in right-to-left pages */}
      <div dir="ltr" className="absolute inset-0 isolate z-0">
        <div ref={elRef} className="h-full w-full bg-white!" />
      </div>
      <svg
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </DiagramFrame>
  );
}
