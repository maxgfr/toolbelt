import { describe, expect, it } from "bun:test";
import { detectDelimiter, extract, parse, parseSpec, resolveSpec, toSpec } from "./logic";

const O = { trim: false, quote: true };

describe("columns", () => {
  it("parses CSV with quotes, doubled quotes and newlines in fields", () => {
    expect(parse('a,"b,c","say ""hi"""\n1,"two\nlines",3\n', ",", true)).toEqual([
      ["a", "b,c", 'say "hi"'],
      ["1", "two\nlines", "3"],
    ]);
    expect(parse('a,"b,c"', ",", false)).toEqual([["a", '"b', 'c"']]);
    expect(parse("", ",", true)).toEqual([]);
  });

  it("splits on runs of spaces, ignoring edge spaces", () => {
    expect(parse("  PID   CMD  \n  12   bash\n", "spaces", true)).toEqual([
      ["PID", "CMD"],
      ["12", "bash"],
    ]);
  });

  it("supports multi-character delimiters and empty fields", () => {
    expect(parse("a::b::::c", "::", true)).toEqual([["a", "b", "", "c"]]);
    expect(parse("a,,c,", ",", true)).toEqual([["a", "", "c", ""]]);
  });

  it("detects the delimiter", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("tab");
    expect(detectDelimiter("a;b;c\n1;2,5;3")).toBe("semicolon");
    expect(detectDelimiter('name,city\n"Doe; John",Paris')).toBe("comma");
    expect(detectDelimiter("a | b\n1 | 2")).toBe("pipe");
    expect(detectDelimiter("total 12\nfoo bar")).toBe("spaces");
  });

  it("reads column specs", () => {
    const s = parseSpec("1, 3-4, 6-");
    expect(s.ok && resolveSpec(s.items, 7)).toEqual([0, 2, 3, 5, 6]);
    const r = parseSpec("4-2,-2");
    expect(r.ok && resolveSpec(r.items, 5)).toEqual([3, 2, 1, 0, 1]);
    const all = parseSpec("");
    expect(all.ok && resolveSpec(all.items, 3)).toEqual([0, 1, 2]);
    expect(parseSpec("1,x")).toEqual({ ok: false, token: "x" });
    expect(parseSpec("0")).toEqual({ ok: false, token: "0" });
  });

  it("writes specs back compactly", () => {
    expect(toSpec([0, 2, 3, 4, 6, 7])).toBe("1,3-5,7,8");
    expect(toSpec([])).toBe("");
  });

  it("extracts columns, quoting only where needed", () => {
    const rows = parse('id,name,city\n1,"Doe, John",Paris', ",", true);
    expect(extract(rows, [1, 0], ",", O)).toBe('name,id\n"Doe, John",1');
    expect(extract(rows, [1, 5], "\t", O)).toBe("name\t\nDoe, John\t");
    expect(extract([[" a "]], [0], ",", { trim: true, quote: true })).toBe("a");
  });
});
