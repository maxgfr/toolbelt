import { describe, expect, it } from "bun:test";
import { applyDiscounts, comparePrices, discountPercent, keptFactor, originalPrice } from "./logic";

describe("discounts", () => {
  it("applies one discount", () => {
    const r = applyDiscounts(80, [25]);
    expect(r.final).toBe(60);
    expect(r.saved).toBe(20);
    expect(r.equivalent).toBe(25);
  });

  it("stacks discounts multiplicatively (30 % + 10 % = 37 %, not 40 %)", () => {
    const r = applyDiscounts(100, [30, 10]);
    expect(r.final).toBeCloseTo(63, 10);
    expect(r.equivalent).toBeCloseTo(37, 10);
    expect(r.steps[0]).toBeCloseTo(70, 10);
    expect(keptFactor([])).toBe(1);
    expect(applyDiscounts(50, []).final).toBe(50);
  });

  it("finds the original price", () => {
    expect(originalPrice(63, [30, 10])).toBeCloseTo(100, 10);
    expect(originalPrice(45, [25])).toBeCloseTo(60, 10);
    expect(originalPrice(10, [100])).toBeNull();
  });

  it("finds the % off", () => {
    expect(discountPercent(80, 60)).toBe(25);
    expect(discountPercent(0, 10)).toBeNull();
  });
});

describe("price per unit", () => {
  it("highlights the cheapest per kg", () => {
    const { results, dim } = comparePrices([
      { price: 2.5, packs: 1, quantity: 500, unit: "g" }, // 5 / kg
      { price: 4.2, packs: 1, quantity: 1, unit: "kg" }, // 4.2 / kg
      { price: 1.5, packs: 2, quantity: 150, unit: "g" }, // 5 / kg
    ]);
    expect(dim).toBe("mass");
    expect(results[0]?.perBase).toBeCloseTo(5, 10);
    expect(results[1]).toMatchObject({ perBase: 4.2, best: true, overBest: 0 });
    expect(results[2]?.overBest).toBeCloseTo(19.048, 3);
  });

  it("compares packs of cans with bottles", () => {
    const { results } = comparePrices([
      { price: 4.8, packs: 6, quantity: 33, unit: "cl" }, // 1.98 L → 2.4242 / L
      { price: 3.2, packs: 1, quantity: 1.5, unit: "L" }, // 2.1333 / L
    ]);
    expect(results[0]?.perBase).toBeCloseTo(2.4242, 4);
    expect(results[1]?.best).toBe(true);
  });

  it("leaves out products in another dimension or without quantity", () => {
    const { results } = comparePrices([
      { price: 3, packs: 1, quantity: 1, unit: "kg" },
      { price: 2, packs: 1, quantity: 1, unit: "kg" },
      { price: 1, packs: 1, quantity: 1, unit: "L" },
      { price: 1, packs: 1, quantity: 0, unit: "kg" },
    ]);
    expect(results.map((r) => r.best)).toEqual([false, true, false, false]);
    expect(results[2]?.overBest).toBeNull();
    expect(results[3]?.perBase).toBeNull();
  });

  it("has no best deal with a single product", () => {
    expect(
      comparePrices([{ price: 1, packs: 1, quantity: 1, unit: "item" }]).results[0]?.best,
    ).toBe(false);
    expect(comparePrices([]).dim).toBeNull();
  });
});
