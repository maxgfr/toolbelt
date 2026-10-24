import { describe, expect, it } from "bun:test";
import {
  formatOffset,
  parseIsoDate,
  parseNumber,
  parseTime,
  searchZones,
  splitSeconds,
  wallClock,
  zonedToUtc,
  zoneOffset,
} from "./_shared";

describe("parseNumber", () => {
  it("reads both decimal separators and thousand groups", () => {
    expect(parseNumber("1234.5")).toBe(1234.5);
    expect(parseNumber("1234,5")).toBe(1234.5);
    expect(parseNumber("1 234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234,567")).toBe(1234567);
    expect(parseNumber("−3")).toBe(-3);
    expect(parseNumber("2e3")).toBe(2000);
    expect(parseNumber(".5")).toBe(0.5);
  });

  it("returns null for empty or garbage", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("1-2")).toBeNull();
  });
});

describe("time zones", () => {
  const jan = new Date("2024-01-31T12:00:00Z");
  const jul = new Date("2024-07-01T12:00:00Z");

  it("knows offsets, with DST", () => {
    expect(zoneOffset(jan, "Europe/Paris")).toBe(60);
    expect(zoneOffset(jul, "Europe/Paris")).toBe(120);
    expect(zoneOffset(jan, "America/New_York")).toBe(-300);
    expect(zoneOffset(jan, "Asia/Kathmandu")).toBe(345);
    expect(zoneOffset(jan, "UTC")).toBe(0);
  });

  it("reads the wall clock in a zone", () => {
    const w = wallClock(jan, "Asia/Tokyo");
    expect([w.year, w.month, w.day, w.hour, w.minute, w.weekday]).toEqual([2024, 1, 31, 21, 0, 3]);
    expect(wallClock(new Date("2024-01-01T02:00:00Z"), "America/Los_Angeles").day).toBe(31);
  });

  it("turns a wall-clock time in a zone into an instant", () => {
    const at = (h: number, m: number, zone: string, d = 31, mo = 1) =>
      zonedToUtc({ year: 2024, month: mo, day: d, hour: h, minute: m }, zone).toISOString();
    expect(at(12, 0, "Europe/Paris")).toBe("2024-01-31T11:00:00.000Z");
    expect(at(12, 0, "America/New_York")).toBe("2024-01-31T17:00:00.000Z");
    // Paris skips 02:00–03:00 on 2024-03-31: 02:30 lands at 03:30 CEST.
    expect(at(2, 30, "Europe/Paris", 31, 3)).toBe("2024-03-31T01:30:00.000Z");
    // Paris lives 02:00–03:00 twice on 2024-10-27: the first one is chosen.
    expect(at(2, 30, "Europe/Paris", 27, 10)).toBe("2024-10-27T00:30:00.000Z");
    expect(at(2, 30, "America/New_York", 10, 3)).toBe("2024-03-10T07:30:00.000Z");
  });

  it("formats offsets", () => {
    expect(formatOffset(60)).toBe("+01:00");
    expect(formatOffset(-330)).toBe("-05:30");
    expect(formatOffset(0)).toBe("+00:00");
  });

  it("searches by city, abbreviation and offset", () => {
    const zones = ["UTC", "Europe/Paris", "America/New_York", "Asia/Kolkata", "Asia/Kathmandu"];
    expect(searchZones("paris", zones)[0]).toBe("Europe/Paris");
    expect(searchZones("new york", zones)[0]).toBe("America/New_York");
    expect(searchZones("est", zones)[0]).toBe("America/New_York");
    const europe = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich"];
    expect(searchZones("wien", europe)[0]).toBe("Europe/Vienna");
    expect(searchZones("München", europe)[0]).toBe("Europe/Berlin");
    expect(searchZones("mez", europe)[0]).toBe("Europe/Berlin");
    expect(searchZones("genf", europe)[0]).toBe("Europe/Zurich");
    expect(searchZones("+05:45", zones, new Date("2024-01-31T12:00:00Z"))).toEqual([
      "Asia/Kathmandu",
    ]);
    expect(searchZones("", zones)).toEqual(zones);
    expect(searchZones("zzzz", zones)).toEqual([]);
  });
});

describe("dates and times", () => {
  it("parses real dates only", () => {
    expect(parseIsoDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseIsoDate("2023-02-29")).toBeNull();
    expect(parseIsoDate("2024-13-01")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });

  it("parses times", () => {
    expect(parseTime("9:05")).toEqual({ hour: 9, minute: 5, second: 0 });
    expect(parseTime("23:59:59")).toEqual({ hour: 23, minute: 59, second: 59 });
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("noon")).toBeNull();
  });
});

describe("splitSeconds", () => {
  it("splits durations", () => {
    expect(splitSeconds(90061.5)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1.5 });
    expect(splitSeconds(59)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 59 });
  });
});
