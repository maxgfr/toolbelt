import { describe, expect, it } from "bun:test";
import { displayable } from "culori";
import { parseColor } from "../_shared";
import {
  cleanName,
  contrastHint,
  cssVars,
  HARMONIES,
  harmony,
  lch,
  oklchCss,
  STEPS,
  scale,
  tailwind3,
  tailwind4,
  toJson,
  wcagLevel,
} from "./logic";

const c = (s: string) => {
  const v = parseColor(s);
  if (!v) throw new Error(s);
  return v;
};
const blue = c("#3b82f6");
const hueOf = (hex: string) => lch(c(hex)).h;
const hueDist = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

describe("palette", () => {
  it("rotates hues for each harmony and keeps the base exact", () => {
    const comp = harmony(blue, "complementary");
    expect(comp).toHaveLength(2);
    expect(comp[0]?.hex).toBe("#3b82f6");
    // gamut mapping keeps the hue (within a few degrees)
    expect(hueDist(hueOf(comp[1]?.hex ?? ""), hueOf("#3b82f6") + 180)).toBeLessThan(8);
    expect(harmony(blue, "triadic")).toHaveLength(3);
    expect(harmony(blue, "analogous")[1]?.hex).toBe("#3b82f6");
    expect(harmony(blue, "tetradic")).toHaveLength(4);
    const mono = harmony(blue, "monochrome");
    expect(mono).toHaveLength(5);
    expect(mono[2]?.hex).toBe("#3b82f6");
    const ls = mono.map((s) => lch(c(s.hex)).l);
    expect(ls).toEqual([...ls].sort((a, b) => a - b));
    for (const k of HARMONIES)
      for (const s of harmony(blue, k)) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("builds a 50–950 scale from light to dark, all displayable", () => {
    const s = scale(blue, false);
    expect(s.map((x) => x.step)).toEqual([...STEPS]);
    const ls = s.map((x) => lch(c(x.hex)).l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThan(ls[i - 1] as number);
    for (const x of s) expect(displayable(c(x.hex))).toBe(true);
    expect(s.some((x) => x.base)).toBe(false);
  });

  it("puts the exact base color on the closest step", () => {
    const s = scale(blue, true);
    const base = s.filter((x) => x.base);
    expect(base).toHaveLength(1);
    expect(base[0]?.hex).toBe("#3b82f6");
    expect(base[0]?.step).toBe(500);
    expect(scale(c("#fef9c3")).find((x) => x.base)?.step).toBe(50);
    expect(scale(c("#1e3a8a")).find((x) => x.base)?.step).toBe(900);
  });

  it("keeps greys grey", () => {
    for (const x of scale(c("#808080"), false)) expect(lch(c(x.hex)).c).toBeLessThan(0.01);
    expect(oklchCss(c("#ffffff"))).toBe("oklch(100% 0 0)");
  });

  it("gives a contrast hint", () => {
    const white = contrastHint("#ffffff");
    expect(white.text).toBe("#000000");
    expect(white.black).toBeCloseTo(21, 5);
    expect(white.blackLevel).toBe("AAA");
    expect(white.whiteLevel).toBe("fail");
    expect(contrastHint("#000000").text).toBe("#ffffff");
    const b = contrastHint("#3b82f6");
    expect(b.whiteLevel).toBe("AA18"); // 3.68:1, large text only
    expect(b.blackLevel).toBe("AA"); // 5.71:1
    expect(wcagLevel(7)).toBe("AAA");
    expect(wcagLevel(2.9)).toBe("fail");
    expect(contrastHint("garbage").text).toBe("#ffffff");
  });

  it("exports CSS, Tailwind and JSON", () => {
    const s = scale(blue);
    const css = cssVars("brand", s, "hex");
    expect(css).toContain("  --color-brand-500: #3b82f6;");
    expect(css.split("\n")).toHaveLength(13);
    expect(tailwind4("brand", s, "oklch")).toMatch(
      /--color-brand-50: oklch\([\d.]+% [\d.]+ [\d.]+\);/,
    );
    expect(tailwind3("brand", s, "hex")).toContain('          500: "#3b82f6",');
    expect(tailwind3("my-brand", s, "hex")).toContain('"my-brand": {');
    const json = JSON.parse(toJson("brand", s, harmony(blue, "triadic"), "triadic", "hex"));
    expect(json.brand["500"]).toBe("#3b82f6");
    expect(json.harmony.type).toBe("triadic");
    expect(json.harmony.colors).toHaveLength(3);
  });

  it("cleans names", () => {
    expect(cleanName(" My Brand! ")).toBe("my-brand");
    expect(cleanName("")).toBe("primary");
    expect(cleanName(null)).toBe("primary");
  });
});
