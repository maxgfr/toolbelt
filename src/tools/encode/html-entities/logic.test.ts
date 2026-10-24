import { describe, expect, it } from "bun:test";
import { NAME_OF, NAMED } from "./entities";
import { decodeEntities, encodeEntities } from "./logic";

const unsafe = { mode: "unsafe", hex: false } as const;
const named = { mode: "named", hex: false } as const;
const numeric = { mode: "numeric", hex: false } as const;

describe("html-entities", () => {
  it("bundles the HTML 4 names with the right code points", () => {
    expect(NAMED.get("nbsp")).toBe(0xa0);
    expect(NAMED.get("yuml")).toBe(0xff);
    expect(NAMED.get("eacute")).toBe(0xe9);
    expect(NAMED.get("Omega")).toBe(0x3a9);
    expect(NAMED.get("omega")).toBe(0x3c9);
    expect(NAMED.get("sigmaf")).toBe(0x3c2);
    expect(NAMED.get("euro")).toBe(0x20ac);
    expect(NAMED.get("hearts")).toBe(0x2665);
    expect(NAMED.size).toBeGreaterThan(250);
    expect(NAME_OF.get(0xa0)).toBe("nbsp");
  });

  it("escapes only the unsafe characters", () => {
    expect(encodeEntities("", unsafe)).toBe("");
    expect(encodeEntities(`<a href="x">Tom & Jerry's</a> é`, unsafe)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt; é",
    );
  });

  it("uses named references where they exist", () => {
    expect(encodeEntities("café © 2024 — 5 € <ok>", named)).toBe(
      "caf&eacute; &copy; 2024 &mdash; 5 &euro; &lt;ok&gt;",
    );
    // No name: numeric, astral characters as one reference.
    expect(encodeEntities("✓ 😀", named)).toBe("&check; &#128512;");
    expect(encodeEntities("ā", { mode: "named", hex: true })).toBe("&#x101;");
  });

  it("uses numeric references for everything non-ASCII", () => {
    expect(encodeEntities("é<😀", numeric)).toBe("&#233;&#60;&#128512;");
    expect(encodeEntities("é", { mode: "numeric", hex: true })).toBe("&#xE9;");
    expect(encodeEntities("plain text", numeric)).toBe("plain text");
  });

  it("decodes named and numeric references", () => {
    const d = decodeEntities("caf&eacute; &lt;b&gt; &#233;&#xE9;&#X1F600; &hellip;&nbsp;!");
    expect(d.text).toBe("café <b> éé😀 … !");
    expect(d.count).toBe(8);
    expect(d.unknown).toEqual([]);
  });

  it("decodes like a browser on edge cases", () => {
    expect(decodeEntities("&#150; &#0; &#xD800; &#99999999;").text).toBe("– � � �");
    // Legacy names work without semicolon, others do not.
    expect(decodeEntities("AT&amp T &copy 2024").text).toBe("AT& T © 2024");
    expect(decodeEntities("a=1&b=2&hellip").text).toBe("a=1&b=2&hellip");
    const d = decodeEntities("&unknownthing; & alone");
    expect(d.text).toBe("&unknownthing; & alone");
    expect(d.unknown).toEqual(["&unknownthing;"]);
  });

  it("round-trips every mode", () => {
    const s = `Ünïcødé "quotes" & <tags> — 你好 👋 ½`;
    for (const opts of [unsafe, named, numeric, { mode: "numeric", hex: true } as const])
      expect(decodeEntities(encodeEntities(s, opts)).text).toBe(s);
  });
});
