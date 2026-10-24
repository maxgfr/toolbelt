/**
 * Numbers written out in English and French: cardinals, ordinals, decimals and
 * amounts of money. Integers use BigInt (up to 10^36 − 1). French follows the
 * classic agreement rules (vingt et un, quatre-vingts, deux cents, mille
 * invariable, millions as nouns), with the 1990 hyphenation as an option, and
 * the Belgian and Swiss tens (septante, huitante, nonante).
 */

export type Variant = "fr" | "be" | "ch";

export interface FrOptions {
  /** 1990 spelling reform: hyphens between every numeral ("deux-cent-vingt-et-un"). */
  reform?: boolean;
  variant?: Variant;
}

export type Currency = "eur" | "usd";

export interface Parsed {
  negative: boolean;
  int: bigint;
  /** Decimal digits as typed, trailing zeros kept ("50" for 1.50). */
  frac: string;
}

export type ParseResult =
  | ({ ok: true } & Parsed)
  | { ok: false; error: "empty" | "invalid" | "big" };

const LIMIT = 10n ** 36n;

/** "1 234,56", "1,234.56", "-12" → sign, integer part and decimals. */
export function parseDecimal(input: string): ParseResult {
  let s = input
    .trim()
    .replace(/[\s  _']/g, "")
    .replace(/^−/, "-");
  if (!s) return { ok: false, error: "empty" };
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0)
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lastComma >= 0)
    s = s.split(",").length === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  else if (s.split(".").length > 2) s = s.replace(/\./g, "");
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || !(m[2] || m[3])) return { ok: false, error: "invalid" };
  const int = BigInt(m[2] || "0");
  if (int >= LIMIT) return { ok: false, error: "big" };
  const frac = m[3] ?? "";
  const negative = m[1] === "-" && (int > 0n || /[1-9]/.test(frac));
  return { ok: true, negative, int, frac };
}

/* --- English --------------------------------------------------------------- */

const EN_ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const EN_SCALES = [
  "",
  "thousand",
  "million",
  "billion",
  "trillion",
  "quadrillion",
  "quintillion",
  "sextillion",
  "septillion",
  "octillion",
  "nonillion",
  "decillion",
];

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const words: string[] = [];
  if (h) words.push(`${EN_ONES[h]} hundred`);
  if (r) {
    if (r < 20) words.push(EN_ONES[r] as string);
    else {
      const u = r % 10;
      words.push(`${EN_TENS[Math.floor(r / 10)]}${u ? `-${EN_ONES[u]}` : ""}`);
    }
  }
  return words.join(" ");
}

/** Splits into groups of three digits, units first. */
function groups(n: bigint): number[] {
  const out: number[] = [];
  let rest = n;
  do {
    out.push(Number(rest % 1000n));
    rest /= 1000n;
  } while (rest > 0n);
  return out;
}

export function enCardinal(n: bigint): string {
  if (n === 0n) return "zero";
  const g = groups(n);
  const words: string[] = [];
  for (let i = g.length - 1; i >= 0; i--) {
    const v = g[i] ?? 0;
    if (v) words.push(enBelow1000(v) + (i ? ` ${EN_SCALES[i]}` : ""));
  }
  return words.join(" ");
}

const EN_ORD: Record<string, string> = {
  one: "first",
  two: "second",
  three: "third",
  five: "fifth",
  eight: "eighth",
  nine: "ninth",
  twelve: "twelfth",
};

/** "twenty-first", "one hundredth"; null below 1. */
export function enOrdinal(n: bigint): string | null {
  if (n < 1n) return null;
  const card = enCardinal(n);
  const m = /^(.*?)([a-z]+)$/.exec(card);
  if (!m) return null;
  const last = m[2] as string;
  const ord = EN_ORD[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return `${m[1]}${ord}`;
}

/* --- French ---------------------------------------------------------------- */

const FR_UNITS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];
const FR_TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];
/** 10^6, 10^9, 10^12…: nouns, so they agree and stay separate words. */
const FR_NOUNS = [
  "",
  "",
  "million",
  "milliard",
  "billion",
  "billiard",
  "trillion",
  "trilliard",
  "quadrillion",
  "quadrilliard",
  "quintillion",
  "quintilliard",
];

/**
 * 0–99. `final`: nothing but a noun (million…) follows, so "quatre-vingts"
 * keeps its s; before "mille" or another numeral it does not.
 */
function frBelow100(n: number, final: boolean, o: Required<FrOptions>): string {
  const et = o.reform ? "-et-" : " et ";
  if (n < 17) return FR_UNITS[n] as string;
  if (n < 20) return `dix-${FR_UNITS[n - 10]}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  const regular = (base: string) =>
    u === 0 ? base : u === 1 ? `${base}${et}un` : `${base}-${FR_UNITS[u]}`;
  if (t <= 6) return regular(FR_TENS[t] as string);
  if (t === 7) {
    if (o.variant !== "fr") return regular("septante");
    return u === 1 ? `soixante${et}onze` : `soixante-${frBelow100(10 + u, final, o)}`;
  }
  if (t === 8) {
    if (o.variant === "ch") return regular("huitante");
    return u === 0 ? (final ? "quatre-vingts" : "quatre-vingt") : `quatre-vingt-${FR_UNITS[u]}`;
  }
  if (o.variant !== "fr") return regular("nonante");
  return `quatre-vingt-${frBelow100(10 + u, final, o)}`;
}

/** 0–999 ("deux cents", "deux cent un"); `final` as in frBelow100, for "cents" too. */
function frBelow1000(n: number, final: boolean, o: Required<FrOptions>): string {
  const sep = o.reform ? "-" : " ";
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return frBelow100(r, final, o);
  const hundred = h === 1 ? "cent" : `${FR_UNITS[h]}${sep}cent${r || !final ? "" : "s"}`;
  return r ? `${hundred}${sep}${frBelow100(r, final, o)}` : hundred;
}

function frOpts(o: FrOptions): Required<FrOptions> {
  return { reform: o.reform ?? false, variant: o.variant ?? "fr" };
}

export function frCardinal(n: bigint, opts: FrOptions = {}): string {
  const o = frOpts(opts);
  if (n === 0n) return "zéro";
  const sep = o.reform ? "-" : " ";
  const g = groups(n);
  let out = "";
  for (let i = g.length - 1; i >= 0; i--) {
    const v = g[i] ?? 0;
    if (!v) continue;
    let part: string;
    if (i === 0) part = frBelow1000(v, true, o);
    else if (i === 1) part = v === 1 ? "mille" : `${frBelow1000(v, false, o)}${sep}mille`;
    else part = `${frBelow1000(v, true, o)} ${FR_NOUNS[i]}${v > 1 ? "s" : ""}`;
    // Numerals join with the separator; a noun (million…) is always followed by a space.
    const prevNoun = /(?:illion|illiard)s?$/.test(out);
    out = out ? `${out}${prevNoun ? " " : sep}${part}` : part;
  }
  return out;
}

/** "premier", "vingt et unième", "quatre-vingtième", "millionième"; null below 1. */
export function frOrdinal(n: bigint, opts: FrOptions = {}): string | null {
  if (n < 1n) return null;
  if (n === 1n) return "premier";
  let card = frCardinal(n, opts);
  // "un million" → "millionième": the ordinal has no "un".
  if (/^un (?:[a-z]+illion|[a-z]+illiard)$/.test(card)) card = card.slice(3);
  const m = /^(.*?)([a-zéè]+)$/.exec(card);
  if (!m) return null;
  let last = m[2] as string;
  if (last === "cinq") last = "cinqu";
  else if (last === "neuf") last = "neuv";
  else if (/(?:cents|vingts|illions|illiards)$/.test(last)) last = last.slice(0, -1);
  else if (last.endsWith("e")) last = last.slice(0, -1);
  return `${m[1]}${last}ième`;
}

/* --- Decimals, signs and money --------------------------------------------- */

export type Lang = "en" | "fr";

function cardinal(n: bigint, lang: Lang, o: FrOptions): string {
  return lang === "fr" ? frCardinal(n, o) : enCardinal(n);
}

/** The full number: sign, integer part, and decimals ("three point one four", "trois virgule quatorze"). */
export function numberToWords(p: Parsed, lang: Lang, o: FrOptions = {}): string {
  const frac = p.frac.replace(/0+$/, "");
  let words = cardinal(p.int, lang, o);
  if (frac) {
    if (lang === "en") {
      words += ` point ${[...frac].map((d) => EN_ONES[Number(d)]).join(" ")}`;
    } else {
      // French reads the decimals as a number, with its leading zeros: 3,05 → trois virgule zéro cinq.
      const zeros = (/^0*/.exec(frac)?.[0] ?? "").length;
      const rest = frac.slice(zeros);
      words += ` virgule ${[...Array(zeros).fill("zéro"), frCardinal(BigInt(rest), o)].join(" ")}`;
    }
  }
  if (p.negative) words = `${lang === "fr" ? "moins" : "minus"} ${words}`;
  return words;
}

/** Rounds to cents: { units, cents }. */
export function toCents(p: Parsed): { units: bigint; cents: number } {
  const f = p.frac.padEnd(3, "0");
  let cents = Number(f.slice(0, 2));
  let units = p.int;
  if (Number(f[2]) >= 5) cents++;
  if (cents === 100) {
    cents = 0;
    units++;
  }
  return { units, cents };
}

const MONEY = {
  en: {
    eur: ["euro", "euros", "cent", "cents"],
    usd: ["dollar", "dollars", "cent", "cents"],
  },
  fr: {
    eur: ["euro", "euros", "centime", "centimes"],
    usd: ["dollar", "dollars", "cent", "cents"],
  },
} as const;

/** "one hundred dollars and five cents", "deux millions d'euros", "zéro euro". */
export function moneyToWords(p: Parsed, currency: Currency, lang: Lang, o: FrOptions = {}): string {
  const { units, cents } = toCents(p);
  const [one, many, cOne, cMany] = MONEY[lang][currency];
  const parts: string[] = [];
  if (units > 0n || cents === 0) {
    const n = cardinal(units, lang, o);
    // French: "un million d'euros", like any noun of quantity.
    const of = lang === "fr" && units >= 1000000n && units % 1000000n === 0n;
    const unit = lang === "fr" ? (units >= 2n ? many : one) : units === 1n ? one : many;
    parts.push(of ? `${n} ${/^[aeiouy]/.test(unit) ? "d'" : "de "}${unit}` : `${n} ${unit}`);
  }
  if (cents > 0) parts.push(`${cardinal(BigInt(cents), lang, o)} ${cents === 1 ? cOne : cMany}`);
  const words = parts.join(lang === "fr" ? " et " : " and ");
  const negative = p.negative && (units > 0n || cents > 0);
  return negative ? `${lang === "fr" ? "moins" : "minus"} ${words}` : words;
}
