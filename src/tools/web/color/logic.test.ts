import { describe, expect, it } from "bun:test";
import {
  apcaContrast,
  apcaUse,
  colorName,
  contrastRatio,
  formats,
  hex,
  inGamut,
  parseColor,
  readableOn,
  tintsAndShades,
  wcagLevels,
} from "./logic";

const c = (s: string) => {
  const v = parseColor(s);
  if (!v) throw new Error(`bad color ${s}`);
  return v;
};
const fmtOf = (s: string) => Object.fromEntries(formats(c(s)).map((f) => [f.id, f.value]));

describe("color", () => {
  it("parses every CSS syntax and rejects garbage", () => {
    for (const s of [
      "#0f766e",
      "0f766e",
      "rgb(15 118 110)",
      "rgba(15, 118, 110, 0.5)",
      "hsl(174 77% 26%)",
      "hwb(174 6% 54%)",
      "lab(45% -33 -3)",
      "lch(45% 33 186)",
      "oklab(51% -0.09 -0.01)",
      "oklch(51% 0.09 182)",
      "rebeccapurple",
    ])
      expect(parseColor(s)).toBeDefined();
    expect(parseColor("")).toBeUndefined();
    expect(parseColor("   ")).toBeUndefined();
    expect(parseColor("not a color")).toBeUndefined();
    expect(parseColor("#12")).toBeUndefined();
  });

  it("writes a color in every format", () => {
    const f = fmtOf("#ff0000");
    expect(f.hex).toBe("#ff0000");
    expect(f.rgb).toBe("rgb(255 0 0)");
    expect(f.hsl).toBe("hsl(0 100% 50%)");
    expect(f.hwb).toBe("hwb(0 0% 0%)");
    expect(f.oklch).toMatch(/^oklch\(62\.\d+% 0\.25\d* 29\.\d+\)$/);
    expect(fmtOf("rebeccapurple").hex).toBe("#663399");
  });

  it("keeps the alpha channel", () => {
    const f = fmtOf("rgb(0 0 0 / 50%)");
    expect(f.hex).toBe("#00000080");
    expect(f.rgb).toBe("rgb(0 0 0 / 0.5)");
  });

  it("flags colors outside sRGB and clamps their hex", () => {
    const wide = c("oklch(70% 0.4 200)");
    expect(inGamut(wide)).toBe(false);
    expect(hex(wide)).toMatch(/^#[0-9a-f]{6}$/);
    expect(inGamut(c("#123456"))).toBe(true);
  });

  it("names colors, exactly or approximately", () => {
    expect(colorName(c("#ff0000"))).toEqual({ name: "red", exact: true });
    const near = colorName(c("#fe0102"));
    expect(near.exact).toBe(false);
    expect(near.name).toBe("red");
  });

  it("builds tints and shades around the color", () => {
    const s = tintsAndShades(c("#808080"));
    expect(s).toHaveLength(11);
    expect(s[5]?.hex).toBe("#808080");
    expect((s[0]?.hex ?? "") < "#808080").toBe(true);
    expect((s[10]?.hex ?? "") > "#808080").toBe(true);
  });

  it("computes the WCAG 2 contrast ratio", () => {
    expect(contrastRatio(c("#000"), c("#fff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(c("#fff"), c("#fff"))).toBeCloseTo(1, 5);
    expect(contrastRatio(c("#777"), c("#fff"))).toBeCloseTo(4.48, 2);
    // A translucent foreground is blended first: 50% black on white is #808080.
    expect(contrastRatio(c("rgb(0 0 0 / .5)"), c("#fff"))).toBeCloseTo(
      contrastRatio(c("#808080"), c("#fff")),
      1,
    );
  });

  it("compares the ratio unrounded", () => {
    const l = wcagLevels(4.499);
    expect(l.aaNormal).toBe(false);
    expect(l.aaLarge).toBe(true);
    expect(wcagLevels(7).aaaNormal).toBe(true);
  });

  it("computes APCA Lc with the reference values", () => {
    expect(apcaContrast(c("#000"), c("#fff"))).toBeCloseTo(106.04, 1);
    expect(apcaContrast(c("#fff"), c("#000"))).toBeCloseTo(-107.88, 1);
    expect(apcaContrast(c("#888"), c("#fff"))).toBeCloseTo(63.06, 1);
    expect(apcaContrast(c("#fff"), c("#888"))).toBeCloseTo(-68.54, 1);
    expect(apcaContrast(c("#abc"), c("#abc"))).toBe(0);
    expect(apcaUse(-80)).toBe("body");
    expect(apcaUse(50)).toBe("large");
    expect(apcaUse(10)).toBe("none");
  });

  it("picks black or white text", () => {
    expect(readableOn(c("#ffff00"))).toBe("#000000");
    expect(readableOn(c("#000080"))).toBe("#ffffff");
  });
});
