/**
 * Pure helpers shared by the design tools: numbers for CSS, clamping untrusted values (state can
 * come from an old localStorage entry or a hand-edited share link), colors with alpha, and
 * declaration lists rendered both as CSS text and as a Preact style object.
 */
import { type Color, converter, formatHex, parse, type Rgb, wcagContrast } from "culori";

/** A number for CSS: dot decimal, at most `digits` decimals, no trailing zeros, no "-0". */
export function num(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "0";
  const r = Number(n.toFixed(digits));
  return String(Object.is(r, -0) ? 0 : r);
}

/** `v` as a finite number in [min, max]; `fallback` when it is not a number at all. */
export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** A length: `0` stays unitless, anything else gets the unit. */
export function len(n: number, unit = "px", digits = 3): string {
  const s = num(n, digits);
  return s === "0" ? "0" : `${s}${unit}`;
}

const toRgb = converter("rgb");

/** Parses a CSS color; also accepts a bare hex like `ff8800`. Undefined when invalid. */
export function parseColor(input: unknown): Color | undefined {
  if (typeof input !== "string") return undefined;
  const s = input.trim();
  if (!s) return undefined;
  if (/^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return parse(`#${s}`);
  try {
    return parse(s);
  } catch {
    return undefined;
  }
}

/** The color clamped into sRGB, channels in [0, 1]. */
export function srgb(c: Color): Rgb {
  const r = toRgb(c);
  const k = (v: number) => Math.min(1, Math.max(0, v || 0));
  return { mode: "rgb", r: k(r.r), g: k(r.g), b: k(r.b), alpha: r.alpha ?? 1 };
}

/** `#rrggbb` for a color string (alpha dropped), `fallback` when it does not parse. */
export function hex6(input: unknown, fallback = "#000000"): string {
  const c = parseColor(input);
  return c ? formatHex(srgb(c)) : fallback;
}

/**
 * A color with an opacity, as compact CSS: hex when opaque, else `rgb(r g b / a)`.
 * `alpha` multiplies the color's own alpha. Invalid colors become black.
 */
export function cssColor(input: unknown, alpha = 1): string {
  const c = parseColor(input);
  const rgb = srgb(c ?? { mode: "rgb", r: 0, g: 0, b: 0 });
  const a = Math.min(1, Math.max(0, (rgb.alpha ?? 1) * (Number.isFinite(alpha) ? alpha : 1)));
  if (a >= 1) return formatHex(rgb);
  const ch = (v: number) => Math.round(v * 255);
  return `rgb(${ch(rgb.r)} ${ch(rgb.g)} ${ch(rgb.b)} / ${num(a, 3)})`;
}

/** WCAG 2 contrast ratio between two colors (1–21). */
export function contrast(a: Color, b: Color): number {
  return wcagContrast(srgb(a), srgb(b));
}

/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: Color | undefined): "#000000" | "#ffffff" {
  if (!bg) return "#000000";
  const black = { mode: "rgb", r: 0, g: 0, b: 0 } as const;
  const white = { mode: "rgb", r: 1, g: 1, b: 1 } as const;
  return contrast(bg, black) >= contrast(bg, white) ? "#000000" : "#ffffff";
}

/** A CSS declaration: property (kebab-case) and value. */
export type Decl = [prop: string, value: string];

/** Declarations as CSS text, one per line, optionally inside `selector { … }`. */
export function declsToCss(decls: Decl[], selector?: string): string {
  if (!selector) return decls.map(([p, v]) => `${p}: ${v};`).join("\n");
  return `${selector} {\n${decls.map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}`;
}

/** Declarations as a Preact style object (custom properties and vendor prefixes kept). */
export function declsToStyle(decls: Decl[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [p, v] of decls) {
    if (p.startsWith("--")) out[p] = v;
    else if (p.startsWith("-webkit-"))
      out[`Webkit${camel(p.slice(8)).replace(/^./, (c) => c.toUpperCase())}`] = v;
    else out[camel(p)] = v;
  }
  return out;
}

function camel(p: string): string {
  return p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * A Tailwind arbitrary value: spaces become underscores (existing underscores are escaped),
 * `prefix-[value]`, or `[prop:value]` when the prefix is a CSS property in brackets.
 */
export function tailwindArbitrary(prefix: string, value: string): string {
  const v = value
    .trim()
    .replace(/_/g, "\\_")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, "_");
  return prefix.startsWith("[") ? `[${prefix.slice(1)}:${v}]` : `${prefix}-[${v}]`;
}

/** A list from untrusted state: an array, or `fallback` when it is not one. */
export function asArray(v: unknown, fallback: unknown[] = []): unknown[] {
  return Array.isArray(v) ? v : fallback;
}

/** An object from untrusted state, or an empty one. */
export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** One of `allowed`, else `fallback`. */
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Moves item `i` by `delta` places; the list is returned unchanged when out of range. */
export function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const out = list.slice();
  const [it] = out.splice(i, 1);
  out.splice(j, 0, it as T);
  return out;
}
