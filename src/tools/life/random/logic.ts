/**
 * Chance toolkit: random numbers, dice in NdM+K notation, coin flips, picking winners,
 * shuffling, teams and Secret Santa. Every function takes the random source (a uniform integer
 * in [0, max)), so tests run on a seeded one and the tool on crypto.getRandomValues.
 */

import type { L10n } from "../../../i18n";
import { l } from "../../../i18n";
import type { RandomInt } from "../_shared";

export type Result<T> = { ok: true; value: T } | { ok: false; error: L10n };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = (en: string, fr: string, de: string): Result<never> => ({
  ok: false,
  error: l(en, fr, de),
});

export const MAX_COUNT = 10_000;

/* --- Numbers ---------------------------------------------------------------- */

/** `count` distinct integers in [0, n), uniformly (Floyd's algorithm: no big arrays). */
export function sampleDistinct(rand: RandomInt, n: number, count: number): number[] {
  const picked = new Set<number>();
  const order: number[] = [];
  for (let j = n - count; j < n; j++) {
    const t = rand(j + 1);
    const v = picked.has(t) ? j : t;
    picked.add(v);
    order.push(v);
  }
  // Floyd's order is not uniform: shuffle it.
  return shuffle(rand, order);
}

export interface NumberOptions {
  min: number;
  max: number;
  count: number;
  /** Decimal places: 0 for integers. */
  decimals: number;
  unique: boolean;
}

/**
 * Random numbers in [min, max], both included. With decimals, every value of the grid
 * min, min + 10^-d, …, max is equally likely.
 */
export function randomNumbers(rand: RandomInt, o: NumberOptions): Result<number[]> {
  const d = Math.max(0, Math.min(6, Math.round(o.decimals)));
  const scale = 10 ** d;
  if (!Number.isFinite(o.min) || !Number.isFinite(o.max))
    return err(
      "Enter a minimum and a maximum.",
      "Entre un minimum et un maximum.",
      "Gib ein Minimum und ein Maximum ein.",
    );
  const lo = Math.ceil(Math.min(o.min, o.max) * scale - 1e-9);
  const hi = Math.floor(Math.max(o.min, o.max) * scale + 1e-9);
  const size = hi - lo + 1;
  if (size < 1)
    return err(
      "No value fits in that range.",
      "Aucune valeur ne tient dans cet intervalle.",
      "In diesen Bereich passt kein Wert.",
    );
  if (!Number.isSafeInteger(size) || size > 2 ** 53)
    return err(
      "The range is too large.",
      "L'intervalle est trop grand.",
      "Der Bereich ist zu groß.",
    );
  const count = Math.round(o.count);
  if (!(count >= 1 && count <= MAX_COUNT))
    return err(
      `The count must be between 1 and ${MAX_COUNT}.`,
      `Le nombre de tirages doit être entre 1 et ${MAX_COUNT}.`,
      `Die Anzahl muss zwischen 1 und ${MAX_COUNT} liegen.`,
    );
  if (o.unique && count > size)
    return err(
      `Only ${size} different values fit in that range.`,
      `Seules ${size} valeurs différentes tiennent dans cet intervalle.`,
      `In diesen Bereich passen nur ${size} verschiedene Werte.`,
    );
  const raw = o.unique
    ? sampleDistinct(rand, size, count)
    : Array.from({ length: count }, () => rand(size));
  return ok(raw.map((k) => Number(((lo + k) / scale).toFixed(d))));
}

/* --- Dice -------------------------------------------------------------------- */

export interface DiceTerm {
  sign: 1 | -1;
  /** Number of dice; 0 for a constant. */
  count: number;
  /** Faces; for a constant, its value. */
  sides: number;
  /** Keep only the highest / lowest `keep` dice. */
  keep?: { which: "h" | "l"; n: number };
  /** Source text of the term. */
  text: string;
}

export const MAX_DICE = 1000;
export const MAX_SIDES = 1_000_000;

/**
 * Parses dice notation: terms like 3d6, d20, d% (d100), 4d6kh3 / 4d6kl1 (keep highest/lowest)
 * and constants, joined by + or -. "2d6+1d8-1". Case and spaces do not matter; the German
 * "W" (Würfel) works like "d": 2W6+3.
 */
export function parseDice(input: string): Result<DiceTerm[]> {
  const s = input
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .trim()
    .replace(/\s*([+-])\s*/g, "$1");
  if (!s)
    return err(
      "Type dice like 2d6+3.",
      "Tape des dés comme 2d6+3.",
      "Gib Würfel wie 2d6+3 oder 2W6+3 ein.",
    );
  const re = /([+-]?)(?:(\d*)[dw](\d+|%)(?:k([hl]?)(\d+))?|(\d+))/y;
  const terms: DiceTerm[] = [];
  let i = 0;
  let dice = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m || (m[1] === "" && terms.length > 0))
      return err(
        `Cannot read "${s.slice(i)}". Use terms like 2d6, d20, 4d6kh3 or 5, joined by + or -.`,
        `Impossible de lire « ${s.slice(i)} ». Utilise des termes comme 2d6, d20, 4d6kh3 ou 5, reliés par + ou -.`,
        `„${s.slice(i)}“ ist nicht lesbar. Nutze Terme wie 2d6, d20, 4d6kh3 oder 5, verbunden mit + oder -.`,
      );
    i = re.lastIndex;
    const sign = m[1] === "-" ? -1 : 1;
    const text = m[0].replace(/^[+-]/, "");
    if (m[6] !== undefined) {
      terms.push({ sign, count: 0, sides: Number(m[6]), text });
      continue;
    }
    const count = m[2] ? Number(m[2]) : 1;
    const sides = m[3] === "%" ? 100 : Number(m[3]);
    if (count < 1 || count > MAX_DICE)
      return err(
        `Roll between 1 and ${MAX_DICE} dice per term.`,
        `Lance entre 1 et ${MAX_DICE} dés par terme.`,
        `Wirf zwischen 1 und ${MAX_DICE} Würfel pro Term.`,
      );
    if (sides < 2 || sides > MAX_SIDES)
      return err(
        `A die has between 2 and ${MAX_SIDES} faces.`,
        `Un dé a entre 2 et ${MAX_SIDES} faces.`,
        `Ein Würfel hat zwischen 2 und ${MAX_SIDES} Seiten.`,
      );
    dice += count;
    if (dice > MAX_DICE)
      return err(
        `At most ${MAX_DICE} dice in total.`,
        `Au plus ${MAX_DICE} dés en tout.`,
        `Höchstens ${MAX_DICE} Würfel insgesamt.`,
      );
    const term: DiceTerm = { sign, count, sides, text };
    if (m[5] !== undefined) {
      const n = Number(m[5]);
      if (n < 1 || n > count)
        return err(
          `Keep between 1 and ${count} dice in ${text}.`,
          `Garde entre 1 et ${count} dés dans ${text}.`,
          `Behalte zwischen 1 und ${count} Würfel in ${text}.`,
        );
      term.keep = { which: m[4] === "l" ? "l" : "h", n };
    }
    terms.push(term);
  }
  if (!terms.some((t) => t.count > 0))
    return err(
      "Add at least one die, like d6.",
      "Ajoute au moins un dé, comme d6.",
      "Füg mindestens einen Würfel hinzu, z. B. d6.",
    );
  return ok(terms);
}

export interface TermRoll {
  term: DiceTerm;
  rolls: number[];
  /** Which rolls count (all, unless the term keeps some). */
  kept: boolean[];
  subtotal: number;
}

export interface DiceRoll {
  notation: string;
  terms: TermRoll[];
  total: number;
  min: number;
  max: number;
}

export function rollDice(rand: RandomInt, terms: DiceTerm[]): DiceRoll {
  let total = 0;
  let min = 0;
  let max = 0;
  const out: TermRoll[] = terms.map((term) => {
    if (term.count === 0) {
      const v = term.sign * term.sides;
      total += v;
      min += v;
      max += v;
      return { term, rolls: [], kept: [], subtotal: v };
    }
    const rolls = Array.from({ length: term.count }, () => rand(term.sides) + 1);
    let kept = rolls.map(() => true);
    if (term.keep) {
      const order = rolls
        .map((v, i) => ({ v, i }))
        .sort((a, b) => (term.keep?.which === "h" ? b.v - a.v : a.v - b.v) || a.i - b.i);
      const keepIdx = new Set(order.slice(0, term.keep.n).map((x) => x.i));
      kept = rolls.map((_, i) => keepIdx.has(i));
    }
    const n = term.keep ? term.keep.n : term.count;
    const sum = rolls.reduce((s, v, i) => s + (kept[i] ? v : 0), 0);
    const subtotal = term.sign * sum;
    total += subtotal;
    const lo = n;
    const hi = n * term.sides;
    min += term.sign > 0 ? lo : -hi;
    max += term.sign > 0 ? hi : -lo;
    return { term, rolls, kept, subtotal };
  });
  const notation = terms
    .map((t, i) => `${i === 0 ? (t.sign < 0 ? "-" : "") : t.sign < 0 ? " - " : " + "}${t.text}`)
    .join("");
  return { notation, terms: out, total, min, max };
}

/* --- Coins, lists ---------------------------------------------------------------- */

export function flipCoin(rand: RandomInt): "heads" | "tails" {
  return rand(2) === 0 ? "heads" : "tails";
}

/** A uniformly shuffled copy (Fisher–Yates). */
export function shuffle<T>(rand: RandomInt, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** The non-empty, trimmed lines of a list (one item per line). */
export function parseList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `n` different items, in draw order (a partial Fisher–Yates). */
export function pick<T>(rand: RandomInt, items: readonly T[], n: number): Result<T[]> {
  if (!items.length) return err("The list is empty.", "La liste est vide.", "Die Liste ist leer.");
  const k = Math.round(n);
  if (k < 1 || k > items.length)
    return err(
      `Pick between 1 and ${items.length}.`,
      `Choisis entre 1 et ${items.length} gagnants.`,
      `Wähl zwischen 1 und ${items.length} Gewinner.`,
    );
  const a = [...items];
  for (let i = 0; i < k; i++) {
    const j = i + rand(a.length - i);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return ok(a.slice(0, k));
}

/**
 * Teams of balanced sizes (they differ by one at most): the shuffled list dealt round-robin.
 * `by: "count"` makes `n` teams; `by: "size"` makes teams of about `n` people.
 */
export function makeTeams<T>(
  rand: RandomInt,
  items: readonly T[],
  n: number,
  by: "count" | "size" = "count",
): Result<T[][]> {
  if (items.length < 2)
    return err(
      "Add at least two names.",
      "Ajoute au moins deux noms.",
      "Füg mindestens zwei Namen hinzu.",
    );
  const k = Math.round(n);
  if (!(k >= 1))
    return err(
      "Choose a number of at least 1.",
      "Choisis un nombre d'au moins 1.",
      "Wähl eine Zahl von mindestens 1.",
    );
  const teams = by === "count" ? k : Math.max(1, Math.round(items.length / k));
  if (teams > items.length)
    return err(
      `There are not enough names for ${teams} teams.`,
      `Il n'y a pas assez de noms pour ${teams} équipes.`,
      `Es gibt nicht genug Namen für ${teams} Teams.`,
    );
  const out: T[][] = Array.from({ length: teams }, () => []);
  shuffle(rand, items).forEach((x, i) => {
    out[i % teams]?.push(x);
  });
  return ok(out);
}

/* --- Secret Santa ------------------------------------------------------------- */

export interface Pair {
  giver: string;
  receiver: string;
}

/**
 * Exclusions, one pair per line: "Alice, Bob" (or ; / - / & between) means neither gives to
 * the other; "Alice > Bob" only stops Alice giving to Bob.
 */
export function parseExclusions(text: string): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (const line of parseList(text)) {
    const one = line.split(/\s*(?:->|→|>)\s*/);
    if (one.length === 2 && one[0] && one[1]) {
      out.push({ from: one[0], to: one[1] });
      continue;
    }
    const both = line.split(/\s*[,;&/]\s*|\s+-\s+|\s+(?:et|and|und)\s+/i).filter(Boolean);
    if (both.length === 2) {
      out.push({ from: both[0] as string, to: both[1] as string });
      out.push({ from: both[1] as string, to: both[0] as string });
    }
  }
  return out;
}

/**
 * A Secret Santa draw: everyone gives exactly one gift and receives one, never to themselves
 * or to an excluded person. Draws uniformly among the valid assignments (rejection sampling),
 * with a randomized search as a fallback when rules are very tight.
 */
export function secretSanta(
  rand: RandomInt,
  names: readonly string[],
  exclusions: { from: string; to: string }[] = [],
): Result<Pair[]> {
  if (names.length < 2)
    return err(
      "Add at least two people.",
      "Ajoute au moins deux personnes.",
      "Füg mindestens zwei Personen hinzu.",
    );
  const fold = (s: string) => s.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  for (const n of names) {
    const k = fold(n);
    if (seen.has(k))
      return err(
        `"${n}" is listed twice.`,
        `« ${n} » apparaît deux fois.`,
        `„${n}“ steht doppelt in der Liste.`,
      );
    seen.add(k);
  }
  const index = new Map(names.map((n, i) => [fold(n), i]));
  const banned = names.map((_, i) => new Set<number>([i]));
  for (const e of exclusions) {
    const a = index.get(fold(e.from));
    const b = index.get(fold(e.to));
    if (a !== undefined && b !== undefined) banned[a]?.add(b);
  }
  const n = names.length;
  const valid = (perm: number[]) => perm.every((r, g) => !banned[g]?.has(r));
  const base = names.map((_, i) => i);
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const perm = shuffle(rand, base);
    if (valid(perm))
      return ok(perm.map((r, g) => ({ giver: names[g] as string, receiver: names[r] as string })));
  }
  // Tight constraints: randomized backtracking (valid, though not exactly uniform).
  const order = shuffle(rand, base);
  const used = new Array<boolean>(n).fill(false);
  const result = new Array<number>(n).fill(-1);
  const solve = (k: number): boolean => {
    if (k === n) return true;
    const g = order[k] as number;
    for (const r of shuffle(rand, base)) {
      if (used[r] || banned[g]?.has(r)) continue;
      used[r] = true;
      result[g] = r;
      if (solve(k + 1)) return true;
      used[r] = false;
    }
    return false;
  };
  if (!solve(0))
    return err(
      "No draw is possible with these exclusions.",
      "Aucun tirage n'est possible avec ces exclusions.",
      "Mit diesen Ausschlüssen ist keine Auslosung möglich.",
    );
  return ok(result.map((r, g) => ({ giver: names[g] as string, receiver: names[r] as string })));
}
