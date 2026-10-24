import { describe, expect, it } from "bun:test";
import { parseHex, toHex } from "../_shared";
import {
  averageColor,
  cssVariables,
  formatsOf,
  kmeans,
  palette,
  pickPoint,
  rgbToHsl,
  rng,
  samplePixels,
  textOn,
} from "./logic";

/** RGBA pixels: `n` copies of each color. */
function pixels(colors: [number, number, number, number][], n: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * n * 4);
  let p = 0;
  for (const c of colors) for (let i = 0; i < n; i++) for (const v of c) out[p++] = v;
  return out;
}

describe("sampling", () => {
  it("skips transparent pixels and caps the count", () => {
    const data = pixels(
      [
        [255, 0, 0, 255],
        [0, 255, 0, 0],
      ],
      10,
    );
    const px = samplePixels(data);
    expect(px.length).toBe(30);
    expect([...px.subarray(0, 3)]).toEqual([255, 0, 0]);
    expect(samplePixels(pixels([[1, 2, 3, 255]], 1000), 100).length / 3).toBeLessThanOrEqual(101);
    expect(samplePixels(new Uint8ClampedArray()).length).toBe(0);
  });

  it("averages colors", () => {
    expect(
      averageColor(
        samplePixels(
          pixels(
            [
              [0, 0, 0, 255],
              [255, 255, 255, 255],
            ],
            5,
          ),
        ),
      ),
    ).toEqual([128, 128, 128]);
    expect(averageColor(new Float32Array())).toBeNull();
  });
});

describe("k-means", () => {
  it("finds the clusters and their shares", () => {
    const data = pixels(
      [
        [250, 10, 10, 255],
        [10, 10, 240, 255],
        [255, 255, 255, 255],
      ],
      100,
    );
    // Add noise around the red cluster so it is the biggest.
    const extra = pixels([[240, 20, 0, 255]], 100);
    const all = new Uint8ClampedArray([...data, ...extra]);
    const p = palette(samplePixels(all), 3);
    expect(p).toHaveLength(3);
    expect(p[0]?.rgb).toEqual([245, 15, 5]);
    expect(p[0]?.share).toBeCloseTo(0.5);
    expect(p.map((s) => toHex(s.rgb)).sort()).toEqual(["#0a0af0", "#f50f05", "#ffffff"]);
    expect(p.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
  });

  it("returns fewer clusters when there are fewer colors", () => {
    const p = palette(samplePixels(pixels([[12, 34, 56, 255]], 50)), 8);
    expect(p).toEqual([{ rgb: [12, 34, 56], share: 1 }]);
    expect(palette(new Float32Array(), 5)).toEqual([]);
  });

  it("is deterministic and steps until convergence", () => {
    const r = rng(42);
    const data = new Uint8ClampedArray(4000);
    for (let i = 0; i < data.length; i++) data[i] = i % 4 === 3 ? 255 : Math.floor(r() * 256);
    const px = samplePixels(data);
    expect(palette(px, 5, 7)).toEqual(palette(px, 5, 7));
    const km = kmeans(px, 5, 7, 3);
    let steps = 0;
    while (!km.step()) steps++;
    expect(steps).toBeLessThan(3);
    expect(km.step()).toBe(true);
  });
});

describe("formats", () => {
  it("converts to hex, rgb, hsl", () => {
    expect(formatsOf([255, 0, 0])).toEqual({
      hex: "#ff0000",
      rgb: "rgb(255 0 0)",
      hsl: "hsl(0 100% 50%)",
    });
    expect(rgbToHsl([0, 128, 128])).toEqual([180, 100, 25]);
    expect(rgbToHsl([128, 128, 128])).toEqual([0, 0, 50]);
    expect(rgbToHsl([255, 0, 128])).toEqual([330, 100, 50]);
    expect(parseHex("#abc")).toEqual([170, 187, 204]);
    expect(parseHex("nope")).toBeNull();
    expect(toHex([300, -5, 15.6])).toBe("#ff0010");
  });

  it("picks readable text and writes CSS variables", () => {
    expect(textOn([255, 255, 0])).toBe("#000000");
    expect(textOn([0, 0, 128])).toBe("#ffffff");
    expect(cssVariables([{ rgb: [255, 0, 0], share: 1 }])).toBe(
      ":root {\n  --color-1: #ff0000;\n}",
    );
  });

  it("maps clicks to pixels", () => {
    const box = { left: 10, top: 20, width: 200, height: 100 };
    expect(pickPoint(110, 70, box, 400, 200)).toEqual({ x: 200, y: 100 });
    expect(pickPoint(0, 0, box, 400, 200)).toEqual({ x: 0, y: 0 });
    expect(pickPoint(999, 999, box, 400, 200)).toEqual({ x: 399, y: 199 });
  });
});
