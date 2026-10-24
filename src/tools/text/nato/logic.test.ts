import { describe, expect, it } from "bun:test";
import { type Alphabet, alphabetTable, spell, spellText } from "./logic";

const words = (text: string, a: Alphabet, markCase = false) =>
  spell(text, a, markCase).map((s) => s.word);

describe("nato", () => {
  it("spells letters and digits in the NATO alphabet", () => {
    expect(words("Abc 19", "nato")).toEqual(["Alfa", "Bravo", "Charlie", "Space", "One", "Nine"]);
  });

  it("spells with the French alphabet", () => {
    expect(words("Zoé", "fr")).toEqual(["Zoé", "Oscar", "Eugène accent aigu"]);
    expect(words("ç", "fr")).toEqual(["Célestin cédille"]);
    expect(words("cœur", "fr")).toEqual(["Célestin", "Oscar", "Eugène", "Ursule", "Raoul"]);
  });

  it("names symbols, so an email address can be read", () => {
    expect(words("a.b@x", "nato")).toEqual(["Alfa", "Dot", "Bravo", "At", "X-ray"]);
    expect(words("a_b", "fr")).toEqual(["Anatole", "tiret bas", "Berthe"]);
  });

  it("marks capitals on request", () => {
    expect(words("aB", "nato", true)).toEqual(["small Alfa", "capital Bravo"]);
    expect(words("É", "fr", true)).toEqual(["Eugène majuscule accent aigu"]);
  });

  it("keeps unknown characters and collapses spaces", () => {
    const s = spell("  a  😀 ", "nato", false);
    expect(s.map((x) => [x.word, x.known])).toEqual([
      ["Alfa", true],
      ["Space", true],
      ["😀", false],
    ]);
    expect(spell("", "fr", false)).toEqual([]);
  });

  it("writes one line per input word", () => {
    expect(spellText(spell("hi you", "nato", false))).toBe("Hotel India\nYankee Oscar Uniform");
  });

  it("lists 36 entries", () => {
    expect(alphabetTable("fr")).toHaveLength(36);
    expect(alphabetTable("nato")[25]).toEqual({ char: "Z", word: "Zulu" });
  });
});

describe("nato, German alphabets", () => {
  it("spells with DIN 5009:2022 city names", () => {
    expect(words("Abc 19", "de")).toEqual([
      "Aachen",
      "Berlin",
      "Chemnitz",
      "Leerzeichen",
      "Eins",
      "Neun",
    ]);
    expect(words("2", "de")).toEqual(["Zwo"]);
  });

  it("spells umlauts and ß with their own words", () => {
    expect(words("Müßig", "de")).toEqual([
      "München",
      "Umlaut Unna",
      "Eszett",
      "Ingelheim",
      "Goslar",
    ]);
    expect(words("Öl", "deNames")).toEqual(["Ökonom", "Ludwig"]);
    expect(words("Ärger", "deNames")[0]).toBe("Ärger");
    // A decomposed ü (u + combining diaeresis) is the same letter.
    expect(words("u\u0308", "de")).toEqual(["Umlaut Unna"]);
  });

  it("spells with the classic name table", () => {
    expect(words("Xaver", "deNames")).toEqual(["Xanthippe", "Anton", "Viktor", "Emil", "Richard"]);
  });

  it("names other accents, symbols and case in German", () => {
    expect(words("é", "de")).toEqual(["Essen (Akut)"]);
    expect(words("a.b@c", "deNames")).toEqual(["Anton", "Punkt", "Berta", "At-Zeichen", "Cäsar"]);
    expect(words("aÜ", "de", true)).toEqual(["klein Aachen", "groß Umlaut Unna"]);
    expect(words("ß", "de", true)).toEqual(["Eszett"]);
  });

  it("lists the umlauts in the table", () => {
    const table = alphabetTable("de");
    expect(table).toHaveLength(40);
    expect(table.find((e) => e.char === "Ü")).toEqual({ char: "Ü", word: "Umlaut Unna" });
    expect(alphabetTable("deNames").find((e) => e.char === "ß")?.word).toBe("Eszett");
  });
});
