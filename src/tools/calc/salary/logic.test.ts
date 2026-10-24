import { describe, expect, it } from "bun:test";
import { convertPay, FULL_TIME_MONTHLY_HOURS, PRESETS, type SalaryInput, salary } from "./logic";

const base: SalaryInput = {
  amount: 2500,
  period: "month",
  kind: "gross",
  rates: PRESETS.nonCadre,
  partTime: 100,
  monthsPerYear: 12,
  taxRate: 0,
};

describe("French salary estimate", () => {
  it("uses 151.67 hours a month for 35 h a week", () => {
    expect(FULL_TIME_MONTHLY_HOURS).toBeCloseTo(151.6667, 4);
  });

  it("goes from gross to net (non-cadre, 22 %)", () => {
    const r = salary(base);
    expect(r?.net.month).toBeCloseTo(1950, 8);
    expect(r?.gross.year).toBe(30000);
    expect(r?.net.year).toBeCloseTo(23400, 8);
    expect(r?.gross.hour).toBeCloseTo(16.4835, 4);
    expect(r?.employerCost?.month).toBeCloseTo(3550, 8);
    expect(r?.revenue).toBeNull();
  });

  it("goes from net back to gross", () => {
    const r = salary({ ...base, amount: 1950, kind: "net" });
    expect(r?.gross.month).toBeCloseTo(2500, 8);
    const c = salary({ ...base, amount: 3000, kind: "net", rates: PRESETS.cadre });
    expect(c?.gross.month).toBeCloseTo(4000, 8);
  });

  it("reads hourly and yearly amounts", () => {
    const h = salary({ ...base, amount: 12, period: "hour" });
    expect(h?.gross.month).toBeCloseTo(1820, 8); // 12 × 151.67
    const y = salary({ ...base, amount: 39000, period: "year", monthsPerYear: 13 });
    expect(y?.gross.month).toBe(3000);
  });

  it("handles part time", () => {
    const r = salary({ ...base, amount: 15, period: "hour", partTime: 80 });
    expect(r?.hours).toBeCloseTo(121.3333, 4);
    expect(r?.gross.month).toBeCloseTo(1820, 8);
  });

  it("estimates the net after withholding tax on the taxable net", () => {
    const r = salary({ ...base, taxRate: 5 });
    // Taxable net = 1950 + 2500 × 2.9 % × 98.25 % = 2021.23; tax = 101.06.
    expect(r?.taxableNet.month).toBeCloseTo(2021.231, 3);
    expect(r?.afterTax.month).toBeCloseTo(1848.938, 3);
  });

  it("knows civil servants and umbrella companies", () => {
    expect(salary({ ...base, rates: PRESETS.public })?.net.month).toBeCloseTo(2125, 8);
    expect(salary({ ...base, rates: PRESETS.public })?.employerCost).toBeNull();
    const p = salary({ ...base, rates: PRESETS.portage });
    // 2500 × 1.45 / 0.92: net is about half the revenue.
    expect(p?.revenue?.month).toBeCloseTo(3940.217, 3);
    expect((p?.net.month ?? 0) / (p?.revenue?.month ?? 1)).toBeCloseTo(0.495, 3);
  });

  it("refuses impossible inputs", () => {
    expect(salary({ ...base, partTime: 0 })).toBeNull();
    expect(salary({ ...base, rates: { employee: 100, employer: 0, fee: 0 } })).toBeNull();
  });
});

describe("pay period converter", () => {
  const s = { hoursPerWeek: 40, daysPerWeek: 5, weeksPerYear: 52 };

  it("converts an hourly rate", () => {
    const r = convertPay(20, "hour", s);
    expect(r?.year).toBe(41600);
    expect(r?.month).toBeCloseTo(3466.667, 3);
    expect(r?.week).toBe(800);
    expect(r?.day).toBe(160);
  });

  it("converts a yearly salary", () => {
    const r = convertPay(52000, "year", { ...s, hoursPerWeek: 35 });
    expect(r?.hour).toBeCloseTo(28.5714, 4);
    expect(r?.month).toBeCloseTo(4333.333, 3);
  });

  it("refuses a zero schedule", () => {
    expect(convertPay(10, "hour", { ...s, hoursPerWeek: 0 })).toBeNull();
  });
});
