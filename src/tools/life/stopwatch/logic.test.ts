import { describe, expect, test } from "bun:test";
import { formatClock } from "../_shared";
import { EMPTY, elapsed, lap, lapRows, lapsText, normalize, start, stop, toggle } from "./logic";

describe("stopwatch", () => {
  test("accumulates runs from timestamps", () => {
    let w = start(EMPTY, 1000);
    expect(elapsed(w, 3500)).toBe(2500);
    w = stop(w, 4000);
    expect(elapsed(w, 99_999)).toBe(3000);
    w = toggle(w, 10_000);
    expect(elapsed(w, 10_250)).toBe(3250);
  });

  test("a long gap (background tab, reload) is counted exactly", () => {
    const w = start(EMPTY, 0);
    expect(elapsed(w, 3_600_000)).toBe(3_600_000);
  });

  test("start and stop are idempotent", () => {
    const w = start(EMPTY, 5);
    expect(start(w, 50)).toBe(w);
    expect(stop(EMPTY, 50)).toBe(EMPTY);
  });

  test("laps record totals, ignore zero and duplicates", () => {
    expect(lap(EMPTY, 0)).toBe(EMPTY);
    let w = start(EMPTY, 0);
    w = lap(w, 1000);
    w = lap(w, 1000);
    w = lap(w, 2500);
    expect(w.laps).toEqual([1000, 2500]);
  });

  test("lap rows: splits, best and worst", () => {
    const rows = lapRows([1000, 2500, 3200]);
    expect(rows.map((r) => r.split)).toEqual([1000, 1500, 700]);
    expect(rows.map((r) => [r.best, r.worst])).toEqual([
      [false, false],
      [false, true],
      [true, false],
    ]);
  });

  test("no best/worst with one lap or equal splits", () => {
    expect(lapRows([1000])[0]?.best).toBe(false);
    expect(lapRows([1000, 2000]).some((r) => r.best || r.worst)).toBe(false);
  });

  test("text export", () => {
    expect(lapsText([1000, 2500], ["#", "Lap", "Total"])).toBe(
      "#\tLap\tTotal\n1\t0:01.00\t0:01.00\n2\t0:01.50\t0:02.50",
    );
  });

  test("normalize rejects junk", () => {
    expect(normalize(null)).toEqual(EMPTY);
    expect(normalize({ startedAt: "x", base: -3, laps: [1, "a", Number.NaN] })).toEqual({
      startedAt: null,
      base: 0,
      laps: [1],
    });
  });
});

describe("formatClock", () => {
  test("formats minutes, hours and decimals", () => {
    expect(formatClock(0, 2)).toBe("0:00.00");
    expect(formatClock(61_234, 2)).toBe("1:01.23");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(59_999, 1)).toBe("0:59.9");
    expect(formatClock(5000, 0, true)).toBe("0:00:05");
    expect(formatClock(-1500)).toBe("-0:01");
  });
});
