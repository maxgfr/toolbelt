import { describe, expect, it } from "bun:test";
import { findReplace, linesTouched, type ReplaceOptions } from "./logic";

const PLAIN: ReplaceOptions = { regex: false, flags: "g", wholeWord: false, escapes: false };
const RE: ReplaceOptions = { regex: true, flags: "g", wholeWord: false, escapes: false };

function out(r: ReturnType<typeof findReplace>): string {
  if (!r.ok) throw new Error(r.message);
  return r.output;
}

describe("replace", () => {
  it("replaces plain text literally, special characters included", () => {
    const r = findReplace("a.b.c", ".", "$&!", PLAIN);
    expect(out(r)).toBe("a$&!b$&!c");
    if (r.ok) expect(r.hits.length).toBe(2);
  });

  it("is case-insensitive and whole-word on request", () => {
    expect(out(findReplace("Cat cat category", "cat", "dog", { ...PLAIN, flags: "gi" }))).toBe(
      "dog dog dogegory",
    );
    expect(
      out(
        findReplace("Cat cat catégorie", "cat", "dog", { ...PLAIN, flags: "gi", wholeWord: true }),
      ),
    ).toBe("dog dog catégorie");
    expect(out(findReplace("a-b a-bc", "a-b", "x", { ...PLAIN, wholeWord: true }))).toBe("x a-bc");
  });

  it("replaces only the first match without g", () => {
    expect(out(findReplace("aaa", "a", "b", { ...PLAIN, flags: "" }))).toBe("baa");
  });

  it("expands groups like String.replace", () => {
    const cases: [string, string, string][] = [
      ["2024-01-31", "(\\d+)-(\\d+)-(\\d+)", "$3/$2/$1"],
      ["john smith", "(?<first>\\w+) (?<last>\\w+)", "$<last>, $<first>"],
      ["abc", "b", "[$`|$&|$'|$$]"],
      ["abc", "(b)", "$2$1$10"],
    ];
    for (const [text, find, rep] of cases)
      expect(out(findReplace(text, find, rep, RE))).toBe(text.replace(new RegExp(find, "g"), rep));
  });

  it("handles empty matches and astral characters", () => {
    expect(out(findReplace("ab", "", "-", RE))).toBe("ab");
    expect(out(findReplace("ab", "(?:)", "-", RE))).toBe("-a-b-");
    expect(out(findReplace("😀x😀", "(?:)", "|", { ...RE, flags: "gu" }))).toBe("|😀|x|😀|");
  });

  it("reads escapes when asked", () => {
    expect(out(findReplace("a,b", ",", "\\n", { ...PLAIN, escapes: true }))).toBe("a\nb");
    expect(out(findReplace("a\tb", "\\t", ";", { ...PLAIN, escapes: true }))).toBe("a;b");
  });

  it("counts the lines that contain a match", () => {
    const r = findReplace("a a\nb\na", "a", "", PLAIN);
    if (r.ok) expect(linesTouched("a a\nb\na", r.hits)).toBe(2);
  });

  it("reports invalid patterns instead of throwing", () => {
    const r = findReplace("x", "(a", "", RE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hint).toBe("group");
  });
});
