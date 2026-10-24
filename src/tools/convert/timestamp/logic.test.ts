import { describe, expect, it } from "bun:test";
import { isoWeek, relative } from "../_shared";
import { breakdown, detectUnit, parseInput } from "./logic";

const UTC = "UTC";

describe("timestamp parsing", () => {
  it("guesses the unit of a number from its size", () => {
    expect(detectUnit(1706702400)).toBe("s");
    expect(detectUnit(1706702400000)).toBe("ms");
    expect(detectUnit(1706702400000000)).toBe("us");
    expect(detectUnit(1706702400000000000)).toBe("ns");
  });

  it("reads seconds, milliseconds, microseconds and nanoseconds", () => {
    for (const s of ["1706702400", "1706702400000", "1706702400000000", "1706702400000000000"]) {
      const p = parseInput(s, "auto", UTC);
      expect(p.ok && p.ms).toBe(1706702400000);
    }
    const ns = parseInput("1706702400123456789", "auto", UTC);
    expect(ns.ok && ns.kind === "number" && [ns.ms, ns.subMs]).toEqual([1706702400123, 456789]);
  });

  it("follows a forced unit", () => {
    const p = parseInput("1706702400", "ms", UTC);
    expect(p.ok && p.ms).toBe(1706702400);
  });

  it("handles negative and fractional timestamps", () => {
    const p = parseInput("-86400", "auto", UTC);
    expect(p.ok && new Date(p.ms).toISOString()).toBe("1969-12-31T00:00:00.000Z");
    const f = parseInput("1706702400.5", "auto", UTC);
    expect(f.ok && f.ms).toBe(1706702400500);
  });

  it("reads ISO dates, with or without an offset", () => {
    const z = parseInput("2024-01-31T12:00:00Z", "auto", "Europe/Paris");
    expect(z.ok && z.ms).toBe(Date.UTC(2024, 0, 31, 12));
    const off = parseInput("2024-01-31T12:00:00+02:00", "auto", UTC);
    expect(off.ok && off.ms).toBe(Date.UTC(2024, 0, 31, 10));
    // No offset: read in the chosen zone.
    const local = parseInput("2024-01-31 12:00", "auto", "Europe/Paris");
    expect(local.ok && local.ms).toBe(Date.UTC(2024, 0, 31, 11));
    const day = parseInput("2024-01-31", "auto", "America/New_York");
    expect(day.ok && day.ms).toBe(Date.UTC(2024, 0, 31, 5));
    const frac = parseInput("2024-01-31T12:00:00.25Z", "auto", UTC);
    expect(frac.ok && frac.ms).toBe(Date.UTC(2024, 0, 31, 12, 0, 0, 250));
  });

  it("reads RFC 2822 dates", () => {
    const p = parseInput("Wed, 31 Jan 2024 12:00:00 +0100", "auto", UTC);
    expect(p.ok && p.ms).toBe(Date.UTC(2024, 0, 31, 11));
    const g = parseInput("31 Jan 2024 12:00 GMT", "auto", "Asia/Tokyo");
    expect(g.ok && g.ms).toBe(Date.UTC(2024, 0, 31, 12));
  });

  it("rejects empty, impossible and garbage input", () => {
    expect(parseInput("", "auto", UTC)).toEqual({ ok: false, error: "empty" });
    expect(parseInput("2023-02-29", "auto", UTC).ok).toBe(false);
    expect(parseInput("2024-01-31 25:00", "auto", UTC).ok).toBe(false);
    expect(parseInput("yesterday-ish", "auto", UTC).ok).toBe(false);
    expect(parseInput("99999999999999999999999", "ms", UTC)).toEqual({ ok: false, error: "range" });
  });
});

describe("timestamp formats", () => {
  const ms = Date.UTC(2024, 0, 31, 12, 0, 0, 123);

  it("gives ISO, RFC 2822 and the numbers", () => {
    const b = breakdown(ms, "Europe/Paris", 456789);
    expect(b.isoUtc).toBe("2024-01-31T12:00:00.123Z");
    expect(b.isoZone).toBe("2024-01-31T13:00:00.123+01:00");
    expect(b.rfc2822).toBe("Wed, 31 Jan 2024 13:00:00 +0100");
    expect(b.seconds).toBe("1706702400");
    expect(b.millis).toBe("1706702400123");
    expect(b.micros).toBe("1706702400123456");
    expect(b.nanos).toBe("1706702400123456789");
    expect(b.dayOfYear).toBe(31);
    expect(b.week).toEqual({ year: 2024, week: 5 });
    expect(breakdown(ms, UTC).isoZone).toBe("2024-01-31T12:00:00.123Z");
  });

  it("uses the zone's date for the day of year", () => {
    expect(breakdown(Date.UTC(2024, 11, 31, 23), "Asia/Tokyo").dayOfYear).toBe(1);
    expect(breakdown(Date.UTC(2024, 11, 31, 23), UTC).dayOfYear).toBe(366);
  });

  it("computes ISO weeks across year ends", () => {
    expect(isoWeek(2021, 1, 3)).toEqual({ year: 2020, week: 53 });
    expect(isoWeek(2024, 12, 30)).toEqual({ year: 2025, week: 1 });
    expect(isoWeek(2026, 10, 24)).toEqual({ year: 2026, week: 43 });
  });

  it("says how long ago, in the UI language", () => {
    const now = Date.UTC(2024, 0, 31, 12);
    expect(relative(now - 3 * 86400000, now, "en-US")).toBe("3 days ago");
    expect(relative(now - 3 * 86400000, now, "fr-FR")).toBe("il y a 3 jours");
    expect(relative(now - 3 * 86400000, now, "de-DE")).toBe("vor 3 Tagen");
    expect(relative(now + 2 * 3600000, now, "de-DE")).toBe("in 2 Stunden");
    expect(relative(now - 86400000, now, "de-DE")).toBe("gestern");
    expect(relative(now + 2 * 3600000, now, "en-US")).toBe("in 2 hours");
    expect(relative(now, now, "en-US")).toBe("now");
  });
});
