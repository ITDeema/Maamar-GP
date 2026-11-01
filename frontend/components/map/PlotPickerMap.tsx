"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RIYADH_CENTER, plotPolygon } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";

export type MapFocus = { point: LatLng; zoom: number; nonce: number };

type PlotPickerMapProps = {
  selected: {
    point: LatLng;
    width: number;
    depth: number;
    rotation: number;
    outline?: LatLng[] | null; // when given, the real plot boundary is drawn instead of a rectangle
    pending?: boolean; // true while the plot is loading: only the pin is drawn
  } | null;
  focus: MapFocus | null; // change `nonce` to make the map fly to a point
  onPick: (point: LatLng) => void;
  label: string;
  layerLabels: { street: string; satellite: string };
};

// A navy pin with a gold center, drawn as SVG so no image files are needed.
const pinIcon = L.divIcon({
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
    <path d="M17 42C17 42 30 28 30 16a13 13 0 1 0-26 0c0 12 13 26 13 26z" fill="#072A4A" stroke="#F6F4EF" stroke-width="2"/>
    <circle cx="17" cy="16" r="5.5" fill="#C08649"/>
  </svg>`,
});

export default function PlotPickerMap({ selected, focus, onPick, label, layerLabels,}: PlotPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const baseLayersRef = useRef<{ street: L.TileLayer; satellite: L.TileLayer } | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // create the map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [RIYADH_CENTER.lat, RIYADH_CENTER.lng],
      zoom: 11,
      minZoom: 5,
    });
    const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
      },
    );
    baseLayersRef.current = { street, satellite };
    
    map.on("click", (event) => {
      onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    groupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      baseLayersRef.current = null;
    };
  }, []);

  // street / satellite switch (rebuilt when the language changes)
  useEffect(() => {
    const map = mapRef.current;
    const base = baseLayersRef.current;
    if (!map || !base) return;
    const control = L.control
      .layers(
        { [layerLabels.street]: base.street, [layerLabels.satellite]: base.satellite },
        undefined,
        { position: "topright" },
      )
      .addTo(map);
    return () => {
      control.remove();
    };
  }, [layerLabels.street, layerLabels.satellite]);  
  
  // draw the selected plot
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!selected) return;

    if (!selected.pending) {
      const corners =
        selected.outline && selected.outline.length >= 3
          ? selected.outline
          : plotPolygon(selected.point, selected.width, selected.depth, selected.rotation);
      L.polygon(
        corners.map((c) => [c.lat, c.lng] as L.LatLngTuple),
        { color: "#C08649", weight: 3, fillColor: "#C08649", fillOpacity: 0.3 },
      ).addTo(group);
    }
    L.marker([selected.point.lat, selected.point.lng], { icon: pinIcon, keyboard: false }).addTo(group);
  }, [selected]);

  // fly to a requested point
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.point.lat, focus.point.lng], focus.zoom, { duration: 0.8 });
  }, [focus]);

  return <div ref={containerRef} role="application" aria-label={label} className="h-full w-full" />;
}