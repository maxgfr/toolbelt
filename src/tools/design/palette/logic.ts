/**
 * Palettes from one color, all computed in OKLCH: harmonies (hue rotations) and a Tailwind-like
 * 50–950 scale (fixed lightness targets, chroma shaped like Tailwind's own scales), mapped into
 * sRGB with the CSS Color 4 gamut-mapping algorithm.
 */
import { type Color, converter, formatHex, type Oklch, toGamut } from "culori";
import { contrast, num, parseColor } from "../_shared";

const toOklch = converter("oklch");
const toSrgb = toGamut("rgb", "oklch");

export const HARMONIES = [
  "complementary",
  "analogous",
  "triadic",
  "split",
  "tetradic",
  "monochrome",
] as const;
export type Harmony = (typeof HARMONIES)[number];

export interface Swatch {
  hex: string;
  /** `oklch(L% C H)` of the displayed (in-gamut) color. */
  oklch: string;
}

/** The color in OKLCH with every channel defined (hue 0 for greys). */
export function lch(c: Color): { l: number; c: number; h: number } {
  const o = toOklch(c);
  return { l: o.l ?? 0, c: o.c ?? 0, h: Number.isFinite(o.h) ? (o.h as number) : 0 };
}

export function oklchCss(c: Color): string {
  const o = lch(c);
  return `oklch(${num(o.l * 100, 2)}% ${num(o.c, 4)} ${num(o.c < 1e-4 ? 0 : o.h, 2)})`;
}

function swatch(l: number, c: number, h: number): Swatch {
  const color: Oklch = {
    mode: "oklch",
    l: Math.min(1, Math.max(0, l)),
    c: Math.max(0, c),
    h: ((h % 360) + 360) % 360,
  };
  const rgb = toSrgb(color);
  return { hex: formatHex(rgb), oklch: oklchCss(rgb) };
}

const HUE_OFFSETS: Record<Exclude<Harmony, "monochrome">, number[]> = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};

/** The harmony's colors; the base color is kept exactly where it appears (offset 0). */
export function harmony(base: Color, kind: Harmony): Swatch[] {
  const o = lch(base);
  const exact = { hex: formatHex(toSrgb(base)), oklch: oklchCss(toSrgb(base)) };
  if (kind === "monochrome") {
    const ls = [-0.3, -0.15, 0, 0.15, 0.3].map((d) => Math.min(0.97, Math.max(0.15, o.l + d)));
    return ls.map((l, i) => (i === 2 ? exact : swatch(l, o.c, o.h)));
  }
  return HUE_OFFSETS[kind].map((d) => (d === 0 ? exact : swatch(o.l, o.c, o.h + d)));
}

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type StepId = (typeof STEPS)[number];

/** OKLCH lightness of each step (close to Tailwind v4's own palettes). */
const LIGHTNESS = [0.971, 0.936, 0.885, 0.808, 0.704, 0.637, 0.577, 0.505, 0.444, 0.396, 0.258];
/** Chroma of each step relative to the 500 step (Tailwind's curve: low at both ends). */
const CHROMA = [0.06, 0.14, 0.27, 0.48, 0.8, 1, 1, 0.88, 0.74, 0.6, 0.4];

export interface ScaleStep extends Swatch {
  step: StepId;
  /** True for the step replaced by the base color itself. */
  base: boolean;
}

/**
 * The 50–950 scale for a base color. With `keepBase`, the step whose lightness is closest to the
 * base color is the base color itself.
 */
export function scale(base: Color, keepBase = true): ScaleStep[] {
  const o = lch(base);
  // Use the base chroma as the scale's peak, but never less than what makes a visible tint.
  const peak = o.c < 0.02 ? o.c : Math.max(o.c, 0.08);
  let nearest = -1;
  if (keepBase) {
    let best = Number.POSITIVE_INFINITY;
    LIGHTNESS.forEach((l, i) => {
      const d = Math.abs(l - o.l);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
  }
  const exact = toSrgb(base);
  return STEPS.map((step, i) => {
    if (i === nearest) return { step, base: true, hex: formatHex(exact), oklch: oklchCss(exact) };
    return {
      step,
      base: false,
      ...swatch(LIGHTNESS[i] as number, peak * (CHROMA[i] as number), o.h),
    };
  });
}

export type Level = "AAA" | "AA" | "AA18" | "fail";

/** WCAG 2 level of a contrast ratio: AAA ≥ 7, AA ≥ 4.5, AA for large text only (AA18) ≥ 3. */
export function wcagLevel(ratio: number): Level {
  return ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA18" : "fail";
}

export interface Contrast {
  white: number;
  black: number;
  /** The better text color on this swatch. */
  text: "#ffffff" | "#000000";
  whiteLevel: Level;
  blackLevel: Level;
}

/** Contrast of white and black text on a swatch. */
export function contrastHint(hex: string): Contrast {
  const c = parseColor(hex) ?? { mode: "rgb" as const, r: 0, g: 0, b: 0 };
  const white = contrast(c, { mode: "rgb", r: 1, g: 1, b: 1 });
  const black = contrast(c, { mode: "rgb", r: 0, g: 0, b: 0 });
  return {
    white,
    black,
    text: white >= black ? "#ffffff" : "#000000",
    whiteLevel: wcagLevel(white),
    blackLevel: wcagLevel(black),
  };
}

/** A safe name for variables and config keys. */
export function cleanName(s: unknown): string {
  const n =
    typeof s === "string"
      ? s
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";
  return n || "primary";
}

export type ColorFormat = "hex" | "oklch";

const val = (s: Swatch, f: ColorFormat) => (f === "hex" ? s.hex : s.oklch);

export function cssVars(name: string, steps: ScaleStep[], f: ColorFormat): string {
  return `:root {\n${steps.map((s) => `  --color-${name}-${s.step}: ${val(s, f)};`).join("\n")}\n}`;
}

export function tailwind4(name: string, steps: ScaleStep[], f: ColorFormat): string {
  return `@theme {\n${steps.map((s) => `  --color-${name}-${s.step}: ${val(s, f)};`).join("\n")}\n}`;
}

export function tailwind3(name: string, steps: ScaleStep[], f: ColorFormat): string {
  const key = /^[a-z_$][a-z0-9_$]*$/i.test(name) ? name : `"${name}"`;
  const lines = steps.map((s) => `          ${s.step}: "${val(s, f)}",`);
  return `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n        ${key}: {\n${lines.join("\n")}\n        },\n      },\n    },\n  },\n};`;
}

export function toJson(
  name: string,
  steps: ScaleStep[],
  harmonyColors: Swatch[],
  kind: Harmony,
  f: ColorFormat,
): string {
  return JSON.stringify(
    {
      [name]: Object.fromEntries(steps.map((s) => [String(s.step), val(s, f)])),
      harmony: { type: kind, colors: harmonyColors.map((s) => val(s, f)) },
    },
    null,
    2,
  );
}
