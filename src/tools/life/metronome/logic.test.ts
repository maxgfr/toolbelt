import { describe, expect, test } from "bun:test";
import { clampBpm, interval, kindOf, type Meter, schedule, tapTempo, tempoName } from "./logic";

const M: Meter = { bpm: 120, beats: 4, sub: 1, accent: true, unit: 4 };

describe("schedule", () => {
  test("120 BPM in 4/4: a click every 0.5 s, accent on beat 1", () => {
    const { ticks, cursor } = schedule({ next: 1, index: 0 }, 3.01, M);
    expect(ticks.map((t) => t.time)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(ticks.map((t) => t.kind)).toEqual(["accent", "beat", "beat", "beat", "accent"]);
    expect(ticks.map((t) => t.beat)).toEqual([0, 1, 2, 3, 0]);
    expect(cursor).toEqual({ next: 3.5, index: 1 });
  });

  test("successive calls continue exactly where the last one stopped", () => {
    let c = { next: 0, index: 0 };
    const all: number[] = [];
    for (let until = 0.1; until < 4; until += 0.1) {
      const r = schedule(c, until, M);
      c = r.cursor;
      all.push(...r.ticks.map((t) => t.time));
    }
    expect(all).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  });

  test("subdivisions", () => {
    const { ticks } = schedule({ next: 0, index: 0 }, 0.99, { ...M, sub: 3 });
    expect(ticks).toHaveLength(6);
    expect(ticks.map((t) => `${t.beat}.${t.sub}`)).toEqual([
      "0.0",
      "0.1",
      "0.2",
      "1.0",
      "1.1",
      "1.2",
    ]);
    expect(ticks.map((t) => t.kind)).toEqual(["accent", "sub", "sub", "beat", "sub", "sub"]);
    expect(ticks[1]?.time).toBeCloseTo(1 / 6);
  });

  test("changing the bar length mid-way wraps the position", () => {
    const { ticks } = schedule({ next: 0, index: 5 }, 1, { ...M, beats: 3 });
    expect(ticks.map((t) => t.beat)).toEqual([2, 0]);
  });

  test("no accent, and compound meters", () => {
    expect(kindOf({ ...M, accent: false }, 0, 0)).toBe("beat");
    const six = { ...M, beats: 6, unit: 8 };
    expect([0, 1, 2, 3, 4, 5].map((b) => kindOf(six, b, 0))).toEqual([
      "accent",
      "beat",
      "beat",
      "medium",
      "beat",
      "beat",
    ]);
    expect(kindOf({ ...M, beats: 3, unit: 8 }, 0, 0)).toBe("accent");
  });

  test("interval and clamping", () => {
    expect(interval({ ...M, bpm: 60, sub: 2 })).toBe(0.5);
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(300);
    expect(clampBpm(Number.NaN)).toBe(120);
    expect(clampBpm(99.6)).toBe(100);
  });
});

describe("tapTempo", () => {
  test("averages the recent taps", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 1000])).toBe(60);
  });
  test("needs two taps; a pause restarts", () => {
    expect(tapTempo([])).toBeNull();
    expect(tapTempo([100])).toBeNull();
    expect(tapTempo([0, 500, 5000])).toBeNull();
    expect(tapTempo([0, 500, 5000, 5400])).toBe(150);
  });
  test("keeps only the last taps", () => {
    const taps = [0, 1000, 2000, 2500, 3000, 3500];
    expect(tapTempo(taps, 3)).toBe(120);
  });
});

test("tempo names", () => {
  expect(tempoName(50)).toBe("Largo");
  expect(tempoName(120)).toBe("Allegro");
  expect(tempoName(250)).toBe("Prestissimo");
});
