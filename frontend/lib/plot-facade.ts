import type { LatLng } from "@/lib/geo";

/*
 * The plot's facades, the same way the dataset notebook finds them
 * (Preparing_dataset, facades_for "v8", and orientation in the building-shape cell):
 *   * streets come from the Riyadh municipality layer Streets_NEW (ArcGIS),
 *   * each plot edge is matched to a street that runs along it:
 *       street edge within 3 m of the plot edge (distance − width / 2 ≤ 3)
 *       and street direction within 30° of the edge direction,
 *   * corner cut-offs (an edge between two street edges, turned 30–60° from both) are skipped,
 *   * each edge's outward direction is one of 8 directions; per direction we keep
 *     the widest street (then the longest edge).
 * When the plot has more than one facade, the main facade is the one on the widest street
 * (then the longest edge). When no street is found, we fall back to the plot's longest edge,
 * like the notebook's orientation_deg.
 */

export type Facade = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
const DIRS8: Facade[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const STREETS_URL =
  "https://services-ap1.arcgis.com/if9krLUYaMWhxyMO/ArcGIS/rest/services/Streets_NEW/FeatureServer/0/query";

// same settings as the notebook
const TOL = 3; // m
const MAX_ANGLE = 30; // degrees
const CAND_RADIUS = 80; // m
const EXCLUDE_CLASS = new Set(["سكة حديد", "طريق مقترح", "نفق", "كوبري"]);

// the streets are loaded around the clicked point, at the same time as the plot
const STREETS_RADIUS = 200; // m

export type StreetFeature = {
  attributes?: { STREETWIDTH?: unknown; STREETCLASS?: unknown; SUBTYPECLASS?: unknown };
  geometry?: { paths?: number[][][] }; // [longitude, latitude] pairs
};

type XY = [number, number]; // meters: x east, y north

type Street = { lines: XY[][]; width: number; detectWidth: number };

/* ---------- requests ---------- */

function boxAround(point: LatLng, meters: number) {
  const dLat = meters / 110_540;
  const dLng = meters / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return [point.lng - dLng, point.lat - dLat, point.lng + dLng, point.lat + dLat];
}

export async function fetchStreets(box: number[]): Promise<StreetFeature[] | null> {
  const params = new URLSearchParams({
    geometry: box.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    where: "1=1",
    outFields: "STREETWIDTH,STREETCLASS,SUBTYPECLASS",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });
  try {
    const res = await fetch(`${STREETS_URL}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: StreetFeature[] };
    return data.features ?? null;
  } catch {
    return null;
  }
}

export function fetchStreetsAround(point: LatLng): Promise<StreetFeature[] | null> {
  return fetchStreets(boxAround(point, STREETS_RADIUS));
}

// The streets loaded around the point cover the plot when every corner of the plot
// is far enough inside that box; otherwise (a very large plot) they are loaded again around the plot.
export async function streetsForPlot(
  point: LatLng,
  outline: LatLng[],
  early: StreetFeature[] | null,
): Promise<StreetFeature[] | null> {
  const reach = STREETS_RADIUS - CAND_RADIUS - TOL;
  const project = projector(point);
  const covered = outline.every((p) => {
    const [x, y] = project(p);
    return Math.abs(x) <= reach && Math.abs(y) <= reach;
  });
  if (early && covered) return early;
  const lats = outline.map((p) => p.lat);
  const lngs = outline.map((p) => p.lng);
  const sw = boxAround({ lat: Math.min(...lats), lng: Math.min(...lngs) }, CAND_RADIUS + 20);
  const ne = boxAround({ lat: Math.max(...lats), lng: Math.max(...lngs) }, CAND_RADIUS + 20);
  return fetchStreets([sw[0], sw[1], ne[2], ne[3]]);
}

/* ---------- geometry (local meters around the plot) ---------- */

function projector(origin: LatLng) {
  const mx = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const my = 110_540;
  return (p: LatLng): XY => [(p.lng - origin.lng) * mx, (p.lat - origin.lat) * my];
}

const deg = (rad: number) => (rad * 180) / Math.PI;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const adiff = (a: number, b: number) => Math.abs(mod(a - b + 180, 360) - 180);
const sector = (az: number) => Math.floor(mod(az + 22.5, 360) / 45);

// distance from p to a polyline, and the distance along the line to the nearest point
function nearestOnLine(line: XY[], p: XY) {
  let best = { dist: Infinity, along: 0 };
  let walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2)) : 0;
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const dist = Math.hypot(p[0] - qx, p[1] - qy);
    if (dist < best.dist) best = { dist, along: walked + t * Math.sqrt(len2) };
    walked += Math.sqrt(len2);
  }
  return best;
}

function pointAlong(line: XY[], s: number): XY {
  let walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (walked + len >= s || i === line.length - 2) {
      const t = len > 0 ? Math.max(0, Math.min(1, (s - walked) / len)) : 0;
      return [ax + t * (bx - ax), ay + t * (by - ay)];
    }
    walked += len;
  }
  return line[0];
}

const lineLength = (line: XY[]) =>
  line.slice(1).reduce((sum, q, i) => sum + Math.hypot(q[0] - line[i][0], q[1] - line[i][1]), 0);

function streetDistance(street: Street, p: XY): number {
  return Math.min(...street.lines.map((line) => nearestOnLine(line, p).dist));
}

// the street's direction (0–180°) near p: from 1 m before to 1 m after the nearest point
function streetDirAt(street: Street, p: XY): number {
  const line = street.lines.reduce((a, b) => (nearestOnLine(a, p).dist <= nearestOnLine(b, p).dist ? a : b));
  const s = nearestOnLine(line, p).along;
  const a = pointAlong(line, Math.max(s - 1, 0));
  const b = pointAlong(line, Math.min(s + 1, lineLength(line)));
  return mod(deg(Math.atan2(b[0] - a[0], b[1] - a[1])), 180);
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function toStreets(features: StreetFeature[], project: (p: LatLng) => XY): Street[] {
  const kept = features.filter((f) => {
    const cls = String(f.attributes?.STREETCLASS ?? "");
    const sub = String(f.attributes?.SUBTYPECLASS ?? "");
    return !EXCLUDE_CLASS.has(cls) && !EXCLUDE_CLASS.has(sub) && (f.geometry?.paths?.length ?? 0) > 0;
  });
  const widthOf = (f: StreetFeature) => {
    const w = f.attributes?.STREETWIDTH;
    return w === null || w === undefined || w === "" ? NaN : Number(w);
  };
  // a street without a width uses the median width of its class (here: of the streets loaded nearby)
  const byClass = new Map<string, number[]>();
  for (const f of kept) {
    const w = widthOf(f);
    if (!Number.isFinite(w)) continue;
    const sub = String(f.attributes?.SUBTYPECLASS ?? "");
    byClass.set(sub, [...(byClass.get(sub) ?? []), w]);
  }
  const streets: Street[] = [];
  for (const f of kept) {
    const width = widthOf(f);
    const classWidths = byClass.get(String(f.attributes?.SUBTYPECLASS ?? ""));
    const detectWidth = Number.isFinite(width) ? width : classWidths ? median(classWidths) : NaN;
    if (!Number.isFinite(detectWidth)) continue;
    const lines = (f.geometry?.paths ?? [])
      .filter((path) => path.length >= 2)
      .map((path) => path.map(([lng, lat]) => project({ lat, lng })));
    if (lines.length) streets.push({ lines, width, detectWidth });
  }
  return streets;
}

/* ---------- facades ---------- */

export type FacadeResult = {
  facades: Facade[]; // every direction with a street, in N → NW order
  main: Facade | null; // the facade on the widest street; the longest edge when no street was found
};

export function findFacades(outline: LatLng[], features: StreetFeature[]): FacadeResult {
  const project = projector(outline[0]);
  let ring = outline.map(project);
  if (ring.length > 1) {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx === lx && fy === ly) ring = ring.slice(0, -1);
  }
  // counter-clockwise, so (dy, −dx) points out of the plot
  const signedArea = ring.reduce((s, [x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    return s + x1 * y2 - x2 * y1;
  }, 0);
  if (signedArea < 0) ring = ring.reverse();

  const streets = toStreets(features, project);

  type Edge = { len: number; normal: number; street: Street | null; chamfer?: boolean };
  const edges: Edge[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    const mid: XY = [(x1 + x2) / 2, (y1 + y2) / 2];
    const normal = mod(deg(Math.atan2(dy, -dx)), 360);
    const edgeDir = mod(deg(Math.atan2(dx, dy)), 180);
    const candidates = streets
      .map((s) => ({ s, dist: streetDistance(s, mid) }))
      .filter((c) => c.dist <= CAND_RADIUS)
      .map((c) => ({ s: c.s, resid: c.dist - c.s.detectWidth / 2 }))
      .filter((c) => c.resid <= TOL)
      .sort((a, b) => Math.abs(a.resid) - Math.abs(b.resid));
    let street: Street | null = null;
    for (const c of candidates) {
      const par = adiff(streetDirAt(c.s, mid), edgeDir);
      if (Math.min(par, 180 - par) <= MAX_ANGLE) {
        street = c.s;
        break;
      }
    }
    edges.push({ len, normal, street });
  }

  // corner cut-off: a street edge between two street edges, turned 30–60° from both
  edges.forEach((e, i) => {
    if (!e.street) return;
    const p = edges[(i - 1 + edges.length) % edges.length];
    const q = edges[(i + 1) % edges.length];
    if (p.street && q.street) {
      const a = adiff(e.normal, p.normal);
      const b = adiff(e.normal, q.normal);
      if (a >= 30 && a <= 60 && b >= 30 && b <= 60) e.chamfer = true;
    }
  });

  // per direction: the widest street, then the longest edge (a street without a width counts as −1)
  const best = new Map<Facade, { width: number; len: number }>();
  for (const e of edges) {
    if (!e.street || e.chamfer) continue;
    const d = DIRS8[sector(e.normal)];
    const width = Number.isFinite(e.street.width) ? e.street.width : -1;
    const old = best.get(d);
    if (!old || width > old.width || (width === old.width && e.len > old.len)) best.set(d, { width, len: e.len });
  }

  const facades = DIRS8.filter((d) => best.has(d));
  let main: Facade | null = null;
  for (const d of facades) {
    const cur = best.get(d)!;
    const top = main ? best.get(main)! : null;
    if (!top || cur.width > top.width || (cur.width === top.width && cur.len > top.len)) main = d;
  }
  if (!main && edges.length) {
    const longest = edges.reduce((a, b) => (b.len > a.len ? b : a));
    main = DIRS8[sector(longest.normal)];
  }
  return { facades, main };
}

/* ---------- edges for drawing ---------- */

export type PlotEdge = { from: LatLng; to: LatLng; facade: Facade; normal: number; length: number };

// Each edge of the plot with the direction it faces (outward, from true north),
// the same way the facades above are found. Used to color the real plot on the map.
export function plotEdges(outline: LatLng[]): PlotEdge[] {
  let points = outline;
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) points = points.slice(0, -1);
  }
  if (points.length < 3) return [];
  const project = projector(points[0]);
  const xy = points.map(project);
  const signedArea = xy.reduce((s, [x1, y1], i) => {
    const [x2, y2] = xy[(i + 1) % xy.length];
    return s + x1 * y2 - x2 * y1;
  }, 0);
  const ordered = signedArea < 0 ? [...points].reverse() : points;
  const orderedXY = signedArea < 0 ? [...xy].reverse() : xy;
  const edges: PlotEdge[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const j = (i + 1) % ordered.length;
    const dx = orderedXY[j][0] - orderedXY[i][0];
    const dy = orderedXY[j][1] - orderedXY[i][1];
    const length = Math.hypot(dx, dy);
    if (length < 0.5) continue;
    const normal = mod(deg(Math.atan2(dy, -dx)), 360);
    edges.push({ from: ordered[i], to: ordered[j], facade: DIRS8[sector(normal)], normal, length });
  }
  return edges;
}

export type PlotCorner = { at: LatLng; facade: Facade; turn: number };

// Each corner of the plot with the direction it points to (between the two edges that meet there).
// The plot's edges cover four of the eight directions; its corners show the other four.
export function plotCorners(edges: PlotEdge[]): PlotCorner[] {
  return edges.map((edge, i) => {
    const next = edges[(i + 1) % edges.length];
    const a = (edge.normal * Math.PI) / 180;
    const b = (next.normal * Math.PI) / 180;
    const bisector = mod(deg(Math.atan2(Math.sin(a) + Math.sin(b), Math.cos(a) + Math.cos(b))), 360);
    return { at: edge.to, facade: DIRS8[sector(bisector)], turn: adiff(edge.normal, next.normal) };
  });
}
