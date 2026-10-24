/**
 * cubic-bezier() easings: the curve through (0,0), P1, P2, (1,1). x of the control points must
 * stay in [0, 1] (CSS rule); y may overshoot, which makes "back" and bounce-like effects.
 */
import { asArray, clampNum, num, tailwindArbitrary } from "../_shared";

export type Bezier = [number, number, number, number];

export const Y_MIN = -1;
export const Y_MAX = 2;

/** A valid curve from anything: x clamped to [0, 1], y to [-1, 2]. */
export function cleanBezier(raw: unknown, fallback: Bezier = [0.25, 0.1, 0.25, 1]): Bezier {
  const a = asArray(raw);
  if (a.length !== 4) return fallback;
  return [
    clampNum(a[0], 0, 1, fallback[0]),
    clampNum(a[1], Y_MIN, Y_MAX, fallback[1]),
    clampNum(a[2], 0, 1, fallback[2]),
    clampNum(a[3], Y_MIN, Y_MAX, fallback[3]),
  ];
}

/** One coordinate of the curve at parameter t, for control values a (P1) and b (P2). */
function coord(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

function slope(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
}

/** The point of the curve at parameter t. */
export function pointAt(b: Bezier, t: number): [number, number] {
  return [coord(t, b[0], b[2]), coord(t, b[1], b[3])];
}

/** The eased progress for a time fraction x in [0, 1] (what the browser computes). */
export function ease(b: Bezier, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Newton's method, then bisection if it does not converge.
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = coord(t, b[0], b[2]) - x;
    if (Math.abs(err) < 1e-7) return coord(t, b[1], b[3]);
    const d = slope(t, b[0], b[2]);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 60; i++) {
    const v = coord(t, b[0], b[2]);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return coord(t, b[1], b[3]);
}

const KEYWORDS: Record<string, Bezier> = {
  ease: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** The CSS value: a keyword when the curve is one, else `cubic-bezier(…)`. */
export function bezierValue(b: Bezier, keywords = true): string {
  if (keywords)
    for (const [k, v] of Object.entries(KEYWORDS)) if (v.every((n, i) => n === b[i])) return k;
  return `cubic-bezier(${b.map((n) => num(n, 3)).join(", ")})`;
}

export function bezierCss(b: Bezier, duration: number): string {
  const v = bezierValue(b);
  return [
    `transition-timing-function: ${v};`,
    `animation-timing-function: ${v};`,
    `transition: transform ${durationText(duration)} ${v};`,
  ].join("\n");
}

export function durationText(ms: number): string {
  return ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`;
}

export function bezierTailwind(b: Bezier): string {
  return tailwindArbitrary("ease", bezierValue(b, false));
}

/**
 * Reads `cubic-bezier(a, b, c, d)`, four bare numbers, or a keyword. Null when invalid, including
 * x values outside [0, 1] (the browser would reject them).
 */
export function parseBezier(input: string): Bezier | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z-]*timing-function\s*:\s*/, "")
    .replace(/;$/, "")
    .trim();
  if (s in KEYWORDS) return [...(KEYWORDS[s] as Bezier)];
  const inner = /^cubic-bezier\((.*)\)$/.exec(s)?.[1] ?? s.replace(/^\[|\]$/g, "");
  const parts = inner.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 4) return null;
  const n = parts.map(Number);
  if (n.some((x) => !Number.isFinite(x))) return null;
  const [x1, y1, x2, y2] = n as Bezier;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;
  if (y1 < Y_MIN || y1 > Y_MAX || y2 < Y_MIN || y2 > Y_MAX) return null;
  return [x1, y1, x2, y2];
}

/** Graph geometry: the unit square drawn in a box, with room above and below for overshoot. */
export interface Frame {
  size: number;
  pad: number;
  /** Visible y range. */
  yMin: number;
  yMax: number;
}

export const FRAME: Frame = { size: 200, pad: 16, yMin: -0.7, yMax: 1.7 };

export function frameHeight(f: Frame = FRAME): number {
  return f.size * (f.yMax - f.yMin) + 2 * f.pad;
}

/** Curve coordinates to SVG coordinates. */
export function toSvg(x: number, y: number, f: Frame = FRAME): [number, number] {
  return [f.pad + x * f.size, f.pad + (f.yMax - y) * f.size];
}

/** SVG coordinates to curve coordinates (x clamped to [0, 1], y to the visible range). */
export function fromSvg(sx: number, sy: number, f: Frame = FRAME): [number, number] {
  const x = Math.min(1, Math.max(0, (sx - f.pad) / f.size));
  const y = Math.min(f.yMax, Math.max(f.yMin, f.yMax - (sy - f.pad) / f.size));
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

/** The curve as an SVG path. */
export function curvePath(b: Bezier, f: Frame = FRAME): string {
  const p = (x: number, y: number) =>
    toSvg(x, y, f)
      .map((n) => num(n, 2))
      .join(" ");
  return `M${p(0, 0)} C${p(b[0], b[1])} ${p(b[2], b[3])} ${p(1, 1)}`;
}

export interface EasingPreset {
  id: string;
  name: string;
  b: Bezier;
}

/** CSS keywords, then the classic easings.net set. */
export const PRESETS: EasingPreset[] = [
  { id: "ease", name: "ease", b: [0.25, 0.1, 0.25, 1] },
  { id: "linear", name: "linear", b: [0, 0, 1, 1] },
  { id: "ease-in", name: "ease-in", b: [0.42, 0, 1, 1] },
  { id: "ease-out", name: "ease-out", b: [0, 0, 0.58, 1] },
  { id: "ease-in-out", name: "ease-in-out", b: [0.42, 0, 0.58, 1] },
  { id: "in-sine", name: "easeInSine", b: [0.12, 0, 0.39, 0] },
  { id: "out-sine", name: "easeOutSine", b: [0.61, 1, 0.88, 1] },
  { id: "in-out-sine", name: "easeInOutSine", b: [0.37, 0, 0.63, 1] },
  { id: "in-quad", name: "easeInQuad", b: [0.11, 0, 0.5, 0] },
  { id: "out-quad", name: "easeOutQuad", b: [0.5, 1, 0.89, 1] },
  { id: "in-out-quad", name: "easeInOutQuad", b: [0.45, 0, 0.55, 1] },
  { id: "in-cubic", name: "easeInCubic", b: [0.32, 0, 0.67, 0] },
  { id: "out-cubic", name: "easeOutCubic", b: [0.33, 1, 0.68, 1] },
  { id: "in-out-cubic", name: "easeInOutCubic", b: [0.65, 0, 0.35, 1] },
  { id: "in-quart", name: "easeInQuart", b: [0.5, 0, 0.75, 0] },
  { id: "out-quart", name: "easeOutQuart", b: [0.25, 1, 0.5, 1] },
  { id: "in-out-quart", name: "easeInOutQuart", b: [0.76, 0, 0.24, 1] },
  { id: "in-expo", name: "easeInExpo", b: [0.7, 0, 0.84, 0] },
  { id: "out-expo", name: "easeOutExpo", b: [0.16, 1, 0.3, 1] },
  { id: "in-out-expo", name: "easeInOutExpo", b: [0.87, 0, 0.13, 1] },
  { id: "in-circ", name: "easeInCirc", b: [0.55, 0, 1, 0.45] },
  { id: "out-circ", name: "easeOutCirc", b: [0, 0.55, 0.45, 1] },
  { id: "in-out-circ", name: "easeInOutCirc", b: [0.85, 0, 0.15, 1] },
  { id: "in-back", name: "easeInBack", b: [0.36, 0, 0.66, -0.56] },
  { id: "out-back", name: "easeOutBack", b: [0.34, 1.56, 0.64, 1] },
  { id: "in-out-back", name: "easeInOutBack", b: [0.68, -0.6, 0.32, 1.6] },
];
