/**
 * Compound interest with a monthly contribution, simulated month by month. With a compounding
 * frequency other than monthly, the equivalent monthly rate is used: (1 + r/m)^(m/12) − 1.
 */

export type Compounding = "yearly" | "quarterly" | "monthly" | "daily";

export const PERIODS_PER_YEAR: Record<Compounding, number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  daily: 365,
};

export interface SavingsInput {
  initial: number;
  monthly: number;
  /** Nominal annual rate, %. */
  rate: number;
  years: number;
  compounding: Compounding;
  /** Contributions at the start of each month (true) or at the end (false). */
  startOfMonth: boolean;
  /** Yearly inflation, %, to express the result in today's money. */
  inflation: number;
}

export interface YearPoint {
  year: number;
  /** Total put in so far (initial + contributions). */
  contributed: number;
  interest: number;
  balance: number;
  /** Balance in today's money. */
  real: number;
}

export interface SavingsResult {
  final: number;
  contributed: number;
  interest: number;
  real: number;
  /** Year 0 (the start) then one point per year. */
  points: YearPoint[];
}

/** The equivalent monthly rate of a nominal annual rate compounded m times a year. */
export function monthlyRate(annualRate: number, c: Compounding): number {
  const m = PERIODS_PER_YEAR[c];
  return (1 + annualRate / 100 / m) ** (m / 12) - 1;
}

export function savings(i: SavingsInput): SavingsResult | null {
  const months = Math.round(i.years * 12);
  if (!(months >= 0 && months <= 1200) || !(i.rate > -100) || !(i.inflation > -100)) return null;
  if (!Number.isFinite(i.initial) || !Number.isFinite(i.monthly)) return null;
  const r = monthlyRate(i.rate, i.compounding);
  let balance = i.initial;
  let contributed = i.initial;
  const point = (k: number): YearPoint => ({
    year: k / 12,
    contributed,
    interest: balance - contributed,
    balance,
    real: balance / (1 + i.inflation / 100) ** (k / 12),
  });
  const points: YearPoint[] = [point(0)];
  for (let k = 1; k <= months; k++) {
    if (i.startOfMonth) balance += i.monthly;
    balance *= 1 + r;
    if (!i.startOfMonth) balance += i.monthly;
    contributed += i.monthly;
    if (k % 12 === 0 || k === months) points.push(point(k));
  }
  const last = points[points.length - 1] as YearPoint;
  return {
    final: last.balance,
    contributed: last.contributed,
    interest: last.interest,
    real: last.real,
    points,
  };
}

/** Years to double at a yearly rate (exact, not the rule of 72); null if it never doubles. */
export function doublingYears(rate: number): number | null {
  return rate > 0 ? Math.log(2) / Math.log(1 + rate / 100) : null;
}
