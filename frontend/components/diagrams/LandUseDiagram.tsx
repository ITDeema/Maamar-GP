"use client";

import { useEffect } from "react";
import DiagramFrame from "@/components/diagrams/DiagramFrame";
import LegendBox, { LegendRow } from "@/components/diagrams/LegendBox";
import { drawLandUse, zoomForRadius } from "@/components/diagrams/draw";
import { useElementSize } from "@/components/diagrams/useElementSize";
import { useStaticMap } from "@/components/diagrams/useStaticMap";
import { SITE, USE_COLORS } from "@/lib/diagram-palette";
import { diagramRadius, landOverlay } from "@/lib/diagram-svg";
import type { Loadable } from "@/lib/loadable";
import { useResultsCopy } from "@/lib/results-copy";
import type { Surroundings } from "@/lib/site-surroundings";

type LandUseDiagramProps = {
  lat: number;
  lng: number;
  around: Loadable<Surroundings>;
  onRetry: () => void;
};

// Buildings and zones colored by how they are used, inside a circle of 800 m.
export default function LandUseDiagram({ lat, lng, around, onRetry }: LandUseDiagramProps) {
  const c = useResultsCopy();
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const { elRef, mapRef, layerRef } = useStaticMap();
  const radius = diagramRadius(size.w, size.h);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || size.w === 0) return;
    map.invalidateSize();
    const zoom = zoomForRadius(lat, diagramRadius(size.w, size.h));
    map.setView([lat, lng], zoom, { animate: false });
    layer.clearLayers();
    if (around.status === "ready") drawLandUse(layer, around.data, zoom);
  }, [lat, lng, size, around, mapRef, layerRef]);

  const ready = around.status === "ready" ? around.data : null;

  return (
    <DiagramFrame
      title={c.diagrams.land.title}
      status={around.status}
      onRetry={onRetry}
      boxRef={boxRef}
      legend={<>{ready && (
        <LegendBox>
          {ready.presentUses.map((use) => (
            <LegendRow
              key={use}
              swatch={
                <span
                  className="block h-3.5 w-4 rounded-sm border border-navy-900/40"
                  style={{ background: USE_COLORS[use] }}
                />
              }
              label={c.diagrams.land.uses[use]}
            />
          ))}
          <LegendRow
            swatch={
              <span
                className="block size-3.5 rounded-pill border-2 border-white"
                style={{ background: SITE }}
              />
            }
            label={c.diagrams.land.selectedSite}
          />
        </LegendBox>
      )}</>}
    >
      <div
        dir="ltr"
        className="absolute inset-0 isolate z-0"
        style={{ clipPath: size.w > 0 ? `circle(${radius + 1}px at 50% 50%)` : undefined }}
      >
        <div ref={elRef} className="h-full w-full bg-white!" />
      </div>
      <svg
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        dangerouslySetInnerHTML={{
          __html:
            ready && size.w > 0
              ? landOverlay(size.w, size.h, c.diagrams.north, c.diagrams.land.selectedSite)
              : "",
        }}
      />
    </DiagramFrame>
  );
}
