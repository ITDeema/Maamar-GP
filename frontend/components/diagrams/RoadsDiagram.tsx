"use client";

import { useEffect } from "react";
import DiagramFrame from "@/components/diagrams/DiagramFrame";
import LegendBox, { LegendRow } from "@/components/diagrams/LegendBox";
import { drawRoads, zoomForRadius } from "@/components/diagrams/draw";
import { useElementSize } from "@/components/diagrams/useElementSize";
import { useStaticMap } from "@/components/diagrams/useStaticMap";
import { INK, ROAD_STYLE, TRANSIT } from "@/lib/diagram-palette";
import { diagramRadius, roadsOverlay } from "@/lib/diagram-svg";
import type { Loadable } from "@/lib/loadable";
import { useResultsCopy } from "@/lib/results-copy";
import type { Surroundings } from "@/lib/site-surroundings";

type RoadsDiagramProps = {
  lat: number;
  lng: number;
  around: Loadable<Surroundings>;
  onRetry: () => void;
};

// The road hierarchy and the transit stops inside a circle of 800 m.
export default function RoadsDiagram({ lat, lng, around, onRetry }: RoadsDiagramProps) {
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
    if (around.status === "ready") drawRoads(layer, around.data, zoom);
  }, [lat, lng, size, around, mapRef, layerRef]);

  const ready = around.status === "ready" ? around.data : null;

  const road = (cls: 1 | 2 | 3) => (
    <span
      className="block w-8 rounded-pill"
      style={{ background: ROAD_STYLE[cls].color, height: Math.min(ROAD_STYLE[cls].w, 8) }}
    />
  );

  return (
    <DiagramFrame
      title={c.diagrams.roads.title}
      status={around.status}
      onRetry={onRetry}
      boxRef={boxRef}
      legend={<>{ready && (
        <LegendBox>
          <LegendRow swatch={road(1)} label={c.diagrams.roads.arterial} />
          <LegendRow swatch={road(2)} label={c.diagrams.roads.collector} />
          <LegendRow swatch={road(3)} label={c.diagrams.roads.local} />
          <LegendRow
            swatch={
              <span
                className="block size-2.5 rounded-pill border-[1.5px] bg-white"
                style={{ borderColor: INK }}
              />
            }
            label={c.diagrams.roads.busStop}
          />
          <LegendRow
            swatch={
              <span
                className="block size-3.5 rounded-pill border-2 border-white"
                style={{ background: TRANSIT }}
              />
            }
            label={c.diagrams.roads.metro}
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
          __html: ready && size.w > 0 ? roadsOverlay(size.w, size.h, c.diagrams.north) : "",
        }}
      />
    </DiagramFrame>
  );
}
