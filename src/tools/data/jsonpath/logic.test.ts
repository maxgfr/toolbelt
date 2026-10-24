import { describe, expect, it } from "bun:test";
import { formatPath } from "../_shared";
import { query, SAMPLE } from "./logic";

function values(q: string, doc: unknown = SAMPLE): unknown[] {
  const r = query(doc, q);
  if (!r.ok) throw new Error(`${r.error.code} at ${r.error.pos}`);
  return r.nodes.map((n) => n.value);
}

function paths(q: string, doc: unknown = SAMPLE): string[] {
  const r = query(doc, q);
  return r.ok ? r.nodes.map((n) => formatPath(n.path)) : [];
}

describe("jsonpath", () => {
  it("selects children, by name and index", () => {
    expect(values("$.store.bicycle.color")).toEqual(["red"]);
    expect(values("$['store']['bicycle']['price']")).toEqual([399]);
    expect(values('$.store.book[0]["title"]')).toEqual(["Sayings of the Century"]);
    expect(values("$.store.book[-1].author")).toEqual(["J. R. R. Tolkien"]);
    expect(values("$.store.book[9]")).toEqual([]);
    expect(values("$")).toEqual([SAMPLE]);
  });

  it("supports wildcards, unions and recursive descent", () => {
    expect(values("$.store.book[*].author")).toHaveLength(4);
    expect(values("$..author")).toHaveLength(4);
    expect(paths("$.store.*")).toEqual(["$.store.book", "$.store.bicycle"]);
    expect(values("$.store..price")).toEqual([8.95, 12.99, 8.99, 22.99, 399]);
    expect(values("$.store.book[0,2].price")).toEqual([8.95, 8.99]);
    expect(paths("$..[0]")).toEqual(["$.store.book[0]"]);
  });

  it("slices like Python", () => {
    const a = [0, 1, 2, 3, 4, 5];
    expect(values("$[1:3]", a)).toEqual([1, 2]);
    expect(values("$[:2]", a)).toEqual([0, 1]);
    expect(values("$[-2:]", a)).toEqual([4, 5]);
    expect(values("$[::2]", a)).toEqual([0, 2, 4]);
    expect(values("$[::-1]", a)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(values("$[4:1:-2]", a)).toEqual([4, 2]);
    expect(values("$[0:10:0]", a)).toEqual([]);
  });

  it("filters with comparisons, existence and logic", () => {
    expect(values("$..book[?(@.isbn)].title")).toEqual(["Moby Dick", "The Lord of the Rings"]);
    expect(values("$..book[?(@.price < 10)].price")).toEqual([8.95, 8.99]);
    expect(values("$..book[?(@.category == 'fiction' && @.price > 10)].title")).toEqual([
      "Sword of Honour",
      "The Lord of the Rings",
    ]);
    expect(values('$..book[?@.price >= 22.99 || @.author == "Nigel Rees"].price')).toEqual([
      8.95, 22.99,
    ]);
    expect(values("$..book[?(!@.isbn)].price")).toEqual([8.95, 12.99]);
    expect(values("$..book[?(@.price < $.store.bicycle.price && @.price > 20)].price")).toEqual([
      22.99,
    ]);
    expect(values("$[?(@ == null)]", [1, null, "a"])).toEqual([null]);
    expect(values("$[?(@.a === 1)]", [{ a: 1 }, { a: "1" }])).toEqual([{ a: 1 }]);
    // Comparing a string with a number is never true.
    expect(values("$[?(@ < 'b')]", [1, "a", "c"])).toEqual(["a"]);
  });

  it("formats paths with quoting when needed", () => {
    expect(paths("$.*", { "a b": 1, "it's": 2, é: 3 })).toEqual([
      "$['a b']",
      "$['it\\'s']",
      "$['é']",
    ]);
    expect(values("$.é", { é: 3 })).toEqual([3]);
  });

  it("reports syntax errors with a position", () => {
    expect(query(SAMPLE, "store")).toEqual({ ok: false, error: { code: "root", pos: 0 } });
    expect(query(SAMPLE, "  ")).toEqual({ ok: false, error: { code: "empty", pos: 2 } });
    expect(query(SAMPLE, "$.store[0")).toEqual({
      ok: false,
      error: { code: "expected", pos: 9, expected: "]" },
    });
    expect(query(SAMPLE, "$['abc")).toEqual({ ok: false, error: { code: "unterminated", pos: 2 } });
    expect(query(SAMPLE, "$.store x").ok).toBe(false);
    expect(query(SAMPLE, "$[?(@.a + 1)]").ok).toBe(false);
    expect(query(SAMPLE, "$.").ok).toBe(false);
  });
});
