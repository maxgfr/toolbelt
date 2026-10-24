import { describe, expect, test } from "bun:test";
import { formatRemaining } from "../_shared";
import {
  addTime,
  endKey,
  makeTimer,
  newlyDone,
  normalizeTimers,
  parseDuration,
  pauseTimer,
  progress,
  remaining,
  resetTimer,
  startTimer,
  status,
  titleText,
} from "./logic";

const MIN = 60_000;

describe("timer lifecycle", () => {
  test("idle → running → paused → running → done", () => {
    let t = makeTimer("a", "Tea", 3 * MIN);
    expect(status(t, 0)).toBe("idle");
    t = startTimer(t, 1000);
    expect(t.endAt).toBe(1000 + 3 * MIN);
    expect(status(t, 2000)).toBe("running");
    expect(remaining(t, 61_000)).toBe(2 * MIN);
    t = pauseTimer(t, 61_000);
    expect(status(t, 999_999)).toBe("paused");
    expect(remaining(t, 999_999)).toBe(2 * MIN);
    t = startTimer(t, 100_000);
    expect(t.endAt).toBe(100_000 + 2 * MIN);
    expect(status(t, 100_000 + 2 * MIN)).toBe("done");
    expect(remaining(t, 10 ** 9)).toBe(0);
    expect(progress(t, 10 ** 9)).toBe(1);
  });

  test("a done timer restarts from its full length; reset goes back to idle", () => {
    let t = startTimer(makeTimer("a", "x", MIN), 0);
    t = startTimer(t, 5 * MIN);
    expect(t.endAt).toBe(6 * MIN);
    expect(status(resetTimer(t), 0)).toBe("idle");
  });

  test("survives a reload: only the end timestamp matters", () => {
    const t = startTimer(makeTimer("a", "x", 10 * MIN), 0);
    const restored = normalizeTimers(JSON.parse(JSON.stringify([t])));
    expect(remaining(restored[0] as never, 4 * MIN)).toBe(6 * MIN);
  });

  test("adding time", () => {
    let t = startTimer(makeTimer("a", "x", MIN), 0);
    t = addTime(t, MIN, 30_000);
    expect(remaining(t, 30_000)).toBe(90_000);
    expect(t.duration).toBe(90_000);
    const done = startTimer(makeTimer("b", "y", MIN), 0);
    expect(status(addTime(done, MIN, 2 * MIN), 2 * MIN)).toBe("running");
    const idle = addTime(makeTimer("c", "z", MIN), -2 * MIN, 0);
    expect(idle.left).toBe(0);
  });

  test("announces each end once", () => {
    const a = startTimer(makeTimer("a", "A", MIN), 0);
    const b = startTimer(makeTimer("b", "B", 2 * MIN), 0);
    const seen = new Set<string>();
    expect(newlyDone([a, b], seen, 30_000)).toEqual([]);
    const first = newlyDone([a, b], seen, MIN);
    expect(first.map((t) => t.id)).toEqual(["a"]);
    seen.add(endKey(a));
    expect(newlyDone([a, b], seen, MIN + 1)).toEqual([]);
  });

  test("title shows the soonest timer, or the done ones", () => {
    const a = startTimer(makeTimer("a", "Pasta", 10 * MIN), 0);
    const b = startTimer(makeTimer("b", "Eggs", 6 * MIN), 0);
    expect(titleText([a, b], 59_500)).toBe("⏳ 5:01 · Eggs");
    expect(titleText([a, b], 6 * MIN)).toBe("⏰ Eggs");
    expect(titleText([makeTimer("c", "c", MIN)], 0)).toBeNull();
  });
});

describe("parseDuration", () => {
  test.each([
    ["5", 5 * MIN],
    ["2.5", 150_000],
    ["1:30", 90_000],
    ["1:02:03", 3_723_000],
    ["90s", 90_000],
    ["5m", 5 * MIN],
    ["5 min", 5 * MIN],
    ["1h30", 90 * MIN],
    ["1h 30m 15s", 5415_000],
    ["5m30", 330_000],
    ["2 heures", 120 * MIN],
    ["10 secondes", 10_000],
  ])("%p", (text, ms) => {
    expect(parseDuration(text)).toBe(ms);
  });

  test.each(["", "abc", "1:75", "0", "5 apples", "200h", "-3"])("rejects %p", (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});

test("formatRemaining rounds up", () => {
  expect(formatRemaining(4200)).toBe("0:05");
  expect(formatRemaining(5000)).toBe("0:05");
  expect(formatRemaining(0)).toBe("0:00");
  expect(formatRemaining(-50)).toBe("0:00");
});
