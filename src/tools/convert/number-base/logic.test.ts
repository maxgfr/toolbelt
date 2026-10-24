import { describe, expect, it } from "bun:test";
import { bitLength, groupDigits, parseInBase, toBase, twosComplement } from "./logic";

const value = (s: string, b: number) => {
  const r = parseInBase(s, b);
  if (!r.ok) throw new Error(`could not parse ${s}`);
  return r.value;
};

describe("parseInBase", () => {
  it("reads every base, with prefixes and digit groups", () => {
    expect(value("255", 10)).toBe(255n);
    expect(value("ff", 16)).toBe(255n);
    expect(value("0xFF", 16)).toBe(255n);
    expect(value("0b1111_1111", 2)).toBe(255n);
    expect(value("0o377", 8)).toBe(255n);
    expect(value("1111 1111", 2)).toBe(255n);
    expect(value("73", 36)).toBe(255n);
    expect(value("-10", 3)).toBe(-3n);
  });

  it("handles numbers beyond 2^53", () => {
    expect(value("18446744073709551615", 10)).toBe(2n ** 64n - 1n);
    expect(toBase(value("ffffffffffffffffffffffffffffffff", 16), 10)).toBe(
      "340282366920938463463374607431768211455",
    );
  });

  it("points at the first bad digit", () => {
    expect(parseInBase("1012", 2)).toEqual({ ok: false, error: "digit", char: "2", index: 3 });
    expect(parseInBase("12G4", 16)).toEqual({ ok: false, error: "digit", char: "G", index: 2 });
    expect(parseInBase("", 10)).toEqual({ ok: false, error: "empty" });
    expect(parseInBase("-", 10)).toEqual({ ok: false, error: "empty" });
    expect(parseInBase("1", 37)).toEqual({ ok: false, error: "base" });
  });
});

describe("formatting", () => {
  it("converts to other bases", () => {
    expect(toBase(255n, 2)).toBe("11111111");
    expect(toBase(255n, 16, true)).toBe("FF");
    expect(toBase(-255n, 16)).toBe("-ff");
    expect(toBase(35n, 36)).toBe("z");
  });

  it("groups digits from the right", () => {
    expect(groupDigits("1234567", 3)).toBe("1 234 567");
    expect(groupDigits("101", 4)).toBe("101");
    expect(groupDigits("-1234", 3, ",")).toBe("-1,234");
  });

  it("measures bits", () => {
    expect(bitLength(0n)).toBe(1);
    expect(bitLength(255n)).toBe(8);
    expect(bitLength(-256n)).toBe(9);
  });
});

describe("two's complement", () => {
  it("encodes negatives", () => {
    const t = twosComplement(-1n, 8);
    expect([t.binary, t.hex, t.fits, t.unsigned]).toEqual(["11111111", "FF", true, 255n]);
    expect(twosComplement(-128n, 8).fits).toBe(true);
    expect(twosComplement(-129n, 8).fits).toBe(false);
    expect(twosComplement(-2n, 16).hex).toBe("FFFE");
    expect(twosComplement(-1n, 64).hex).toBe("FFFFFFFFFFFFFFFF");
  });

  it("reads unsigned bit patterns as signed", () => {
    expect(twosComplement(255n, 8).signed).toBe(-1n);
    expect(twosComplement(0x7fn, 8).signed).toBe(127n);
    expect(twosComplement(256n, 8).fits).toBe(false);
    expect(twosComplement(5n, 32).binary).toBe(`${"0".repeat(29)}101`);
  });
});
