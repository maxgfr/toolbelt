import { describe, expect, it } from "bun:test";
import { convert, convertAll, DEFAULT_CONTEXT as D, parseLength } from "./logic";

describe("css-units", () => {
  it("converts px to font-relative units with the base size", () => {
    expect(convert(24, "px", "rem", D)).toBe(1.5);
    expect(convert(24, "px", "em", { ...D, parent: 12 })).toBe(2);
    expect(convert(1.5, "em", "%", D)).toBe(150);
    expect(convert(1, "rem", "px", { ...D, root: 10 })).toBe(10);
  });

  it("uses the CSS absolute units (1in = 96px)", () => {
    expect(convert(16, "px", "pt", D)).toBe(12);
    expect(convert(1, "in", "cm", D)).toBeCloseTo(2.54, 10);
    expect(convert(1, "pc", "pt", D)).toBeCloseTo(12, 10);
    expect(convert(10, "mm", "Q", D)).toBeCloseTo(40, 10);
  });

  it("uses the viewport size", () => {
    expect(convert(144, "px", "vw", D)).toBe(10);
    expect(convert(50, "vh", "px", D)).toBe(450);
    expect(convert(10, "vmin", "px", D)).toBe(90);
    expect(convert(10, "vmax", "px", D)).toBe(144);
  });

  it("never divides by zero", () => {
    expect(convert(10, "px", "rem", { ...D, root: 0 })).toBe(0);
  });

  it("parses CSS lengths", () => {
    expect(parseLength("1.5rem", "px")).toEqual({ value: 1.5, unit: "rem" });
    expect(parseLength(" 24 ", "px")).toEqual({ value: 24, unit: "px" });
    expect(parseLength(".5EM", "px")).toEqual({ value: 0.5, unit: "em" });
    expect(parseLength("-12px", "rem")).toEqual({ value: -12, unit: "px" });
    expect(parseLength("1,5", "rem")).toEqual({ value: 1.5, unit: "rem" });
    expect(parseLength("50%", "px")).toEqual({ value: 50, unit: "%" });
    expect(parseLength("12 furlongs", "px")).toBeNull();
    expect(parseLength("", "px")).toBeNull();
    expect(parseLength("abc", "px")).toBeNull();
  });

  it("writes every unit as CSS text", () => {
    const all = Object.fromEntries(convertAll(18, "px", D).map((r) => [r.unit, r.css]));
    expect(all.rem).toBe("1.125rem");
    expect(all.pt).toBe("13.5pt");
    expect(all.vw).toBe("1.25vw");
  });
});
