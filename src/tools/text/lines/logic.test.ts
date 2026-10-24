import { describe, expect, it } from "bun:test";
import { DEFAULTS, dedupe, processLines, shuffle, sortLines } from "./logic";

describe("lines", () => {
  it("returns nothing for empty input and ignores one trailing newline", () => {
    expect(processLines("", DEFAULTS)).toEqual([]);
    expect(processLines("a\nb\n", DEFAULTS)).toEqual(["a", "b"]);
  });

  it("sorts alphabetically, naturally and by length", () => {
    const l = ["item10", "Item2", "item1", "éclair", "zebra"];
    expect(sortLines(l, "az", true, "en")).toEqual(["éclair", "item1", "item10", "Item2", "zebra"]);
    expect(sortLines(l, "natural", true, "en")).toEqual([
      "éclair",
      "item1",
      "Item2",
      "item10",
      "zebra",
    ]);
    expect(sortLines(l, "za", true, "en")[0]).toBe("zebra");
    expect(sortLines(["cccc", "👍🏽👍🏽👍🏽", "a"], "length", true, "en")).toEqual([
      "a",
      "👍🏽👍🏽👍🏽",
      "cccc",
    ]);
  });

  it("dedupes with or without case", () => {
    expect(dedupe(["a", "A", "b", "a"], false)).toEqual(["a", "A", "b"]);
    expect(dedupe(["a", "A", "b", "a"], true)).toEqual(["a", "b"]);
  });

  it("shuffles deterministically and keeps every line", () => {
    const l = ["1", "2", "3", "4", "5", "6"];
    expect(shuffle(l, 42)).toEqual(shuffle(l, 42));
    expect([...shuffle(l, 7)].sort()).toEqual(l);
  });

  it("composes trim, empty removal, dedupe, sort, numbering and affixes", () => {
    const out = processLines("  pear\n\napple \npear\nfig", {
      ...DEFAULTS,
      trim: true,
      removeEmpty: true,
      dedupe: true,
      sort: "az",
      number: true,
      prefix: "[",
      suffix: "]",
    });
    expect(out).toEqual(["[1. apple]", "[2. fig]", "[3. pear]"]);
  });

  it("right-aligns numbers and reverses", () => {
    const text = Array.from({ length: 10 }, (_, i) => `l${i}`).join("\n");
    const out = processLines(text, { ...DEFAULTS, reverse: true, number: true, numberSep: ": " });
    expect(out[0]).toBe(" 1: l9");
    expect(out[9]).toBe("10: l0");
  });
});
