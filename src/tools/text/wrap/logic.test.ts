import { describe, expect, it } from "bun:test";
import { longestLine, unwrapText, type WrapOptions, wrapText } from "./logic";

const O: WrapOptions = { width: 20, prefix: "", reflow: true, breakLongWords: false };

describe("wrap", () => {
  it("wraps at word boundaries within the width", () => {
    const out = wrapText("The quick brown fox jumps over the lazy dog.", O);
    expect(out).toBe("The quick brown fox\njumps over the lazy\ndog.");
    expect(longestLine(out)).toBeLessThanOrEqual(20);
  });

  it("reflows paragraph lines and keeps blank lines", () => {
    expect(wrapText("one two\nthree four\n\nfive", { ...O, width: 30 })).toBe(
      "one two three four\n\nfive",
    );
    expect(wrapText("one two\nthree four", { ...O, width: 30, reflow: false })).toBe(
      "one two\nthree four",
    );
  });

  it("adds a prefix that counts in the width", () => {
    expect(wrapText("aaa bbb ccc\n\nddd", { ...O, width: 9, prefix: "> " })).toBe(
      "> aaa bbb\n> ccc\n>\n> ddd",
    );
  });

  it("wraps list items with a hanging indent", () => {
    expect(wrapText("- alpha beta gamma delta\n- two", { ...O, width: 14 })).toBe(
      "- alpha beta\n  gamma delta\n- two",
    );
  });

  it("keeps or breaks long words", () => {
    const url = "https://example.com/a/very/long/path";
    expect(wrapText(`see ${url}`, O)).toBe(`see\n${url}`);
    expect(wrapText("abcdefghij", { ...O, width: 4, breakLongWords: true })).toBe("abcd\nefgh\nij");
  });

  it("counts graphemes, not UTF-16 units", () => {
    expect(wrapText("😀😀 😀😀 😀😀", { ...O, width: 5 })).toBe("😀😀 😀😀\n😀😀");
  });

  it("unwraps paragraphs and strips the quote prefix", () => {
    expect(unwrapText("> one two\n> three\n>\n> four", "> ")).toBe("one two three\n\nfour");
    expect(unwrapText("a\nb\n- c\n  d", "")).toBe("a b\n- c d");
  });

  it("handles empty input", () => {
    expect(wrapText("", O)).toBe("");
    expect(unwrapText("", "> ")).toBe("");
  });
});
