import { describe, expect, it } from "bun:test";
import { foldRows, inlineDiff, lineRows, summarize, unifiedPatch } from "./logic";

const O = { ignoreWhitespace: false, ignoreCase: false };

describe("diff", () => {
  it("pairs changed lines and numbers both sides", () => {
    const rows = lineRows("a\nb\nc\n", "a\nB\nc\nd\n", O);
    expect(rows.map((r) => r.kind)).toEqual(["same", "change", "same", "add"]);
    expect(rows[3]?.right?.num).toBe(4);
    expect(summarize(rows)).toEqual({ added: 1, removed: 0, changed: 1, same: 2 });
  });

  it("highlights the changed word inside a changed line", () => {
    const rows = lineRows("the quick fox", "the slow fox", O);
    const right = rows[0]?.right?.pieces ?? [];
    expect(right.filter((p) => p.changed).map((p) => p.text)).toEqual(["slow"]);
  });

  it("can ignore case and whitespace", () => {
    expect(summarize(lineRows("Hello  world", "hello world ", O)).changed).toBe(1);
    const loose = { ignoreWhitespace: true, ignoreCase: true };
    expect(summarize(lineRows("Hello  world", "hello world ", loose)).same).toBe(1);
  });

  it("handles one empty side", () => {
    expect(lineRows("", "x\ny", O).map((r) => r.kind)).toEqual(["add", "add"]);
    expect(lineRows("x", "", O).map((r) => r.kind)).toEqual(["del"]);
  });

  it("folds long unchanged runs", () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n");
    const b = a.replace("l10", "X");
    const folded = foldRows(lineRows(a, b, O), 2);
    expect(folded[0]).toEqual({ kind: "fold", count: 8 });
    expect(folded.at(-1)).toEqual({ kind: "fold", count: 7 });
  });

  it("diffs words inline", () => {
    expect(inlineDiff("a b", "a c", "word", O).filter((p) => p.kind !== "same")).toEqual([
      { text: "b", kind: "del" },
      { text: "c", kind: "add" },
    ]);
  });

  it("writes a unified patch", () => {
    const p = unifiedPatch("a\nb\n", "a\nc\n", "old.txt", "new.txt");
    expect(p).toContain("--- old.txt");
    expect(p).toContain("-b\n+c");
  });
});
