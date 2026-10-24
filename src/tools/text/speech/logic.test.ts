import { describe, expect, it } from "bun:test";
import {
  baseLang,
  chunkText,
  clampSettings,
  languages,
  pickVoice,
  voicesFor,
  wordAt,
} from "./logic";

const VOICES = [
  { name: "Thomas", lang: "fr-FR", localService: true, voiceURI: "thomas" },
  { name: "Amélie", lang: "fr-CA", localService: true, voiceURI: "amelie" },
  { name: "Google US", lang: "en-US", localService: false, voiceURI: "gus" },
  { name: "Samantha", lang: "en_US", localService: true, default: true, voiceURI: "sam" },
  { name: "Anna", lang: "de-DE", localService: true, voiceURI: "anna" },
];

describe("voices", () => {
  it("reads base languages from BCP 47 and underscore tags", () => {
    expect(baseLang("fr-FR")).toBe("fr");
    expect(baseLang("en_US")).toBe("en");
    expect(baseLang("")).toBe("");
  });

  it("lists languages with the preferred one first", () => {
    expect(languages(VOICES, "fr-BE")).toEqual(["fr", "de", "en"]);
    expect(languages(VOICES, "ja")).toEqual(["de", "en", "fr"]);
    expect(languages([], "fr")).toEqual([]);
  });

  it("filters by language, default and local voices first", () => {
    expect(voicesFor(VOICES, "en").map((v) => v.name)).toEqual(["Samantha", "Google US"]);
    expect(voicesFor(VOICES, "fr").map((v) => v.name)).toEqual(["Amélie", "Thomas"]);
    expect(voicesFor(VOICES, "all")).toHaveLength(5);
    expect(voicesFor(VOICES, "xx")).toEqual([]);
  });

  it("keeps the remembered voice when it is available", () => {
    const fr = voicesFor(VOICES, "fr");
    expect(pickVoice(fr, "thomas")?.name).toBe("Thomas");
    expect(pickVoice(fr, "gone")?.name).toBe("Amélie");
    expect(pickVoice([], "x")).toBeNull();
  });
});

describe("chunkText", () => {
  it("returns nothing for blank text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("  \n\n ")).toEqual([]);
  });

  it("splits at sentence ends and keeps offsets", () => {
    const text = "Hello there. How are you? Fine!";
    const chunks = chunkText(text);
    expect(chunks.map((c) => c.text)).toEqual(["Hello there.", " How are you?", " Fine!"]);
    for (const c of chunks) expect(text.slice(c.offset, c.offset + c.text.length)).toBe(c.text);
  });

  it("cuts long sentences at commas or spaces under the limit", () => {
    const text = `${"word ".repeat(30)}end, and ${"more ".repeat(30)}done.`;
    const chunks = chunkText(text, 60);
    expect(chunks.every((c) => c.text.length <= 60)).toBe(true);
    expect(chunks.map((c) => c.text).join("")).toBe(text);
    for (const c of chunks) expect(text.slice(c.offset, c.offset + c.text.length)).toBe(c.text);
  });

  it("cuts a long word with no space", () => {
    const chunks = chunkText("x".repeat(25), 10);
    expect(chunks.map((c) => c.text.length)).toEqual([10, 10, 5]);
  });
});

describe("wordAt", () => {
  const text = "L'été, c'est super-chouette !";
  it("finds the word around an index", () => {
    expect(wordAt(text, 0)).toEqual([0, 5]);
    expect(wordAt(text, 7)).toEqual([7, 12]);
    expect(wordAt(text, 15)).toEqual([13, 27]);
  });

  it("skips to the next word when pointed at a space", () => {
    expect(wordAt(text, 6)).toEqual([7, 12]);
  });

  it("uses the engine's length when given", () => {
    expect(wordAt(text, 7, 3)).toEqual([7, 10]);
  });

  it("returns null out of range or at the end", () => {
    expect(wordAt(text, -1)).toBeNull();
    expect(wordAt(text, 99)).toBeNull();
    expect(wordAt("hi !", 3)).toBeNull();
  });
});

describe("clampSettings", () => {
  it("clamps and replaces invalid numbers", () => {
    expect(clampSettings(20, -1, 2)).toEqual({ rate: 10, pitch: 0, volume: 1 });
    expect(clampSettings(Number.NaN, 1.5, 0.5)).toEqual({ rate: 1, pitch: 1.5, volume: 0.5 });
  });
});
