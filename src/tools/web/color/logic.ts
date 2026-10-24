/**
 * Colors: parse any CSS color (culori), write it in every CSS syntax, build a tints/shades
 * scale, and measure contrast — WCAG 2 ratio and APCA Lc (0.0.98G-4g constants).
 */
import {
  type Color,
  colorsNamed,
  converter,
  differenceCiede2000,
  displayable,
  formatHex,
  formatHex8,
  interpolate,
  nearest,
  parse,
  type Rgb,
} from "culori";
import { num } from "../_shared";

const toRgb = converter("rgb");
const toHsl = converter("hsl");
const toHwb = converter("hwb");
const toLab = converter("lab");
const toLch = converter("lch");
const toOklab = converter("oklab");
const toOklch = converter("oklch");

/** Parses a CSS color; also accepts a bare hex like `ff8800`. Undefined when invalid. */
export function parseColor(input: string): Color | undefined {
  const s = input.trim();
  if (!s) return undefined;
  if (/^[0-9a-f]{3,4}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(s)) return parse(`#${s}`);
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

export function hex(c: Color): string {
  const s = srgb(c);
  return (s.alpha ?? 1) < 1 ? formatHex8(s) : formatHex(s);
}

/** True when the color fits in sRGB (else the sRGB formats are clamped). */
export function inGamut(c: Color): boolean {
  return displayable(c);
}

const alphaPart = (a: number | undefined) => (a === undefined || a >= 1 ? "" : ` / ${num(a, 3)}`);
const hue = (h: number | undefined) => num(h ?? 0, 2);
const pct = (v: number | undefined, digits = 2) => `${num((v ?? 0) * 100, digits)}%`;

export interface Formatted {
  id: string;
  value: string;
}

/** The color in every common CSS syntax. */
export function formats(c: Color): Formatted[] {
  const s = srgb(c);
  const a = c.alpha;
  const rgb = [s.r, s.g, s.b].map((v) => Math.round(v * 255)).join(" ");
  const hsl = toHsl(s);
  const hwb = toHwb(s);
  const lab = toLab(c);
  const lch = toLch(c);
  const oklab = toOklab(c);
  const oklch = toOklch(c);
  return [
    { id: "hex", value: hex(c) },
    { id: "rgb", value: `rgb(${rgb}${alphaPart(a)})` },
    { id: "hsl", value: `hsl(${hue(hsl.h)} ${pct(hsl.s, 1)} ${pct(hsl.l, 1)}${alphaPart(a)})` },
    { id: "hwb", value: `hwb(${hue(hwb.h)} ${pct(hwb.w, 1)} ${pct(hwb.b, 1)}${alphaPart(a)})` },
    {
      id: "lab",
      value: `lab(${num(lab.l, 2)}% ${num(lab.a, 2)} ${num(lab.b, 2)}${alphaPart(a)})`,
    },
    {
      id: "lch",
      value: `lch(${num(lch.l, 2)}% ${num(lch.c, 2)} ${hue(lch.h)}${alphaPart(a)})`,
    },
    {
      id: "oklab",
      value: `oklab(${pct(oklab.l)} ${num(oklab.a, 4)} ${num(oklab.b, 4)}${alphaPart(a)})`,
    },
    {
      id: "oklch",
      value: `oklch(${pct(oklch.l)} ${num(oklch.c, 4)} ${hue(oklch.h)}${alphaPart(a)})`,
    },
  ];
}

const NAMES = Object.keys(colorsNamed);
const nearestNamed = nearest(NAMES, differenceCiede2000());

/** The CSS named color: exact when it matches, else the perceptually nearest one. */
export function colorName(c: Color): { name: string; exact: boolean } {
  const h = formatHex(srgb(c));
  const exact = NAMES.find((n) => formatHex(parse(n)) === h);
  if (exact) return { name: exact, exact: true };
  return { name: nearestNamed(srgb(c), 1)[0] ?? "black", exact: false };
}

export interface ScaleStep {
  /** -5 … 5: negative are shades (towards black), positive tints (towards white). */
  step: number;
  hex: string;
}

/** Five shades, the color, five tints — mixed in OKLab so the steps look even. */
export function tintsAndShades(c: Color): ScaleStep[] {
  const base = { ...srgb(c), alpha: 1 };
  const toWhite = interpolate([base, "white"], "oklab");
  const toBlack = interpolate([base, "black"], "oklab");
  const out: ScaleStep[] = [];
  for (let i = -5; i <= 5; i++) {
    const mixed = i < 0 ? toBlack(-i * 0.16) : i > 0 ? toWhite(i * 0.17) : base;
    out.push({ step: i, hex: formatHex(srgb(mixed)) });
  }
  return out;
}

/** `fg` drawn over an opaque `bg` (alpha compositing in sRGB, as browsers do). */
export function blend(fg: Color, bg: Color): Rgb {
  const f = srgb(fg);
  const b = srgb(bg);
  const a = f.alpha ?? 1;
  return {
    mode: "rgb",
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
  };
}

/** WCAG 2 relative luminance of an sRGB color. */
export function luminance(c: Rgb): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2 contrast ratio, 1 … 21 (a translucent foreground is blended over the background). */
export function contrastRatio(fg: Color, bg: Color): number {
  const back = { ...srgb(bg), alpha: 1 };
  const l1 = luminance(blend(fg, back));
  const l2 = luminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export interface WcagLevels {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  /** 1.4.11: UI components and graphical objects. */
  ui: boolean;
}

/** Pass/fail per WCAG 2 level. The ratio is compared unrounded, as the spec requires. */
export function wcagLevels(ratio: number): WcagLevels {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    ui: ratio >= 3,
  };
}

/** APCA lightness contrast Lc (about -108 … 106; negative = light text on dark). */
export function apcaContrast(fg: Color, bg: Color): number {
  const back = { ...srgb(bg), alpha: 1 };
  const y = (c: Rgb) => {
    const v = 0.2126729 * c.r ** 2.4 + 0.7151522 * c.g ** 2.4 + 0.072175 * c.b ** 2.4;
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: APCA's black clamp is 1.414, not √2
    return v > 0.022 ? v : v + (0.022 - v) ** 1.414;
  };
  const yt = y(blend(fg, back));
  const yb = y(back);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

export type ApcaUse = "body" | "content" | "large" | "spot" | "none";

/** What an |Lc| is good for, after the APCA "bronze" guidelines. */
export function apcaUse(lc: number): ApcaUse {
  const a = Math.abs(lc);
  if (a >= 75) return "body";
  if (a >= 60) return "content";
  if (a >= 45) return "large";
  if (a >= 30) return "spot";
  return "none";
}

/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: Color): "#000000" | "#ffffff" {
  const black: Rgb = { mode: "rgb", r: 0, g: 0, b: 0 };
  const white: Rgb = { mode: "rgb", r: 1, g: 1, b: 1 };
  return contrastRatio(black, bg) >= contrastRatio(white, bg) ? "#000000" : "#ffffff";
}
