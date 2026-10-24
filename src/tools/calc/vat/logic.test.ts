import { describe, expect, it } from "bun:test";
import { COUNTRIES, findCountry, fromGross, fromNet, fromVat, rateFrom, totals } from "./logic";

describe("VAT", () => {
  it("adds VAT to a price before tax", () => {
    expect(fromNet(100, 20)).toEqual({ net: 100, vat: 20, gross: 120 });
    const r = fromNet(49.9, 5.5);
    expect(r.vat).toBeCloseTo(2.7445, 10);
    expect(r.gross).toBeCloseTo(52.6445, 10);
  });

  it("takes VAT out of a price with tax (not a simple − 20 %)", () => {
    const r = fromGross(120, 20);
    expect(r?.net).toBeCloseTo(100, 10);
    expect(r?.vat).toBeCloseTo(20, 10);
    expect(fromGross(110, 10)?.net).toBeCloseTo(100, 10);
    expect(fromGross(100, -100)).toBeNull();
  });

  it("goes back from the tax amount", () => {
    expect(fromVat(20, 20)).toEqual({ net: 100, vat: 20, gross: 120 });
    expect(fromVat(5, 0)).toBeNull();
  });

  it("finds the rate from both prices", () => {
    expect(rateFrom(100, 120)).toBeCloseTo(20, 10);
    expect(rateFrom(100, 105.5)).toBeCloseTo(5.5, 10);
    expect(rateFrom(0, 10)).toBeNull();
  });

  it("totals invoice lines per rate, rounding each line to the cent", () => {
    const t = totals(
      [
        { qty: 3, price: 9.99, rate: 20 },
        { qty: 1, price: 100, rate: 10 },
        { qty: 2, price: 1.25, rate: 20 },
      ],
      false,
    );
    // 29.97 → VAT 5.994 → 5.99; 2.50 → 0.50; 100 → 10.
    expect(t.lines[0]).toEqual({ rate: 20, net: 29.97, vat: 5.99, gross: 35.96 });
    expect(t.byRate).toEqual([
      { rate: 20, net: 32.47, vat: 6.49, gross: 38.96 },
      { rate: 10, net: 100, vat: 10, gross: 110 },
    ]);
    expect(t).toMatchObject({ net: 132.47, vat: 16.49, gross: 148.96 });
  });

  it("totals lines priced with tax", () => {
    const t = totals([{ qty: 1, price: 12, rate: 20 }], true);
    expect(t).toMatchObject({ net: 10, vat: 2, gross: 12 });
    expect(totals([], true)).toMatchObject({ net: 0, vat: 0, gross: 0, byRate: [] });
  });

  it("knows the countries", () => {
    expect(findCountry("fr").rates.map((r) => r.rate)).toEqual([20, 10, 5.5, 2.1]);
    expect(findCountry("nope").id).toBe("fr");
    expect(new Set(COUNTRIES.map((c) => c.id)).size).toBe(COUNTRIES.length);
  });

  it("has the German-speaking countries' rates, in three languages", () => {
    expect(findCountry("de").rates.map((r) => r.rate)).toEqual([19, 7]);
    expect(findCountry("at").rates.map((r) => r.rate)).toEqual([20, 13, 10, 4.9]);
    expect(findCountry("ch").rates.map((r) => r.rate)).toEqual([8.1, 3.8, 2.6]);
    for (const c of COUNTRIES) {
      expect(c.name.de).toBeTruthy();
      for (const r of c.rates) expect(r.de).toBeTruthy();
    }
  });
});
