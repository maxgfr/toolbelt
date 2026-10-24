import { describe, expect, it } from "bun:test";
import {
  cleanGradient,
  colorAt,
  DEFAULT,
  fromPreset,
  type Gradient,
  gradientCss,
  gradientTailwind,
  gradientValue,
  newStopPosition,
  PRESETS,
  sortedStops,
} from "./logic";

const g = (p: Partial<Gradient>): Gradient => ({ ...DEFAULT, ...p });
const bw = [
  { color: "#000", pos: 0 },
  { color: "#fff", pos: 100 },
];

describe("gradient", () => {
  it("writes linear gradients with the angle and the interpolation space", () => {
    expect(gradientValue(g({ angle: 90, space: "", stops: bw }))).toBe(
      "linear-gradient(90deg, #000000 0%, #ffffff 100%)",
    );
    expect(gradientValue(g({ angle: 90, space: "oklch", stops: bw }))).toBe(
      "linear-gradient(90deg in oklch, #000000 0%, #ffffff 100%)",
    );
    expect(gradientValue(g({ angle: 0, space: "oklch", hue: "longer", stops: bw }))).toBe(
      "linear-gradient(0deg in oklch longer hue, #000000 0%, #ffffff 100%)",
    );
    // the hue method only exists for polar spaces
    expect(gradientValue(g({ space: "oklab", hue: "longer", stops: bw }))).toContain("in oklab,");
  });

  it("writes radial and conic gradients with shape, center and start angle", () => {
    expect(gradientValue(g({ type: "radial", space: "", stops: bw }))).toBe(
      "radial-gradient(#000000 0%, #ffffff 100%)",
    );
    expect(
      gradientValue(g({ type: "radial", shape: "circle", x: 20, y: 30, space: "", stops: bw })),
    ).toBe("radial-gradient(circle at 20% 30%, #000000 0%, #ffffff 100%)");
    expect(gradientValue(g({ type: "radial", space: "oklab", stops: bw }))).toBe(
      "radial-gradient(in oklab, #000000 0%, #ffffff 100%)",
    );
    expect(gradientValue(g({ type: "conic", angle: 45, space: "", stops: bw }))).toBe(
      "conic-gradient(from 45deg, #000000 0%, #ffffff 100%)",
    );
    expect(gradientValue(g({ type: "conic", angle: 0, x: 10, space: "oklch", stops: bw }))).toBe(
      "conic-gradient(at 10% 50% in oklch, #000000 0%, #ffffff 100%)",
    );
  });

  it("repeats and sorts stops by position", () => {
    const v = gradientValue(
      g({
        repeating: true,
        space: "",
        stops: [
          { color: "red", pos: 20 },
          { color: "blue", pos: 5 },
        ],
      }),
    );
    expect(v).toBe("repeating-linear-gradient(135deg, #0000ff 5%, #ff0000 20%)");
    expect(
      sortedStops([
        { color: "a", pos: 5 },
        { color: "b", pos: 5 },
      ]).map((s) => s.color),
    ).toEqual(["a", "b"]);
  });

  it("adds an sRGB fallback line when a space is set", () => {
    expect(gradientCss(g({ space: "", stops: bw })).split("\n")).toHaveLength(1);
    const lines = gradientCss(g({ space: "oklch", stops: bw })).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toContain(" in ");
    expect(lines[1]).toContain(" in oklch");
  });

  it("writes Tailwind arbitrary values without spaces", () => {
    expect(gradientTailwind(g({ angle: 90, space: "oklch", stops: bw }))).toBe(
      "bg-[linear-gradient(90deg_in_oklch,#000000_0%,#ffffff_100%)]",
    );
  });

  it("cleans untrusted state", () => {
    expect(cleanGradient(null)).toEqual(DEFAULT);
    const c = cleanGradient({
      type: "weird",
      angle: 999,
      stops: [{ color: "red", pos: 50 }],
      space: "xyz",
    });
    expect(c.type).toBe("linear");
    expect(c.angle).toBe(360);
    expect(c.space).toBe("oklch");
    expect(c.stops).toEqual(DEFAULT.stops); // fewer than two stops
    expect(cleanGradient({ stops: [{ pos: -5 }, { color: "red", pos: 500 }] }).stops).toEqual([
      { color: "#000000", pos: 0 },
      { color: "red", pos: 100 },
    ]);
    // invalid colors never produce invalid CSS
    expect(gradientValue(g({ stops: [{ color: "nope", pos: 0 }, ...bw] }))).not.toContain("nope");
  });

  it("finds the color and the place of a new stop", () => {
    expect(colorAt(bw, 0)).toBe("#000000");
    expect(colorAt(bw, 100)).toBe("#ffffff");
    const mid = colorAt(bw, 50);
    expect(mid).toMatch(/^#([0-9a-f]{2})\1\1$/); // a grey
    expect(colorAt([], 50)).toBe("#808080");
    expect(newStopPosition(bw)).toBe(50);
    expect(
      newStopPosition([
        { color: "a", pos: 0 },
        { color: "b", pos: 20 },
        { color: "c", pos: 100 },
      ]),
    ).toBe(60);
  });

  it("has presets that make valid gradients", () => {
    for (const p of PRESETS) {
      const v = gradientValue(fromPreset(p));
      expect(v).toMatch(/^(repeating-)?(linear|radial|conic)-gradient\(.+\)$/);
      expect(v).not.toContain("NaN");
    }
  });
});
