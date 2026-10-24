/**
 * French gross ↔ net salary estimate with flat, average contribution rates (the real payslip
 * depends on the salary level, the company, the collective agreement, the mutual insurance…),
 * plus a generic hourly ↔ monthly ↔ yearly converter for any country.
 */

export type Status = "nonCadre" | "cadre" | "public" | "portage";

export interface Rates {
  /** Employee contributions, % of gross. */
  employee: number;
  /** Employer contributions, % of gross (null when not meaningful, e.g. civil servants). */
  employer: number | null;
  /** Umbrella company (portage) management fee, % of revenue. */
  fee: number;
}

/** Average rates commonly used for estimates (2025–2026). */
export const PRESETS: Record<Status, Rates> = {
  nonCadre: { employee: 22, employer: 42, fee: 0 },
  cadre: { employee: 25, employer: 45, fee: 0 },
  public: { employee: 15, employer: null, fee: 0 },
  portage: { employee: 22, employer: 45, fee: 8 },
};

/** Legal full time: 35 h a week → 35 × 52 / 12 ≈ 151.67 h a month. */
export const FULL_TIME_MONTHLY_HOURS = (35 * 52) / 12;

/**
 * Taxable net ≈ net + the non-deductible CSG (2.4 %) and CRDS (0.5 %), both on 98.25 % of gross.
 * Income tax withheld at source applies to this taxable net, not to the net paid.
 */
export const NON_DEDUCTIBLE = 0.029 * 0.9825;

export type Period = "hour" | "month" | "year";

export interface SalaryInput {
  amount: number;
  period: Period;
  /** Is `amount` the gross or the net? */
  kind: "gross" | "net";
  rates: Rates;
  /** Part-time share, 100 = full time. */
  partTime: number;
  /** 12, or 13 with a 13th month. */
  monthsPerYear: number;
  /** Withholding tax rate (prélèvement à la source), %. */
  taxRate: number;
}

export interface Amounts {
  hour: number;
  month: number;
  year: number;
}

export interface SalaryResult {
  hours: number;
  gross: Amounts;
  net: Amounts;
  taxableNet: Amounts;
  afterTax: Amounts;
  /** Employer cost (gross + employer contributions); null when unknown. */
  employerCost: Amounts | null;
  /** Revenue an umbrella company needs to bill (portage); null without a fee. */
  revenue: Amounts | null;
}

function per(monthly: number, hours: number, months: number): Amounts {
  return { hour: hours > 0 ? monthly / hours : Number.NaN, month: monthly, year: monthly * months };
}

export function salary(i: SalaryInput): SalaryResult | null {
  const hours = (FULL_TIME_MONTHLY_HOURS * i.partTime) / 100;
  const keep = 1 - i.rates.employee / 100;
  if (!(hours > 0) || !(i.monthsPerYear > 0) || keep <= 0) return null;
  const monthly =
    i.period === "month"
      ? i.amount
      : i.period === "year"
        ? i.amount / i.monthsPerYear
        : i.amount * hours;
  const gross = i.kind === "gross" ? monthly : monthly / keep;
  const net = gross * keep;
  const taxable = net + gross * NON_DEDUCTIBLE;
  const after = net - (taxable * i.taxRate) / 100;
  const cost = i.rates.employer === null ? null : gross * (1 + i.rates.employer / 100);
  const revenue = cost !== null && i.rates.fee > 0 ? cost / (1 - i.rates.fee / 100) : null;
  const m = i.monthsPerYear;
  return {
    hours,
    gross: per(gross, hours, m),
    net: per(net, hours, m),
    taxableNet: per(taxable, hours, m),
    afterTax: per(after, hours, m),
    employerCost: cost === null ? null : per(cost, hours, m),
    revenue: revenue === null ? null : per(revenue, hours, m),
  };
}

/* --- Any country: pay per hour / day / week / month / year ------------------------------- */

export type PayPeriod = "hour" | "day" | "week" | "month" | "year";

export interface Schedule {
  hoursPerWeek: number;
  daysPerWeek: number;
  /** Paid weeks per year (52 when holidays are paid). */
  weeksPerYear: number;
}

export type PayTable = Record<PayPeriod, number>;

export function convertPay(amount: number, from: PayPeriod, s: Schedule): PayTable | null {
  if (!(s.hoursPerWeek > 0 && s.daysPerWeek > 0 && s.weeksPerYear > 0)) return null;
  const perYear: Record<PayPeriod, number> = {
    hour: s.hoursPerWeek * s.weeksPerYear,
    day: s.daysPerWeek * s.weeksPerYear,
    week: s.weeksPerYear,
    month: 12,
    year: 1,
  };
  const year = amount * perYear[from];
  return {
    hour: year / perYear.hour,
    day: year / perYear.day,
    week: year / perYear.week,
    month: year / 12,
    year,
  };
}
