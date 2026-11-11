"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FACADES, isSide, radiationColor } from "@/lib/analysis-detail";
import type { Facade, Side } from "@/lib/analysis-detail";
import type { LatLng } from "@/lib/geo";
import { plotCorners, plotEdges } from "@/lib/plot-facade";
import type { Facade as Direction } from "@/lib/plot-facade";

type ResultMapProps = {
  lat: number; // plot center
  lng: number;
  width: number; // plot width in meters
  depth: number; // plot depth in meters
  setbacks: Record<Side, number>;
  heat: Record<Facade, number | null> | null; // summer radiation per façade, kWh/m²/day (null: no wall faces it), or null while unknown
  selected: Facade;
  tips: Record<Facade, string>; // hover text per façade
  label: string;
  outline?: LatLng[] | null; // the real plot boundary; when missing, a square from width and depth is drawn
  shown?: Facade[] | null; // the façades on display (the four longest walls); the others are not drawn (null = all)
};

const LETTERS: Record<Facade, string> = {
  north: "N",
  northeast: "NE",
  east: "E",
  southeast: "SE",
  south: "S",
  southwest: "SW",
  west: "W",
  northwest: "NW",
};
const NEUTRAL = "#9AA7B4";

// The plot's lines and dots show their value on hover, but keep the normal cursor (no hand).
function plainCursor(event: L.LeafletEvent) {
  const element = (event.target as L.Path).getElement() as SVGElement | undefined;
  element?.style.setProperty("cursor", "default");
}

// A façade that is not on display, or has no wall facing it (null once the values have loaded), is not drawn.
function hasNoWall(heat: Record<Facade, number | null> | null, facade: Facade, shown: Facade[] | null): boolean {
  return (shown !== null && !shown.includes(facade)) || (heat !== null && heat[facade] === null);
}

function colorFor(heat: Record<Facade, number | null> | null, facade: Facade): string {
  const value = heat?.[facade];
  return value === null || value === undefined ? NEUTRAL : radiationColor(value);
}

const FACADE_OF: Record<Direction, Facade> = {
  N: "north",
  NE: "northeast",
  E: "east",
  SE: "southeast",
  S: "south",
  SW: "southwest",
  W: "west",
  NW: "northwest",
};

function letterIcon(facade: Facade, isSelected: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;background:${isSelected ? "#C08649" : "#fff"};color:#072A4A;border:1px solid rgba(7,42,74,.3);box-shadow:0 1px 4px rgba(7,42,74,.25)">${LETTERS[facade]}</div>`,
  });
}

// The real plot, drawn like the square: all eight façades show.
// Each edge is a colored line for the direction it faces (from true north),
// each corner a colored dot for the direction it points to, and the eight letters sit around the plot.
function drawOutline(
  group: L.LayerGroup,
  outline: LatLng[],
  heat: Record<Facade, number | null> | null,
  selected: Facade,
  tips: Record<Facade, string>,
  shown: Facade[] | null,
) {
  L.polygon(
    outline.map((p) => [p.lat, p.lng] as L.LatLngTuple),
    { color: "#072A4A", weight: 2, dashArray: "6 6", interactive: false, fillColor: "#072A4A", fillOpacity: 0.08 },
  ).addTo(group);

  const colorOf = (facade: Facade) => colorFor(heat, facade);
  const edges = plotEdges(outline);
  const onEdge = new Set<Facade>();
  for (const edge of edges) {
    const facade = FACADE_OF[edge.facade];
    const isSelected = facade === selected;
    onEdge.add(facade);
    if (hasNoWall(heat, facade, shown)) continue;
    L.polyline(
      [
        [edge.from.lat, edge.from.lng],
        [edge.to.lat, edge.to.lng],
      ],
      { color: colorOf(facade), weight: isSelected ? 12 : 7, opacity: isSelected ? 1 : 0.8, lineCap: "round" },
    )
      .bindTooltip(tips[facade], { sticky: true })
      .on("add", plainCursor)
      .addTo(group);
  }

  // the directions no edge faces are shown on the sharpest corner pointing that way
  const corners = new Map<Facade, ReturnType<typeof plotCorners>[number]>();
  for (const corner of plotCorners(edges)) {
    const facade = FACADE_OF[corner.facade];
    if (onEdge.has(facade)) continue;
    const old = corners.get(facade);
    if (!old || corner.turn > old.turn) corners.set(facade, corner);
  }
  corners.forEach((corner, facade) => {
    if (hasNoWall(heat, facade, shown)) return;
    const isSelected = facade === selected;
    L.circleMarker([corner.at.lat, corner.at.lng], {
      radius: isSelected ? 13 : 9,
      color: isSelected ? "#072A4A" : "#FFFFFF",
      weight: isSelected ? 3 : 2,
      fillColor: colorOf(facade),
      fillOpacity: 1,
    })
      .bindTooltip(tips[facade], { sticky: true })
      .on("add", plainCursor)
      .addTo(group);
  });

  // the eight letters on a circle around the plot, like a compass
  const center = {
    lat: outline.reduce((sum, p) => sum + p.lat, 0) / outline.length,
    lng: outline.reduce((sum, p) => sum + p.lng, 0) / outline.length,
  };
  const metersX = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  const radius =
    Math.max(...outline.map((p) => Math.hypot((p.lng - center.lng) * metersX, (p.lat - center.lat) * 111_320))) + 4;
  FACADES.forEach((facade, i) => {
    if (shown !== null && !shown.includes(facade)) return; // only the letters of the façades on display
    const angle = (i * 45 * Math.PI) / 180; // clockwise from north
    L.marker(at(center, radius * Math.sin(angle), radius * Math.cos(angle)), {
      interactive: false,
      keyboard: false,
      icon: letterIcon(facade, facade === selected),
    }).addTo(group);
  });
}

// A compass in the top corner: the map is never rotated, so north is always up.
function compassControl() {
  const Compass = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create("div");
      box.setAttribute("aria-hidden", "true");
      box.style.cssText =
        "width:56px;height:56px;border-radius:999px;background:#fff;border:1px solid rgba(7,42,74,.25);box-shadow:0 1px 4px rgba(7,42,74,.25)";
      box.innerHTML = `<svg viewBox="0 0 56 56" width="56" height="56">
        <text x="28" y="13" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#072A4A">N</text>
        <polygon points="28,16 33,30 28,27 23,30" fill="#C08649"/>
        <polygon points="28,44 33,30 28,33 23,30" fill="#9AA7B4"/>
        <text x="47" y="32" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#072A4A">E</text>
        <text x="28" y="53" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#072A4A">S</text>
        <text x="9" y="32" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#072A4A">W</text>
      </svg>`;
      return box;
    },
  });
  return new Compass({ position: "topright" });
}

// Meters east (x) and north (y) from the plot center -> map coordinates.
function at(center: LatLng, x: number, y: number): L.LatLngTuple {
  return [
    center.lat + y / 111_320,
    center.lng + x / (111_320 * Math.cos((center.lat * Math.PI) / 180)),
  ];
}

export default function ResultMap({
  lat,
  lng,
  width,
  depth,
  setbacks,
  heat,
  selected,
  tips,
  label,
  outline,
  shown = null,
}: ResultMapProps) {
  const realOutline = outline && outline.length >= 3 ? outline : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);

  // create the map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, { center: [lat, lng], zoom: 18, maxZoom: 21, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 21,
      maxNativeZoom: 19, // the tiles are stretched when you zoom in further
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);
    compassControl().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
    // The map is created once; the effects below keep it up to date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // frame the plot
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = { lat, lng };
    const bounds = realOutline
      ? L.latLngBounds(realOutline.map((p) => [p.lat, p.lng] as L.LatLngTuple))
      : L.latLngBounds([at(center, -width / 2, -depth / 2), at(center, width / 2, depth / 2)]);
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 21 });
  }, [lat, lng, width, depth, realOutline]);

  // draw the plot, the building and the colored façades
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();

    if (realOutline) {
      drawOutline(group, realOutline, heat, selected, tips, shown);
      return;
    }

    const center = { lat, lng };
    const hw = width / 2;
    const hd = depth / 2;
    L.polygon(
      [at(center, -hw, hd), at(center, hw, hd), at(center, hw, -hd), at(center, -hw, -hd)],
      { color: "#072A4A", weight: 2, dashArray: "6 6", interactive: false, fillOpacity: 0 },
    ).addTo(group);

    const x0 = -hw + setbacks.west;
    const x1 = hw - setbacks.east;
    const y0 = -hd + setbacks.south;
    const y1 = hd - setbacks.north;
    const nw = at(center, x0, y1);
    const ne = at(center, x1, y1);
    const se = at(center, x1, y0);
    const sw = at(center, x0, y0);
    L.polygon([nw, ne, se, sw], {
      stroke: false,
      interactive: false,
      fillColor: "#072A4A",
      fillOpacity: 0.12,
    }).addTo(group);

    // the four sides are colored lines, the four diagonals are colored dots on the corners
    const sides: Record<Side, L.LatLngTuple[]> = {
      north: [nw, ne],
      east: [ne, se],
      south: [se, sw],
      west: [sw, nw],
    };
    const corners: Record<Exclude<Facade, Side>, L.LatLngTuple> = {
      northeast: ne,
      southeast: se,
      southwest: sw,
      northwest: nw,
    };
    FACADES.forEach((facade) => {
      const isSelected = facade === selected;
      if (hasNoWall(heat, facade, shown)) return;
      const color = colorFor(heat, facade);
      if (isSide(facade)) {
        L.polyline(sides[facade], {
          color,
          weight: isSelected ? 12 : 7,
          opacity: isSelected ? 1 : 0.8,
          lineCap: "round",
        })
          .bindTooltip(tips[facade], { sticky: true })
          .on("add", plainCursor)
      .addTo(group);
      }
    });
    FACADES.forEach((facade) => {
      if (isSide(facade) || hasNoWall(heat, facade, shown)) return;
      const isSelected = facade === selected;
      L.circleMarker(corners[facade], {
        radius: isSelected ? 13 : 9,
        color: isSelected ? "#072A4A" : "#FFFFFF",
        weight: isSelected ? 3 : 2,
        fillColor: colorFor(heat, facade),
        fillOpacity: 1,
      })
        .bindTooltip(tips[facade], { sticky: true })
        .on("add", plainCursor)
      .addTo(group);
    });

    // compass letters around the plot
    const spots: Record<Facade, [number, number]> = {
      north: [0, hd + 3],
      northeast: [hw + 3, hd + 3],
      east: [hw + 3, 0],
      southeast: [hw + 3, -hd - 3],
      south: [0, -hd - 3],
      southwest: [-hw - 3, -hd - 3],
      west: [-hw - 3, 0],
      northwest: [-hw - 3, hd + 3],
    };
    FACADES.forEach((facade) => {
      if (shown !== null && !shown.includes(facade)) return;
      const isSelected = facade === selected;
      const [x, y] = spots[facade];
      L.marker(at(center, x, y), {
        interactive: false,
        keyboard: false,
        icon: letterIcon(facade, isSelected),
      }).addTo(group);
    });
  }, [lat, lng, width, depth, setbacks, heat, selected, tips, realOutline, shown]);

  return <div ref={containerRef} role="application" aria-label={label} className="h-full w-full" />;
}