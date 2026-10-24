/** Roman numerals ↔ numbers, 1 to 3999, with a strict check and a lenient reading for hints. */

const PAIRS: [string, number][] = [
  ["M", 1000],
  ["CM", 900],
  ["D", 500],
  ["CD", 400],
  ["C", 100],
  ["XC", 90],
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1],
];

const VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export const MAX = 3999;

export function toRoman(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > MAX) return null;
  let out = "";
  let rest = n;
  for (const [sym, v] of PAIRS)
    while (rest >= v) {
      out += sym;
      rest -= v;
    }
  return out;
}

/** The parts of a canonical numeral: "MCMXC" → M 1000, CM 900, XC 90. */
export function romanParts(n: number): { symbol: string; value: number }[] {
  const out: { symbol: string; value: number }[] = [];
  let rest = n;
  for (const [symbol, value] of PAIRS)
    while (rest >= value) {
      out.push({ symbol, value });
      rest -= value;
    }
  return out;
}

const STRICT = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

export type FromRoman =
  | { ok: true; value: number }
  | { ok: false; error: "empty" }
  | { ok: false; error: "char"; char: string }
  /** Readable but not standard ("IIII", "IC"): `value` is the lenient reading, `canonical` its proper form. */
  | { ok: false; error: "form"; value: number; canonical: string | null };

export function fromRoman(input: string): FromRoman {
  const s = input.trim().toUpperCase();
  if (!s) return { ok: false, error: "empty" };
  for (const ch of s) if (!(ch in VALUE)) return { ok: false, error: "char", char: ch };
  if (STRICT.test(s)) return { ok: true, value: lenient(s) };
  const value = lenient(s);
  return { ok: false, error: "form", value, canonical: toRoman(value) };
}

/** Additive reading where a smaller symbol before a larger one subtracts. */
function lenient(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALUE[s[i] as string] ?? 0;
    const next = VALUE[s[i + 1] as string] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}

export type Detected =
  | { kind: "number"; value: number; roman: string | null }
  | { kind: "roman"; result: FromRoman }
  | { kind: "empty" };

/** Digits go to Roman, letters come back to a number. */
export function convert(input: string): Detected {
  const s = input.trim().replace(/[\s  .,']/g, "");
  if (!s) return { kind: "empty" };
  if (/^[+-]?\d+$/.test(s)) {
    const value = Number(s);
    return { kind: "number", value, roman: toRoman(value) };
  }
  return { kind: "roman", result: fromRoman(s) };
}
