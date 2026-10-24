import { describe, expect, it } from "bun:test";
import {
  type Bezier,
  bezierCss,
  bezierTailwind,
  bezierValue,
  cleanBezier,
  curvePath,
  durationText,
  ease,
  FRAME,
  fromSvg,
  PRESETS,
  parseBezier,
  pointAt,
  toSvg,
} from "./logic";

describe("cubic-bezier", () => {
  it("evaluates the curve like the browser", () => {
    expect(ease([0, 0, 1, 1], 0.3)).toBeCloseTo(0.3, 6);
    expect(ease([0.25, 0.1, 0.25, 1], 0)).toBe(0);
    expect(ease([0.25, 0.1, 0.25, 1], 1)).toBe(1);
    // known value of `ease` at 50% of the time
    expect(ease([0.25, 0.1, 0.25, 1], 0.5)).toBeCloseTo(0.8024, 3);
    // ease-in-out is symmetric
    expect(ease([0.42, 0, 0.58, 1], 0.5)).toBeCloseTo(0.5, 6);
    // easeOutBack overshoots
    const ys = Array.from({ length: 101 }, (_, i) => ease([0.34, 1.56, 0.64, 1], i / 100));
    expect(Math.max(...ys)).toBeGreaterThan(1.05);
    expect(pointAt([0.3, 0.6, 0.7, 0.4], 0)).toEqual([0, 0]);
    expect(pointAt([0.3, 0.6, 0.7, 0.4], 1)).toEqual([1, 1]);
  });

  it("stays monotonic for steep curves", () => {
    const b: Bezier = [0.9, 0, 0.1, 1];
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const y = ease(b, i / 100);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
  });

  it("writes keywords when possible", () => {
    expect(bezierValue([0.25, 0.1, 0.25, 1])).toBe("ease");
    expect(bezierValue([0, 0, 1, 1])).toBe("linear");
    expect(bezierValue([0.42, 0, 0.58, 1])).toBe("ease-in-out");
    expect(bezierValue([0.42, 0, 0.58, 1], false)).toBe("cubic-bezier(0.42, 0, 0.58, 1)");
    expect(bezierValue([0.123456, -0.5, 1, 1.5])).toBe("cubic-bezier(0.123, -0.5, 1, 1.5)");
  });

  it("writes CSS and Tailwind", () => {
    expect(bezierCss([0, 0, 1, 1], 600)).toContain("transition: transform 600ms linear;");
    expect(durationText(2000)).toBe("2s");
    expect(durationText(250)).toBe("250ms");
    expect(bezierTailwind([0.34, 1.56, 0.64, 1])).toBe("ease-[cubic-bezier(0.34,1.56,0.64,1)]");
    expect(bezierTailwind([0, 0, 1, 1])).toBe("ease-[cubic-bezier(0,0,1,1)]");
  });

  it("parses pasted timing functions", () => {
    expect(parseBezier("cubic-bezier(0.68, -0.6, 0.32, 1.6)")).toEqual([0.68, -0.6, 0.32, 1.6]);
    expect(parseBezier("transition-timing-function: ease-out;")).toEqual([0, 0, 0.58, 1]);
    expect(parseBezier(".1 .2 .3 .4")).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(parseBezier("[0.5, 0, 0.5, 1]")).toEqual([0.5, 0, 0.5, 1]);
    for (const bad of [
      "",
      "cubic-bezier(1.2, 0, 0, 1)",
      "cubic-bezier(0, 0, -0.1, 1)",
      "1 2 3",
      "a b c d",
      "steps(4)",
    ])
      expect(parseBezier(bad)).toBeNull();
  });

  it("cleans untrusted state", () => {
    expect(cleanBezier("x")).toEqual([0.25, 0.1, 0.25, 1]);
    expect(cleanBezier([2, 5, -1, -9])).toEqual([1, 2, 0, -1]);
    expect(cleanBezier([0.1, null, 0.3, 0.4])).toEqual([0.1, 0.1, 0.3, 0.4]);
  });

  it("maps between curve and SVG coordinates", () => {
    expect(toSvg(0, 0)).toEqual([FRAME.pad, FRAME.pad + FRAME.yMax * FRAME.size]);
    const [sx, sy] = toSvg(0.25, 0.75);
    expect(fromSvg(sx, sy)).toEqual([0.25, 0.75]);
    expect(fromSvg(-100, -1000)).toEqual([0, FRAME.yMax]);
    expect(curvePath([0, 0, 1, 1])).toMatch(/^M[\d. ]+ C[\d. ]+ [\d. ]+ [\d. ]+$/);
  });

  it("has valid presets", () => {
    for (const p of PRESETS) expect(parseBezier(bezierValue(p.b, false))).toEqual(p.b);
  });
});
