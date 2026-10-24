/** Layered box-shadow: clean layers from untrusted state, write the CSS, presets. */
import {
  asArray,
  asRecord,
  clampNum,
  cssColor,
  len,
  parseColor,
  tailwindArbitrary,
} from "../_shared";

export type ShadowLayer = {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** Any CSS color; `alpha` multiplies its opacity. */
  color: string;
  alpha: number;
  inset: boolean;
};

export const LIMITS = { offset: 100, blur: 200, spread: 100 } as const;

export function newLayer(over: Partial<ShadowLayer> = {}): ShadowLayer {
  return { x: 0, y: 4, blur: 12, spread: 0, color: "#000000", alpha: 0.15, inset: false, ...over };
}

/** A clean layer from anything (missing or wrong fields get defaults, numbers are clamped). */
export function cleanLayer(raw: unknown): ShadowLayer {
  const r = asRecord(raw);
  const d = newLayer();
  return {
    x: clampNum(r.x, -LIMITS.offset, LIMITS.offset, d.x),
    y: clampNum(r.y, -LIMITS.offset, LIMITS.offset, d.y),
    blur: clampNum(r.blur, 0, LIMITS.blur, d.blur),
    spread: clampNum(r.spread, -LIMITS.spread, LIMITS.spread, d.spread),
    color: typeof r.color === "string" ? r.color : d.color,
    alpha: clampNum(r.alpha, 0, 1, d.alpha),
    inset: r.inset === true,
  };
}

export function cleanLayers(raw: unknown): ShadowLayer[] {
  return asArray(raw)
    .slice(0, 12)
    .map((l) => cleanLayer(l));
}

/** One layer: `[inset] x y blur spread color`. */
export function layerCss(l: ShadowLayer): string {
  const parts = [len(l.x), len(l.y), len(l.blur)];
  if (l.spread !== 0) parts.push(len(l.spread));
  parts.push(cssColor(parseColor(l.color) ? l.color : "#000", l.alpha));
  return (l.inset ? "inset " : "") + parts.join(" ");
}

/** The `box-shadow` value: layers separated by commas, the first one drawn on top. */
export function shadowValue(layers: ShadowLayer[]): string {
  return layers.length ? layers.map(layerCss).join(", ") : "none";
}

/** A ready-to-paste declaration, one layer per line when there are several. */
export function shadowCss(layers: ShadowLayer[]): string {
  if (layers.length <= 1) return `box-shadow: ${shadowValue(layers)};`;
  return `box-shadow:\n${layers.map((l) => `  ${layerCss(l)}`).join(",\n")};`;
}

export function shadowTailwind(layers: ShadowLayer[]): string {
  return layers.length ? tailwindArbitrary("shadow", shadowValue(layers)) : "shadow-none";
}

export interface ShadowPreset {
  id: string;
  name: { en: string; fr: string };
  layers: ShadowLayer[];
  /** Suggested page and box colors for the preview. */
  bg?: string;
  box?: string;
}

const L = newLayer;

export const PRESETS: ShadowPreset[] = [
  {
    id: "soft",
    name: { en: "Soft", fr: "Douce" },
    layers: [L({ x: 0, y: 1, blur: 2, alpha: 0.06 }), L({ x: 0, y: 8, blur: 24, alpha: 0.1 })],
  },
  {
    id: "elevated",
    name: { en: "Elevated", fr: "Surélevée" },
    layers: [
      L({ x: 0, y: 1, blur: 1, alpha: 0.08 }),
      L({ x: 0, y: 2, blur: 2, alpha: 0.08 }),
      L({ x: 0, y: 4, blur: 4, alpha: 0.08 }),
      L({ x: 0, y: 8, blur: 8, alpha: 0.08 }),
      L({ x: 0, y: 16, blur: 16, alpha: 0.08 }),
    ],
  },
  {
    id: "floating",
    name: { en: "Floating", fr: "Flottante" },
    layers: [L({ x: 0, y: 24, blur: 48, spread: -12, alpha: 0.3 })],
  },
  {
    id: "sharp",
    name: { en: "Sharp", fr: "Nette" },
    layers: [L({ x: 6, y: 6, blur: 0, color: "#111827", alpha: 1 })],
  },
  {
    id: "neumorphism",
    name: { en: "Neumorphism", fr: "Neumorphisme" },
    layers: [
      L({ x: 9, y: 9, blur: 16, color: "#a3b1c6", alpha: 0.6 }),
      L({ x: -9, y: -9, blur: 16, color: "#ffffff", alpha: 0.5 }),
    ],
    bg: "#e0e5ec",
    box: "#e0e5ec",
  },
  {
    id: "pressed",
    name: { en: "Pressed", fr: "Enfoncée" },
    layers: [
      L({ x: 6, y: 6, blur: 12, color: "#a3b1c6", alpha: 0.6, inset: true }),
      L({ x: -6, y: -6, blur: 12, color: "#ffffff", alpha: 0.6, inset: true }),
    ],
    bg: "#e0e5ec",
    box: "#e0e5ec",
  },
  {
    id: "glow",
    name: { en: "Glow", fr: "Halo" },
    layers: [
      L({ x: 0, y: 0, blur: 8, color: "#8b5cf6", alpha: 0.6 }),
      L({ x: 0, y: 0, blur: 32, color: "#8b5cf6", alpha: 0.4 }),
    ],
    bg: "#0f172a",
    box: "#1e1b4b",
  },
  {
    id: "ring",
    name: { en: "Focus ring", fr: "Anneau de focus" },
    layers: [
      L({ x: 0, y: 0, blur: 0, spread: 2, color: "#ffffff", alpha: 1 }),
      L({ x: 0, y: 0, blur: 0, spread: 4, color: "#0f766e", alpha: 1 }),
    ],
  },
  {
    id: "layered",
    name: { en: "Layered cards", fr: "Cartes empilées" },
    layers: [
      L({ x: 8, y: 8, blur: 0, spread: -2, color: "#f59e0b", alpha: 1 }),
      L({ x: 16, y: 16, blur: 0, spread: -4, color: "#ef4444", alpha: 1 }),
    ],
  },
];
