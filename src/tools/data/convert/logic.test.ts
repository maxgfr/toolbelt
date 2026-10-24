import { describe, expect, it } from "bun:test";
import { detect, parseAs, parseInput, write } from "./logic";

describe("convert", () => {
  it("detects the input format", () => {
    expect(detect('{"a": 1}')).toBe("json");
    expect(detect("[1, 2]")).toBe("json");
    expect(detect("# comment\n[server]\nport = 8080")).toBe("toml");
    expect(detect('title = "x"')).toBe("toml");
    expect(detect("a: 1\nb: [1, 2]")).toBe("yaml");
    expect(detect("- a\n- b")).toBe("yaml");
    expect(detect("[a, b]\n")).toBe("yaml");
  });

  it("converts JSON to YAML and TOML", () => {
    const p = parseInput('{"name": "é", "server": {"port": 8080, "tags": ["a", "b"]}}', "auto");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(write(p.value, "yaml")).toEqual({
      ok: true,
      text: "name: é\nserver:\n  port: 8080\n  tags:\n    - a\n    - b\n",
    });
    const toml = write(p.value, "toml");
    expect(toml.ok && toml.text).toContain("[server]\nport = 8080");
  });

  it("converts TOML (with dates) to JSON", () => {
    const p = parseAs("[owner]\nborn = 1979-05-27\n", "toml");
    expect(p.ok && write(p.value, "json", "2")).toEqual({
      ok: true,
      text: '{\n  "owner": {\n    "born": "1979-05-27"\n  }\n}',
    });
  });

  it("reads several YAML documents as an array", () => {
    const p = parseAs("a: 1\n---\nb: 2\n", "yaml");
    expect(p.ok && p.value).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("reports errors with a line and column", () => {
    const y = parseAs("a: 1\nb: [1, 2\nc: 3", "yaml");
    expect(y.ok).toBe(false);
    if (!y.ok) expect(y.line).toBeGreaterThan(1);
    const t = parseAs("a = 1\nb = [1,\nc = 3", "toml");
    expect(t.ok).toBe(false);
    if (!t.ok) {
      expect(t.line).toBe(3);
      expect(t.message).not.toContain("\n");
    }
    const j = parseAs('{\n  "a": 1,\n}', "json");
    expect(!j.ok && j.line).toBe(3);
  });

  it("refuses what TOML cannot hold", () => {
    expect(write([1, 2], "toml")).toEqual({ ok: false, error: "root" });
    expect(write("x", "toml")).toEqual({ ok: false, error: "root" });
    const w = write({ a: null, b: 1 }, "toml");
    expect(w.ok && w.warning).toBe("nulls");
  });

  it("honours the indentation", () => {
    expect(write({ a: { b: 1 } }, "yaml", "4")).toEqual({ ok: true, text: "a:\n    b: 1\n" });
    expect(write({ a: 1 }, "json", "4")).toEqual({ ok: true, text: '{\n    "a": 1\n}' });
  });
});

describe("convert edge cases", () => {
  it("refuses alias bombs instead of hanging or throwing", () => {
    const bomb = [
      "a: &a [x, x, x, x, x, x, x, x, x]",
      "b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]",
      "c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]",
      "d: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c]",
      "e: [*d, *d, *d, *d, *d, *d, *d, *d, *d]",
    ].join("\n");
    expect(parseAs(bomb, "yaml").ok).toBe(false);
  });
});
