import { describe, expect, it } from "bun:test";
import { alphabetTable, spell, spellText } from "./logic";

const words = (text: string, a: "nato" | "fr", markCase = false) =>
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
