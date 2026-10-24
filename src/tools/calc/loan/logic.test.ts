import { describe, expect, it } from "bun:test";
import { borrowingCapacity, loan, monthlyPayment } from "./logic";

describe("loan", () => {
  it("computes the classic mortgage payment", () => {
    // 200 000 at 3.5 % over 20 years: 1 159.92 a month (bank tables).
    expect(monthlyPayment(200000, 3.5, 240)).toBeCloseTo(1159.92, 2);
    // 10 000 at 5 % over 3 years: 299.71.
    expect(monthlyPayment(10000, 5, 36)).toBeCloseTo(299.71, 2);
    expect(monthlyPayment(12000, 0, 24)).toBe(500);
  });

  it("totals interest, insurance and fees", () => {
    const r = loan({ principal: 200000, rate: 3.5, months: 240, insuranceRate: 0.3, fees: 1500 });
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.totalInterest).toBeCloseTo(78380.66, 1);
    expect(r.insurance).toBeCloseTo(50, 10); // 200 000 × 0.3 % ÷ 12
    expect(r.totalInsurance).toBeCloseTo(12000, 8);
    expect(r.total).toBeCloseTo(1209.92, 2);
    expect(r.totalCost).toBeCloseTo(78380.66 + 12000 + 1500, 1);
    expect(r.totalPaid).toBeCloseTo(200000 + r.totalCost, 6);
  });

  it("builds an amortization schedule that ends at zero", () => {
    const r = loan({ principal: 200000, rate: 3.5, months: 240, insuranceRate: 0, fees: 0 });
    if (!r) throw new Error("no result");
    expect(r.schedule).toHaveLength(240);
    expect(r.schedule[0]?.interest).toBeCloseTo(583.33, 2); // 200 000 × 3.5 % ÷ 12
    expect(r.schedule[0]?.principal).toBeCloseTo(576.59, 2);
    expect(r.schedule[239]?.balance).toBe(0);
    expect(r.years).toHaveLength(20);
    expect(r.years[0]?.months).toHaveLength(12);
    const repaid = r.years.reduce((s, y) => s + y.principal, 0);
    expect(repaid).toBeCloseTo(200000, 6);
  });

  it("groups a partial last year", () => {
    const r = loan({ principal: 1000, rate: 6, months: 18, insuranceRate: 0, fees: 0 });
    expect(r?.years.map((y) => y.months.length)).toEqual([12, 6]);
  });

  it("rejects impossible durations", () => {
    expect(loan({ principal: 1000, rate: 3, months: 0, insuranceRate: 0, fees: 0 })).toBeNull();
    expect(
      loan({ principal: Number.NaN, rate: 3, months: 12, insuranceRate: 0, fees: 0 }),
    ).toBeNull();
  });
});

describe("borrowing capacity", () => {
  it("is the inverse of the payment", () => {
    const p = borrowingCapacity(1159.919436, 3.5, 240);
    expect(p).toBeCloseTo(200000, 0);
  });

  it("accounts for insurance", () => {
    // 1 500 a month, 4 %, 25 years, insurance 0.3 %: about 271 328.
    expect(borrowingCapacity(1500, 4, 300, 0.3)).toBeCloseTo(271327.79, 1);
    expect(borrowingCapacity(1200, 0, 120)).toBe(144000);
    expect(borrowingCapacity(1000, 3, 0)).toBeNull();
  });
});
