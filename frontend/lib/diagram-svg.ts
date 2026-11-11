import { INK, SITE, SUN, WHITE } from "@/lib/diagram-palette";
import type { SunPath, SunPoint } from "@/lib/site-api";

// SVG drawn on top of the diagram maps (as text, to be placed in an <svg>).
// Only numbers and palette colors go into these strings. Labels are escaped.

const n1 = (value: number) => value.toFixed(1);
const pair = (p: number[]) => `${n1(p[0])},${n1(p[1])}`;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeText = (text: string) => text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

// The circle of the diagram is 42% of the smaller side.
export const diagramRadius = (w: number, h: number) => Math.min(w, h) * 0.42;

/* ---------- helpers ---------- */

function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const from = parse(a);
  const to = parse(b);
  return "rgb(" + from.map((v, i) => Math.round(v + (to[i] - v) * t)).join(",") + ")";
}

function sunColor(s: number): string {
  return s < 0.5
    ? mixHex(SUN.end, SUN.mid, s / 0.5)
    : mixHex(SUN.mid, SUN.top, (s - 0.5) / 0.5);
}

function solidArrow(
  x1: number, y1: number, x2: number, y2: number,
  shaft: number, head: number, headLength: number,
  fill: string, stroke: string,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const bx = x2 - ux * headLength;
  const by = y2 - uy * headLength;
  const points = [
    [x1 + (nx * shaft) / 2, y1 + (ny * shaft) / 2],
    [bx + (nx * shaft) / 2, by + (ny * shaft) / 2],
    [bx + (nx * head) / 2, by + (ny * head) / 2],
    [x2, y2],
    [bx - (nx * head) / 2, by - (ny * head) / 2],
    [bx - (nx * shaft) / 2, by - (ny * shaft) / 2],
    [x1 - (nx * shaft) / 2, y1 - (ny * shaft) / 2],
  ];
  return `<polygon points="${points.map(pair).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`;
}

export type WaveOptions = { amp: number; waves: number; w0: number; w1: number; color: string };

// A wavy arrow that grows wider toward its head. Used for the wind.
export function waveArrow(x1: number, y1: number, x2: number, y2: number, o: WaveOptions): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const headLength = Math.max(10, o.w1 * 2.8);
  const tb = Math.min(0.9, Math.max(0.4, 1 - headLength / len));

  const steps = 48;
  const centre: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (tb * i) / steps;
    const off = o.amp * Math.sin(2 * Math.PI * o.waves * t);
    centre.push({
      x: x1 + ux * len * t + nx * off,
      y: y1 + uy * len * t + ny * off,
      w: o.w0 + (o.w1 - o.w0) * (i / steps),
    });
  }

  const left: number[][] = [];
  const right: number[][] = [];
  let lastTangent = [ux, uy];
  for (let i = 0; i <= steps; i++) {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(steps, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const half = centre[i].w / 2;
    left.push([centre[i].x - ty * half, centre[i].y + tx * half]);
    right.push([centre[i].x + ty * half, centre[i].y - tx * half]);
    lastTangent = [tx, ty];
  }

  const end = centre[steps];
  const headHalf = o.w1 * 1.3 + 2;
  const tip = [end.x + lastTangent[0] * headLength, end.y + lastTangent[1] * headLength];

  const points = left
    .concat([[end.x - lastTangent[1] * headHalf, end.y + lastTangent[0] * headHalf], tip, [end.x + lastTangent[1] * headHalf, end.y - lastTangent[0] * headHalf]])
    .concat(right.reverse());

  return `<polygon points="${points.map(pair).join(" ")}" fill="${o.color}" fill-opacity="0.93" stroke="${WHITE}" stroke-width="0.8" stroke-opacity="0.7" stroke-linejoin="round"/>`;
}

/* ---------- sun and wind ---------- */

// A wind arrow from the wind data: the direction it comes FROM (degrees from north),
// hot (summer) or cool (winter), and its strength 0..1 (the thickness of the arrows).
// The arrows start at that direction on the circle and point at the site in the centre.
export type WindArrow = { from: number; type: "hot" | "cool"; strength: number };

function windGroup(cx: number, cy: number, R: number, wind: WindArrow): string {
  const a = (wind.from * Math.PI) / 180;
  const ux = -Math.sin(a);
  const uy = Math.cos(a);
  const nx = -uy;
  const ny = ux;

  const s = wind.strength;
  const color = wind.type === "hot" ? SUN.hot : SUN.cool;

  const startX = cx + Math.sin(a) * R * 0.82;
  const startY = cy - Math.cos(a) * R * 0.82;
  const endX = cx + Math.sin(a) * R * 0.24;
  const endY = cy - Math.cos(a) * R * 0.24;
  const lx = endX - startX;
  const ly = endY - startY;
  const gap = 26 * s;

  const items: [number, number, number, number][] = [
    [-gap, 0.14, 0.88, 0.6],
    [0, 0, 1, 1],
    [gap, 0.14, 0.88, 0.6],
  ];

  return items
    .map(([off, f0, f1, k]) =>
      waveArrow(
        startX + lx * f0 + nx * off, startY + ly * f0 + ny * off,
        startX + lx * f1 + nx * off, startY + ly * f1 + ny * off,
        { amp: 8 * s * (k > 0.9 ? 1 : 0.8), waves: 2.5, w0: 0.8, w1: 7 * s * k, color },
      ),
    )
    .join("");
}

function sunCrescent(cx: number, cy: number, R: number, sun: SunPath): string {
  const eq = sun.arcs.equinox;
  if (!eq || eq.length < 2) return "";

  // keeps the azimuths in one continuous run (no jump from 359 to 0)
  const unwrap = (arr: SunPoint[]) => {
    const out = [arr[0].azimuth];
    for (let i = 1; i < arr.length; i++) {
      let a = arr[i].azimuth;
      const prev = out[i - 1];
      while (a - prev > 180) a -= 360;
      while (a - prev < -180) a += 360;
      out.push(a);
    }
    return out;
  };

  const eqAz = unwrap(eq);
  const dir = eqAz[eqAz.length - 1] >= eqAz[0] ? 1 : -1;

  const firsts: number[] = [];
  const lasts: number[] = [];
  (["summer", "equinox", "winter"] as const).forEach((key) => {
    const arc = sun.arcs[key];
    if (!arc || arc.length < 2) return;
    const u = unwrap(arc);
    firsts.push(u[0]);
    lasts.push(u[u.length - 1]);
  });

  const a0 = dir > 0 ? Math.min(...firsts) : Math.max(...firsts);
  const a1 = dir > 0 ? Math.max(...lasts) : Math.min(...lasts);
  if (Math.abs(a1 - a0) < 20) return "";

  let noonIndex = 0;
  eq.forEach((p, i) => {
    if (p.altitude > eq[noonIndex].altitude) noonIndex = i;
  });
  const aNoon = eqAz[noonIndex];

  const at = (az: number, radius: number) => {
    const a = (az * Math.PI) / 180;
    return [cx + radius * Math.sin(a), cy - radius * Math.cos(a)];
  };

  const slices = 90;
  const thickMax = R * 0.11;
  const thickMin = R * 0.02;
  const thickness = (t: number) => thickMin + (thickMax - thickMin) * Math.pow(Math.sin(Math.PI * t), 0.8);

  let out = "";
  for (let j = 0; j < slices; j++) {
    const t0 = j / slices;
    const t1 = (j + 1) / slices;
    const z0 = a0 + (a1 - a0) * t0;
    const z1 = a0 + (a1 - a0) * t1;
    const col = sunColor(Math.sin((Math.PI * (t0 + t1)) / 2));
    out += `<polygon points="${pair(at(z0, R))} ${pair(at(z1, R))} ${pair(at(z1, R - thickness(t1)))} ${pair(at(z0, R - thickness(t0)))}" fill="${col}" stroke="${col}" stroke-width="0.6" stroke-linejoin="round"/>`;
  }

  [a0, a1].forEach((z) => {
    const s = at(z, R - thickMin / 2);
    const e = at(z, R * 0.74);
    out += solidArrow(s[0], s[1], e[0], e[1], R * 0.022, R * 0.075, R * 0.09, SUN.end, SUN.end);
  });

  const s = at(aNoon, R - thickMax * 0.5);
  const e = at(aNoon, R * 0.36);
  out += solidArrow(s[0], s[1], e[0], e[1], R * 0.06, R * 0.17, R * 0.14, SUN.arrow, SUN.arrowEdge);

  return out;
}

/* ---------- shared parts ---------- */

function northArrow(x: number, y: number, label: string): string {
  return `<polygon points="${x},${y - 30} ${x - 15},${y + 8} ${x},${y} ${x + 15},${y + 8}" fill="${INK}"/>
<text x="${x}" y="${y + 26}" text-anchor="middle" font-family="inherit" font-size="16" font-weight="bold" fill="${INK}" stroke="${WHITE}" stroke-width="3" paint-order="stroke">${escapeText(label)}</text>`;
}

function dashedCircle(cx: number, cy: number, r: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 1}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="7 4"/>`;
}

function siteMarker(cx: number, cy: number, label?: string): string {
  let out = `<circle cx="${cx}" cy="${cy}" r="17" fill="${SITE}" fill-opacity="0.16" stroke="${SITE}" stroke-width="1.5"/>
<circle cx="${cx}" cy="${cy}" r="6.5" fill="${SITE}" stroke="${WHITE}" stroke-width="2.5"/>`;
  if (label) {
    out += `<text x="${cx + 24}" y="${cy + 4}" font-size="13" font-weight="bold" font-family="inherit" fill="${SITE}" stroke="${WHITE}" stroke-width="3" paint-order="stroke">${escapeText(label)}</text>`;
  }
  return out;
}

/* ---------- the three overlays ---------- */

export function sunOverlay(w: number, h: number, sun: SunPath, northLabel: string, winds: WindArrow[] = []): string {
  const cx = w / 2;
  const cy = h / 2;
  const R = diagramRadius(w, h);
  let out = winds.map((wind) => windGroup(cx, cy, R, wind)).join("");
  out += sunCrescent(cx, cy, R, sun);
  out += dashedCircle(cx, cy, R);
  out += northArrow(w - 44, 58, northLabel);
  return out;
}

export function landOverlay(w: number, h: number, northLabel: string, siteLabel: string): string {
  const cx = w / 2;
  const cy = h / 2;
  return dashedCircle(cx, cy, diagramRadius(w, h)) + northArrow(w - 44, 58, northLabel) + siteMarker(cx, cy, siteLabel);
}

export function roadsOverlay(w: number, h: number, northLabel: string): string {
  const cx = w / 2;
  const cy = h / 2;
  return dashedCircle(cx, cy, diagramRadius(w, h)) + northArrow(w - 44, 58, northLabel) + siteMarker(cx, cy);
}
