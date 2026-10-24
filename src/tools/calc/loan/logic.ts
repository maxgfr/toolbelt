/**
 * Fixed-rate loan with constant monthly payments (mortgage, car loan…): payment, interest,
 * insurance on the initial capital (the French way), fees, the amortization schedule, and the
 * reverse question: how much can I borrow for a given monthly payment.
 */

export interface LoanInput {
  principal: number;
  /** Nominal annual rate, %. */
  rate: number;
  months: number;
  /** Annual insurance rate on the initial capital, %. */
  insuranceRate: number;
  /** One-off fees (application, guarantee, broker…). */
  fees: number;
}

export interface Row {
  /** 1-based month number. */
  month: number;
  payment: number;
  interest: number;
  principal: number;
  insurance: number;
  balance: number;
}

export interface YearRow {
  year: number;
  payment: number;
  interest: number;
  principal: number;
  insurance: number;
  balance: number;
  months: Row[];
}

export interface LoanResult {
  /** Monthly payment without insurance. */
  payment: number;
  insurance: number;
  /** Monthly payment with insurance. */
  total: number;
  totalInterest: number;
  totalInsurance: number;
  /** Interest + insurance + fees. */
  totalCost: number;
  /** Everything paid back: principal + total cost. */
  totalPaid: number;
  schedule: Row[];
  years: YearRow[];
}

/** The payment factor: payment = principal × factor (r = monthly rate). */
export function annuityFactor(monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return 1 / months;
  return monthlyRate / (1 - (1 + monthlyRate) ** -months);
}

export function monthlyPayment(principal: number, annualRate: number, months: number): number {
  return principal * annuityFactor(annualRate / 1200, months);
}

export function loan(i: LoanInput): LoanResult | null {
  const n = Math.round(i.months);
  if (!(n >= 1 && n <= 1200) || !(i.principal >= 0) || !(i.rate > -100) || !(i.insuranceRate >= 0))
    return null;
  const r = i.rate / 1200;
  const payment = i.principal * annuityFactor(r, n);
  const insurance = (i.principal * i.insuranceRate) / 1200;
  const schedule: Row[] = [];
  let balance = i.principal;
  for (let m = 1; m <= n; m++) {
    const interest = balance * r;
    // The last payment clears what's left (no −0.00 balance from rounding drift).
    const princ = m === n ? balance : payment - interest;
    balance = m === n ? 0 : balance - princ;
    schedule.push({
      month: m,
      payment: princ + interest,
      interest,
      principal: princ,
      insurance,
      balance,
    });
  }
  const years: YearRow[] = [];
  for (let k = 0; k < schedule.length; k += 12) {
    const months = schedule.slice(k, k + 12);
    const sum = (f: (x: Row) => number) => months.reduce((s, x) => s + f(x), 0);
    years.push({
      year: k / 12 + 1,
      payment: sum((x) => x.payment),
      interest: sum((x) => x.interest),
      principal: sum((x) => x.principal),
      insurance: sum((x) => x.insurance),
      balance: months[months.length - 1]?.balance ?? 0,
      months,
    });
  }
  const totalInterest = schedule.reduce((s, x) => s + x.interest, 0);
  const totalInsurance = insurance * n;
  const totalCost = totalInterest + totalInsurance + i.fees;
  return {
    payment,
    insurance,
    total: payment + insurance,
    totalInterest,
    totalInsurance,
    totalCost,
    totalPaid: i.principal + totalCost,
    schedule,
    years,
  };
}

/**
 * How much can be borrowed when the monthly budget (insurance included) is `budget`:
 * budget = P × (factor + insurance / 12) → P = budget ÷ (factor + insurance / 12).
 */
export function borrowingCapacity(
  budget: number,
  annualRate: number,
  months: number,
  insuranceRate = 0,
): number | null {
  const n = Math.round(months);
  if (!(n >= 1) || !(budget >= 0)) return null;
  const k = annuityFactor(annualRate / 1200, n) + insuranceRate / 1200;
  return k > 0 ? budget / k : null;
}

/** French banks' usual cap (HCSF): payments ≤ 35 % of net income, insurance included. */
export const MAX_DEBT_RATIO = 35;
