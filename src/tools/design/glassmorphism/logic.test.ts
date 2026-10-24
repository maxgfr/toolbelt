import { describe, expect, it } from "bun:test";
import { declsToStyle } from "../_shared";
import {
  BACKGROUNDS,
  backdropValue,
  background,
  cardInk,
  cleanGlass,
  DEFAULT,
  type Glass,
  glassCss,
  glassDecls,
  glassTailwind,
  PRESETS,
} from "./logic";

const glass = (p: Partial<Glass>): Glass => ({ ...DEFAULT, ...p });

describe("glassmorphism", () => {
  it("writes the CSS with the -webkit- prefix first", () => {
    expect(glassCss(DEFAULT)).toBe(
      [
        ".glass {",
        "  background: rgb(255 255 255 / 0.18);",
        "  -webkit-backdrop-filter: blur(16px) saturate(180%);",
        "  backdrop-filter: blur(16px) saturate(180%);",
        "  border: 1px solid rgb(255 255 255 / 0.3);",
        "  border-radius: 20px;",
        "  box-shadow: 0 8px 32px rgb(0 0 0 / 0.2);",
        "}",
      ].join("\n"),
    );
  });

  it("drops what is turned off", () => {
    const d = glassDecls(glass({ border: 0, radius: 0, shadow: 0, saturation: 100 }));
    expect(d.map(([p]) => p)).toEqual(["background", "-webkit-backdrop-filter", "backdrop-filter"]);
    expect(backdropValue(glass({ blur: 0, saturation: 100 }))).toBe("blur(0)");
  });

  it("turns the declarations into a style object for the preview", () => {
    const s = declsToStyle(glassDecls(DEFAULT));
    expect(s.backdropFilter).toBe("blur(16px) saturate(180%)");
    expect(s.WebkitBackdropFilter).toBe("blur(16px) saturate(180%)");
    expect(s.borderRadius).toBe("20px");
  });

  it("writes Tailwind classes", () => {
    expect(glassTailwind(DEFAULT)).toBe(
      "bg-[rgb(255_255_255/0.18)] backdrop-blur-[16px] backdrop-saturate-[180%] border border-[rgb(255_255_255/0.3)] rounded-[20px] shadow-[0_8px_32px_rgb(0_0_0/0.2)]",
    );
  });

  it("cleans untrusted state and keeps invalid tints harmless", () => {
    expect(cleanGlass("x")).toEqual(DEFAULT);
    const g = cleanGlass({ blur: 500, alpha: -1, bg: "nope", tint: "not a color" });
    expect(g.blur).toBe(64);
    expect(g.alpha).toBe(0);
    expect(g.bg).toBe("aurora");
    expect(glassCss(g)).toContain("background: rgb(0 0 0 / 0);");
  });

  it("picks a readable text color", () => {
    expect(cardInk(glass({ alpha: 0.9, tint: "#ffffff" }))).toBe("#000000");
    expect(cardInk(glass({ alpha: 0.9, tint: "#000000" }))).toBe("#ffffff");
    expect(cardInk(glass({ alpha: 0.2, bg: "candy" }))).toBe(background("candy").ink);
  });

  it("has backgrounds and presets", () => {
    expect(background("missing")).toBe(BACKGROUNDS[0]);
    for (const p of PRESETS)
      expect(cleanGlass({ ...DEFAULT, ...p.g })).toEqual({ ...DEFAULT, ...p.g });
  });
});
