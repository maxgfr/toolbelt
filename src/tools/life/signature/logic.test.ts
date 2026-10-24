import { describe, expect, test } from "bun:test";
import {
  addPoint,
  bounds,
  normalizeStrokes,
  outline,
  type Stroke,
  smoothPath,
  startPen,
  strokePath,
  toSvg,
} from "./logic";

const line: Stroke = {
  color: "#1d4ed8",
  width: 4,
  points: [
    [0, 0, 4],
    [10, 0, 4],
    [20, 0, 4],
  ],
};

describe("pen", () => {
  test("pressure sets the width", () => {
    let pen = startPen();
    pen = addPoint(pen, { x: 0, y: 0, t: 0, pressure: 1 }, 2);
    expect(pen.points[0]?.[2]).toBeCloseTo(2.8);
    pen = startPen();
    pen = addPoint(pen, { x: 0, y: 0, t: 0, pressure: 0.1 }, 2);
    expect(pen.points[0]?.[2]).toBeCloseTo(0.82);
  });

  test("faster strokes get thinner", () => {
    const run = (speed: number) => {
      let pen = startPen();
      for (let i = 0; i < 30; i++)
        pen = addPoint(pen, { x: i * speed, y: 0, t: i * 10, pressure: null }, 3);
      return pen.points[pen.points.length - 1]?.[2] ?? 0;
    };
    expect(run(1)).toBeGreaterThan(run(20));
    expect(run(40)).toBeGreaterThanOrEqual(3 * 0.4 - 1e-9);
  });

  test("tiny moves are skipped; positions are eased", () => {
    let pen = startPen();
    pen = addPoint(pen, { x: 0, y: 0, t: 0, pressure: null }, 2);
    pen = addPoint(pen, { x: 0.3, y: 0, t: 5, pressure: null }, 2);
    expect(pen.points).toHaveLength(1);
    pen = addPoint(pen, { x: 10, y: 0, t: 10, pressure: null }, 2);
    expect(pen.points[1]?.[0]).toBeCloseTo(6.5);
  });
});

describe("outline", () => {
  test("a straight line is a band of the right width with round ends", () => {
    const poly = outline(line.points);
    const ys = poly.map((p) => p[1]);
    expect(Math.max(...ys)).toBeCloseTo(2);
    expect(Math.min(...ys)).toBeCloseTo(-2);
    const xs = poly.map((p) => p[0]);
    // Caps reach beyond the end points by the radius.
    expect(Math.max(...xs)).toBeGreaterThan(21.5);
    expect(Math.min(...xs)).toBeLessThan(-1.5);
  });

  test("a single point is a dot; no points, nothing", () => {
    const dot = outline([[5, 5, 6]]);
    expect(dot).toHaveLength(16);
    for (const [x, y] of dot) expect(Math.hypot(x - 5, y - 5)).toBeCloseTo(3);
    expect(outline([])).toEqual([]);
  });

  test("repeated points do not produce NaN", () => {
    const poly = outline([
      [1, 1, 2],
      [1, 1, 2],
      [1, 1, 2],
    ]);
    expect(poly.flat().every(Number.isFinite)).toBe(true);
  });

  test("path data is closed and uses curves", () => {
    const d = strokePath(line);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("Q");
    expect(smoothPath([[0, 0]])).toBe("");
  });
});

describe("export", () => {
  test("bounds include the width and the padding", () => {
    expect(bounds([line], 0)).toEqual({ x: -3, y: -3, w: 26, h: 6 });
    expect(bounds([], 4)).toBeNull();
  });

  test("SVG is cropped, transparent and keeps colors", () => {
    const svg = toSvg([line, { ...line, color: 'red" onload="x' }], 8) ?? "";
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="-11 -11 42 22"');
    expect(svg).toContain('fill="#1d4ed8"');
    expect(svg).not.toContain("onload");
    expect(svg.match(/<path/g)).toHaveLength(2);
    expect(svg).not.toContain("<rect");
    expect(toSvg([])).toBeNull();
  });

  test("normalize drops malformed strokes and points", () => {
    expect(
      normalizeStrokes([{ color: "#fff", width: 2, points: [[1, 2, 3], [1, "x", 3], [1]] }, null]),
    ).toEqual([{ color: "#fff", width: 2, points: [[1, 2, 3]] }]);
  });
});
