import { describe, expect, test } from "bun:test";
import {
  advance,
  cycleDots,
  DEFAULTS,
  INITIAL,
  nextPhase,
  normalizePomo,
  normalizeSettings,
  pause,
  phaseMs,
  progress,
  remaining,
  type Settings,
  skip,
  start,
  todayCount,
} from "./logic";

const MIN = 60_000;
const day = () => "2026-10-24";

describe("pomodoro", () => {
  test("phase order: 4 work sessions then a long break", () => {
    let p = { phase: "work" as const, done: 0 };
    const seq: string[] = [];
    let cur: { phase: "work" | "short" | "long"; done: number } = p;
    for (let i = 0; i < 9; i++) {
      cur = nextPhase(cur.phase, cur.done, 4);
      seq.push(cur.phase);
    }
    expect(seq).toEqual([
      "short",
      "work",
      "short",
      "work",
      "short",
      "work",
      "long",
      "work",
      "short",
    ]);
    p = { phase: "work", done: 0 };
    expect(nextPhase(p.phase, p.done, 1).phase).toBe("long");
  });

  test("start, pause and remaining", () => {
    let p = start(INITIAL, DEFAULTS, 0);
    expect(remaining(p, DEFAULTS, 5 * MIN)).toBe(20 * MIN);
    expect(progress(p, DEFAULTS, 5 * MIN)).toBeCloseTo(0.2);
    p = pause(p, DEFAULTS, 5 * MIN);
    expect(remaining(p, DEFAULTS, 99 * MIN)).toBe(20 * MIN);
    p = start(p, DEFAULTS, 100 * MIN);
    expect(p.endAt).toBe(120 * MIN);
  });

  test("a finished work session counts and auto-starts the break from the exact end", () => {
    const p = start(INITIAL, DEFAULTS, 0);
    const { state, events } = advance(p, DEFAULTS, 25 * MIN + 3000, day);
    expect(events).toEqual([{ phase: "work", at: 25 * MIN, next: "short" }]);
    expect(state.phase).toBe("short");
    expect(state.endAt).toBe(30 * MIN);
    expect(todayCount(state, "2026-10-24")).toBe(1);
    expect(todayCount(state, "2026-10-25")).toBe(0);
  });

  test("without auto-start work, it stops after the break", () => {
    const p = start(INITIAL, DEFAULTS, 0);
    const { state, events } = advance(p, DEFAULTS, 3 * 3600_000, day);
    expect(events.map((e) => e.phase)).toEqual(["work", "short"]);
    expect(state).toMatchObject({ phase: "work", endAt: null, done: 1, count: 1 });
  });

  test("fully automatic: replays every phase that ended while away", () => {
    const s: Settings = { ...DEFAULTS, autoWork: true };
    const p = start(INITIAL, s, 0);
    // 4 × 25 + 3 × 5 = 115 min, then the long break of 15 min.
    const { state, events } = advance(p, s, 116 * MIN, day);
    expect(events.map((e) => e.phase)).toEqual([
      "work",
      "short",
      "work",
      "short",
      "work",
      "short",
      "work",
    ]);
    expect(state.phase).toBe("long");
    expect(state.endAt).toBe(130 * MIN);
    expect(state.count).toBe(4);
    const after = advance(state, s, 131 * MIN, day).state;
    expect(after).toMatchObject({ phase: "work", done: 0, endAt: 155 * MIN });
  });

  test("the day count restarts on a new day", () => {
    const p = { ...start(INITIAL, DEFAULTS, 0), day: "2026-10-23", count: 7 };
    expect(advance(p, DEFAULTS, 26 * MIN, day).state.count).toBe(1);
  });

  test("skip does not count the session", () => {
    const p = skip(start(INITIAL, DEFAULTS, 0), DEFAULTS, MIN);
    expect(p).toMatchObject({ phase: "short", done: 0, endAt: MIN + 5 * MIN });
    expect(skip(p, DEFAULTS, 2 * MIN).phase).toBe("work");
  });

  test("cycle dots", () => {
    expect(cycleDots({ ...INITIAL, done: 2 }, 4)).toEqual([true, true, false, false]);
    expect(cycleDots({ ...INITIAL, phase: "long", done: 4 }, 4)).toEqual([true, true, true, true]);
  });

  test("normalize clamps settings and state", () => {
    expect(normalizeSettings({ work: 0, cycles: 99.4, autoWork: "x" })).toMatchObject({
      work: 1,
      cycles: 12,
      autoWork: false,
    });
    expect(normalizePomo(null)).toEqual(INITIAL);
    expect(phaseMs(DEFAULTS, "long")).toBe(15 * MIN);
  });
});
