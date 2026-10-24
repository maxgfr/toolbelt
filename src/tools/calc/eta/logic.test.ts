import { describe, expect, it } from "bun:test";
import { eta, parseLocal, requiredPace, splitDuration, timeAtPace, toLocalInput } from "./logic";

const H = 3600000;
const start = new Date(2026, 9, 24, 9, 0).getTime();

describe("ETA from progress", () => {
  it("extrapolates the rate so far", () => {
    // 30 of 120 done in 1 h 30: 20 / h, 90 left → 4 h 30, done at 15:00.
    const r = eta({ total: 120, done: 30, startMs: start, nowMs: start + 1.5 * H });
    if (typeof r === "string") throw new Error(r);
    expect(r.percent).toBe(25);
    expect(r.perHour).toBeCloseTo(20, 10);
    expect(r.remaining).toBe(90);
    expect(r.remainingMs).toBeCloseTo(4.5 * H, 3);
    expect(r.finishMs).toBe(new Date(2026, 9, 24, 15, 0).getTime());
    expect(r.totalMs).toBeCloseTo(6 * H, 3);
  });

  it("can't predict before the first item", () => {
    const r = eta({ total: 10, done: 0, startMs: start, nowMs: start + H });
    if (typeof r === "string") throw new Error(r);
    expect(r.remainingMs).toBe(Number.POSITIVE_INFINITY);
    expect(r.finishMs).toBeNull();
  });

  it("is done when everything is done", () => {
    const r = eta({ total: 10, done: 10, startMs: start, nowMs: start + H });
    expect(typeof r !== "string" && r.remainingMs).toBe(0);
  });

  it("reports bad input", () => {
    expect(eta({ total: 0, done: 0, startMs: start, nowMs: start + H })).toBe("total");
    expect(eta({ total: 5, done: 6, startMs: start, nowMs: start + H })).toBe("done");
    expect(eta({ total: 5, done: 1, startMs: start, nowMs: start - 1 })).toBe("start");
  });
});

describe("pace", () => {
  it("gives the time at a known pace", () => {
    expect(timeAtPace(45, 30)).toBe(1.5 * H);
    expect(timeAtPace(10, 0)).toBeNull();
  });

  it("gives the pace needed for a deadline", () => {
    expect(requiredPace(90, start, start + 3 * H)).toBe(30);
    expect(requiredPace(90, start, start - 1)).toBeNull();
  });
});

describe("helpers", () => {
  it("reads and writes datetime-local values", () => {
    expect(parseLocal("2026-10-24T09:00")).toBe(start);
    expect(toLocalInput(start)).toBe("2026-10-24T09:00");
    expect(parseLocal("2026-02-30T09:00")).toBeNull();
    expect(parseLocal("nope")).toBeNull();
  });

  it("splits durations", () => {
    expect(splitDuration(1.5 * H)).toEqual({ d: 0, h: 1, m: 30 });
    expect(splitDuration(26 * H + 59.6 * 60000)).toEqual({ d: 1, h: 3, m: 0 });
  });
});
