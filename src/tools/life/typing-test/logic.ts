/**
 * Typing test scoring. Words are compared letter by letter; WPM counts the characters of
 * correctly typed words (plus the spaces after them) divided by 5 per minute, raw WPM counts
 * every typed character, and accuracy is the share of correct keystrokes (corrected mistakes
 * still count as mistakes).
 */
import type { RandomInt } from "../_shared";

/** `n` words drawn from `list`, never the same word twice in a row. */
export function makeWords(rand: RandomInt, list: readonly string[], n: number): string[] {
  const out: string[] = [];
  if (!list.length) return out;
  for (let i = 0; i < n; i++) {
    let w = list[rand(list.length)] as string;
    if (list.length > 1 && w === out[i - 1])
      w = list[(list.indexOf(w) + 1) % list.length] as string;
    out.push(w);
  }
  return out;
}

export type CharState = "correct" | "wrong" | "extra" | "missing" | "pending";

/**
 * The state of each letter of `target` (and extra typed letters) once `typed` is entered.
 * With `done`, untyped letters are "missing"; otherwise they are still "pending".
 */
export function compareWord(
  target: string,
  typed: string,
  done: boolean,
): { char: string; state: CharState }[] {
  const t = [...target];
  const u = [...typed];
  const out: { char: string; state: CharState }[] = t.map((c, i) => ({
    char: c,
    state: i < u.length ? (u[i] === c ? "correct" : "wrong") : done ? "missing" : "pending",
  }));
  for (let i = t.length; i < u.length; i++) out.push({ char: u[i] as string, state: "extra" });
  return out;
}

export interface Score {
  wpm: number;
  raw: number;
  /** 0–100. */
  accuracy: number;
  correctWords: number;
  wrongWords: number;
  /** Letters wrong, extra or missing in the words typed so far. */
  errors: number;
  seconds: number;
}

/**
 * Scores the test. `typed` holds what was typed for each word (the last one may be in
 * progress); `keys` counts keystrokes that added a correct / wrong character.
 */
export function score(
  targets: readonly string[],
  typed: readonly string[],
  keys: { correct: number; wrong: number },
  ms: number,
): Score {
  const minutes = Math.max(ms, 1) / 60_000;
  let good = 0;
  let all = 0;
  let correctWords = 0;
  let wrongWords = 0;
  let errors = 0;
  typed.forEach((u, i) => {
    const t = targets[i] ?? "";
    const last = i === typed.length - 1;
    const len = [...u].length;
    all += len + (last ? 0 : 1);
    if (u === t) {
      correctWords++;
      good += len + (last ? 0 : 1);
    } else if (last && t.startsWith(u)) {
      // A word in progress counts its correct letters so far.
      good += len;
    } else {
      wrongWords++;
    }
    errors += compareWord(t, u, !last).filter(
      (c) => c.state === "wrong" || c.state === "extra" || c.state === "missing",
    ).length;
  });
  const total = keys.correct + keys.wrong;
  return {
    wpm: good / 5 / minutes,
    raw: all / 5 / minutes,
    accuracy: total ? (keys.correct / total) * 100 : 100,
    correctWords,
    wrongWords,
    errors,
    seconds: ms / 1000,
  };
}

/**
 * Whether one keystroke was right: the input went from `before` to `after` for the word
 * `target`. Returns null when no character was added (deletion, nothing changed).
 */
export function keystroke(target: string, before: string, after: string): boolean | null {
  const a = [...after];
  const b = [...before];
  if (a.length <= b.length) return null;
  const i = a.length - 1;
  return a[i] === [...target][i];
}

/** Key under which a personal best is stored: mode, length and language. */
export function bestKey(mode: "time" | "words", n: number, lang: string): string {
  return `${mode}-${n}-${lang}`;
}
