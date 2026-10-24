/** CSS lengths: convert between absolute units, font-relative units and viewport units. */
import { num } from "../_shared";

export const UNITS = [
  "px",
  "rem",
  "em",
  "%",
  "pt",
  "pc",
  "in",
  "cm",
  "mm",
  "Q",
  "vw",
  "vh",
  "vmin",
  "vmax",
] as const;
export type Unit = (typeof UNITS)[number];

export interface Context {
  /** Root font size (html), in px: what 1rem is. */
  root: number;
  /** Parent font size, in px: what 1em (and 100%) is. */
  parent: number;
  /** Viewport width and height, in px. */
  vw: number;
  vh: number;
}

export const DEFAULT_CONTEXT: Context = { root: 16, parent: 16, vw: 1440, vh: 900 };

/** How many px one of each unit is. CSS fixes 1in = 96px, so 1pt = 4/3 px. */
export function pxPer(unit: Unit, ctx: Context): number {
  switch (unit) {
    case "px":
      return 1;
    case "rem":
      return ctx.root;
    case "em":
      return ctx.parent;
    case "%":
      return ctx.parent / 100;
    case "pt":
      return 96 / 72;
    case "pc":
      return 16;
    case "in":
      return 96;
    case "cm":
      return 96 / 2.54;
    case "mm":
      return 96 / 25.4;
    case "Q":
      return 96 / 101.6;
    case "vw":
      return ctx.vw / 100;
    case "vh":
      return ctx.vh / 100;
    case "vmin":
      return Math.min(ctx.vw, ctx.vh) / 100;
    case "vmax":
      return Math.max(ctx.vw, ctx.vh) / 100;
  }
}

export function convert(value: number, from: Unit, to: Unit, ctx: Context): number {
  const per = pxPer(to, ctx);
  return per ? (value * pxPer(from, ctx)) / per : 0;
}

/** A length as written in CSS: `1.5rem`, `-12px`, `.5em`, `50%`; a bare number uses `fallback`. */
export function parseLength(text: string, fallback: Unit): { value: number; unit: Unit } | null {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i.exec(
    text.replace(",", "."),
  );
  if (!m) return null;
  const value = Number(m[1]);
  const raw = m[2] ?? "";
  if (!Number.isFinite(value)) return null;
  if (!raw) return { value, unit: fallback };
  const unit = UNITS.find((u) => u.toLowerCase() === raw.toLowerCase());
  return unit ? { value, unit } : null;
}

/** `value` in every unit, as CSS text (`1.5rem`). */
export function convertAll(
  value: number,
  from: Unit,
  ctx: Context,
): { unit: Unit; value: number; css: string }[] {
  return UNITS.map((unit) => {
    const v = convert(value, from, unit, ctx);
    return { unit, value: v, css: `${num(v)}${unit}` };
  });
}

/** Sizes that show up all the time in designs, in px. */
export const COMMON_PX = [
  1, 2, 4, 6, 8, 10, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128,
];
