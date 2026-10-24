import { describe, expect, it } from "bun:test";
import { countWords, formatDuration, textStats, wordFrequency } from "./logic";

describe("counter", () => {
  it("counts an empty text as zero everywhere", () => {
    const s = textStats("");
    expect(s.characters).toBe(0);
    expect(s.words).toBe(0);
    expect(s.lines).toBe(0);
    expect(s.paragraphs).toBe(0);
  });

  it("counts words, lines, sentences and paragraphs", () => {
    const s = textStats("Hello world. How are you?\n\nFine, thanks!");
    expect(s.words).toBe(7);
    expect(s.lines).toBe(3);
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
  });

  it("separates UTF-16 units, graphemes and UTF-8 bytes", () => {
    const s = textStats("é👍🏽");
    expect(s.characters).toBe(5);
    expect(s.graphemes).toBe(2);
    expect(s.bytes).toBe(10);
  });

  it("counts French elisions as words", () => {
    expect(countWords("l'arbre d'à côté", "fr")).toBeGreaterThanOrEqual(3);
  });

  it("ranks frequent words", () => {
    expect(wordFrequency("a b a c a b", 2)).toEqual([
      { word: "a", count: 3 },
      { word: "b", count: 2 },
    ]);
  });

  it("formats durations", () => {
    expect(formatDuration(0.5)).toBe("30 s");
    expect(formatDuration(2)).toBe("2 min");
    expect(formatDuration(3.34)).toBe("3 min 20 s");
  });
});
