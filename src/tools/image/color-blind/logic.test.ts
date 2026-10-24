import { describe, expect, it } from "bun:test";
import { parseHex, type Rgb } from "../_shared";
import {
  blendIdentity,
  type Deficiency,
  distance,
  fromLinear,
  MATRICES,
  matrixOf,
  SAMPLE_PAIRS,
  simulate,
  simulateRgb,
  toLinear,
} from "./logic";

const ALL: Deficiency[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
  "protanomaly",
  "deuteranomaly",
  "tritanomaly",
  "achromatomaly",
];

describe("matrices", () => {
  it("keep white and grays unchanged (rows sum to 1)", () => {
    for (const d of ALL) {
      const m = matrixOf(d);
      for (let r = 0; r < 3; r++)
        expect((m[r * 3] ?? 0) + (m[r * 3 + 1] ?? 0) + (m[r * 3 + 2] ?? 0)).toBeCloseTo(1, 4);
      for (const g of [0, 64, 128, 255]) {
        const out = simulateRgb([g, g, g], d);
        for (const v of out) expect(Math.abs(v - g)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("blends with the identity", () => {
    expect(blendIdentity(MATRICES.protanopia, 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(blendIdentity(MATRICES.protanopia, 1)).toEqual(MATRICES.protanopia);
  });
});

describe("simulation", () => {
  const red: Rgb = [214, 39, 40];
  const green: Rgb = [44, 160, 44];

  it("brings red and green together for protans and deutans, not for tritans", () => {
    const before = distance(red, green);
    const protan = distance(simulateRgb(red, "protanopia"), simulateRgb(green, "protanopia"));
    const deutan = distance(simulateRgb(red, "deuteranopia"), simulateRgb(green, "deuteranopia"));
    const tritan = distance(simulateRgb(red, "tritanopia"), simulateRgb(green, "tritanopia"));
    expect(protan).toBeLessThan(before * 0.6);
    expect(deutan).toBeLessThan(before * 0.6);
    expect(tritan).toBeGreaterThan(before * 0.7);
    // Anomalous vision is in between.
    const anomalous = distance(
      simulateRgb(red, "deuteranomaly"),
      simulateRgb(green, "deuteranomaly"),
    );
    expect(anomalous).toBeGreaterThan(deutan);
    expect(anomalous).toBeLessThan(before);
  });

  it("turns everything gray with achromatopsia", () => {
    const [r, g, b] = simulateRgb([255, 0, 0], "achromatopsia");
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBe(fromLinear(0.2126));
  });

  it("processes RGBA pixels like single colors, keeping alpha", () => {
    const src = new Uint8ClampedArray([...red, 255, ...green, 128, 0, 0, 255, 0]);
    for (const d of ALL) {
      const out = simulate(src, d);
      expect(out.length).toBe(src.length);
      for (let i = 0; i < 3; i++) {
        const want = simulateRgb([src[i * 4] ?? 0, src[i * 4 + 1] ?? 0, src[i * 4 + 2] ?? 0], d);
        for (let c = 0; c < 3; c++)
          expect(Math.abs((out[i * 4 + c] ?? 0) - (want[c] ?? 0))).toBeLessThanOrEqual(1);
        expect(out[i * 4 + 3]).toBe(src[i * 4 + 3]);
      }
    }
    expect(simulate(new Uint8ClampedArray(), "protanopia").length).toBe(0);
  });

  it("round-trips the sRGB transfer", () => {
    for (let v = 0; v < 256; v += 17) expect(fromLinear(toLinear(v))).toBe(v);
    expect(fromLinear(2)).toBe(255);
    expect(fromLinear(-1)).toBe(0);
  });

  it("has valid sample colors", () => {
    for (const [a, b] of SAMPLE_PAIRS) {
      expect(parseHex(a)).not.toBeNull();
      expect(parseHex(b)).not.toBeNull();
    }
  });
});
