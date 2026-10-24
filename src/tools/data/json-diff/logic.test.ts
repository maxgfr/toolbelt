import { describe, expect, it } from "bun:test";
import { canonical, count, diffJson, report } from "./logic";

const byIndex = { ignoreArrayOrder: false };
const anyOrder = { ignoreArrayOrder: true };

describe("json-diff", () => {
  it("finds nothing between equal documents, whatever the key order", () => {
    expect(diffJson({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 }, byIndex)).toEqual([]);
    expect(diffJson(null, null, byIndex)).toEqual([]);
  });

  it("reports added, removed and changed paths", () => {
    const changes = diffJson(
      { name: "a", age: 30, tags: ["x", "y"], meta: { v: 1 } },
      { name: "b", tags: ["x"], meta: { v: 1, w: true }, extra: null },
      byIndex,
    );
    expect(changes).toEqual([
      { kind: "changed", path: ["name"], old: "a", new: "b" },
      { kind: "removed", path: ["age"], old: 30 },
      { kind: "removed", path: ["tags", 1], old: "y" },
      { kind: "added", path: ["meta", "w"], new: true },
      { kind: "added", path: ["extra"], new: null },
    ]);
    expect(count(changes)).toEqual({ added: 2, removed: 2, changed: 1 });
  });

  it("treats a type change as a change of the whole value", () => {
    expect(diffJson({ a: [1] }, { a: { 0: 1 } }, byIndex)).toEqual([
      { kind: "changed", path: ["a"], old: [1], new: { 0: 1 } },
    ]);
    expect(diffJson(1, "1", byIndex)).toEqual([{ kind: "changed", path: [], old: 1, new: "1" }]);
  });

  it("can ignore array order, at every depth", () => {
    const a = { list: [{ id: 1, t: ["a", "b"] }, { id: 2 }, 3, 3] };
    const b = { list: [3, { id: 2 }, { t: ["b", "a"], id: 1 }, 3] };
    expect(diffJson(a, b, anyOrder)).toEqual([]);
    expect(diffJson(a, b, byIndex).length).toBeGreaterThan(0);
    expect(diffJson([1, 2, 2], [2, 1, 4], anyOrder)).toEqual([
      { kind: "removed", path: [2], old: 2 },
      { kind: "added", path: [2], new: 4 },
    ]);
  });

  it("writes a readable report", () => {
    const r = report(diffJson({ "a b": 1, x: [1] }, { "a b": 2, x: [] }, byIndex));
    expect(r).toBe("~ $['a b']: 1 → 2\n- $.x[0]: 1");
  });

  it("canonicalizes values", () => {
    expect(canonical({ b: 1, a: [{ d: 1, c: "é" }] })).toBe('{"a":[{"c":"é","d":1}],"b":1}');
  });
});
