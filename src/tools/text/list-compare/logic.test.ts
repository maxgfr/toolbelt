import { describe, expect, it } from "bun:test";
import { type CompareOptions, compareLists, items } from "./logic";

const O: CompareOptions = { trim: true, ignoreCase: false, splitCommas: false, sort: false };

describe("list-compare", () => {
  it("splits A and B into only-A, only-B, both and union", () => {
    const r = compareLists("apple\nbanana\ncherry", "cherry\ndate\napple", O);
    expect(r.onlyA).toEqual(["banana"]);
    expect(r.onlyB).toEqual(["date"]);
    expect(r.both).toEqual(["apple", "cherry"]);
    expect(r.union).toEqual(["apple", "banana", "cherry", "date"]);
  });

  it("dedupes, trims and skips empty lines", () => {
    const r = compareLists(" a \n\na\nb", "b\nb", O);
    expect(r.a).toEqual(["a", "b"]);
    expect(r.b).toEqual(["b"]);
    expect(items(" x \n", { ...O, trim: false })).toEqual([" x "]);
  });

  it("compares case-insensitively, keeping the first spelling", () => {
    const r = compareLists("Paris\nLyon", "paris\nNICE", { ...O, ignoreCase: true });
    expect(r.both).toEqual(["Paris"]);
    expect(r.onlyB).toEqual(["NICE"]);
    expect(compareLists("Paris", "paris", O).both).toEqual([]);
  });

  it("splits on commas and sorts naturally on request", () => {
    const r = compareLists("item10, item2; item1", "item2", {
      ...O,
      splitCommas: true,
      sort: true,
    });
    expect(r.onlyA).toEqual(["item1", "item10"]);
    expect(r.union).toEqual(["item1", "item2", "item10"]);
  });

  it("handles empty lists and Unicode", () => {
    const r = compareLists("", "é\n😀", O);
    expect(r.onlyA).toEqual([]);
    expect(r.onlyB).toEqual(["é", "😀"]);
    expect(compareLists("Éa", "éa", { ...O, ignoreCase: true }).both).toEqual(["Éa"]);
  });
});
