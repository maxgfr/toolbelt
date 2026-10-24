/**
 * Compares two lists as sets: items only in A, only in B, in both, and the
 * union. Each result keeps the first spelling seen and the input order (A
 * first), unless sorted.
 */
import { splitLines } from "../_shared";

export interface CompareOptions {
  trim: boolean;
  ignoreCase: boolean;
  /** Also split on commas and semicolons (for "a, b, c" lists). */
  splitCommas: boolean;
  sort: boolean;
}

export interface Comparison {
  a: string[];
  b: string[];
  onlyA: string[];
  onlyB: string[];
  both: string[];
  union: string[];
}

export function items(text: string, o: CompareOptions): string[] {
  const parts = o.splitCommas ? splitLines(text).flatMap((l) => l.split(/[,;]/)) : splitLines(text);
  return parts.map((s) => (o.trim ? s.trim() : s)).filter((s) => s.trim() !== "");
}

/** Unique items by key, first occurrence wins. */
function unique(list: string[], key: (s: string) => string): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of list) {
    const k = key(s);
    if (!m.has(k)) m.set(k, s);
  }
  return m;
}

export function compareLists(
  textA: string,
  textB: string,
  o: CompareOptions,
  locale?: string,
): Comparison {
  const key = o.ignoreCase ? (s: string) => s.toLocaleLowerCase(locale) : (s: string) => s;
  const a = unique(items(textA, o), key);
  const b = unique(items(textB, o), key);
  const onlyA: string[] = [];
  const both: string[] = [];
  for (const [k, v] of a) (b.has(k) ? both : onlyA).push(v);
  const onlyB = [...b].filter(([k]) => !a.has(k)).map(([, v]) => v);
  const union = [...a.values(), ...onlyB];
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const sorted = (l: string[]) => (o.sort ? [...l].sort(collator.compare) : l);
  return {
    a: [...a.values()],
    b: [...b.values()],
    onlyA: sorted(onlyA),
    onlyB: sorted(onlyB),
    both: sorted(both),
    union: sorted(union),
  };
}
