import { describe, expect, it } from "bun:test";
import { convert, fromRoman, romanParts, toRoman } from "./logic";

describe("roman numerals", () => {
  it("writes numbers", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(1990)).toBe("MCMXC");
    expect(toRoman(2024)).toBe("MMXXIV");
    expect(toRoman(3999)).toBe("MMMCMXCIX");
  });

  it("refuses what Roman numerals cannot write", () => {
    expect(toRoman(0)).toBeNull();
    expect(toRoman(4000)).toBeNull();
    expect(toRoman(-5)).toBeNull();
    expect(toRoman(1.5)).toBeNull();
  });

  it("reads numerals, in any case", () => {
    expect(fromRoman("MCMXC")).toEqual({ ok: true, value: 1990 });
    expect(fromRoman("mmxxiv")).toEqual({ ok: true, value: 2024 });
    expect(fromRoman(" xlii ")).toEqual({ ok: true, value: 42 });
  });

  it("round-trips 1 to 3999", () => {
    for (let n = 1; n <= 3999; n++) {
      const r = fromRoman(toRoman(n) ?? "");
      if (!r.ok || r.value !== n) throw new Error(`round trip failed at ${n}`);
    }
  });

  it("explains malformed numerals", () => {
    expect(fromRoman("IIII")).toEqual({ ok: false, error: "form", value: 4, canonical: "IV" });
    expect(fromRoman("IC")).toEqual({ ok: false, error: "form", value: 99, canonical: "XCIX" });
    expect(fromRoman("VV")).toEqual({ ok: false, error: "form", value: 10, canonical: "X" });
    expect(fromRoman("MMMM")).toEqual({ ok: false, error: "form", value: 4000, canonical: null });
    expect(fromRoman("XIZ")).toEqual({ ok: false, error: "char", char: "Z" });
    expect(fromRoman("")).toEqual({ ok: false, error: "empty" });
  });

  it("breaks a numeral into parts", () => {
    expect(romanParts(1994).map((p) => p.symbol)).toEqual(["M", "CM", "XC", "IV"]);
  });

  it("detects the direction", () => {
    expect(convert("1 990")).toEqual({ kind: "number", value: 1990, roman: "MCMXC" });
    expect(convert("xiv")).toEqual({ kind: "roman", result: { ok: true, value: 14 } });
    expect(convert("")).toEqual({ kind: "empty" });
    expect(convert("0")).toEqual({ kind: "number", value: 0, roman: null });
  });
});
