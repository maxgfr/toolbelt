import { describe, expect, it } from "bun:test";
import {
  DEFAULT_OPTIONS,
  domainToAscii,
  domainToUnicode,
  extractAddress,
  normalizeEmail,
  processList,
  punycodeDecode,
  splitList,
  uniqueAddresses,
  validateEmail,
} from "./logic";

const issues = (s: string) => validateEmail(s).issues;

describe("email-normalize — punycode", () => {
  it("decodes and encodes IDN labels", () => {
    expect(punycodeDecode("mnchen-3ya")).toBe("münchen");
    expect(punycodeDecode("bcher-kva")).toBe("bücher");
    expect(punycodeDecode("wgv71a119e")).toBe("日本語");
    expect(punycodeDecode("!!")).toBeNull();
    expect(domainToUnicode("xn--mnchen-3ya.de")).toBe("münchen.de");
    expect(domainToUnicode("example.com")).toBe("example.com");
    expect(domainToAscii("München.DE")).toBe("xn--mnchen-3ya.de");
    expect(domainToAscii("Example.COM")).toBe("example.com");
    expect(domainToAscii("")).toBeNull();
  });
});

describe("email-normalize — validation", () => {
  it("accepts ordinary and unusual valid addresses", () => {
    for (const s of [
      "john@example.com",
      "john.doe+news@sub.example.co.uk",
      "o'brien@example.ie",
      "x@example.museum",
      "user@münchen.de",
      "a_b-c!#$%&*=?^`{|}~@example.org",
    ])
      expect(validateEmail(s).ok).toBe(true);
  });

  it("explains what is wrong", () => {
    expect(issues("")).toEqual(["empty"]);
    expect(issues("john.example.com")).toEqual(["no-at"]);
    expect(issues("@example.com")).toContain("local-empty");
    expect(issues("john@")).toContain("domain-empty");
    expect(issues(".john@example.com")).toContain("local-dots");
    expect(issues("jo..hn@example.com")).toContain("local-dots");
    expect(issues("jo hn@example.com")).toContain("local-chars");
    expect(issues("a@b@example.com")).toContain("local-chars");
    expect(issues("john@localhost")).toContain("no-dot");
    expect(issues("john@example.123")).toContain("tld");
    expect(issues("john@-example.com")).toContain("label-hyphen");
    expect(issues("john@exa_mple.com")).toContain("domain-chars");
    expect(issues(`${"a".repeat(65)}@example.com`)).toContain("local-long");
    expect(issues(`john@${"a".repeat(64)}.com`)).toContain("label-long");
    expect(
      issues(
        `${"a".repeat(64)}@${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.${"e".repeat(60)}.com`,
      ),
    ).toContain("too-long");
  });

  it("keeps rare but deliverable forms as warnings", () => {
    const q = validateEmail('"john doe"@example.com');
    expect(q.ok).toBe(true);
    expect(q.issues).toEqual(["quoted"]);
    expect(validateEmail("jöhn@example.com")).toMatchObject({
      ok: true,
      issues: ["unicode-local"],
    });
    expect(validateEmail("john@[192.0.2.1]")).toMatchObject({ ok: true, issues: ["ip-literal"] });
    expect(validateEmail('"unclosed@example.com').ok).toBe(false);
  });
});

describe("email-normalize — normalization", () => {
  it("applies Gmail rules", () => {
    expect(normalizeEmail(" John.Doe+News@GoogleMail.com ")).toEqual({
      address: "johndoe@gmail.com",
      changes: ["lowercase", "plus-tag", "gmail-dots", "googlemail"],
    });
  });

  it("removes plus tags only where the provider supports them", () => {
    expect(normalizeEmail("jane.doe+x@outlook.com").address).toBe("jane.doe@outlook.com");
    expect(normalizeEmail("jane+x@proton.me").address).toBe("jane@proton.me");
    expect(normalizeEmail("jane+x@fastmail.com").address).toBe("jane@fastmail.com");
    expect(normalizeEmail("max+x@posteo.de").address).toBe("max@posteo.de");
    expect(normalizeEmail("max+x@hotmail.de").address).toBe("max@hotmail.de");
    expect(normalizeEmail("max+x@gmx.de").address).toBe("max+x@gmx.de");
    expect(normalizeEmail("jane+x@example.com").address).toBe("jane+x@example.com");
    expect(
      normalizeEmail("jane+x@example.com", { ...DEFAULT_OPTIONS, plusEverywhere: true }).address,
    ).toBe("jane@example.com");
    expect(normalizeEmail("+x@gmail.com").address).toBe("+x@gmail.com");
  });

  it("can keep the case and skip provider rules", () => {
    const opts = { lowercase: false, providers: false, plusEverywhere: false };
    expect(normalizeEmail("John.Doe+a@Gmail.com", opts)).toEqual({
      address: "John.Doe+a@gmail.com",
      changes: [],
    });
  });

  it("shows IDN domains in Unicode and drops a trailing dot", () => {
    expect(normalizeEmail("a@xn--mnchen-3ya.de").address).toBe("a@münchen.de");
    expect(normalizeEmail("a@example.com.")).toEqual({
      address: "a@example.com",
      changes: ["trailing-dot"],
    });
  });
});

describe("email-normalize — lists", () => {
  it("splits on lines, commas and semicolons, outside quotes and brackets", () => {
    expect(splitList('a@x.com, b@y.com;c@z.com\n\n"Doe, John" <j@x.com>')).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
      '"Doe, John" <j@x.com>',
    ]);
    expect(splitList("")).toEqual([]);
  });

  it("extracts addresses from display forms", () => {
    expect(extractAddress('"Doe, John" <j@x.com>')).toBe("j@x.com");
    expect(extractAddress("mailto:j@x.com?subject=hi")).toBe("j@x.com");
    expect(extractAddress("  j@x.com ")).toBe("j@x.com");
  });

  it("dedupes after normalization", () => {
    const rows = processList(
      "John.Doe@gmail.com\njohndoe+promo@googlemail.com\nnot-an-email\nJane <jane@münchen.de>\njane@xn--mnchen-3ya.de",
    );
    expect(rows.map((r) => r.duplicateOf)).toEqual([null, 0, null, null, 3]);
    expect(rows[2]?.validation.ok).toBe(false);
    expect(rows[2]?.normalized).toBe("");
    expect(uniqueAddresses(rows)).toEqual(["johndoe@gmail.com", "jane@münchen.de"]);
    expect(uniqueAddresses(rows, true)).toEqual(["johndoe@gmail.com", "jane@xn--mnchen-3ya.de"]);
  });
});
