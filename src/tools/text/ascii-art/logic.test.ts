import { describe, expect, it } from "bun:test";
import { FONTS } from "./fonts";
import { banner, box, displayWidth, parseFont } from "./logic";

const std = parseFont(FONTS.standard);
const opts = { layout: "font", width: 0, align: "left" } as const;

describe("parseFont", () => {
  it("reads every bundled font", () => {
    for (const src of Object.values(FONTS)) {
      const f = parseFont(src);
      expect(f.chars.size).toBeGreaterThanOrEqual(95);
      expect(f.chars.get(65)?.length).toBe(f.height);
    }
    expect(std.height).toBe(6);
    expect(std.layout).toEqual({ kind: "smush", rules: 15 });
    expect(std.chars.has(0xe9)).toBe(true);
  });

  it("rejects something that is not a font", () => {
    expect(() => parseFont("hello")).toThrow();
  });

  it("parses a tiny hand-made font with full-width layout", () => {
    const f = parseFont(`flf2a$ 1 1 3 -1 0\n $@@\nAB@@\n${"x@@\n".repeat(100)}`);
    expect(f.layout).toEqual({ kind: "full" });
    expect(banner("! !", f, opts)).toBe("AB  AB");
  });
});

describe("banner", () => {
  it("matches figlet's output for Standard (smushing rules)", () => {
    expect(banner("Hello, World!", std, opts)).toBe(
      [
        " _   _      _ _         __        __         _     _ _",
        "| | | | ___| | | ___    \\ \\      / /__  _ __| | __| | |",
        "| |_| |/ _ \\ | |/ _ \\    \\ \\ /\\ / / _ \\| '__| |/ _` | |",
        "|  _  |  __/ | | (_) |    \\ V  V / (_) | |  | | (_| |_|",
        "|_| |_|\\___|_|_|\\___( )    \\_/\\_/ \\___/|_|  |_|\\__,_(_)",
        "                    |/",
      ].join("\n"),
    );
  });

  it("is wider with full width than fitted than smushed", () => {
    const width = (layout: "full" | "fit" | "smush") =>
      Math.max(
        ...banner("HELLO", std, { ...opts, layout })
          .split("\n")
          .map((r) => r.length),
      );
    expect(width("full")).toBeGreaterThan(width("fit"));
    expect(width("fit")).toBeGreaterThan(width("smush"));
  });

  it("wraps words to the width and aligns them", () => {
    const out = banner("one two three", std, { layout: "font", width: 30, align: "right" });
    const rows = out.split("\n");
    expect(rows.length).toBe(std.height * 3);
    expect(rows.every((r) => r.length <= 30)).toBe(true);
    const centered = banner("a", std, { layout: "font", width: 21, align: "center" });
    expect(centered.split("\n")[1]?.startsWith("        ")).toBe(true);
  });

  it("splits a word that is wider than the width", () => {
    const out = banner("WWWWWWWW", std, { ...opts, width: 25 });
    expect(out.split("\n").every((r) => r.length <= 25)).toBe(true);
    expect(out.split("\n").length).toBeGreaterThan(std.height);
  });

  it("falls back for missing characters and handles empty input", () => {
    const banner3 = parseFont(FONTS.banner3);
    expect(banner("é", banner3, opts)).toBe(banner("e", banner3, opts));
    expect(banner("中", std, opts)).toBe(banner("?", std, opts));
    expect(banner("", std, opts)).toBe("");
  });

  it("keeps explicit line breaks", () => {
    expect(banner("a\nb", std, opts).split("\n")).toHaveLength(std.height * 2);
  });
});

describe("box", () => {
  it("frames text with padding and alignment", () => {
    expect(box("hi\nthere", { style: "single", padX: 1, padY: 0, align: "center" })).toBe(
      ["┌───────┐", "│  hi   │", "│ there │", "└───────┘"].join("\n"),
    );
    expect(box("", { style: "ascii", padX: 0, padY: 1, align: "left" })).toBe(
      ["++", "||", "||", "||", "++"].join("\n"),
    );
  });

  it("counts wide characters as two columns", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("日本")).toBe(4);
    expect(displayWidth("👍🏽")).toBe(2);
    expect(displayWidth("é")).toBe(1);
    const lines = box("日本\nabcd", { style: "double", padX: 0, padY: 0, align: "left" }).split(
      "\n",
    );
    expect(lines[1]).toBe("║日本║");
    expect(lines[2]).toBe("║abcd║");
  });
});
