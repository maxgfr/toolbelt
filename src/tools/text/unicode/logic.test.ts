import { describe, expect, it } from "bun:test";
import {
  category,
  charName,
  inspect,
  normalizeSpaces,
  removeInvisible,
  script,
  summarize,
} from "./logic";

describe("unicode", () => {
  it("describes each code point with its grapheme, bytes and category", () => {
    const rows = inspect("é😀");
    expect(rows.map((r) => r.hex)).toEqual(["U+00E9", "U+1F600"]);
    expect(rows[0]?.utf8).toBe("C3 A9");
    expect(rows[1]?.utf16).toBe("D83D DE00");
    expect(rows[1]?.utf8).toBe("F0 9F 98 80");
    expect(rows.map((r) => r.category)).toEqual(["Ll", "So"]);
    expect(inspect("")).toEqual([]);
  });

  it("groups combining marks and joined emoji into graphemes", () => {
    const rows = inspect("e\u0301👨\u200D👩\u200D👧x");
    expect(rows.map((r) => r.grapheme)).toEqual([0, 0, 1, 1, 1, 1, 1, 2]);
    expect(rows[1]?.category).toBe("Mn");
    expect(rows[1]?.script).toBe("Inherited");
  });

  it("names invisible characters and common letters", () => {
    expect(charName(0x200b)).toBe("ZERO WIDTH SPACE");
    expect(charName(0x202e)).toBe("RIGHT-TO-LEFT OVERRIDE");
    expect(charName(0x41)).toBe("LATIN CAPITAL LETTER A");
    expect(charName(0x37)).toBe("DIGIT SEVEN");
    expect(charName(0xfe0f)).toBe("VARIATION SELECTOR-16");
    expect(charName(0xe0067)).toBe("TAG LATIN SMALL LETTER G");
    expect(charName(0x4e2d)).toBe("");
  });

  it("detects scripts and categories", () => {
    expect(script("Ж")).toBe("Cyrillic");
    expect(script("中")).toBe("Han");
    expect(script("1")).toBe("Common");
    expect(category("\u00A0")).toBe("Zs");
    expect(category("\u200B")).toBe("Cf");
    expect(category("͸")).toBe("Cn");
  });

  it("flags invisible, bidi and special-space characters", () => {
    const s = summarize("a\u200Bb\u202Ec\u00A0d\u00AD\u0007\t\n");
    expect(s.flagged).toEqual({ bidi: 1, "zero-width": 1, invisible: 1, space: 1, control: 1 });
    expect(s.codePoints).toBe(11);
  });

  it("removes invisible characters but keeps emoji sequences", () => {
    expect(removeInvisible("pass\u200Bword\u202E!\u2060")).toBe("password!");
    const family = "👨\u200D👩\u200D👧";
    const flag = "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
    expect(removeInvisible(`${family} ❤\uFE0F ${flag}\u200B`)).toBe(`${family} ❤\uFE0F ${flag}`);
    expect(removeInvisible("line\nnext\ttab")).toBe("line\nnext\ttab");
  });

  it("turns special spaces into plain spaces", () => {
    expect(normalizeSpaces("1\u00A0000\u202F€\u2028x")).toBe("1 000 €\nx");
  });

  it("does not flag the joiners and selectors of emoji", () => {
    expect(summarize("\u{1F468}\u200D\u{1F469} \u2764\uFE0F").flagged["zero-width"]).toBe(0);
    expect(inspect("a\u200Db").map((r) => r.flag)).toEqual([null, "zero-width", null]);
  });

  it("counts units, bytes and graphemes", () => {
    expect(summarize("e\u0301😀")).toMatchObject({
      codePoints: 3,
      graphemes: 2,
      utf16: 4,
      utf8: 7,
    });
  });
});
