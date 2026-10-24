import { describe, expect, it } from "bun:test";
import { fromKwh100, fromL100, measured, pricePerBase, toKwh100, toL100, trip } from "./logic";

describe("consumption units", () => {
  it("converts L/100 km to mpg and km/L", () => {
    // 6 L/100 km ≈ 39.2 mpg (US) ≈ 47.1 mpg (UK) ≈ 16.67 km/L
    expect(fromL100(6, "mpgUS")).toBeCloseTo(39.2, 1);
    expect(fromL100(6, "mpgUK")).toBeCloseTo(47.08, 2);
    expect(fromL100(6, "kmL")).toBeCloseTo(16.667, 3);
    // 30 mpg US ≈ 7.84 L/100 km
    expect(toL100(30, "mpgUS")).toBeCloseTo(7.84, 2);
    expect(toL100(0, "mpgUS")).toBeNull();
  });

  it("converts EV units", () => {
    expect(toKwh100(150, "whkm")).toBe(15);
    // 4 mi/kWh = 6.437 km/kWh → 15.53 kWh/100 km
    expect(toKwh100(4, "miKwh")).toBeCloseTo(15.534, 3);
    expect(fromKwh100(15.534, "miKwh")).toBeCloseTo(4, 3);
    expect(fromKwh100(15, "kwh100mi")).toBeCloseTo(24.14, 2);
    expect(toKwh100(24.14016, "kwh100mi")).toBeCloseTo(15, 4);
  });

  it("converts gallon prices to per litre", () => {
    expect(pricePerBase(3.785411784, "galUS")).toBeCloseTo(1, 10);
    expect(pricePerBase(1.8, "L")).toBe(1.8);
  });
});

describe("trip cost", () => {
  it("computes fuel, cost and share", () => {
    // 450 km at 6.5 L/100 km and 1.85 /L, 3 people: 29.25 L, 54.11, 18.04 each.
    const r = trip({ distance: 450, per100: 6.5, price: 1.85, people: 3, roundTrip: false });
    expect(r?.energy).toBeCloseTo(29.25, 10);
    expect(r?.cost).toBeCloseTo(54.1125, 10);
    expect(r?.perPerson).toBeCloseTo(18.0375, 10);
    expect(r?.perKm).toBeCloseTo(0.12025, 10);
  });

  it("doubles a round trip", () => {
    const r = trip({ distance: 100, per100: 17, price: 0.25, people: 1, roundTrip: true });
    expect(r?.km).toBe(200);
    expect(r?.energy).toBe(34);
    expect(r?.cost).toBe(8.5);
  });

  it("refuses bad input", () => {
    expect(trip({ distance: 100, per100: 0, price: 1, people: 1, roundTrip: false })).toBeNull();
    expect(trip({ distance: 100, per100: 5, price: 1, people: 0, roundTrip: false })).toBeNull();
  });

  it("measures consumption from a refill", () => {
    expect(measured(42, 700)).toBe(6);
    expect(measured(42, 0)).toBeNull();
  });
});
