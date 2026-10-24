import { describe, expect, it } from "bun:test";
import { formatJson, jsonInfo, parseJson, position } from "./logic";

describe("json", () => {
  it("parses valid JSON", () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("reports where invalid JSON breaks", () => {
    const r = parseJson('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(3);
  });

  it("maps offsets to lines and columns", () => {
    expect(position("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });

  it("formats, minifies and sorts keys", () => {
    const v = { b: 1, a: [1, { d: 1, c: 2 }] };
    expect(formatJson(v, "min", true)).toBe('{"a":[1,{"c":2,"d":1}],"b":1}');
    expect(formatJson({ a: 1 }, "2")).toBe('{\n  "a": 1\n}');
    expect(formatJson({ a: 1 }, "tab")).toBe('{\n\t"a": 1\n}');
  });

  it("measures structure", () => {
    expect(jsonInfo({ a: [1, 2], b: { c: 1 } })).toEqual({
      keys: 3,
      depth: 2,
      arrays: 1,
      objects: 2,
    });
  });
});
