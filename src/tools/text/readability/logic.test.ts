import { describe, expect, it } from "bun:test";
import {
  analyze,
  detectLang,
  sentences,
  syllablesDe,
  syllablesEn,
  syllablesFr,
  words,
} from "./logic";

describe("syllables", () => {
  it("counts English syllables with silent endings and vowel pairs", () => {
    const cases: Record<string, number> = {
      the: 1,
      make: 1,
      jumped: 1,
      hello: 2,
      simple: 2,
      table: 2,
      wanted: 2,
      lion: 2,
      nation: 2,
      beautiful: 3,
      actual: 3,
      computer: 3,
      quality: 3,
      piano: 3,
      education: 4,
      readability: 5,
      university: 5,
    };
    for (const [w, n] of Object.entries(cases)) expect([w, syllablesEn(w)]).toEqual([w, n]);
    expect(syllablesEn("")).toBe(0);
    expect(syllablesEn("123")).toBe(0);
  });

  it("counts French syllables with mute e and diaereses", () => {
    const cases: Record<string, number> = {
      un: 1,
      table: 1,
      parlent: 1,
      phrase: 1,
      maison: 2,
      oiseau: 2,
      naïf: 2,
      noël: 2,
      été: 2,
      crier: 2,
      école: 2,
      chocolat: 3,
      difficile: 3,
      ordinateur: 4,
      lisibilité: 5,
    };
    for (const [w, n] of Object.entries(cases)) expect([w, syllablesFr(w)]).toEqual([w, n]);
  });

  it("counts German syllables with diphthongs, long vowels and hiatus", () => {
    const cases: Record<string, number> = {
      Haus: 1,
      ein: 1,
      Boot: 1,
      See: 1,
      Aal: 1,
      Straße: 2,
      Häuser: 2,
      Feuer: 2,
      Quelle: 2,
      Biene: 2,
      Kaffee: 2,
      Mädchen: 2,
      Schifffahrt: 2,
      Theater: 3,
      Nation: 3,
      Eisenbahn: 3,
      Lesbarkeit: 3,
      beobachten: 4,
      Universität: 5,
    };
    for (const [w, n] of Object.entries(cases)) expect([w, syllablesDe(w)]).toEqual([w, n]);
    expect(syllablesDe("")).toBe(0);
  });
});

describe("words and sentences", () => {
  it("splits French elisions but keeps English contractions", () => {
    expect(words("L’oiseau d'été", "fr")).toEqual(["L", "oiseau", "d", "été"]);
    expect(words("don't stop", "en")).toEqual(["don't", "stop"]);
    expect(words("", "en")).toEqual([]);
  });

  it("finds sentences, not fooled by titles, initials, abbreviations or decimals", () => {
    const t = "Dr. Smith met J. Doe. It cost 3.5 dollars, e.g. a coffee! Really?\n\nNew paragraph";
    expect(sentences(t, "en").map((s) => t.slice(s.start, s.end))).toEqual([
      "Dr. Smith met J. Doe.",
      "It cost 3.5 dollars, e.g. a coffee!",
      "Really?",
      "New paragraph",
    ]);
    expect(sentences(t, "en").map((s) => s.words)).toEqual([5, 7, 1, 2]);
    expect(sentences("...", "en")).toEqual([]);
  });

  it("keeps German abbreviations and dates inside the sentence", () => {
    const t =
      "Das ist z. B. ein Test. Am 3. Oktober ist Feiertag. Er kam um 3. Dann ging er. Siehe Nr. 5 bzw. Abb. 3 unten.";
    expect(sentences(t, "de").map((s) => t.slice(s.start, s.end))).toEqual([
      "Das ist z. B. ein Test.",
      "Am 3. Oktober ist Feiertag.",
      "Er kam um 3.",
      "Dann ging er.",
      "Siehe Nr. 5 bzw. Abb. 3 unten.",
    ]);
    const u = "Das gilt z.B. für Äpfel.";
    expect(sentences(u, "de")).toHaveLength(1);
  });
});

describe("analyze", () => {
  it("returns no scores without words", () => {
    expect(analyze("", "en").scores).toEqual([]);
    expect(analyze("  123 !", "fr").scores).toEqual([]);
  });

  it("scores easy English as easy and dense English as hard", () => {
    const easy = analyze("The cat sat on the mat. The dog ran to the cat. It was fun.", "en");
    const flesch = easy.scores.find((s) => s.id === "flesch");
    expect(flesch?.value).toBeGreaterThan(90);
    expect(flesch?.level).toBe(0);
    expect(easy.scores.map((s) => s.id)).toEqual([
      "flesch",
      "fk",
      "fog",
      "smog",
      "cli",
      "ari",
      "lix",
    ]);
    expect(easy.scores.find((s) => s.id === "smog")?.shaky).toBe(true);

    const hard = analyze(
      "Notwithstanding considerable methodological heterogeneity, the investigators systematically characterized multidimensional interdependencies between organizational accountability and institutional sustainability.",
      "en",
    );
    expect(hard.scores.find((s) => s.id === "flesch")?.value).toBeLessThan(10);
    expect(hard.scores.find((s) => s.id === "fk")?.value).toBeGreaterThan(18);
    expect(hard.complex).toBeGreaterThan(8);
  });

  it("matches the Flesch formula on a hand-counted text", () => {
    // 2 sentences, 8 words, 10 syllables ("Hello" 2, "little" 2).
    const a = analyze("Hello my little cat. Go to bed now.", "en");
    expect([a.sentences.length, a.words, a.syllables]).toEqual([2, 8, 10]);
    const expected = 206.835 - 1.015 * (8 / 2) - 84.6 * (10 / 8);
    expect(a.scores[0]?.value).toBeCloseTo(expected, 0);
  });

  it("uses Kandel–Moles and LIX for French", () => {
    const a = analyze("Le chat dort sur le canapé. Il fait beau et l’oiseau chante.", "fr");
    expect(a.scores.map((s) => s.id)).toEqual(["kandel", "lix"]);
    expect(a.scores[0]?.value).toBeGreaterThan(80);
  });

  it("uses Flesch–Amstad, the Wiener Sachtextformel and LIX for German", () => {
    // 3 sentences, 13 words; syllables: Der Hund schläft (3), Die Kat-ze spielt im Gar-ten (7),
    // Es ist ein schö-ner Tag (6) = 16; 1-syllable words: 10; 3+ syllables: 0; > 6 letters: 2.
    const a = analyze(
      "Der Hund schläft. Die Katze spielt im Garten. Es ist ein schöner Tag.",
      "de",
    );
    expect([a.sentences.length, a.words, a.syllables, a.mono, a.complex, a.long]).toEqual([
      3, 13, 16, 10, 0, 2,
    ]);
    expect(a.scores.map((s) => s.id)).toEqual(["amstad", "wstf", "lix"]);
    expect(a.scores[0]?.value).toBeCloseTo(180 - 13 / 3 - 58.5 * (16 / 13), 0);
    expect(a.scores[0]?.level).toBe(0);
    const wstf = 0.1672 * (13 / 3) + 0.1297 * (200 / 13) - 0.0327 * ((100 * 10) / 13) - 0.875;
    expect(a.scores[1]?.value).toBe(Math.max(0, Math.round(wstf * 10) / 10));

    const hard = analyze(
      "Die Bundesregierung beabsichtigt, die verfassungsrechtlichen Rahmenbedingungen der grenzüberschreitenden Zusammenarbeit im Gesundheitswesen grundlegend weiterzuentwickeln.",
      "de",
    );
    expect(hard.scores[0]?.value).toBeLessThan(30);
    expect(hard.scores[1]?.value).toBeGreaterThan(12);
    expect(hard.scores[1]?.level).toBe(4);
  });
});

describe("detectLang", () => {
  it("tells English from French and German", () => {
    expect(detectLang("Le chat dort et il est content.")).toBe("fr");
    expect(detectLang("Der Hund schläft und die Katze ist müde.")).toBe("de");
    expect(detectLang("The cat is asleep and it is happy.")).toBe("en");
    expect(detectLang("")).toBe("en");
  });
});
