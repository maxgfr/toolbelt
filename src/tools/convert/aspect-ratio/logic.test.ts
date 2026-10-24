import { describe, expect, it } from "bun:test";
import { exactSizes, gcd, nearestCommon, scale, simplify } from "./logic";

describe("aspect ratio", () => {
  it("finds the greatest common divisor", () => {
    expect(gcd(1920, 1080)).toBe(120);
    expect(gcd(7, 3)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
  });

  it("simplifies sizes", () => {
    expect(simplify(1920, 1080)).toEqual({ w: 16, h: 9, value: 1920 / 1080 });
    expect(simplify(1366, 768)?.w).toBe(683);
    expect(simplify(1080, 1920)).toMatchObject({ w: 9, h: 16 });
    expect(simplify(1.85, 1)).toMatchObject({ w: 37, h: 20 });
    expect(simplify(800, 800)).toMatchObject({ w: 1, h: 1, value: 1 });
  });

  it("refuses empty, zero or negative sizes", () => {
    expect(simplify(0, 1080)).toBeNull();
    expect(simplify(-4, 3)).toBeNull();
    expect(simplify(Number.NaN, 3)).toBeNull();
    expect(simplify(Number.POSITIVE_INFINITY, 3)).toBeNull();
  });

  it("names the closest common ratio", () => {
    expect(nearestCommon(1366 / 768)).toMatchObject({ w: 16, h: 9 });
    expect(nearestCommon(2520 / 1080)).toMatchObject({ w: 21, h: 9 });
    expect(nearestCommon(3440 / 1440)).toMatchObject({ w: 2.39, h: 1 });
    expect(nearestCommon(4 / 3)).toEqual({ w: 4, h: 3, off: 0 });
  });

  it("scales keeping the ratio", () => {
    expect(scale(16 / 9, "width", 1280)).toBe(720);
    expect(scale(16 / 9, "height", 1080)).toBe(1920);
    expect(scale(16 / 9, "width", 0)).toBeNull();
    expect(scale(0, "width", 100)).toBeNull();
  });

  it("lists exact sizes", () => {
    expect(exactSizes(16, 9).map((s) => `${s.w}x${s.h}`)).toContain("1920x1080");
    expect(exactSizes(4, 3, 1024).at(-1)).toEqual({ w: 1024, h: 768 });
    expect(exactSizes(0, 3)).toEqual([]);
  });
});
