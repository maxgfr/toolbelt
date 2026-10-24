import { describe, expect, it } from "bun:test";
import { doublingYears, monthlyRate, type SavingsInput, savings } from "./logic";

const base: SavingsInput = {
  initial: 10000,
  monthly: 0,
  rate: 5,
  years: 10,
  compounding: "yearly",
  startOfMonth: false,
  inflation: 0,
};

describe("savings", () => {
  it("compounds a lump sum yearly", () => {
    // 10 000 × 1.05^10 = 16 288.95
    const r = savings(base);
    expect(r?.final).toBeCloseTo(16288.95, 2);
    expect(r?.interest).toBeCloseTo(6288.95, 2);
    expect(r?.points).toHaveLength(11);
    expect(r?.points[1]?.balance).toBeCloseTo(10500, 6);
  });

  it("compounds monthly contributions (annuity formula)", () => {
    // 100 a month at 6 % compounded monthly for 10 years: 100 × ((1.005^120 − 1) ÷ 0.005) = 16 387.93
    const r = savings({ ...base, initial: 0, monthly: 100, rate: 6, compounding: "monthly" });
    expect(r?.final).toBeCloseTo(16387.93, 2);
    expect(r?.contributed).toBe(12000);
    // Paid at the start of each month: one more month of interest each time (× 1.005).
    const s = savings({
      ...base,
      initial: 0,
      monthly: 100,
      rate: 6,
      compounding: "monthly",
      startOfMonth: true,
    });
    expect(s?.final).toBeCloseTo(16387.93 * 1.005, 1);
  });

  it("uses the equivalent monthly rate", () => {
    expect(monthlyRate(12, "monthly")).toBeCloseTo(0.01, 12);
    expect((1 + monthlyRate(5, "yearly")) ** 12).toBeCloseTo(1.05, 12);
    // Daily compounding of 5 %: effective yearly 5.1267 %.
    expect((1 + monthlyRate(5, "daily")) ** 12 - 1).toBeCloseTo(0.051267, 6);
  });

  it("discounts for inflation", () => {
    const r = savings({ ...base, inflation: 2 });
    expect(r?.real).toBeCloseTo(16288.95 / 1.02 ** 10, 2);
  });

  it("handles partial years, zero rates and bad input", () => {
    const r = savings({ ...base, initial: 0, monthly: 50, rate: 0, years: 1.5 });
    expect(r?.final).toBe(900);
    expect(r?.points.map((p) => p.year)).toEqual([0, 1, 1.5]);
    expect(savings({ ...base, years: 0 })?.final).toBe(10000);
    expect(savings({ ...base, years: -1 })).toBeNull();
    expect(savings({ ...base, initial: Number.NaN })).toBeNull();
  });

  it("gives the doubling time", () => {
    expect(doublingYears(7)).toBeCloseTo(10.245, 3);
    expect(doublingYears(0)).toBeNull();
  });
});
