import { describe, expect, it } from "bun:test";
import {
  entries,
  expandAll,
  getAt,
  jsonPointer,
  pathKey,
  scalarText,
  search,
  size,
  splitMatches,
  treeStats,
  typeOf,
} from "./logic";

const doc = {
  store: {
    book: [
      { title: "Sayings", price: 8.95, tags: ["wisdom"] },
      { title: "Moby Dick", price: 8.99, isbn: null },
    ],
    "a/b~c": true,
  },
};

describe("json-tree", () => {
  it("knows node types, sizes and children", () => {
    expect(typeOf(null)).toBe("null");
    expect(typeOf([])).toBe("array");
    expect(typeOf({})).toBe("object");
    expect(typeOf("x")).toBe("string");
    expect(typeOf(1)).toBe("number");
    expect(typeOf(false)).toBe("boolean");
    expect(size(doc.store.book)).toBe(2);
    expect(size(doc.store)).toBe(2);
    expect(size("abc")).toBe(0);
    expect(entries(["a"])).toEqual([[0, "a"]]);
    expect(entries(3)).toEqual([]);
  });

  it("builds pointers and reads values by path", () => {
    expect(jsonPointer(["store", "a/b~c"])).toBe("/store/a~1b~0c");
    expect(jsonPointer([])).toBe("");
    expect(getAt(doc, ["store", "book", 1, "title"])).toBe("Moby Dick");
    expect(getAt(doc, ["store", "nope"])).toBeUndefined();
    expect(getAt(doc, ["store", "book", "0"])).toBeUndefined();
    expect(getAt({}, ["__proto__"])).toBeUndefined();
  });

  it("shows scalars", () => {
    expect(scalarText("a\nb")).toBe('"a\\nb"');
    expect(scalarText(null)).toBe("null");
    expect(scalarText("x".repeat(10), 5)).toBe('"xxx…');
  });

  it("finds matches in keys and values, case-insensitively, with their ancestors", () => {
    const r = search(doc, "MOBY");
    expect([...r.hits]).toEqual([pathKey(["store", "book", 1, "title"])]);
    expect(r.ancestors).toEqual(
      new Set([
        pathKey(["store", "book", 1]),
        pathKey(["store", "book"]),
        pathKey(["store"]),
        pathKey([]),
      ]),
    );
    const k = search(doc, "price");
    expect(k.count).toBe(2);
    expect(search(doc, "null").hits.has(pathKey(["store", "book", 1, "isbn"]))).toBe(true);
    expect(search(doc, "8.9").count).toBe(2);
    expect(search(doc, "  ").count).toBe(0);
    expect(search(doc, "zzz").ancestors.size).toBe(0);
  });

  it("caps the number of matches", () => {
    const big = Array.from({ length: 100 }, (_, i) => `item ${i}`);
    const r = search(big, "item", 10);
    expect(r.count).toBe(10);
    expect(r.capped).toBe(true);
  });

  it("expands breadth first within a budget", () => {
    expect(expandAll(doc)).toEqual(
      new Set([
        pathKey([]),
        pathKey(["store"]),
        pathKey(["store", "book"]),
        pathKey(["store", "book", 0]),
        pathKey(["store", "book", 1]),
        pathKey(["store", "book", 0, "tags"]),
      ]),
    );
    const wide = { a: Array.from({ length: 50 }, (_, i) => ({ i })), b: [1] };
    const open = expandAll(wide, 20);
    expect(open.has(pathKey([]))).toBe(true);
    expect(open.has(pathKey(["a"]))).toBe(false);
    expect(open.has(pathKey(["b"]))).toBe(true);
    expect(expandAll("x").size).toBe(0);
    // The root always opens, even past the budget.
    expect(
      expandAll(
        Array.from({ length: 10 }, () => 1),
        2,
      ).has(pathKey([])),
    ).toBe(true);
  });

  it("splits text around matches", () => {
    expect(splitMatches("Moby Dick moby", "moby")).toEqual(["", "Moby", " Dick ", "moby", ""]);
    expect(splitMatches("abc", "")).toEqual(["abc"]);
    expect(splitMatches("abc", "x")).toEqual(["abc"]);
    expect(splitMatches("İstanbul", "stan")).toEqual(["İstanbul"]);
  });

  it("counts nodes and depth", () => {
    expect(treeStats(doc)).toEqual({ nodes: 13, depth: 5 });
    expect(treeStats(1)).toEqual({ nodes: 1, depth: 0 });
  });
});
