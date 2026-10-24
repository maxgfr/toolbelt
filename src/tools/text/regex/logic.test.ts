import { describe, expect, it } from "bun:test";
import { regexHint } from "../_shared";
import { captureGroups, PRESETS, testRegex, toLiteral } from "./logic";

describe("regex", () => {
  it("lists matches with positions and groups", () => {
    const r = testRegex("(\\w)(\\d)?", "g", "a1 b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matches.map((m) => [m.index, m.end, m.text])).toEqual([
      [0, 2, "a1"],
      [3, 4, "b"],
    ]);
    expect(r.matches[1]?.groups).toEqual([
      { n: 1, name: null, value: "b" },
      { n: 2, name: null, value: undefined },
    ]);
  });

  it("names groups in order, skipping escapes, classes and lookbehinds", () => {
    expect(captureGroups("(?<y>\\d{4})-(\\d+)(?:x)(?<=a)[(]\\((?<z>.)")).toEqual(["y", null, "z"]);
    const r = testRegex("(?<year>\\d{4})-(?<m>\\d\\d)", "", "on 2024-05 and 2025-06");
    if (r.ok) {
      expect(r.matches.length).toBe(1);
      expect(r.matches[0]?.groups.map((g) => [g.name, g.value])).toEqual([
        ["year", "2024"],
        ["m", "05"],
      ]);
    }
  });

  it("handles empty input, empty pattern and empty matches", () => {
    const empty = testRegex("", "g", "abc");
    expect(empty.ok && empty.matches.length).toBe(0);
    const r = testRegex("x*", "g", "ab");
    expect(r.ok && r.matches.length).toBe(3);
    const none = testRegex("a", "g", "");
    expect(none.ok && none.matches.length).toBe(0);
  });

  it("caps the number of matches", () => {
    const r = testRegex(".", "g", "x".repeat(50), 10);
    expect(r.ok && r.matches.length).toBe(10);
    expect(r.ok && r.truncated).toBe(true);
  });

  it("explains common errors", () => {
    const r = testRegex("[a-", "g", "x");
    expect(r.ok).toBe(false);
    expect(regexHint("Invalid regular expression: /*a/: Nothing to repeat")).toBe("repeat");
    expect(regexHint("Invalid regular expression: /a(/: Unterminated group")).toBe("group");
    expect(regexHint("Invalid regular expression: missing terminating ] for character class")).toBe(
      "class",
    );
    expect(regexHint("Invalid regular expression: /a)/: Unmatched ')'")).toBe("paren");
    expect(regexHint("invalid range in character class")).toBe("range");
    expect(regexHint("Invalid flags supplied to RegExp constructor 'gg'")).toBe("flags");
  });

  it("writes a regex literal", () => {
    expect(toLiteral("a/b\\/c", "gi")).toBe("/a\\/b\\/c/gi");
    expect(toLiteral("", "")).toBe("/(?:)/");
  });

  it("ships presets that compile and match their sample", () => {
    for (const p of PRESETS) {
      const r = testRegex(p.pattern, p.flags, p.sample);
      expect(r.ok && r.matches.length > 0).toBe(true);
    }
    const ip = PRESETS.find((p) => p.id === "ipv4");
    if (ip) {
      const r = testRegex(ip.pattern, ip.flags, ip.sample);
      expect(r.ok && r.matches.map((m) => m.text)).toEqual(["192.168.1.1", "8.8.8.8"]);
    }
  });
});
