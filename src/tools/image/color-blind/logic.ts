/**
 * Color vision deficiency simulation with the Machado, Oliveira & Fernandes (2009) matrices,
 * applied in linear RGB (pixels are linearized, multiplied, then re-encoded to sRGB).
 * Achromatopsia uses the Rec. 709 luminance. Pure.
 */
import type { Rgb } from "../_shared";

export type Deficiency =
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia"
  | "protanomaly"
  | "deuteranomaly"
  | "tritanomaly"
  | "achromatomaly";

export type Matrix = [number, number, number, number, number, number, number, number, number];

/** Machado 2009, severity 1.0 (dichromacy) and 0.6 (anomalous trichromacy). */
export const MATRICES: Record<Exclude<Deficiency, "achromatopsia" | "achromatomaly">, Matrix> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
  protanomaly: [
    0.38545, 0.769005, -0.154455, 0.100526, 0.829802, 0.069673, -0.007442, -0.02219, 1.029632,
  ],
  deuteranomaly: [
    0.547494, 0.607765, -0.155259, 0.181692, 0.781742, 0.036566, -0.01041, 0.027275, 0.983136,
  ],
  tritanomaly: [
    1.104996, -0.046633, -0.058363, -0.032137, 0.971635, 0.060503, 0.001336, 0.317922, 0.680742,
  ],
};

const LUM: [number, number, number] = [0.2126, 0.7152, 0.0722];

/** Achromatopsia: every channel gets the luminance. */
const ACHROMA: Matrix = [...LUM, ...LUM, ...LUM] as Matrix;

/** Mixes a matrix with the identity: 1 = full effect, 0 = normal vision. */
export function blendIdentity(m: Matrix, amount: number): Matrix {
  const id = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return m.map((v, i) => (id[i] as number) * (1 - amount) + v * amount) as Matrix;
}

export function matrixOf(d: Deficiency): Matrix {
  if (d === "achromatopsia") return ACHROMA;
  if (d === "achromatomaly") return blendIdentity(ACHROMA, 0.6);
  return MATRICES[d];
}

/** Share of people concerned (rough, mostly from Northern-European studies). */
export const PREVALENCE: Record<Deficiency, { men: number; women: number }> = {
  protanopia: { men: 0.01, women: 0.0002 },
  deuteranopia: { men: 0.01, women: 0.0001 },
  tritanopia: { men: 0.0001, women: 0.0001 },
  achromatopsia: { men: 0.00003, women: 0.00003 },
  protanomaly: { men: 0.01, women: 0.0003 },
  deuteranomaly: { men: 0.05, women: 0.0035 },
  tritanomaly: { men: 0.0001, women: 0.0001 },
  achromatomaly: { men: 0.00001, women: 0.00001 },
};

/* --- sRGB transfer ------------------------------------------------------------------- */

export function toLinear(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function fromLinear(v: number): number {
  const x = Math.min(1, Math.max(0, v));
  const s = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

const TO_LIN = Float32Array.from({ length: 256 }, (_, i) => toLinear(i));
const STEPS = 4096;
const FROM_LIN = Uint8Array.from({ length: STEPS + 1 }, (_, i) => fromLinear(i / STEPS));

/** One color as seen with a deficiency. */
export function simulateRgb([r, g, b]: Rgb, d: Deficiency): Rgb {
  const m = matrixOf(d);
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return [
    fromLinear(m[0] * R + m[1] * G + m[2] * B),
    fromLinear(m[3] * R + m[4] * G + m[5] * B),
    fromLinear(m[6] * R + m[7] * G + m[8] * B),
  ];
}

/** RGBA pixels as seen with a deficiency (alpha kept). Uses lookup tables: fast on big images. */
export function simulate(src: Uint8ClampedArray, d: Deficiency): Uint8ClampedArray {
  const m = matrixOf(d);
  const out = new Uint8ClampedArray(src.length);
  const q = (v: number) => FROM_LIN[Math.round(Math.min(1, Math.max(0, v)) * STEPS)] as number;
  for (let i = 0; i < src.length; i += 4) {
    const R = TO_LIN[src[i] as number] as number;
    const G = TO_LIN[src[i + 1] as number] as number;
    const B = TO_LIN[src[i + 2] as number] as number;
    out[i] = q(m[0] * R + m[1] * G + m[2] * B);
    out[i + 1] = q(m[3] * R + m[4] * G + m[5] * B);
    out[i + 2] = q(m[6] * R + m[7] * G + m[8] * B);
    out[i + 3] = src[i + 3] as number;
  }
  return out;
}

/** Euclidean distance between two colors in sRGB (0–441). */
export function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Color pairs often confused, drawn on the built-in sample. */
export const SAMPLE_PAIRS: [string, string][] = [
  ["#d62728", "#2ca02c"],
  ["#ff7f0e", "#8bc34a"],
  ["#1f77b4", "#9467bd"],
  ["#e377c2", "#7f7f7f"],
  ["#17becf", "#bcbd22"],
  ["#8c564b", "#2e7d32"],
];
