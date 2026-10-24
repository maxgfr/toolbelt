/**
 * Line operations, composable: each enabled step runs in a fixed order
 * (trim → remove empty → dedupe → sort → reverse → shuffle → number → prefix/suffix)
 * so the result does not depend on the order the toggles were clicked.
 */
import { graphemes, rng, splitLines } from "../_shared";

export type SortMode = "none" | "az" | "za" | "natural" | "length";

export interface LineOptions {
  trim: boolean;
  removeEmpty: boolean;
  dedupe: boolean;
  dedupeIgnoreCase: boolean;
  sort: SortMode;
  sortIgnoreCase: boolean;
  reverse: boolean;
  shuffle: boolean;
  /** Seed of the shuffle, so a shuffle is stable until asked again. */
  seed: number;
  number: boolean;
  numberStart: number;
  numberSep: string;
  prefix: string;
  suffix: string;
}

export const DEFAULTS: LineOptions = {
  trim: false,
  removeEmpty: false,
  dedupe: false,
  dedupeIgnoreCase: false,
  sort: "none",
  sortIgnoreCase: true,
  reverse: false,
  shuffle: false,
  seed: 1,
  number: false,
  numberStart: 1,
  numberSep: ". ",
  prefix: "",
  suffix: "",
};

export function dedupe(lines: string[], ignoreCase: boolean): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const k = ignoreCase ? line.toLocaleLowerCase() : line;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sortLines(
  lines: string[],
  mode: SortMode,
  ignoreCase: boolean,
  locale?: string,
): string[] {
  if (mode === "none") return lines;
  const base = new Intl.Collator(locale, { sensitivity: ignoreCase ? "base" : "variant" });
  const natural = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: ignoreCase ? "base" : "variant",
  });
  const copy = [...lines];
  if (mode === "az") return copy.sort(base.compare);
  if (mode === "za") return copy.sort((a, b) => base.compare(b, a));
  if (mode === "natural") return copy.sort(natural.compare);
  return copy.sort((a, b) => graphemes(a).length - graphemes(b).length || natural.compare(a, b));
}

/** Fisher–Yates with a seeded generator. */
export function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rand = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function processLines(text: string, o: LineOptions, locale?: string): string[] {
  let lines = splitLines(text);
  if (o.trim) lines = lines.map((x) => x.trim());
  if (o.removeEmpty) lines = lines.filter((x) => x.trim() !== "");
  if (o.dedupe) lines = dedupe(lines, o.dedupeIgnoreCase);
  lines = sortLines(lines, o.sort, o.sortIgnoreCase, locale);
  if (o.reverse) lines = [...lines].reverse();
  if (o.shuffle) lines = shuffle(lines, o.seed);
  if (o.number) {
    const width = String(o.numberStart + lines.length - 1).length;
    lines = lines.map(
      (x, i) => `${String(o.numberStart + i).padStart(width, " ")}${o.numberSep}${x}`,
    );
  }
  if (o.prefix || o.suffix) lines = lines.map((x) => `${o.prefix}${x}${o.suffix}`);
  return lines;
}
