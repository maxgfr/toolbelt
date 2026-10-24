import { describe, expect, it } from "bun:test";
import { declsToStyle } from "../_shared";
import {
  borderCss,
  borderDecls,
  borderTailwind,
  cleanTriangle,
  clipCss,
  clipTailwind,
  DEFAULT,
  DIRECTIONS,
  equilateral,
  type Triangle,
} from "./logic";

const tri = (p: Partial<Triangle>): Triangle => ({ ...DEFAULT, ...p });

describe("css-triangle", () => {
  it("draws an upward triangle with transparent side borders", () => {
    expect(borderCss(tri({ dir: "up", w: 80, h: 60, color: "#ff0000" }))).toBe(
      [
        ".triangle {",
        "  width: 0;",
        "  height: 0;",
        "  border-left: 40px solid transparent;",
        "  border-right: 40px solid transparent;",
        "  border-bottom: 60px solid #ff0000;",
        "}",
      ].join("\n"),
    );
  });

  it("uses two borders for corner triangles and halves odd sizes", () => {
    const d = Object.fromEntries(borderDecls(tri({ dir: "down-right", w: 50, h: 30 })));
    expect(d["border-bottom"]).toBe("30px solid #0f766e");
    expect(d["border-left"]).toBe("50px solid transparent");
    expect(Object.keys(d)).toHaveLength(4);
    const r = Object.fromEntries(borderDecls(tri({ dir: "right", w: 20, h: 25 })));
    expect(r["border-top"]).toBe("12.5px solid transparent");
    expect(r["border-left"]).toBe("20px solid #0f766e");
  });

  it("has a clip-path version for every direction", () => {
    for (const dir of DIRECTIONS) {
      const css = clipCss(tri({ dir }));
      expect(css).toContain("width: 80px;");
      expect(css).toMatch(/clip-path: polygon\([^)]+\);/);
    }
    expect(clipCss(tri({ dir: "up" }))).toContain("polygon(50% 0, 100% 100%, 0 100%)");
  });

  it("writes Tailwind classes", () => {
    expect(borderTailwind(tri({ dir: "up", w: 80, h: 60, color: "#ff0000" }))).toBe(
      "w-0 h-0 border-l-[40px] border-l-transparent border-r-[40px] border-r-transparent border-b-[60px] border-b-[#ff0000]",
    );
    expect(clipTailwind(tri({ dir: "right", w: 10, h: 20, color: "#000" }))).toBe(
      "w-[10px] h-[20px] bg-[#000000] [clip-path:polygon(0_0,100%_50%,0_100%)]",
    );
  });

  it("makes a preview style object", () => {
    const s = declsToStyle(borderDecls(tri({ dir: "up" })));
    expect(s.borderBottom).toBe("60px solid #0f766e");
    expect(s.width).toBe("0");
  });

  it("cleans untrusted state", () => {
    expect(cleanTriangle(null)).toEqual(DEFAULT);
    expect(cleanTriangle({ dir: "sideways", w: -4, h: 1e9, color: 5 })).toEqual({
      dir: "up",
      w: 1,
      h: 1000,
      color: "#0f766e",
    });
    expect(borderCss(tri({ color: "nope" }))).toContain("solid #000000");
  });

  it("computes equilateral heights", () => {
    expect(equilateral(100)).toBe(86.6);
    expect(equilateral(0)).toBe(0);
  });
});
