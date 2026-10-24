import { describe, expect, it } from "bun:test";
import {
  cleanRadius,
  DEFAULT,
  fromHandles,
  PRESETS,
  parseRadius,
  type Quad,
  radiusCss,
  radiusTailwind,
  radiusValue,
  randomBlob,
  shorten,
  toHandles,
} from "./logic";

describe("border-radius", () => {
  it("writes the shortest form for each axis", () => {
    expect(shorten([10, 10, 10, 10], "px")).toBe("10px");
    expect(shorten([10, 20, 10, 20], "px")).toBe("10px 20px");
    expect(shorten([10, 20, 30, 20], "px")).toBe("10px 20px 30px");
    expect(shorten([10, 20, 30, 40], "%")).toBe("10% 20% 30% 40%");
    expect(shorten([0, 0, 0, 0], "%")).toBe("0");
    expect(shorten([0, 50, 0, 50], "%")).toBe("0 50%");
  });

  it("adds the vertical radii only when they differ", () => {
    expect(radiusValue({ unit: "%", h: [50, 50, 50, 50], v: [50, 50, 50, 50] })).toBe("50%");
    expect(radiusValue(DEFAULT)).toBe("30% 70% 70% 30% / 30% 30% 70% 70%");
    expect(radiusCss(DEFAULT)).toBe("border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;");
    expect(radiusTailwind(DEFAULT)).toBe("rounded-[30%_70%_70%_30%/30%_30%_70%_70%]");
  });

  it("parses what it writes, and pasted values", () => {
    for (const p of PRESETS) expect(parseRadius(radiusValue(p.r))).toEqual(p.r);
    expect(parseRadius("border-radius: 12px;")).toEqual({
      unit: "px",
      h: [12, 12, 12, 12],
      v: [12, 12, 12, 12],
    });
    expect(parseRadius("10% 20% / 5%")).toEqual({
      unit: "%",
      h: [10, 20, 10, 20],
      v: [5, 5, 5, 5],
    });
    expect(parseRadius("0")).toEqual({ unit: "px", h: [0, 0, 0, 0], v: [0, 0, 0, 0] });
  });

  it("rejects what it cannot edit", () => {
    for (const bad of [
      "",
      "10px 5%",
      "1em",
      "a / b",
      "1px 2px 3px 4px 5px",
      "1px / 2px / 3px",
      "10",
      "-5px",
      "150%",
    ])
      expect(parseRadius(bad)).toBeNull();
  });

  it("maps the four edge handles to complementary corners", () => {
    const r = fromHandles({ top: 30, right: 40, bottom: 20, left: 60 });
    expect(r).toEqual({ unit: "%", h: [30, 70, 80, 20], v: [60, 40, 60, 40] });
    expect(toHandles(r)).toEqual({ top: 30, right: 40, bottom: 20, left: 60 });
    // out-of-range handles are clamped
    expect(fromHandles({ top: -10, right: 120, bottom: 50.4, left: 50 }).h).toEqual([
      0, 100, 50, 50,
    ]);
  });

  it("makes random blobs within range", () => {
    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 20; i++) {
      const b = randomBlob(rand);
      const all = [...b.h, ...b.v];
      expect(all.every((n) => n >= 20 && n <= 80)).toBe(true);
      expect((b.h[0] as number) + (b.h[1] as number)).toBe(100);
    }
  });

  it("cleans untrusted state", () => {
    expect(cleanRadius(undefined)).toEqual(DEFAULT);
    expect(cleanRadius({ unit: "px", h: [1, 2, 3, 999], v: "x" })).toEqual({
      unit: "px",
      h: [1, 2, 3, 400] as Quad,
      v: [1, 2, 3, 400] as Quad,
    });
    expect(cleanRadius({ unit: "em", h: [1, 2] })).toEqual(DEFAULT);
  });
});
