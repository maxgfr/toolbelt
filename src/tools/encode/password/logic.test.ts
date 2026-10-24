import { describe, expect, it } from "bun:test";
import { EncodeError } from "../_shared";
import {
  AMBIGUOUS,
  CLASSES,
  charsetSize,
  crackSeconds,
  estimateStrength,
  generatePassphrase,
  generatePassword,
  type PasswordOptions,
  passphraseEntropy,
  passwordEntropy,
  pools,
  scoreOf,
  timeUnit,
} from "./logic";
import { WORDS } from "./words";

const ALL: PasswordOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
  eachClass: true,
};

describe("wordlist", () => {
  it("has 2048 unique lowercase words of 3 to 8 letters", () => {
    expect(WORDS.length).toBe(2048);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]{3,8}$/);
  });
});

describe("generatePassword", () => {
  it("has the requested length and only allowed characters", () => {
    const pw = generatePassword({ ...ALL, length: 64, symbols: false });
    expect(pw).toHaveLength(64);
    expect(pw).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("always contains one of each chosen class, even at the minimum length", () => {
    for (let i = 0; i < 300; i++) {
      const pw = generatePassword({ ...ALL, length: 4 });
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect([...pw].some((c) => CLASSES.symbols.includes(c))).toBe(true);
    }
  });

  it("leaves out ambiguous characters", () => {
    const pw = generatePassword({ ...ALL, length: 128, excludeAmbiguous: true });
    for (const c of AMBIGUOUS) expect(pw.includes(c)).toBe(false);
    expect(pools({ ...ALL, excludeAmbiguous: true }).join("")).not.toContain("0");
  });

  it("draws characters roughly uniformly", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++)
      for (const c of generatePassword({ ...ALL, length: 25, upper: false, eachClass: false }))
        counts.set(c, (counts.get(c) ?? 0) + 1);
    // 10,000 draws over 68 characters: about 147 each.
    for (const n of counts.values()) expect(n).toBeGreaterThan(70);
    expect(counts.size).toBe(26 + 10 + 32);
  });

  it("rejects impossible options", () => {
    expect(() =>
      generatePassword({ ...ALL, lower: false, upper: false, digits: false, symbols: false }),
    ).toThrow(EncodeError);
    expect(() => generatePassword({ ...ALL, length: 2 })).toThrow(EncodeError);
    expect(() => generatePassword({ ...ALL, length: 500 })).toThrow(EncodeError);
  });
});

describe("passwordEntropy", () => {
  it("is length × log2(pool) without constraints", () => {
    expect(
      passwordEntropy({ ...ALL, eachClass: false, upper: false, symbols: false, length: 10 }),
    ).toBeCloseTo(10 * Math.log2(36), 10);
    expect(passwordEntropy({ ...ALL, eachClass: false })).toBeCloseTo(20 * Math.log2(94), 10);
  });

  it("counts the passwords that hold every class exactly", () => {
    // Length 2 over {a..z} ∪ {0..9} with both classes: 2 × 26 × 10 = 520 passwords.
    const o = { ...ALL, length: 2, upper: false, symbols: false };
    expect(2 ** passwordEntropy(o)).toBeCloseTo(520, 6);
    expect(passwordEntropy({ ...ALL, eachClass: true })).toBeLessThan(
      passwordEntropy({ ...ALL, eachClass: false }),
    );
  });
});

describe("passphrases", () => {
  it("joins the requested number of words", () => {
    const p = generatePassphrase({ words: 6, separator: "-", capitalize: false, digit: false });
    const parts = p.split("-");
    expect(parts).toHaveLength(6);
    for (const w of parts) expect(WORDS).toContain(w);
  });

  it("capitalizes and adds one digit", () => {
    const p = generatePassphrase({ words: 4, separator: " ", capitalize: true, digit: true });
    expect(p.split(" ").every((w) => /^[A-Z][a-z]+\d?$/.test(w))).toBe(true);
    expect(p.match(/\d/g)).toHaveLength(1);
  });

  it("has 11 bits per word from a 2048-word list", () => {
    expect(passphraseEntropy({ words: 5, separator: "-", capitalize: false, digit: false })).toBe(
      55,
    );
    expect(
      passphraseEntropy({ words: 4, separator: "-", capitalize: true, digit: true }),
    ).toBeCloseTo(44 + Math.log2(40), 10);
  });
});

describe("estimateStrength", () => {
  it("rates empty, common and dictionary passwords low", () => {
    expect(estimateStrength("")).toEqual({ bits: 0, score: 0, warnings: [] });
    const common = estimateStrength("password");
    expect(common.warnings).toEqual(["common"]);
    expect(common.score).toBe(0);
    expect(estimateStrength("Password1!").score).toBeLessThanOrEqual(1);
    expect(estimateStrength("sunsetcandle").warnings).toContain("dictionary");
  });

  it("penalizes repeats and sequences", () => {
    const s = estimateStrength("zzzzzzzzzzzz");
    expect(s.warnings).toContain("pattern");
    expect(s.bits).toBeLessThan(20);
    expect(estimateStrength("abcdefghij").bits).toBeLessThan(estimateStrength("qmzrxkvtpw").bits);
  });

  it("rates long random passwords high", () => {
    expect(estimateStrength("x7#Qp!9vL2@rT8&mZ4").score).toBe(4);
    expect(estimateStrength("Tr0ub4dor&3x").score).toBeGreaterThanOrEqual(2);
  });

  it("knows charset sizes and score bands", () => {
    expect(charsetSize("abc")).toBe(26);
    expect(charsetSize("aB3!")).toBe(95);
    expect(charsetSize("é")).toBe(100);
    expect([0, 30, 50, 70, 90].map(scoreOf)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("crack time", () => {
  it("converts bits to a duration", () => {
    expect(crackSeconds(1, 1)).toBe(1);
    expect(crackSeconds(41, 1e10)).toBeCloseTo(109.95, 1);
    expect(timeUnit(0.2).unit).toBe("instant");
    expect(timeUnit(120)).toEqual({ unit: "minutes", value: 2 });
    expect(timeUnit(86400 * 3)).toEqual({ unit: "days", value: 3 });
    expect(timeUnit(crackSeconds(128)).unit).toBe("ages");
  });
});
