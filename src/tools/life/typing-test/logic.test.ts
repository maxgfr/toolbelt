import { describe, expect, test } from "bun:test";
import { seededInt } from "../_shared";
import { bestKey, compareWord, keystroke, makeWords, score } from "./logic";
import { EN_WORDS, FR_WORDS } from "./words";

describe("word lists", () => {
  test("about 200 words each, no blanks or duplicates", () => {
    for (const list of [EN_WORDS, FR_WORDS]) {
      expect(list.length).toBeGreaterThanOrEqual(180);
      expect(list.every((w) => w.length > 0 && !/\s/.test(w))).toBe(true);
      expect(new Set(list).size).toBe(list.length);
    }
  });
  test("makeWords draws from the list without immediate repeats", () => {
    const w = makeWords(seededInt(1), ["a", "b"], 50);
    expect(w).toHaveLength(50);
    expect(w.every((x, i) => i === 0 || x !== w[i - 1])).toBe(true);
    expect(makeWords(seededInt(1), [], 5)).toEqual([]);
    expect(makeWords(seededInt(1), ["solo"], 3)).toEqual(["solo", "solo", "solo"]);
  });
});

describe("compareWord", () => {
  const st = (t: string, u: string, done: boolean) =>
    compareWord(t, u, done)
      .map((c) => c.state[0])
      .join("");
  test("correct, wrong, extra, pending, missing", () => {
    expect(st("hello", "hello", true)).toBe("ccccc");
    expect(st("hello", "hallo", true)).toBe("cwccc");
    expect(st("hi", "hiya", true)).toBe("ccee");
    expect(st("hello", "he", false)).toBe("ccppp");
    expect(st("hello", "he", true)).toBe("ccmmm");
  });
  test("accented letters are single characters", () => {
    expect(compareWord("été", "été", true).every((c) => c.state === "correct")).toBe(true);
    expect(compareWord("œil", "oeil", true).map((c) => c.state)).toEqual([
      "wrong",
      "wrong",
      "wrong",
      "extra",
    ]);
  });
});

describe("score", () => {
  test("a perfect minute", () => {
    // 10 words of 4 letters + 9 spaces between = 49 chars.
    const words = Array<string>(10).fill("abcd");
    const s = score(words, words, { correct: 49, wrong: 0 }, 60_000);
    expect(s.wpm).toBeCloseTo(49 / 5);
    expect(s.raw).toBeCloseTo(49 / 5);
    expect(s.accuracy).toBe(100);
    expect(s.correctWords).toBe(10);
    expect(s.errors).toBe(0);
  });
  test("wrong words do not count for WPM but do for raw", () => {
    const s = score(["one", "two", "six"], ["one", "twx", "si"], { correct: 9, wrong: 1 }, 30_000);
    // good: "one " (4) + "si" in progress (2) = 6 → 6 / 5 / 0.5 min = 2.4
    expect(s.wpm).toBeCloseTo(2.4);
    // all: "one " + "twx " + "si" = 10 chars
    expect(s.raw).toBeCloseTo(4);
    expect(s.accuracy).toBeCloseTo(90);
    expect([s.correctWords, s.wrongWords, s.errors]).toEqual([1, 1, 1]);
  });
  test("skipped letters of finished words are errors", () => {
    const s = score(["hello", "x"], ["he", ""], { correct: 2, wrong: 0 }, 10_000);
    expect(s.errors).toBe(3);
    expect(s.wrongWords).toBe(1);
  });
  test("no time and no keys do not divide by zero", () => {
    const s = score(["a"], [""], { correct: 0, wrong: 0 }, 0);
    expect(Number.isFinite(s.wpm)).toBe(true);
    expect(s.accuracy).toBe(100);
  });
});

test("keystroke and best key", () => {
  expect(keystroke("cat", "c", "ca")).toBe(true);
  expect(keystroke("cat", "c", "cx")).toBe(false);
  expect(keystroke("cat", "cat", "catt")).toBe(false);
  expect(keystroke("cat", "ca", "c")).toBeNull();
  expect(bestKey("time", 30, "fr")).toBe("time-30-fr");
});
