import { describe, expect, it } from "bun:test";
import {
  displayWidth,
  exportGrid,
  parseMarkdownTable,
  readTabular,
  splitRow,
  toMarkdown,
} from "./logic";

describe("markdown-table", () => {
  it("builds a padded, aligned table", () => {
    const g = { header: ["Name", "Qty", "Note"], rows: [["Apple", "3", "a|b"]] };
    expect(toMarkdown(g, ["left", "right", "center"], true)).toBe(
      ["| Name  | Qty | Note |", "| :---- | --: | :--: |", "| Apple |   3 | a\\|b |"].join("\n"),
    );
    expect(toMarkdown(g, [], false)).toBe(
      "| Name | Qty | Note |\n| --- | --- | --- |\n| Apple | 3 | a\\|b |",
    );
  });

  it("measures wide characters", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("日本")).toBe(4);
    expect(displayWidth("e\u0301")).toBe(1);
    expect(displayWidth("👍🏽")).toBe(2);
    const md = toMarkdown({ header: ["k"], rows: [["日本"]] }, [], true);
    expect(md.split("\n")[2]).toBe("| 日本 |");
  });

  it("reads CSV, TSV and JSON arrays", () => {
    const c = readTabular("a\tb\n1\t2");
    expect(c).toEqual({
      ok: true,
      grid: { header: ["a", "b"], rows: [["1", "2"]] },
      source: "csv",
    });
    const j = readTabular('[{"a": 1, "b": {"c": true}}]');
    expect(j.ok && j.grid).toEqual({ header: ["a", "b.c"], rows: [["1", "true"]] });
    expect(readTabular("42").ok).toBe(true);
    expect(readTabular("[1,").ok).toBe(false);
    expect(readTabular('"x"')).toMatchObject({ ok: true });
  });

  it("parses a Markdown table back, with alignment and escapes", () => {
    const md = [
      "Some text",
      "",
      "| Name | Qty | Note |",
      "|:-----|----:|:----:|",
      "| Apple | 3 | a\\|b |",
      "| Pear | | two<br>lines | extra |",
      "",
      "after",
    ].join("\n");
    const t = parseMarkdownTable(md);
    expect(t).toEqual({
      ok: true,
      aligns: ["left", "right", "center"],
      grid: {
        header: ["Name", "Qty", "Note"],
        rows: [
          ["Apple", "3", "a|b"],
          ["Pear", "", "two\nlines"],
        ],
      },
    });
    if (t.ok)
      expect(exportGrid(t.grid, "csv")).toBe('Name,Qty,Note\nApple,3,a|b\nPear,,"two\nlines"');
  });

  it("accepts tables without outer pipes and refuses non-tables", () => {
    const t = parseMarkdownTable("a | b\n--- | ---\n1 | 2");
    expect(t.ok && t.grid.rows).toEqual([["1", "2"]]);
    expect(parseMarkdownTable("").ok).toBe(false);
    expect(parseMarkdownTable("just | text\nno separator").ok).toBe(false);
    expect(splitRow("| a | b |")).toEqual(["a", "b"]);
  });

  it("round-trips through Markdown", () => {
    const g = {
      header: ["x", "y"],
      rows: [
        ["1", "multi\nline"],
        ["é", "|"],
      ],
    };
    const back = parseMarkdownTable(toMarkdown(g, ["none", "right"], true));
    expect(back.ok && back.grid).toEqual(g);
    expect(back.ok && back.aligns).toEqual(["none", "right"]);
    expect(exportGrid(g, "json")).toBe(
      JSON.stringify(
        [
          { x: "1", y: "multi\nline" },
          { x: "é", y: "|" },
        ],
        null,
        2,
      ),
    );
  });
});
