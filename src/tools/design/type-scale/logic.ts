/**
 * Modular type scales: size(n) = base × ratio^n. The fluid version interpolates between a scale
 * at a small viewport and one at a large viewport with clamp() (the Utopia approach).
 */
import { asRecord, clampNum, num } from "../_shared";

export type Scale = {
  /** Base size and ratio at the large viewport (and for the static scale). */
  base: number;
  ratio: number;
  /** Base size and ratio at the small viewport. */
  minBase: number;
  minRatio: number;
  up: number;
  down: number;
  root: number;
  fluid: boolean;
  minVw: number;
  maxVw: number;
  prefix: string;
};

export const DEFAULT: Scale = {
  base: 18,
  ratio: 1.25,
  minBase: 16,
  minRatio: 1.2,
  up: 5,
  down: 2,
  root: 16,
  fluid: true,
  minVw: 360,
  maxVw: 1280,
  prefix: "step",
};

export const RATIOS: { value: number; name: { en: string; fr: string; de: string } }[] = [
  { value: 1.067, name: { en: "Minor second", fr: "Seconde mineure", de: "Kleine Sekunde" } },
  { value: 1.125, name: { en: "Major second", fr: "Seconde majeure", de: "Große Sekunde" } },
  { value: 1.2, name: { en: "Minor third", fr: "Tierce mineure", de: "Kleine Terz" } },
  { value: 1.25, name: { en: "Major third", fr: "Tierce majeure", de: "Große Terz" } },
  { value: 1.333, name: { en: "Perfect fourth", fr: "Quarte juste", de: "Reine Quarte" } },
  {
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: the interval is named 1.414, not √2
    value: 1.414,
    name: { en: "Augmented fourth", fr: "Quarte augmentée", de: "Übermäßige Quarte" },
  },
  { value: 1.5, name: { en: "Perfect fifth", fr: "Quinte juste", de: "Reine Quinte" } },
  { value: 1.618, name: { en: "Golden ratio", fr: "Nombre d'or", de: "Goldener Schnitt" } },
];

/** A safe CSS identifier fragment for the variable names. */
export function cleanPrefix(s: unknown): string {
  const p =
    typeof s === "string"
      ? s
          .trim()
          .toLowerCase()
          .replace(/^-+/, "")
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/-+$/, "")
      : "";
  return p || DEFAULT.prefix;
}

export function cleanScale(raw: unknown): Scale {
  const r = asRecord(raw);
  return {
    base: clampNum(r.base, 1, 200, DEFAULT.base),
    ratio: clampNum(r.ratio, 1, 4, DEFAULT.ratio),
    minBase: clampNum(r.minBase, 1, 200, DEFAULT.minBase),
    minRatio: clampNum(r.minRatio, 1, 4, DEFAULT.minRatio),
    up: Math.round(clampNum(r.up, 0, 12, DEFAULT.up)),
    down: Math.round(clampNum(r.down, 0, 6, DEFAULT.down)),
    root: clampNum(r.root, 1, 100, DEFAULT.root),
    fluid: r.fluid !== false,
    minVw: clampNum(r.minVw, 1, 10000, DEFAULT.minVw),
    maxVw: clampNum(r.maxVw, 1, 10000, DEFAULT.maxVw),
    prefix: cleanPrefix(r.prefix),
  };
}

export function size(base: number, ratio: number, step: number): number {
  return base * ratio ** step;
}

const rem = (px: number, root: number) => `${num(px / root, 4)}rem`;

/**
 * `clamp(min, intercept + slope·vw, max)` growing linearly from `minPx` at `minVw` to `maxPx` at
 * `maxVw`. A plain rem value when both ends are equal or the viewports are not in order.
 */
export function fluidClamp(
  minPx: number,
  maxPx: number,
  minVw: number,
  maxVw: number,
  root: number,
): string {
  if (maxVw <= minVw || Math.abs(maxPx - minPx) < 1e-9) return rem(maxPx, root);
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  const vw = `${num(Math.abs(slope) * 100, 4)}vw`;
  const i = num(intercept / root, 4);
  const iAbs = `${num(Math.abs(intercept) / root, 4)}rem`;
  let middle: string;
  if (slope < 0) middle = `${i}rem - ${vw}`;
  else if (i === "0") middle = vw;
  else middle = intercept < 0 ? `${vw} - ${iAbs}` : `${i}rem + ${vw}`;
  return `clamp(${rem(lo, root)}, ${middle}, ${rem(hi, root)})`;
}

export interface Step {
  step: number;
  name: string;
  /** Size at the small and the large viewport (equal when not fluid). */
  minPx: number;
  maxPx: number;
  value: string;
}

export function steps(s: Scale): Step[] {
  const out: Step[] = [];
  for (let n = s.up; n >= -s.down; n--) {
    const maxPx = size(s.base, s.ratio, n);
    const minPx = s.fluid ? size(s.minBase, s.minRatio, n) : maxPx;
    out.push({
      step: n,
      name: `--${s.prefix}-${n}`,
      minPx,
      maxPx,
      value: s.fluid ? fluidClamp(minPx, maxPx, s.minVw, s.maxVw, s.root) : rem(maxPx, s.root),
    });
  }
  return out;
}

export function scaleCss(s: Scale): string {
  const head = s.fluid
    ? `/* ${num(s.minBase, 2)}px × ${num(s.minRatio, 3)} @ ${num(s.minVw)}px → ${num(s.base, 2)}px × ${num(s.ratio, 3)} @ ${num(s.maxVw)}px */\n`
    : `/* ${num(s.base, 2)}px × ${num(s.ratio, 3)} */\n`;
  return `${head}:root {\n${steps(s)
    .map((st) => `  ${st.name}: ${st.value};`)
    .join("\n")}\n}`;
}

/** Tailwind v4 `@theme` block: utilities `text-<prefix>-<n>`. */
export function scaleTailwind4(s: Scale): string {
  return `@theme {\n${steps(s)
    .map((st) => `  --text-${s.prefix}-${st.step}: ${st.value};`)
    .join("\n")}\n}`;
}

/** Tailwind v3 `theme.extend.fontSize`. */
export function scaleTailwind3(s: Scale): string {
  const lines = steps(s).map((st) => `        "${s.prefix}-${st.step}": "${st.value}",`);
  return `module.exports = {\n  theme: {\n    extend: {\n      fontSize: {\n${lines.join("\n")}\n      },\n    },\n  },\n};`;
}
