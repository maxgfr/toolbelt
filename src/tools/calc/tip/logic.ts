/** Tip and bill splitting: even split with optional rounding up, or each person pays for what they had. */

export interface EvenInput {
  bill: number;
  /** Tip, % of the bill. */
  tipPct: number;
  people: number;
  /** Round each share up to a multiple of this (0 = no rounding). */
  roundTo: number;
}

export interface EvenResult {
  tip: number;
  total: number;
  perPerson: number;
  /** After rounding up (equals perPerson without rounding). */
  rounded: number;
  roundedTotal: number;
  /** The tip actually left once rounded, and its % of the bill. */
  actualTip: number;
  actualTipPct: number;
}

/** Rounds up to a multiple of `step`, ignoring float noise (12.000000001 stays 12). */
export function ceilTo(n: number, step: number): number {
  if (!(step > 0)) return n;
  return Math.ceil(n / step - 1e-9) * step;
}

export function splitEven(i: EvenInput): EvenResult | null {
  const people = Math.round(i.people);
  if (!(i.bill >= 0) || !(people >= 1) || !(i.tipPct >= 0)) return null;
  const tip = (i.bill * i.tipPct) / 100;
  const total = i.bill + tip;
  const perPerson = total / people;
  const rounded = ceilTo(perPerson, i.roundTo);
  const roundedTotal = rounded * people;
  const actualTip = roundedTotal - i.bill;
  return {
    tip,
    total,
    perPerson,
    rounded,
    roundedTotal,
    actualTip,
    actualTipPct: i.bill > 0 ? (actualTip / i.bill) * 100 : 0,
  };
}

export interface Person {
  name: string;
  /** What this person ordered (their own items). */
  own: number;
}

export interface ShareResult {
  name: string;
  own: number;
  /** Their part of what nobody claimed (shared dishes, bread…), split equally. */
  shared: number;
  tip: number;
  total: number;
}

export interface UnevenResult {
  shares: ShareResult[];
  /** The bill minus everything claimed; negative when people claimed more than the bill. */
  unclaimed: number;
  tip: number;
  total: number;
}

/**
 * Each person pays their own items, the unclaimed rest of the bill is split equally, and the
 * tip is shared in proportion to what each one pays.
 */
export function splitUneven(bill: number, tipPct: number, people: Person[]): UnevenResult | null {
  if (!(bill >= 0) || !(tipPct >= 0) || people.length === 0) return null;
  if (people.some((p) => !(p.own >= 0))) return null;
  const claimed = people.reduce((s, p) => s + p.own, 0);
  const unclaimed = bill - claimed;
  const sharedEach = Math.max(0, unclaimed) / people.length;
  const base = claimed + Math.max(0, unclaimed);
  const tip = (bill * tipPct) / 100;
  const shares = people.map((p) => {
    const sub = p.own + sharedEach;
    const t = base > 0 ? (tip * sub) / base : tip / people.length;
    return { name: p.name, own: p.own, shared: sharedEach, tip: t, total: sub + t };
  });
  return { shares, unclaimed, tip, total: shares.reduce((s, x) => s + x.total, 0) };
}
