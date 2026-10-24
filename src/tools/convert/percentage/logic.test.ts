import { describe, expect, it } from "bun:test";
import {
  addPercent,
  clean,
  percentChange,
  percentDifference,
  percentOf,
  reversePercent,
  whatPercent,
} from "./logic";

describe("percentages", () => {
  it("X % of Y", () => {
    expect(percentOf(15, 200)).toBe(30);
    expect(clean(percentOf(7, 0.3))).toBe(0.021);
    expect(percentOf(-10, 50)).toBe(-5);
  });

  it("X is what % of Y", () => {
    expect(whatPercent(30, 200)).toBe(15);
    expect(whatPercent(1, 3)).toBeCloseTo(33.333333, 5);
    expect(whatPercent(5, 0)).toBeNull();
  });

  it("% change", () => {
    expect(percentChange(80, 100)).toBe(25);
    expect(percentChange(100, 80)).toBe(-20);
    expect(percentChange(-50, -25)).toBe(50);
    expect(percentChange(0, 10)).toBeNull();
  });

  it("adds and subtracts a percentage", () => {
    expect(clean(addPercent(100, 20))).toBe(120);
    expect(clean(addPercent(100, -20))).toBe(80);
    expect(clean(addPercent(19.99, 20))).toBe(23.988);
  });

  it("finds the original value", () => {
    expect(clean(reversePercent(120, 20) ?? Number.NaN)).toBe(100);
    expect(clean(reversePercent(80, -20) ?? Number.NaN)).toBe(100);
    expect(reversePercent(50, -100)).toBeNull();
  });

  it("measures a symmetric difference", () => {
    expect(clean(percentDifference(90, 110) ?? Number.NaN)).toBe(20);
    expect(percentDifference(0, 0)).toBeNull();
  });

  it("cleans floating-point noise", () => {
    expect(clean(0.1 + 0.2)).toBe(0.3);
  });
});
