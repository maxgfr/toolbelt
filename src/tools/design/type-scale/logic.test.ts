import { describe, expect, it } from "bun:test";
import {
  cleanPrefix,
  cleanScale,
  DEFAULT,
  fluidClamp,
  RATIOS,
  type Scale,
  scaleCss,
  scaleTailwind3,
  scaleTailwind4,
  size,
  steps,
} from "./logic";

const sc = (p: Partial<Scale>): Scale => ({ ...DEFAULT, ...p });

describe("type-scale", () => {
  it("computes modular sizes", () => {
    expect(size(16, 1.25, 0)).toBe(16);
    expect(size(16, 1.25, 1)).toBe(20);
    expect(size(16, 1.25, 2)).toBe(25);
    expect(size(16, 1.25, -1)).toBeCloseTo(12.8, 10);
    expect(size(16, 1.618, 1)).toBeCloseTo(25.888, 3);
  });

  it("lists steps from the largest to the smallest, in rem", () => {
    const list = steps(sc({ base: 16, ratio: 1.25, up: 2, down: 1, fluid: false }));
    expect(list.map((s) => s.name)).toEqual(["--step-2", "--step-1", "--step-0", "--step--1"]);
    expect(list.map((s) => s.value)).toEqual(["1.5625rem", "1.25rem", "1rem", "0.8rem"]);
    const css = scaleCss(sc({ base: 16, ratio: 1.25, up: 1, down: 0, fluid: false }));
    expect(css).toBe("/* 16px × 1.25 */\n:root {\n  --step-1: 1.25rem;\n  --step-0: 1rem;\n}");
  });

  it("writes fluid clamp() values (Utopia formula)", () => {
    // 16px at 320px → 20px at 1280px: slope 4/960, intercept 16 − 320·slope = 14.6667px
    expect(fluidClamp(16, 20, 320, 1280, 16)).toBe("clamp(1rem, 0.9167rem + 0.4167vw, 1.25rem)");
    // shrinking sizes keep min ≤ max in clamp()
    expect(fluidClamp(20, 16, 320, 1280, 16)).toBe("clamp(1rem, 1.3333rem - 0.4167vw, 1.25rem)");
    // equal ends or bad viewports: a plain value
    expect(fluidClamp(16, 16, 320, 1280, 16)).toBe("1rem");
    expect(fluidClamp(16, 20, 1280, 320, 16)).toBe("1.25rem");
    // a negative intercept is written as a subtraction
    expect(fluidClamp(10, 40, 400, 1000, 16)).toBe("clamp(0.625rem, 5vw - 0.625rem, 2.5rem)");
  });

  it("hits both sizes at both viewports", () => {
    const [step] = steps(sc({ base: 20, ratio: 1.25, minBase: 16, minRatio: 1.2, up: 1, down: 0 }));
    expect(step?.minPx).toBeCloseTo(19.2, 10);
    expect(step?.maxPx).toBe(25);
    const m = /clamp\(([\d.]+)rem, ([\d.-]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\)/.exec(
      step?.value ?? "",
    );
    expect(m).not.toBeNull();
    const at = (vw: number) => Number(m?.[2]) * 16 + (Number(m?.[3]) / 100) * vw;
    expect(at(DEFAULT.minVw)).toBeCloseTo(19.2, 2);
    expect(at(DEFAULT.maxVw)).toBeCloseTo(25, 2);
  });

  it("writes Tailwind themes", () => {
    const s = sc({ base: 16, ratio: 1.25, up: 1, down: 0, fluid: false, prefix: "fs" });
    expect(scaleTailwind4(s)).toBe("@theme {\n  --text-fs-1: 1.25rem;\n  --text-fs-0: 1rem;\n}");
    expect(scaleTailwind3(s)).toContain('        "fs-1": "1.25rem",');
    expect(scaleTailwind3(s)).toStartWith("module.exports = {");
  });

  it("cleans names and untrusted state", () => {
    expect(cleanPrefix("  Font Size!! ")).toBe("font-size");
    expect(cleanPrefix("--x")).toBe("x");
    expect(cleanPrefix("")).toBe("step");
    expect(cleanPrefix(3)).toBe("step");
    expect(cleanScale(null)).toEqual(DEFAULT);
    const s = cleanScale({ ratio: 0.5, up: 99, down: 2.4, fluid: "no" });
    expect(s.ratio).toBe(1);
    expect(s.up).toBe(12);
    expect(s.down).toBe(2);
    expect(s.fluid).toBe(true);
  });

  it("has ratio presets in increasing order", () => {
    const v = RATIOS.map((r) => r.value);
    expect(v).toEqual([...v].sort((a, b) => a - b));
  });
});
