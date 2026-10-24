import { describe, expect, it } from "bun:test";
import { escapeAs, FORMATS, type Format, unescapeAs } from "./logic";

const O = { asciiOnly: false };

function un(f: Format, s: string): string {
  const r = unescapeAs(f, s);
  if (!r.ok) throw new Error(r.detail);
  return r.value;
}

describe("escape", () => {
  it("round-trips every format, Unicode included", () => {
    const samples = [
      "",
      "plain",
      'He said "hi" & left',
      "it's\na\ttab \\ back",
      "Café 😀 <b>",
      "$x `y` $" + "{z}",
    ];
    for (const f of FORMATS) for (const s of samples) expect(un(f, escapeAs(f, s, O))).toBe(s);
  });

  it("escapes JSON and JavaScript strings", () => {
    expect(escapeAs("json", 'a"b\n\u0001', O)).toBe('a\\"b\\n\\u0001');
    expect(escapeAs("js", 'it\'s "x"\n\u2028', O)).toBe('it\\\'s \\"x\\"\\n\\u2028');
    expect(escapeAs("js", "é😀", { asciiOnly: true })).toBe("\\u00E9\\u{1F600}");
    expect(escapeAs("js", "\u00001", O)).toBe("\\x001");
  });

  it("unescapes JSON and JavaScript with or without quotes", () => {
    expect(un("json", '"caf\\u00e9"')).toBe("café");
    expect(un("js", "'\\x41\\u{1F600}\\u00e9\\q'")).toBe("A😀éq");
    expect(unescapeAs("json", "\\x").ok).toBe(false);
    expect(unescapeAs("js", "\\u12").ok).toBe(false);
  });

  it("escapes and unescapes HTML and XML entities", () => {
    expect(escapeAs("html", `<a href="x">'&'</a>`, O)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
    expect(escapeAs("xml", "'", O)).toBe("&apos;");
    expect(escapeAs("html", "é😀", { asciiOnly: true })).toBe("&#233;&#128512;");
    expect(un("html", "&eacute;&nbsp;&hellip;&#x1F600;&#233;&unknown;&amp;lt;")).toBe(
      "é\u00A0…😀é&unknown;&lt;",
    );
    expect(un("xml", "&lt;&eacute;")).toBe("<&eacute;");
  });

  it("handles SQL, CSV, regex and shell", () => {
    expect(escapeAs("sql", "O'Brien", O)).toBe("O''Brien");
    expect(un("sql", "'O''Brien'")).toBe("O'Brien");
    expect(escapeAs("csv", "plain", O)).toBe("plain");
    expect(escapeAs("csv", 'a,"b"', O)).toBe('"a,""b"""');
    expect(unescapeAs("csv", '"a"b"').ok).toBe(false);
    expect(escapeAs("regex", "1.5*(2+3)?", O)).toBe("1\\.5\\*\\(2\\+3\\)\\?");
    expect(escapeAs("shell", "it's", O)).toBe("'it'\\''s'");
    expect(un("shell", `'a b'"c \\"d\\""\\ e`)).toBe('a bc "d" e');
    expect(unescapeAs("shell", "'open").ok).toBe(false);
  });
});
