/** Pure parts of the image converter: output sizes, names, batch totals. */
import { fitWithin, type OutFormat, outName, type Size, sizeChange, uniqueNames } from "../_shared";

export interface ConvertOptions {
  format: OutFormat;
  /** 1–100. */
  quality: number;
  /** 0 = no limit. */
  maxW: number;
  maxH: number;
}

/** The output size for an image of w × h: scaled down to the limits, aspect ratio kept. */
export function outputSize(w: number, h: number, o: Pick<ConvertOptions, "maxW" | "maxH">): Size {
  return fitWithin(w, h, Math.max(0, Math.round(o.maxW)), Math.max(0, Math.round(o.maxH)));
}

/** Quality 1–100 as the 0–1 number canvas.toBlob expects. */
export function encoderQuality(q: number): number {
  return Math.min(1, Math.max(0.01, Math.round(q) / 100));
}

export interface Totals {
  count: number;
  before: number;
  after: number;
  /** Relative change of the converted files only (-0.6 = 60 % smaller). */
  change: number;
}

/** Sums the sizes of the converted files (those with an `after`). */
export function totals(items: { before: number; after: number | null }[]): Totals {
  let before = 0;
  let after = 0;
  let count = 0;
  for (const it of items) {
    if (it.after == null) continue;
    before += it.before;
    after += it.after;
    count++;
  }
  return { count, before, after, change: sizeChange(before, after) };
}

/** Output names for a batch, made unique for the ZIP. */
export function batchNames(names: string[], format: OutFormat): string[] {
  return uniqueNames(names.map((n) => outName(n, format)));
}
