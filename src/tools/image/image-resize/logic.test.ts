import { describe, expect, it } from "bun:test";
import {
  aspectRatio,
  clampRect,
  dragRect,
  fitAspect,
  flipRectH,
  flipRectV,
  fullRect,
  type Orientation,
  orientedSize,
  outputSize,
  rotateOrientation,
  rotateRect,
} from "./logic";

const W = 400;
const H = 300;
const r0 = { x: 100, y: 100, w: 100, h: 100 };

describe("aspect presets", () => {
  it("gives ratios", () => {
    const img = { w: W, h: H };
    expect(aspectRatio("free", { w: 1, h: 1 }, img)).toBeNull();
    expect(aspectRatio("16:9", { w: 1, h: 1 }, img)).toBeCloseTo(16 / 9);
    expect(aspectRatio("9:16", { w: 1, h: 1 }, img)).toBeCloseTo(9 / 16);
    expect(aspectRatio("original", { w: 1, h: 1 }, img)).toBeCloseTo(4 / 3);
    expect(aspectRatio("custom", { w: 5, h: 2 }, img)).toBe(2.5);
    expect(aspectRatio("custom", { w: 0, h: 2 }, img)).toBeNull();
  });

  it("fits the largest box of a ratio, centered", () => {
    expect(fitAspect(fullRect(W, H), 1, W, H)).toEqual({ x: 50, y: 0, w: 300, h: 300 });
    expect(fitAspect(fullRect(W, H), 16 / 9, W, H)).toEqual({ x: 0, y: 38, w: 400, h: 225 });
  });
});

describe("clampRect", () => {
  it("keeps the crop inside, in whole pixels", () => {
    expect(clampRect({ x: -10, y: 250.4, w: 50.6, h: 100 }, W, H)).toEqual({
      x: 0,
      y: 200,
      w: 51,
      h: 100,
    });
    expect(clampRect({ x: 0, y: 0, w: 9999, h: 0 }, W, H, 4)).toEqual({ x: 0, y: 0, w: 400, h: 4 });
  });
});

describe("dragRect", () => {
  it("moves inside the image", () => {
    expect(dragRect(r0, "move", 20, -30, W, H, null)).toEqual({ x: 120, y: 70, w: 100, h: 100 });
    expect(dragRect(r0, "move", 1000, 1000, W, H, null)).toEqual({
      x: 300,
      y: 200,
      w: 100,
      h: 100,
    });
  });

  it("resizes freely from edges and corners, with a minimum size", () => {
    expect(dragRect(r0, "se", 50, 20, W, H, null)).toEqual({ x: 100, y: 100, w: 150, h: 120 });
    expect(dragRect(r0, "nw", -50, -20, W, H, null)).toEqual({ x: 50, y: 80, w: 150, h: 120 });
    expect(dragRect(r0, "e", 1000, 0, W, H, null)).toEqual({ x: 100, y: 100, w: 300, h: 100 });
    expect(dragRect(r0, "w", 500, 0, W, H, null, 8)).toEqual({ x: 192, y: 100, w: 8, h: 100 });
    expect(dragRect(r0, "n", 0, -500, W, H, null)).toEqual({ x: 100, y: 0, w: 100, h: 200 });
  });

  it("keeps the ratio on corners, anchored on the opposite corner", () => {
    const r = dragRect(r0, "se", 60, 10, W, H, 1);
    expect(r).toEqual({ x: 100, y: 100, w: 160, h: 160 });
    const capped = dragRect(r0, "se", 1000, 1000, W, H, 1);
    expect(capped).toEqual({ x: 100, y: 100, w: 200, h: 200 });
    const nw = dragRect(r0, "nw", -40, 0, W, H, 2);
    expect(nw.w / nw.h).toBeCloseTo(2, 1);
    expect(nw.x + nw.w).toBe(200);
    expect(nw.y + nw.h).toBe(200);
  });

  it("keeps the ratio on edges, around the middle", () => {
    const r = dragRect(r0, "e", 40, 0, W, H, 1);
    expect(r).toEqual({ x: 100, y: 80, w: 140, h: 140 });
    const big = dragRect(r0, "s", 0, 1000, W, H, 1);
    expect(big.y).toBe(100);
    expect(big.h).toBe(200);
    expect(big.x + big.w / 2).toBe(150);
  });
});

describe("orientation", () => {
  it("rotates and flips", () => {
    const o: Orientation = { turns: 0, flipH: true, flipV: false };
    expect(rotateOrientation(o)).toEqual({ turns: 1, flipH: false, flipV: true });
    expect(rotateOrientation({ turns: 3, flipH: false, flipV: false }).turns).toBe(0);
    expect(orientedSize(400, 300, { turns: 1, flipH: false, flipV: false })).toEqual({
      w: 300,
      h: 400,
    });
    expect(orientedSize(400, 300, { turns: 2, flipH: false, flipV: false })).toEqual({
      w: 400,
      h: 300,
    });
  });

  it("moves a crop with the image", () => {
    // Top-left 100×50 of a 400×300 image ends top-right of the 300×400 turned image.
    expect(rotateRect({ x: 0, y: 0, w: 100, h: 50 }, 400, 300)).toEqual({
      x: 250,
      y: 0,
      w: 50,
      h: 100,
    });
    // Four turns bring it back.
    let r = { x: 10, y: 20, w: 30, h: 40 };
    let w = 400;
    let h = 300;
    for (let i = 0; i < 4; i++) {
      r = rotateRect(r, w, h);
      [w, h] = [h, w];
    }
    expect(r).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    expect(flipRectH({ x: 10, y: 20, w: 30, h: 40 }, 400).x).toBe(360);
    expect(flipRectV({ x: 10, y: 20, w: 30, h: 40 }, 300).y).toBe(240);
  });
});

describe("outputSize", () => {
  const crop = { w: 400, h: 300 };
  it("scales by percent", () => {
    expect(outputSize(crop, { mode: "pct", pct: 50, w: 0, h: 0, lock: true })).toEqual({
      w: 200,
      h: 150,
    });
  });
  it("follows the edited side when locked", () => {
    expect(outputSize(crop, { mode: "px", pct: 100, w: 800, h: 0, lock: true })).toEqual({
      w: 800,
      h: 600,
    });
    expect(outputSize(crop, { mode: "px", pct: 100, w: 0, h: 150, lock: true })).toEqual({
      w: 200,
      h: 150,
    });
    expect(outputSize(crop, { mode: "px", pct: 100, w: 0, h: 0, lock: true })).toEqual(crop);
  });
  it("stretches when unlocked and caps huge sizes", () => {
    expect(outputSize(crop, { mode: "px", pct: 100, w: 100, h: 100, lock: false })).toEqual({
      w: 100,
      h: 100,
    });
    const huge = outputSize(crop, { mode: "pct", pct: 100000, w: 0, h: 0, lock: true });
    expect(huge.w).toBeLessThanOrEqual(16384);
    expect(huge.w / huge.h).toBeCloseTo(4 / 3, 2);
  });
});
