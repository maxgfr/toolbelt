import { describe, expect, it } from "bun:test";
import {
  attempt,
  EncodeError,
  formatSize,
  fromBase64,
  fromHex,
  fromUtf8,
  isUtf8,
  randomInt,
  randomString,
  toBase64,
  toHex,
  utf8,
} from "./_shared";

describe("encode shared helpers", () => {
  it("encodes Base64 with the RFC 4648 test vectors", () => {
    const vectors: [string, string][] = [
      ["", ""],
      ["f", "Zg=="],
      ["fo", "Zm8="],
      ["foo", "Zm9v"],
      ["foob", "Zm9vYg=="],
      ["fooba", "Zm9vYmE="],
      ["foobar", "Zm9vYmFy"],
    ];
    for (const [plain, b64] of vectors) {
      expect(toBase64(utf8(plain))).toBe(b64);
      expect(fromUtf8(fromBase64(b64))).toBe(plain);
    }
  });

  it("handles the URL-safe alphabet and missing padding", () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
    expect(toBase64(bytes)).toBe("+/+/");
    expect(toBase64(bytes, true)).toBe("-_-_");
    expect(toBase64(utf8("fo"), true)).toBe("Zm8");
    expect(fromBase64("-_-_")).toEqual(bytes);
    expect(fromUtf8(fromBase64("Zm8"))).toBe("fo");
    expect(fromUtf8(fromBase64(" Zm9v\nYmFy "))).toBe("foobar");
  });

  it("rejects invalid Base64 with a translated error", () => {
    expect(() => fromBase64("abc$")).toThrow(EncodeError);
    expect(() => fromBase64("abcde")).toThrow(EncodeError);
    const r = attempt(() => fromBase64("a=b"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.fr).toContain("Base64");
      expect(r.error.de).toContain("Base64");
      expect(r.error.de).not.toBe(r.error.en);
    }
    const other = attempt(() => {
      throw new Error("boom");
    });
    if (!other.ok) expect(other.error).toEqual({ en: "boom", fr: "boom", de: "boom" });
  });

  it("converts hex both ways, tolerant of separators", () => {
    expect(toHex(utf8("é"))).toBe("c3a9");
    expect(toHex(new Uint8Array([0xab]), true)).toBe("AB");
    expect(fromHex("0xC3 a9")).toEqual(utf8("é"));
    expect(fromHex("de:ad:be:ef")).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    expect(() => fromHex("abc")).toThrow(EncodeError);
    expect(() => fromHex("zz")).toThrow(EncodeError);
  });

  it("detects invalid UTF-8", () => {
    expect(isUtf8(utf8("héllo 👋"))).toBe(true);
    expect(isUtf8(new Uint8Array([0xc3, 0x28]))).toBe(false);
    expect(() => fromUtf8(new Uint8Array([0xff]), true)).toThrow(EncodeError);
    expect(fromUtf8(new Uint8Array([0xff]))).toBe("�");
  });

  it("formats sizes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(5 * 1024 * 1024, "fr-FR")).toBe("5 MB");
    expect(formatSize(1536, "de-DE")).toBe("1,5 KB");
  });

  it("draws random values in range", () => {
    for (let i = 0; i < 200; i++) {
      const n = randomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(randomString(32, "ab")).toMatch(/^[ab]{32}$/);
    expect(() => randomInt(0)).toThrow();
  });
});
