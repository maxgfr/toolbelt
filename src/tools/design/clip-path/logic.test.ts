import { describe, expect, it } from "bun:test";
import {
  type Clip,
  cleanClip,
  clipCss,
  clipTailwind,
  clipValue,
  DEFAULT,
  insertPoint,
  PRESETS,
  type Pt,
  regularPolygon,
  splitLongestEdge,
  star,
} from "./logic";

const clip = (p: Partial<Clip>): Clip => ({ ...DEFAULT, ...p });
const square: Pt[] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

describe("clip-path", () => {
  it("writes every shape", () => {
    expect(
      clipValue(
        clip({
          points: [
            [50, 0],
            [100, 100],
            [0, 100],
          ],
        }),
      ),
    ).toBe("polygon(50% 0, 100% 100%, 0 100%)");
    expect(clipValue(clip({ kind: "circle", r: 40, cx: 50, cy: 50 }))).toBe(
      "circle(40% at 50% 50%)",
    );
    expect(clipValue(clip({ kind: "ellipse", rx: 50, ry: 25.5, cx: 30, cy: 60 }))).toBe(
      "ellipse(50% 25.5% at 30% 60%)",
    );
    expect(clipValue(clip({ kind: "inset", inset: [10, 10, 10, 10], round: 0 }))).toBe(
      "inset(10%)",
    );
    expect(clipValue(clip({ kind: "inset", inset: [10, 20, 10, 20], round: 8 }))).toBe(
      "inset(10% 20% round 8px)",
    );
    expect(clipValue(clip({ kind: "inset", inset: [5, 20, 10, 20], round: 0 }))).toBe(
      "inset(5% 20% 10%)",
    );
    expect(clipValue(clip({ kind: "inset", inset: [1, 2, 3, 4], round: 0 }))).toBe(
      "inset(1% 2% 3% 4%)",
    );
  });

  it("writes CSS and Tailwind", () => {
    expect(clipCss(clip({ kind: "circle", r: 50 }))).toBe("clip-path: circle(50% at 50% 50%);");
    expect(
      clipTailwind(
        clip({
          points: [
            [50, 0],
            [100, 100],
            [0, 100],
          ],
        }),
      ),
    ).toBe("[clip-path:polygon(50%_0,100%_100%,0_100%)]");
  });

  it("builds regular polygons and stars inside the box", () => {
    const hex = regularPolygon(6);
    expect(hex).toHaveLength(6);
    expect(hex[0]).toEqual([50, 0]);
    expect(regularPolygon(1)).toHaveLength(3);
    const s = star(5);
    expect(s).toHaveLength(10);
    for (const [x, y] of [...hex, ...s]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("inserts a point on the nearest edge", () => {
    // near the right edge (between points 1 and 2)
    expect(insertPoint(square, [95, 50])).toEqual({
      points: [
        [0, 0],
        [100, 0],
        [95, 50],
        [100, 100],
        [0, 100],
      ],
      index: 2,
    });
    // near the closing edge (between the last and the first point)
    expect(insertPoint(square, [3, 40]).index).toBe(4);
    expect(insertPoint([], [1, 1])).toEqual({ points: [[1, 1]], index: 0 });
  });

  it("splits the longest edge", () => {
    const r = splitLongestEdge([
      [0, 0],
      [100, 0],
      [60, 10],
    ]);
    expect(r.index).toBe(1);
    expect(r.points[1]).toEqual([50, 0]);
  });

  it("cleans untrusted state", () => {
    expect(cleanClip(42)).toEqual(DEFAULT);
    const c = cleanClip({ kind: "circle", points: [[1, 2], "x", [3]], r: 900, inset: [1, 2] });
    expect(c.kind).toBe("circle");
    expect(c.points).toEqual(DEFAULT.points); // fewer than three valid points
    expect(c.r).toBe(100);
    expect(c.inset).toEqual(DEFAULT.inset);
    expect(
      cleanClip({
        points: [
          [-5, 50],
          [200, 0],
          [5, "7"],
        ],
      }).points,
    ).toEqual([
      [0, 50],
      [100, 0],
      [5, 7],
    ]);
  });

  it("has presets that are valid polygons", () => {
    for (const p of PRESETS) {
      expect(p.points.length).toBeGreaterThanOrEqual(3);
      expect(cleanClip({ points: p.points }).points).toEqual(p.points);
    }
  });
});
