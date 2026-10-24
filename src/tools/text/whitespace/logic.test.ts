import { describe, expect, it } from "bun:test";
import { type CleanOptions, changedLines, clean, DEFAULTS, expandTabs, inspect } from "./logic";

const c = (cp: number) => String.fromCodePoint(cp);
const ZWSP = c(0x200b);
const ZWJ = c(0x200d);
const ZWNJ = c(0x200c);
const NBSP = c(0xa0);
const NNBSP = c(0x202f);
const BOM = c(0xfeff);

/** Every step off, then the given ones on. */
function only(o: Partial<CleanOptions>): CleanOptions {
  return {
    ...DEFAULTS,
    zeroWidth: false,
    oddSpaces: false,
    collapseSpaces: false,
    trimTrailing: false,
    ...o,
  };
}

describe("clean", () => {
  it("leaves an empty text alone", () => {
    expect(clean("", DEFAULTS)).toEqual({ text: "", changes: [] });
  });

  it("does nothing with every step off", () => {
    const s = `  a${NBSP}b  \r\n\tc…“d”  `;
    expect(clean(s, only({})).text).toBe(s);
    expect(clean(s, only({})).changes).toEqual([]);
  });

  it("removes invisible characters but keeps emoji and non-Latin joiners", () => {
    const persian = `می${ZWNJ}خواهم`;
    const r = clean(`${BOM}a${ZWSP}b ${persian} 👩${ZWJ}💻 x${ZWJ}y`, only({ zeroWidth: true }));
    expect(r.text).toBe(`ab ${persian} 👩${ZWJ}💻 xy`);
    expect(r.changes).toEqual([{ step: "zeroWidth", count: 3 }]);
  });

  it("converts odd spaces, collapses inner runs, trims trailing spaces", () => {
    const r = clean(`  a${NBSP}${NNBSP}b    c  \nd\t `, DEFAULTS);
    expect(r.text).toBe("  a b c\nd");
    expect(r.changes.map((x) => x.step)).toEqual(["oddSpaces", "collapseSpaces", "trimTrailing"]);
  });

  it("keeps tab-separated columns when collapsing spaces", () => {
    expect(clean("a\t\tb", DEFAULTS).text).toBe("a\t\tb");
  });

  it("straightens curly quotes and guillemets", () => {
    const r = clean(`“Hi” l’été «${NBSP}oui${NBSP}» ‹a›`, only({ quotes: "straight" }));
    expect(r.text).toBe(`"Hi" l'été "oui" 'a'`);
  });

  it("makes quotes smart, with apostrophes inside words", () => {
    expect(clean(`He said "it's (fine)" and 'ok'`, only({ quotes: "smart" })).text).toBe(
      "He said “it’s (fine)” and ‘ok’",
    );
  });

  it("converts dashes and ellipses both ways", () => {
    expect(clean("a—b – c−1 …", only({ dashes: "ascii", ellipsis: "ascii" })).text).toBe(
      "a-b - c-1 ...",
    );
    expect(
      clean("a--b, x - y, 1990-2000...", only({ dashes: "smart", ellipsis: "smart" })).text,
    ).toBe("a—b, x – y, 1990–2000…");
  });

  it("fixes line endings and reports how many changed", () => {
    expect(clean("a\r\nb\r\nc", only({ lineEndings: "lf" }))).toEqual({
      text: "a\nb\nc",
      changes: [{ step: "lineEndings", count: 2 }],
    });
    expect(clean("a\nb", only({ lineEndings: "crlf" })).text).toBe("a\r\nb");
    // "keep" unifies mixed endings on the most frequent one.
    expect(clean("a\r\nb\r\nc\nd", only({ lineEndings: "keep" })).text).toBe("a\r\nb\r\nc\r\nd");
    expect(clean("a\r\nb", only({ lineEndings: "keep" })).changes).toEqual([]);
  });

  it("converts tabs to spaces at tab stops, and indentation back to tabs", () => {
    expect(expandTabs("a\tbc\td", 4)).toBe("a   bc  d");
    expect(clean("\tx\n  \ty", only({ tabs: "spaces", tabSize: 4 })).text).toBe("    x\n    y");
    expect(clean("        x\n      y", only({ tabs: "tabs", tabSize: 4 })).text).toBe(
      "\t\tx\n\t  y",
    );
  });

  it("collapses or removes blank lines and trims the text", () => {
    expect(clean("a\n\n\n\nb\n \nc", only({ blankLines: "collapse" })).text).toBe("a\n\nb\n \nc");
    expect(clean("a\n\n\nb\n \nc", only({ blankLines: "remove" })).text).toBe("a\nb\nc");
    expect(clean("\n  a b  \n", only({ trimText: true })).text).toBe("a b");
  });

  it("removes accents, including letters that do not decompose", () => {
    const r = clean("Crème brûlée, Œuvre, straße, Łódź, ñ", only({ removeAccents: true }));
    expect(r.text).toBe("Creme brulee, OEuvre, strasse, Lodz, n");
  });

  it("removes punctuation, digits and emoji (not text symbols)", () => {
    expect(clean("Hi, you! (2024) «ok»", only({ removePunctuation: true })).text).toBe(
      "Hi you 2024 ok",
    );
    expect(clean("R2-D2 ٣", only({ removeDigits: true })).text).toBe("R-D ");
    expect(clean("ok 😀👍🏽🇫🇷#️⃣👩‍💻 © ™", only({ removeEmoji: true })).text).toBe("ok  © ™");
  });
});

describe("inspect", () => {
  it("counts what may need cleaning", () => {
    const f = inspect(`a${NBSP}b${ZWSP}\t“x”  \r\nend`);
    expect(f.oddSpaces).toBe(1);
    expect(f.invisible).toBe(1);
    expect(f.tabs).toBe(1);
    expect(f.crlf).toBe(1);
    expect(f.trailing).toBe(1);
    expect(f.smartQuotes).toBe(2);
    expect(inspect("")).toEqual({
      oddSpaces: 0,
      invisible: 0,
      tabs: 0,
      crlf: 0,
      trailing: 0,
      smartQuotes: 0,
      nonAscii: 0,
    });
  });
});

describe("changedLines", () => {
  it("counts lines that differ", () => {
    expect(changedLines("a\nb\nc", "a\nB\nc\nd")).toBe(2);
    expect(changedLines("", "")).toBe(0);
  });
});
