import { describe, expect, test } from "bun:test";
import {
  cycle,
  estimateRefresh,
  LAYOUTS,
  layoutCodes,
  median,
  physicalPixels,
  rowWidth,
  TEST_COLORS,
} from "./logic";

function frames(hz: number, n = 60, jitter = 0): number[] {
  return Array.from({ length: n }, (_, i) => i * (1000 / hz) + (i % 2 ? jitter : -jitter));
}

describe("refresh rate", () => {
  test.each([60, 75, 120, 144, 240])("%p Hz", (hz) => {
    const r = estimateRefresh(frames(hz, 60, 0.3));
    expect(r?.snapped).toBe(hz);
    expect(Math.abs((r?.hz ?? 0) - hz) / hz).toBeLessThan(0.05);
  });
  test("an odd rate is not snapped", () => {
    expect(estimateRefresh(frames(110))?.snapped).toBeNull();
  });
  test("a few dropped frames do not change the median", () => {
    const t = frames(60);
    t.splice(10, 1);
    t.splice(30, 1);
    expect(estimateRefresh(t)?.snapped).toBe(60);
  });
  test("too few frames", () => {
    expect(estimateRefresh([0, 16, 33])).toBeNull();
  });
  test("median", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(Number.isNaN(median([]))).toBe(true);
  });
});

describe("dead pixel colors", () => {
  test("cycle wraps both ways", () => {
    expect(cycle(0, TEST_COLORS.length, -1)).toBe(TEST_COLORS.length - 1);
    expect(cycle(TEST_COLORS.length - 1, TEST_COLORS.length)).toBe(0);
    expect(cycle(3, 0)).toBe(0);
  });
  test("pure primaries are included", () => {
    expect(TEST_COLORS.map((c) => c.css)).toEqual(
      expect.arrayContaining(["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"]),
    );
  });
});

describe("keyboard layouts", () => {
  test("main rows are 15 units wide", () => {
    for (const layout of ["qwerty", "azerty"] as const)
      for (const row of LAYOUTS[layout].slice(1, 6)) expect(rowWidth(row)).toBeCloseTo(15);
  });
  test("each code appears once (except the tall ISO Enter)", () => {
    for (const layout of ["qwerty", "azerty"] as const) {
      const codes = LAYOUTS[layout]
        .flat()
        .map((x) => x.code)
        .filter((c) => c && c !== "Enter");
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
  test("AZERTY labels sit on the right physical keys", () => {
    const label = (code: string) => LAYOUTS.azerty.flat().find((x) => x.code === code)?.label;
    expect(label("KeyQ")).toBe("A");
    expect(label("KeyW")).toBe("Z");
    expect(label("KeyA")).toBe("Q");
    expect(label("Semicolon")).toBe("M");
    expect(label("KeyZ")).toBe("W");
    expect(label("KeyM")).toBe(",");
    expect(label("Digit2")).toBe("é");
    expect(label("Digit0")).toBe("à");
  });
  test("ISO has the extra key next to left Shift", () => {
    expect(layoutCodes("azerty").has("IntlBackslash")).toBe(true);
    expect(layoutCodes("qwerty").has("IntlBackslash")).toBe(false);
    expect(layoutCodes("qwerty").has("F12")).toBe(true);
  });
});

test("physical pixels", () => {
  expect(physicalPixels(1440, 900, 2)).toEqual({ w: 2880, h: 1800 });
  expect(physicalPixels(1280, 720, 1.5)).toEqual({ w: 1920, h: 1080 });
});
