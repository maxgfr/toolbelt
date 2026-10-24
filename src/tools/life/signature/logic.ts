/**
 * Signature strokes as filled outlines: each point gets a width (from pen pressure, or from
 * speed for a mouse or finger: faster is thinner, like ink), positions are smoothed, and the
 * outline is drawn with quadratic curves. The same path data feeds the canvas (Path2D) and the
 * SVG export, so both look identical.
 */

/** A point of a stroke: position and final width, in CSS pixels. */
export type StrokePoint = [x: number, y: number, w: number];

export type Stroke = { color: string; width: number; points: StrokePoint[] };

export interface RawPoint {
  x: number;
  y: number;
  /** Ms timestamp. */
  t: number;
  /** Pen pressure 0–1; null for a mouse or a finger (no real pressure). */
  pressure: number | null;
}

export interface Pen {
  points: StrokePoint[];
  last: RawPoint | null;
}

export function startPen(): Pen {
  return { points: [], last: null };
}

/**
 * Adds one input point. Positions are eased toward the input (less jitter), points closer than
 * half a pixel are skipped, and the width eases toward its target so it never jumps.
 */
export function addPoint(pen: Pen, raw: RawPoint, base: number): Pen {
  const prev = pen.points[pen.points.length - 1];
  let target: number;
  if (raw.pressure !== null && raw.pressure > 0) target = base * (0.3 + raw.pressure * 1.1);
  else if (!pen.last) target = base;
  else {
    const dt = Math.max(1, raw.t - pen.last.t);
    const v = Math.hypot(raw.x - pen.last.x, raw.y - pen.last.y) / dt; // px per ms
    target = base * Math.max(0.4, Math.min(1.4, 1.5 - v * 0.55));
  }
  if (!prev) return { points: [[raw.x, raw.y, target]], last: raw };
  const x = prev[0] + (raw.x - prev[0]) * 0.65;
  const y = prev[1] + (raw.y - prev[1]) * 0.65;
  if (Math.hypot(x - prev[0], y - prev[1]) < 0.5) return { ...pen, last: raw };
  const w = prev[2] + (target - prev[2]) * 0.35;
  return { points: [...pen.points, [x, y, w]], last: raw };
}

type V = [number, number];

function norm(x: number, y: number): V {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? [x / len, y / len] : [1, 0];
}

const CAP_STEPS = 6;

/** The closed outline (polygon) around a stroke, with round caps; a lone point is a circle. */
export function outline(points: readonly StrokePoint[]): V[] {
  if (!points.length) return [];
  const first = points[0] as StrokePoint;
  if (points.length === 1) {
    const r = Math.max(0.5, first[2] / 2);
    return Array.from({ length: 16 }, (_, i): V => {
      const a = (i / 16) * Math.PI * 2;
      return [first[0] + Math.cos(a) * r, first[1] + Math.sin(a) * r];
    });
  }
  const left: V[] = [];
  const right: V[] = [];
  const dirs: V[] = [];
  let lastDir: V = [1, 0];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)] as StrokePoint;
    const b = points[Math.min(points.length - 1, i + 1)] as StrokePoint;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d: V = Math.hypot(dx, dy) > 1e-9 ? norm(dx, dy) : lastDir;
    lastDir = d;
    dirs.push(d);
    const p = points[i] as StrokePoint;
    const r = p[2] / 2;
    left.push([p[0] - d[1] * r, p[1] + d[0] * r]);
    right.push([p[0] + d[1] * r, p[1] - d[0] * r]);
  }
  const cap = (p: StrokePoint, d: V, forward: boolean): V[] => {
    const r = p[2] / 2;
    const n: V = [-d[1], d[0]];
    const s = forward ? 1 : -1;
    const out: V[] = [];
    for (let k = 1; k < CAP_STEPS; k++) {
      const th = (k / CAP_STEPS) * Math.PI;
      out.push([
        p[0] + s * (n[0] * r * Math.cos(th) + d[0] * r * Math.sin(th)),
        p[1] + s * (n[1] * r * Math.cos(th) + d[1] * r * Math.sin(th)),
      ]);
    }
    return out;
  };
  const last = points[points.length - 1] as StrokePoint;
  return [
    ...left,
    ...cap(last, dirs[dirs.length - 1] as V, true),
    ...right.reverse(),
    ...cap(first, dirs[0] as V, false),
  ];
}

function r2(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** SVG path data for a closed polygon, smoothed with quadratic curves through the midpoints. */
export function smoothPath(poly: readonly V[]): string {
  const n = poly.length;
  if (n < 3) return "";
  const mid = (a: V, b: V): V => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(poly[n - 1] as V, poly[0] as V);
  let d = `M${r2(start[0])} ${r2(start[1])}`;
  for (let i = 0; i < n; i++) {
    const p = poly[i] as V;
    const m = mid(p, poly[(i + 1) % n] as V);
    d += `Q${r2(p[0])} ${r2(p[1])} ${r2(m[0])} ${r2(m[1])}`;
  }
  return `${d}Z`;
}

export function strokePath(s: Stroke): string {
  return smoothPath(outline(s.points));
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The area covered by the strokes (widths included), plus `pad`; null when there is nothing. */
export function bounds(strokes: readonly Stroke[], pad = 0): Box | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const s of strokes)
    for (const [x, y, w] of s.points) {
      const r = w / 2 + 1;
      minX = Math.min(minX, x - r);
      minY = Math.min(minY, y - r);
      maxX = Math.max(maxX, x + r);
      maxY = Math.max(maxY, y + r);
    }
  if (!Number.isFinite(minX)) return null;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

/** A standalone SVG of the strokes, cropped to them, with a transparent background. */
export function toSvg(strokes: readonly Stroke[], pad = 8): string | null {
  const b = bounds(strokes, pad);
  if (!b) return null;
  const paths = strokes
    .filter((s) => s.points.length)
    .map((s) => `  <path fill="${escapeAttr(s.color)}" d="${strokePath(s)}"/>`)
    .join("\n");
  const w = Math.ceil(b.w);
  const h = Math.ceil(b.h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${r2(b.x)} ${r2(b.y)} ${w} ${h}">\n${paths}\n</svg>\n`;
}

function escapeAttr(s: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : "#000000";
}

export function normalizeStrokes(v: unknown): Stroke[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const o = s as Record<string, unknown>;
    if (!Array.isArray(o.points)) return [];
    const points = o.points.filter(
      (p): p is StrokePoint =>
        Array.isArray(p) &&
        p.length === 3 &&
        p.every((n) => typeof n === "number" && Number.isFinite(n)),
    );
    return [
      {
        color: typeof o.color === "string" ? escapeAttr(o.color) : "#000000",
        width: typeof o.width === "number" ? o.width : 2,
        points,
      },
    ];
  });
}
