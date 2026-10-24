import { describe, expect, it } from "bun:test";
import {
  deCardinal,
  deOrdinal,
  enCardinal,
  enOrdinal,
  frCardinal,
  frOrdinal,
  moneyToWords,
  numberToWords,
  type Parsed,
  parseDecimal,
} from "./logic";

const p = (s: string): Parsed => {
  const r = parseDecimal(s);
  if (!r.ok) throw new Error(`cannot parse ${s}`);
  return r;
};
const fr = (n: number | bigint) => frCardinal(BigInt(n));
const reform = (n: number | bigint) => frCardinal(BigInt(n), { reform: true });

describe("parseDecimal", () => {
  it("reads signs, separators and groups", () => {
    expect(parseDecimal("1 234,56")).toEqual({ ok: true, negative: false, int: 1234n, frac: "56" });
    expect(parseDecimal("-1,234.5")).toEqual({ ok: true, negative: true, int: 1234n, frac: "5" });
    expect(parseDecimal(".5")).toEqual({ ok: true, negative: false, int: 0n, frac: "5" });
    expect(parseDecimal("-0")).toEqual({ ok: true, negative: false, int: 0n, frac: "" });
  });

  it("rejects garbage and too large numbers", () => {
    expect(parseDecimal("")).toEqual({ ok: false, error: "empty" });
    expect(parseDecimal("12a")).toEqual({ ok: false, error: "invalid" });
    expect(parseDecimal("-")).toEqual({ ok: false, error: "invalid" });
    expect(parseDecimal("1".repeat(37))).toEqual({ ok: false, error: "big" });
  });
});

describe("English", () => {
  it("writes cardinals", () => {
    expect(enCardinal(0n)).toBe("zero");
    expect(enCardinal(21n)).toBe("twenty-one");
    expect(enCardinal(105n)).toBe("one hundred five");
    expect(enCardinal(1_000_001n)).toBe("one million one");
    expect(enCardinal(1234567n)).toBe(
      "one million two hundred thirty-four thousand five hundred sixty-seven",
    );
    expect(enCardinal(10n ** 33n)).toBe("one decillion");
  });

  it("writes ordinals", () => {
    expect(enOrdinal(1n)).toBe("first");
    expect(enOrdinal(2n)).toBe("second");
    expect(enOrdinal(3n)).toBe("third");
    expect(enOrdinal(12n)).toBe("twelfth");
    expect(enOrdinal(20n)).toBe("twentieth");
    expect(enOrdinal(21n)).toBe("twenty-first");
    expect(enOrdinal(100n)).toBe("one hundredth");
    expect(enOrdinal(1_000_000n)).toBe("one millionth");
    expect(enOrdinal(0n)).toBeNull();
  });

  it("writes decimals and negatives", () => {
    expect(numberToWords(p("3.14"), "en")).toBe("three point one four");
    expect(numberToWords(p("-0.05"), "en")).toBe("minus zero point zero five");
    expect(numberToWords(p("2.50"), "en")).toBe("two point five");
  });

  it("writes amounts of money", () => {
    expect(moneyToWords(p("1"), "usd", "en")).toBe("one dollar");
    expect(moneyToWords(p("123.45"), "usd", "en")).toBe(
      "one hundred twenty-three dollars and forty-five cents",
    );
    expect(moneyToWords(p("0.01"), "eur", "en")).toBe("one cent");
    expect(moneyToWords(p("0"), "eur", "en")).toBe("zero euros");
    expect(moneyToWords(p("1.999"), "usd", "en")).toBe("two dollars");
    expect(moneyToWords(p("-5.5"), "usd", "en")).toBe("minus five dollars and fifty cents");
  });
});

describe("French", () => {
  it("follows the agreement rules", () => {
    expect(fr(0)).toBe("zéro");
    expect(fr(17)).toBe("dix-sept");
    expect(fr(21)).toBe("vingt et un");
    expect(fr(22)).toBe("vingt-deux");
    expect(fr(71)).toBe("soixante et onze");
    expect(fr(77)).toBe("soixante-dix-sept");
    expect(fr(80)).toBe("quatre-vingts");
    expect(fr(81)).toBe("quatre-vingt-un");
    expect(fr(91)).toBe("quatre-vingt-onze");
    expect(fr(99)).toBe("quatre-vingt-dix-neuf");
    expect(fr(100)).toBe("cent");
    expect(fr(101)).toBe("cent un");
    expect(fr(200)).toBe("deux cents");
    expect(fr(201)).toBe("deux cent un");
    expect(fr(280)).toBe("deux cent quatre-vingts");
    expect(fr(1000)).toBe("mille");
    expect(fr(1001)).toBe("mille un");
    expect(fr(2000)).toBe("deux mille");
    expect(fr(80000)).toBe("quatre-vingt mille");
    expect(fr(200000)).toBe("deux cent mille");
    expect(fr(1990)).toBe("mille neuf cent quatre-vingt-dix");
    expect(fr(1_000_000)).toBe("un million");
    expect(fr(2_000_000)).toBe("deux millions");
    expect(fr(200_000_000)).toBe("deux cents millions");
    expect(fr(80_000_000)).toBe("quatre-vingts millions");
    expect(fr(1_000_000_000)).toBe("un milliard");
    expect(fr(2_300_021)).toBe("deux millions trois cent mille vingt et un");
    expect(frCardinal(10n ** 12n)).toBe("un billion");
  });

  it("hyphenates everything with the 1990 reform, except around nouns", () => {
    expect(reform(21)).toBe("vingt-et-un");
    expect(reform(71)).toBe("soixante-et-onze");
    expect(reform(201)).toBe("deux-cent-un");
    expect(reform(1200)).toBe("mille-deux-cents");
    expect(reform(2_300_021)).toBe("deux millions trois-cent-mille-vingt-et-un");
  });

  it("knows the Belgian and Swiss tens", () => {
    expect(frCardinal(71n, { variant: "be" })).toBe("septante et un");
    expect(frCardinal(80n, { variant: "be" })).toBe("quatre-vingts");
    expect(frCardinal(95n, { variant: "be" })).toBe("nonante-cinq");
    expect(frCardinal(81n, { variant: "ch" })).toBe("huitante et un");
  });

  it("writes ordinals", () => {
    expect(frOrdinal(1n)).toBe("premier");
    expect(frOrdinal(2n)).toBe("deuxième");
    expect(frOrdinal(4n)).toBe("quatrième");
    expect(frOrdinal(5n)).toBe("cinquième");
    expect(frOrdinal(9n)).toBe("neuvième");
    expect(frOrdinal(21n)).toBe("vingt et unième");
    expect(frOrdinal(80n)).toBe("quatre-vingtième");
    expect(frOrdinal(200n)).toBe("deux centième");
    expect(frOrdinal(1000n)).toBe("millième");
    expect(frOrdinal(1_000_000n)).toBe("millionième");
    expect(frOrdinal(0n)).toBeNull();
  });

  it("writes decimals and negatives", () => {
    expect(numberToWords(p("3,14"), "fr")).toBe("trois virgule quatorze");
    expect(numberToWords(p("3,05"), "fr")).toBe("trois virgule zéro cinq");
    expect(numberToWords(p("-21"), "fr")).toBe("moins vingt et un");
  });

  it("writes amounts of money", () => {
    expect(moneyToWords(p("1"), "eur", "fr")).toBe("un euro");
    expect(moneyToWords(p("0"), "eur", "fr")).toBe("zéro euro");
    expect(moneyToWords(p("1,5"), "eur", "fr")).toBe("un euro et cinquante centimes");
    expect(moneyToWords(p("0,01"), "eur", "fr")).toBe("un centime");
    expect(moneyToWords(p("2000000"), "eur", "fr")).toBe("deux millions d'euros");
    expect(moneyToWords(p("1000000"), "usd", "fr")).toBe("un million de dollars");
    expect(moneyToWords(p("1000001"), "eur", "fr")).toBe("un million un euros");
    expect(moneyToWords(p("80"), "usd", "fr")).toBe("quatre-vingts dollars");
  });
});

describe("German", () => {
  const de = (n: number | bigint) => deCardinal(BigInt(n));

  it("writes cardinals below a million as one word", () => {
    expect(de(0)).toBe("null");
    expect(de(1)).toBe("eins");
    expect(de(11)).toBe("elf");
    expect(de(12)).toBe("zwölf");
    expect(de(16)).toBe("sechzehn");
    expect(de(17)).toBe("siebzehn");
    expect(de(21)).toBe("einundzwanzig");
    expect(de(30)).toBe("dreißig");
    expect(de(37)).toBe("siebenunddreißig");
    expect(de(66)).toBe("sechsundsechzig");
    expect(de(70)).toBe("siebzig");
    expect(de(99)).toBe("neunundneunzig");
    expect(de(100)).toBe("hundert");
    expect(de(101)).toBe("hunderteins");
    expect(de(121)).toBe("hunderteinundzwanzig");
    expect(de(200)).toBe("zweihundert");
    expect(de(1000)).toBe("tausend");
    expect(de(1001)).toBe("tausendeins");
    expect(de(1234)).toBe("tausendzweihundertvierunddreißig");
    expect(de(2000)).toBe("zweitausend");
    expect(de(21000)).toBe("einundzwanzigtausend");
    expect(de(101000)).toBe("hunderteintausend");
    expect(de(999999)).toBe("neunhundertneunundneunzigtausendneunhundertneunundneunzig");
  });

  it("writes millions and up as separate, agreeing nouns", () => {
    expect(de(1_000_000)).toBe("eine Million");
    expect(de(1_000_001)).toBe("eine Million eins");
    expect(de(2_000_000)).toBe("zwei Millionen");
    expect(de(1_234_567)).toBe(
      "eine Million zweihundertvierunddreißigtausendfünfhundertsiebenundsechzig",
    );
    expect(de(21_000_000)).toBe("einundzwanzig Millionen");
    expect(de(101_000_000)).toBe("hunderteine Millionen");
    expect(de(1_000_000_000)).toBe("eine Milliarde");
    expect(de(3_002_000_000)).toBe("drei Milliarden zwei Millionen");
    expect(deCardinal(10n ** 12n)).toBe("eine Billion");
    expect(deCardinal(10n ** 33n)).toBe("eine Quintilliarde");
  });

  it("writes ordinals", () => {
    expect(deOrdinal(1n)).toBe("erste");
    expect(deOrdinal(2n)).toBe("zweite");
    expect(deOrdinal(3n)).toBe("dritte");
    expect(deOrdinal(7n)).toBe("siebte");
    expect(deOrdinal(8n)).toBe("achte");
    expect(deOrdinal(11n)).toBe("elfte");
    expect(deOrdinal(17n)).toBe("siebzehnte");
    expect(deOrdinal(19n)).toBe("neunzehnte");
    expect(deOrdinal(20n)).toBe("zwanzigste");
    expect(deOrdinal(21n)).toBe("einundzwanzigste");
    expect(deOrdinal(30n)).toBe("dreißigste");
    expect(deOrdinal(100n)).toBe("hundertste");
    expect(deOrdinal(101n)).toBe("hunderterste");
    expect(deOrdinal(103n)).toBe("hundertdritte");
    expect(deOrdinal(1000n)).toBe("tausendste");
    expect(deOrdinal(1001n)).toBe("tausenderste");
    expect(deOrdinal(1_000_000n)).toBe("millionste");
    expect(deOrdinal(2_000_000n)).toBe("zweimillionste");
    expect(deOrdinal(1_000_000_000n)).toBe("milliardste");
    expect(deOrdinal(0n)).toBeNull();
  });

  it("writes decimals and negatives", () => {
    expect(numberToWords(p("3,14"), "de")).toBe("drei Komma eins vier");
    expect(numberToWords(p("3,05"), "de")).toBe("drei Komma null fünf");
    expect(numberToWords(p("2,50"), "de")).toBe("zwei Komma fünf");
    expect(numberToWords(p("-21"), "de")).toBe("minus einundzwanzig");
    expect(numberToWords(p("-0,5"), "de")).toBe("minus null Komma fünf");
    expect(numberToWords(p("1"), "de")).toBe("eins");
  });

  it("writes amounts of money, without a plural", () => {
    expect(moneyToWords(p("1"), "eur", "de")).toBe("ein Euro");
    expect(moneyToWords(p("0"), "eur", "de")).toBe("null Euro");
    expect(moneyToWords(p("2"), "eur", "de")).toBe("zwei Euro");
    expect(moneyToWords(p("101"), "eur", "de")).toBe("hundertein Euro");
    expect(moneyToWords(p("1,5"), "eur", "de")).toBe("ein Euro und fünfzig Cent");
    expect(moneyToWords(p("0,01"), "eur", "de")).toBe("ein Cent");
    expect(moneyToWords(p("123,45"), "usd", "de")).toBe(
      "hundertdreiundzwanzig Dollar und fünfundvierzig Cent",
    );
    expect(moneyToWords(p("1000000"), "eur", "de")).toBe("eine Million Euro");
    expect(moneyToWords(p("2000000"), "usd", "de")).toBe("zwei Millionen Dollar");
    expect(moneyToWords(p("-5,5"), "usd", "de")).toBe("minus fünf Dollar und fünfzig Cent");
  });
});
