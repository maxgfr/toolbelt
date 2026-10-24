import { describe, expect, it } from "bun:test";
import { move } from "../_shared";
import {
  cleanLayers,
  layerCss,
  newLayer,
  PRESETS,
  shadowCss,
  shadowTailwind,
  shadowValue,
} from "./logic";

describe("box-shadow", () => {
  it("writes one layer with lengths, optional spread and color", () => {
    expect(layerCss(newLayer({ x: 0, y: 4, blur: 12, spread: 0, alpha: 0.15 }))).toBe(
      "0 4px 12px rgb(0 0 0 / 0.15)",
    );
    expect(
      layerCss(newLayer({ x: -2, y: 3, blur: 0, spread: 1, color: "#ff0000", alpha: 1 })),
    ).toBe("-2px 3px 0 1px #ff0000");
    expect(layerCss(newLayer({ inset: true, alpha: 1 }))).toBe("inset 0 4px 12px #000000");
  });

  it("multiplies the color's own alpha and falls back to black for invalid colors", () => {
    expect(layerCss(newLayer({ color: "rgb(255 0 0 / 0.5)", alpha: 0.5 }))).toContain(
      "rgb(255 0 0 / 0.25)",
    );
    expect(layerCss(newLayer({ color: "nope", alpha: 1 }))).toContain("#000000");
  });

  it("joins layers, or says none", () => {
    expect(shadowValue([])).toBe("none");
    expect(shadowCss([])).toBe("box-shadow: none;");
    const two = [newLayer({ alpha: 1 }), newLayer({ y: 8, alpha: 1 })];
    expect(shadowValue(two)).toBe("0 4px 12px #000000, 0 8px 12px #000000");
    expect(shadowCss(two)).toBe("box-shadow:\n  0 4px 12px #000000,\n  0 8px 12px #000000;");
  });

  it("writes a Tailwind arbitrary value without spaces", () => {
    expect(shadowTailwind([newLayer()])).toBe("shadow-[0_4px_12px_rgb(0_0_0/0.15)]");
    expect(shadowTailwind([newLayer(), newLayer()])).toMatch(/^shadow-\[[^ ]+,[^ ]+\]$/);
    expect(shadowTailwind([])).toBe("shadow-none");
  });

  it("cleans untrusted state", () => {
    expect(cleanLayers("garbage")).toEqual([]);
    expect(cleanLayers([null])).toEqual([newLayer()]);
    const [l] = cleanLayers([{ x: 9999, blur: -5, alpha: "0.5", inset: "yes", color: 3 }]);
    expect(l).toEqual({ ...newLayer(), x: 100, blur: 0, alpha: 0.5, inset: false });
    expect(cleanLayers(Array.from({ length: 50 }, () => ({}))).length).toBe(12);
  });

  it("reorders layers", () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(move([1, 2, 3], 2, -2)).toEqual([3, 1, 2]);
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });

  it("has valid presets", () => {
    for (const p of PRESETS) {
      expect(p.layers.length).toBeGreaterThan(0);
      expect(cleanLayers(p.layers)).toEqual(p.layers);
      expect(shadowValue(p.layers)).not.toContain("NaN");
    }
  });
});
