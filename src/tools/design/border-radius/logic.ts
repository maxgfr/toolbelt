/**
 * border-radius with its full 8-value syntax: four horizontal radii, then four vertical ones,
 * corners in the order top-left, top-right, bottom-right, bottom-left.
 */
import { asArray, asRecord, clampNum, num, oneOf, tailwindArbitrary } from "../_shared";

export const UNITS = ["%", "px"] as const;
export type Unit = (typeof UNITS)[number];
export type Quad = [number, number, number, number];

export type Radius = {
  unit: Unit;
  /** Horizontal radii: top-left, top-right, bottom-right, bottom-left. */
  h: Quad;
  /** Vertical radii, same order. Equal to `h` for circular corners. */
  v: Quad;
};

export const MAX = { "%": 100, px: 400 } as const;

export const DEFAULT: Radius = { unit: "%", h: [30, 70, 70, 30], v: [30, 30, 70, 70] };

function quad(raw: unknown, max: number, fallback: Quad): Quad {
  const a = asArray(raw);
  if (a.length !== 4) return fallback;
  return a.map((x, i) => clampNum(x, 0, max, fallback[i] as number)) as Quad;
}

export function cleanRadius(raw: unknown): Radius {
  const r = asRecord(raw);
  const unit = oneOf(r.unit, UNITS, DEFAULT.unit);
  const h = quad(r.h, MAX[unit], DEFAULT.h);
  const hasH = Array.isArray(r.h) && r.h.length === 4;
  return { unit, h, v: quad(r.v, MAX[unit], hasH ? h : DEFAULT.v) };
}

/** The shortest of the 1-to-4-value forms for one axis. */
export function shorten(q: Quad, unit: Unit): string {
  const s = q.map((n) => (n === 0 ? "0" : `${num(n, 2)}${unit}`));
  const [a, b, c, d] = s;
  if (b === d) {
    if (a === c) return a === b ? `${a}` : `${a} ${b}`;
    return `${a} ${b} ${c}`;
  }
  return s.join(" ");
}

export function sameQuad(a: Quad, b: Quad): boolean {
  return a.every((x, i) => x === b[i]);
}

/** The `border-radius` value: `h` alone when corners are circular, else `h / v`. */
export function radiusValue(r: Radius): string {
  const h = shorten(r.h, r.unit);
  return sameQuad(r.h, r.v) ? h : `${h} / ${shorten(r.v, r.unit)}`;
}

export function radiusCss(r: Radius): string {
  return `border-radius: ${radiusValue(r)};`;
}

export function radiusTailwind(r: Radius): string {
  return tailwindArbitrary("rounded", radiusValue(r));
}

function expand(parts: string[]): string[] | null {
  if (parts.length < 1 || parts.length > 4) return null;
  const [a, b = a, c = a, d = b] = parts;
  return [a, b, c, d] as string[];
}

/** Reads a border-radius value (`10px`, `30% 70% / 50%`…); null when it is not one we can edit. */
export function parseRadius(input: string): Radius | null {
  const s = input
    .trim()
    .replace(/^border-radius\s*:\s*/i, "")
    .replace(/;$/, "")
    .trim();
  if (!s) return null;
  const halves = s.split("/");
  if (halves.length > 2) return null;
  const axes = halves.map((x) => expand(x.trim().split(/\s+/).filter(Boolean)));
  if (axes.some((a) => !a)) return null;
  let unit: Unit | null = null;
  const vals: Quad[] = [];
  for (const a of axes as string[][]) {
    const q: number[] = [];
    for (const t of a) {
      const m = /^(\d*\.?\d+)(%|px)?$/.exec(t);
      if (!m) return null;
      const n = Number(m[1]);
      if (m[2]) {
        if (unit && unit !== m[2]) return null;
        unit = m[2] as Unit;
      } else if (n !== 0) return null;
      q.push(n);
    }
    vals.push(q as Quad);
  }
  const u = unit ?? "px";
  const h = vals[0] as Quad;
  const v = vals[1] ?? h;
  if ([...h, ...v].some((n) => n > MAX[u])) return null;
  return { unit: u, h, v };
}

/**
 * The four edge handles of the blob editor (percent mode): each one splits its edge between the
 * two corners it touches. top = top-left horizontal, right = top-right vertical, bottom =
 * bottom-left horizontal, left = top-left vertical.
 */
export type Handles = { top: number; right: number; bottom: number; left: number };

export function fromHandles(hd: Handles): Radius {
  const c = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  const t = c(hd.top);
  const r = c(hd.right);
  const b = c(hd.bottom);
  const l = c(hd.left);
  return { unit: "%", h: [t, 100 - t, 100 - b, b], v: [l, r, 100 - r, 100 - l] };
}

export function toHandles(r: Radius): Handles {
  return { top: r.h[0], right: r.v[1], bottom: r.h[3], left: r.v[0] };
}

/** A random organic blob (percent values whose opposite corners add up to 100). */
export function randomBlob(rand: () => number = Math.random): Radius {
  const p = () => 20 + Math.round(rand() * 60);
  return fromHandles({ top: p(), right: p(), bottom: p(), left: p() });
}

export interface RadiusPreset {
  id: string;
  name: { en: string; fr: string; de: string };
  r: Radius;
}

const pc = (h: Quad, v: Quad = h): Radius => ({ unit: "%", h, v });

export const PRESETS: RadiusPreset[] = [
  {
    id: "blob",
    name: { en: "Blob", fr: "Blob", de: "Blob" },
    r: pc([30, 70, 70, 30], [30, 30, 70, 70]),
  },
  {
    id: "pebble",
    name: { en: "Pebble", fr: "Galet", de: "Kiesel" },
    r: pc([63, 37, 54, 46], [55, 48, 52, 45]),
  },
  { id: "circle", name: { en: "Circle", fr: "Cercle", de: "Kreis" }, r: pc([50, 50, 50, 50]) },
  {
    id: "egg",
    name: { en: "Egg", fr: "Œuf", de: "Ei" },
    r: pc([50, 50, 50, 50], [60, 60, 40, 40]),
  },
  { id: "leaf", name: { en: "Leaf", fr: "Feuille", de: "Blatt" }, r: pc([0, 100, 0, 100]) },
  { id: "drop", name: { en: "Drop", fr: "Goutte", de: "Tropfen" }, r: pc([0, 50, 50, 50]) },
  { id: "tab", name: { en: "Tab", fr: "Onglet", de: "Tab" }, r: pc([20, 20, 0, 0]) },
  {
    id: "rounded",
    name: { en: "Rounded", fr: "Arrondi", de: "Abgerundet" },
    r: { unit: "px", h: [16, 16, 16, 16], v: [16, 16, 16, 16] },
  },
];
