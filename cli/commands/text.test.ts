import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tb } from "../test-utils";

const dir = mkdtempSync(join(tmpdir(), "toolbelt-text-"));
const file = (name: string, content: string) => {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
};

async function ok(argv: string[], stdin?: string) {
  const r = await tb(argv, stdin === undefined ? {} : { stdin });
  expect(r.stderr).toBe("");
  expect(r.code).toBe(0);
  return r.stdout;
}

async function fails(argv: string[], code = 1, stdin?: string) {
  const r = await tb(argv, stdin === undefined ? {} : { stdin });
  expect(r.code).toBe(code);
  expect(r.stderr).toStartWith("error: ");
  return r.stderr;
}

describe("counter", () => {
  it("counts words and characters", async () => {
    const out = await ok(["counter", "Hello world. How are you?"]);
    expect(out).toContain("Words:");
    expect(out).toMatch(/Words:\s+5/);
    expect(out).toMatch(/Sentences:\s+2/);
  });
  it("reads stdin and gives JSON with top words", async () => {
    const out = await ok(["counter", "--top", "1", "--json"], "b a b");
    const j = JSON.parse(out);
    expect(j.words).toBe(3);
    expect(j.topWords[0]).toEqual({ word: "b", count: 2 });
  });
  it("fails without input", async () => {
    expect(await fails(["counter"], 2)).toContain("missing input");
  });
});

describe("diff", () => {
  it("makes a unified patch from two files", async () => {
    const a = file("a.txt", "one\ntwo\n");
    const b = file("b.txt", "one\nthree\n");
    const out = await ok(["diff", a, b]);
    expect(out).toContain("-two");
    expect(out).toContain("+three");
  });
  it("diffs words inline", async () => {
    expect(
      await ok(["diff", "--a", "the quick fox", "--b", "the slow fox", "--format", "words"]),
    ).toBe("the [-quick-]{+slow+} fox\n");
  });
  it("reports identical inputs and --exit-code", async () => {
    expect(await ok(["diff", "--a", "x", "--b", "x"])).toContain("identical");
    const r = await tb(["diff", "--a", "x", "--b", "y", "--exit-code", "--format", "summary"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/Changed lines:\s+1/);
  });
  it("fails with one input or a missing file", async () => {
    expect(await fails(["diff", "--a", "x"], 2)).toContain("two inputs");
    expect(await fails(["diff", join(dir, "nope.txt"), join(dir, "nope2.txt")])).toContain(
      "not found",
    );
  });
});

describe("case", () => {
  it("converts to one case", async () => {
    expect(await ok(["case", "XMLHttpRequest handler", "--to", "snake"])).toBe(
      "xml_http_request_handler\n",
    );
  });
  it("lists every case", async () => {
    const out = await ok(["case", "hello world"]);
    expect(out).toContain("kebab");
    expect(out).toContain("hello-world");
  });
  it("rejects an unknown case", async () => {
    expect(await fails(["case", "x", "--to", "weird"], 2)).toContain("--to must be one of");
  });
});

describe("ascii-art", () => {
  it("draws a framed banner", async () => {
    const out = await ok(["ascii-art", "Hi", "--frame", "--style", "ascii"]);
    expect(out.split("\n")[0]).toMatch(/^\+-+\+$/);
    expect(out).toContain("|_|");
  });
  it("frames plain text", async () => {
    expect(await ok(["ascii-art", "ok", "--no-banner", "--frame", "--style", "ascii"])).toBe(
      "+----+\n| ok |\n+----+\n",
    );
  });
  it("rejects an unknown font and blank text", async () => {
    await fails(["ascii-art", "x", "--font", "comic"], 2);
    expect(await fails(["ascii-art", "   "])).toContain("empty");
  });
});

describe("cipher", () => {
  it("applies ROT13 and Caesar", async () => {
    expect(await ok(["cipher", "Hello"])).toBe("Uryyb\n");
    expect(await ok(["cipher", "Khoor", "--cipher", "caesar", "--shift", "3", "--decode"])).toBe(
      "Hello\n",
    );
    expect(await ok(["rot13", "Uryyb"])).toBe("Hello\n");
  });
  it("brute-forces a Caesar text", async () => {
    const j = JSON.parse(await ok(["cipher", "Wkh fdw vdw rq wkh pdw", "--brute-force", "--json"]));
    expect(j[0]).toMatchObject({ shift: 3, text: "The cat sat on the mat" });
  });
  it("rejects a fractional shift", async () => {
    expect(await fails(["cipher", "x", "--cipher", "caesar", "--shift", "1.5"])).toContain(
      "whole number",
    );
  });
});

describe("columns", () => {
  it("extracts and reorders columns", async () => {
    expect(await ok(["columns", "--columns", "3,1"], "a,b,c\n1,2,3\n")).toBe("c,a\n3,1\n");
  });
  it("splits on spaces and changes the output delimiter", async () => {
    expect(
      await ok(["columns", "-d", "spaces", "-c", "2-", "--out-delimiter", "tab"], "x  y z\n1 2  3"),
    ).toBe("y\tz\n2\t3\n");
  });
  it("rejects a bad spec", async () => {
    expect(await fails(["columns", "--columns", "a-b"], 1, "a,b")).toContain("invalid column spec");
  });
});

describe("emoji", () => {
  it("finds an emoji by name", async () => {
    const out = await ok(["emoji", "rocket", "--limit", "1"]);
    expect(out).toContain("🚀");
    expect(out).toContain("U+1F680");
  });
  it("applies a skin tone and localizes names", async () => {
    const j = JSON.parse(
      await ok(["emoji", "thumbs", "up", "--tone", "2", "--limit", "1", "--json"]),
    );
    expect(j[0].emoji).toBe("👍🏼");
    const fr = JSON.parse(await ok(["emoji", "rocket", "--limit", "1", "--json", "--lang", "fr"]));
    expect(fr[0].name).toBe("fusée");
  });
  it("fails without words and with no match", async () => {
    await fails(["emoji"], 2);
    const r = await tb(["emoji", "zzqqxx"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("No emoji");
    await fails(["emoji", "x", "--tone", "9"], 2);
  });
});

describe("escape", () => {
  it("escapes and unescapes", async () => {
    expect(await ok(["escape", 'He said "hi"'])).toBe('He said \\"hi\\"\n');
    expect(await ok(["escape", "&lt;b&gt;", "--format", "html", "--unescape"])).toBe("<b>\n");
    expect(await ok(["escape", "it's", "--format", "shell"])).toBe("'it'\\''s'\n");
  });
  it("reports an invalid escaped string", async () => {
    expect(await fails(["escape", "abc\\", "--format", "json", "--unescape"])).toContain(
      "invalid JSON string",
    );
  });
});

describe("extract", () => {
  it("extracts several kinds", async () => {
    const out = await ok(["extract", "mail a@b.co or see https://x.org"]);
    expect(out).toContain("email:\n  a@b.co");
    expect(out).toContain("https://x.org");
  });
  it("extracts one kind as a plain list", async () => {
    expect(await ok(["extract", "--kind", "ipv4", "--sort"], "10.0.0.2 then 10.0.0.1")).toBe(
      "10.0.0.1\n10.0.0.2\n",
    );
  });
  it("exits 1 when nothing is found, 2 on a bad kind", async () => {
    const r = await tb(["extract", "nothing here", "--kind", "email"]);
    expect(r.code).toBe(1);
    await fails(["extract", "x", "--kind", "phones"], 2);
  });
});

describe("html-to-markdown", () => {
  it("converts HTML, tables included", async () => {
    const out = await ok([
      "html-to-markdown",
      "<h1>Title</h1><p>Some <b>bold</b></p><table><tr><th>a</th></tr><tr><td>1</td></tr></table>",
    ]);
    expect(out).toContain("# Title");
    expect(out).toContain("**bold**");
    expect(out).toContain("| a |");
  });
  it("uses setext headings", async () => {
    expect(await ok(["html2md", "<h1>T</h1>", "--heading", "setext"])).toContain("T\n=");
  });
  it("fails without input", async () => {
    await fails(["html-to-markdown"], 2);
  });
});

describe("lines", () => {
  it("sorts naturally, dedupes and numbers", async () => {
    expect(
      await ok(["lines", "--sort", "natural", "--dedupe", "--number"], "b\na\nb\n10\n9\n"),
    ).toBe("1. 9\n2. 10\n3. a\n4. b\n");
  });
  it("adds a prefix and suffix", async () => {
    expect(await ok(["lines", "--prefix", "'", "--suffix", "',"], "x\ny")).toBe("'x',\n'y',\n");
  });
  it("rejects an unknown sort", async () => {
    await fails(["lines", "--sort", "random"], 2, "a");
  });
});

describe("list-compare", () => {
  it("compares two inline lists", async () => {
    const out = await ok(["list-compare", "--a", "a\nb\nc", "--b", "b\nc\nd"]);
    expect(out).toContain("Only in A (1):\n  a");
    expect(out).toContain("Only in B (1):\n  d");
  });
  it("compares two files and shows one part", async () => {
    const a = file("la.txt", "x\ny\n");
    const b = file("lb.txt", "Y\nz\n");
    expect(await ok(["list-compare", a, b, "--ignore-case", "--show", "both"])).toBe("y\n");
  });
  it("needs two lists", async () => {
    expect(await fails(["list-compare", "--a", "x"], 2)).toContain("two lists");
  });
});

describe("lorem", () => {
  it("is seeded and starts with Lorem ipsum", async () => {
    const a = await ok(["lorem", "8", "--unit", "words"]);
    expect(a).toStartWith("Lorem ipsum dolor sit amet");
    expect(a.trim().split(" ")).toHaveLength(8);
    expect(await ok(["lorem", "8", "--unit", "words"])).toBe(a);
  });
  it("wraps paragraphs in HTML", async () => {
    expect(await ok(["lorem", "2", "--html"])).toStartWith("<p>Lorem");
  });
  it("rejects a bad count", async () => {
    await fails(["lorem", "abc"], 2);
    expect(await fails(["lorem", "0"])).toContain("between 1 and");
  });
});

describe("markdown", () => {
  it("renders HTML", async () => {
    expect(await ok(["markdown", "# Hi\n\n**bold**"])).toContain("<strong>bold</strong>");
  });
  it("builds a table of contents", async () => {
    expect(await ok(["markdown", "# Hi\n## There", "--toc"])).toBe(
      "- [Hi](#hi)\n  - [There](#there)\n",
    );
  });
  it("exits 1 when there is no heading for --toc", async () => {
    const r = await tb(["markdown", "plain", "--toc"]);
    expect(r.code).toBe(1);
    await fails(["markdown"], 2);
  });
});

describe("morse", () => {
  it("encodes and decodes automatically", async () => {
    expect(await ok(["morse", "SOS"])).toBe("... --- ...\n");
    expect(await ok(["morse", "... --- ..."])).toBe("SOS\n");
  });
  it("fails when nothing can be translated", async () => {
    expect(await fails(["morse", "€"])).toContain("no Morse code");
  });
});

describe("nato", () => {
  it("spells with NATO by default", async () => {
    expect(await ok(["nato", "AB12"])).toBe("Alfa Bravo One Two\n");
  });
  it("follows --lang and prints tables", async () => {
    expect(await ok(["nato", "AB", "--lang", "fr"])).toBe("Anatole Berthe\n");
    expect(await ok(["nato", "--table"])).toContain("Z  Zulu");
  });
  it("rejects an unknown alphabet", async () => {
    await fails(["nato", "x", "--alphabet", "greek"], 2);
  });
});

describe("numeronym", () => {
  it("abbreviates long words", async () => {
    expect(await ok(["numeronym", "internationalization localization"])).toBe("i18n l10n\n");
  });
  it("expands known numeronyms", async () => {
    expect(await ok(["numeronym", "a11y and k8s", "--expand"])).toContain("k8s: kubernetes");
  });
  it("exits 1 when there is nothing to expand, 2 on a bad length", async () => {
    expect((await tb(["numeronym", "hello", "--expand"])).code).toBe(1);
    await fails(["numeronym", "x", "--min-length", "1"], 2);
  });
});

describe("readability", () => {
  it("scores an English text", async () => {
    const out = await ok([
      "readability",
      "The cat sat on the mat. It was a very happy cat, and it purred all day long.",
    ]);
    expect(out).toMatch(/Language:\s+en/);
    expect(out).toContain("Flesch Reading Ease");
  });
  it("gives JSON with every score", async () => {
    const j = JSON.parse(await ok(["readability", "Le chat dort. Il est content.", "--json"]));
    expect(j.language).toBe("fr");
    expect(j.scores.length).toBeGreaterThan(1);
  });
  it("fails on a text without words", async () => {
    expect(await fails(["readability", "... !!!"])).toContain("no words");
  });
});

describe("regex", () => {
  it("lists matches with named groups", async () => {
    const out = await ok(["regex", "(?<n>\\d+)", "order 66 and 42"]);
    expect(out).toContain("2 matches");
    expect(out).toContain('6-8: "66"  n="66"');
  });
  it("reads the text from stdin", async () => {
    const j = JSON.parse(await ok(["regex", "b+", "--json"], "abbbc"));
    expect(j.matches[0].text).toBe("bbb");
  });
  it("exits 1 without a match and on an invalid pattern", async () => {
    const r = await tb(["regex", "z", "abc"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe("No match.\n");
    expect(await fails(["regex", "(", "x"])).toContain("invalid regular expression");
  });
});

describe("replace", () => {
  it("replaces plain text", async () => {
    expect(await ok(["replace", "--find", "foo", "--with", "bar"], "foo foo")).toBe("bar bar\n");
  });
  it("replaces with a regex and groups", async () => {
    expect(
      await ok([
        "replace",
        "2024-05-01",
        "--regex",
        "--find",
        "(\\d+)-(\\d+)-(\\d+)",
        "--with",
        "$3/$2/$1",
      ]),
    ).toBe("01/05/2024\n");
  });
  it("needs --find and a valid regex", async () => {
    await fails(["replace", "x"], 2);
    expect(await fails(["replace", "x", "--regex", "--find", "("])).toContain(
      "invalid regular expression",
    );
  });
});

describe("slugify", () => {
  it("makes a slug", async () => {
    expect(await ok(["slugify", "Héllo Wörld: a guide!"])).toBe("hello-world-a-guide\n");
  });
  it("handles umlauts and separators", async () => {
    expect(await ok(["slugify", "Grüße aus Köln", "--umlauts", "--separator", "_"])).toBe(
      "gruesse_aus_koeln\n",
    );
  });
  it("fails when nothing is left", async () => {
    expect(await fails(["slugify", "!!!"])).toContain("nothing left");
  });
});

describe("speech (browser only)", () => {
  it("prints the tool's link", async () => {
    const out = await ok(["speech"]);
    expect(out).toContain("browser only");
    expect(out).toContain("https://maxgfr.github.io/toolbelt/#/speech");
  });
  it("rejects unknown options", async () => {
    await fails(["speech", "--voice", "x"], 2);
  });
});

describe("unicode", () => {
  it("inspects code points and flags invisible ones", async () => {
    const out = await ok(["unicode", "é\u200b"]);
    expect(out).toContain("U+00E9");
    expect(out).toContain("ZERO WIDTH SPACE");
    expect(out).toContain("zero-width");
  });
  it("normalizes and removes invisible characters", async () => {
    expect(await ok(["unicode", "e\u0301", "--normalize", "NFC"])).toBe("é\n");
    expect(await ok(["unicode", "a\u200bb", "--remove-invisible"])).toBe("ab\n");
  });
  it("rejects an unknown form", async () => {
    await fails(["unicode", "x", "--normalize", "NFX"], 2);
  });
});

describe("whitespace", () => {
  it("cleans spaces and collapses blank lines", async () => {
    expect(await ok(["whitespace", "--blank-lines", "collapse"], "a  b   \n\n\n\nc")).toBe(
      "a b\n\nc\n",
    );
  });
  it("inspects a text", async () => {
    const j = JSON.parse(await ok(["whitespace", "--inspect", "--json"], "a\u00a0b\t"));
    expect(j.oddSpaces).toBe(1);
    expect(j.tabs).toBe(1);
  });
  it("rejects bad options", async () => {
    await fails(["whitespace", "x", "--quotes", "fancy"], 2);
    await fails(["whitespace", "x", "--tab-size", "0"], 2);
  });
});

describe("wrap", () => {
  it("wraps with a prefix", async () => {
    expect(await ok(["wrap", "aaa bbb ccc ddd", "--width", "9", "--prefix", "> "])).toBe(
      "> aaa bbb\n> ccc ddd\n",
    );
  });
  it("unwraps", async () => {
    expect(await ok(["wrap", "--unwrap"], "aaa\nbbb\n\nccc")).toBe("aaa bbb\n\nccc\n");
  });
  it("rejects a bad width", async () => {
    await fails(["wrap", "x", "--width", "0"], 2);
  });
});
