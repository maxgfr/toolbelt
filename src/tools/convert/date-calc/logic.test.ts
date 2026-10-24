import { describe, expect, it } from "bun:test";
import {
  addBusinessDays,
  addDuration,
  addMonths,
  businessDaysBetween,
  type DateTime,
  difference,
  formatDateTime,
  readDateTime,
} from "./logic";

const d = (year: number, month: number, day: number, hour = 0, minute = 0): DateTime => ({
  year,
  month,
  day,
  hour,
  minute,
});
const NONE = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0 };

describe("difference", () => {
  it("splits into years, months and days", () => {
    const r = difference(d(2020, 2, 29), d(2024, 3, 15));
    expect([r.years, r.months, r.days]).toEqual([4, 0, 15]);
    expect(r.totalDays).toBe(1476);
    expect(r.sign).toBe(1);
  });

  it("counts weeks, hours and minutes", () => {
    const r = difference(d(2024, 1, 1, 8, 0), d(2024, 1, 16, 10, 30));
    expect([r.totalDays, r.weeks, r.weekDays]).toEqual([15, 2, 1]);
    expect([r.days, r.hours, r.minutes]).toEqual([15, 2, 30]);
    expect(r.totalHours).toBe(362);
    expect(r.totalMinutes).toBe(362 * 60 + 30);
  });

  it("handles month ends", () => {
    const r = difference(d(2024, 1, 31), d(2024, 2, 29));
    expect([r.months, r.days]).toEqual([1, 0]);
    const s = difference(d(2024, 1, 31), d(2024, 3, 1));
    expect([s.months, s.days]).toEqual([1, 1]);
  });

  it("works backwards with a negative sign", () => {
    const r = difference(d(2024, 3, 15), d(2024, 1, 1));
    expect(r.sign).toBe(-1);
    expect([r.months, r.days, r.totalDays]).toEqual([2, 14, 74]);
  });

  it("counts business days, optionally with the end date", () => {
    // Mon 2024-01-01 → Mon 2024-01-08: five working days, six with the end.
    expect(difference(d(2024, 1, 1), d(2024, 1, 8)).businessDays).toBe(5);
    expect(difference(d(2024, 1, 1), d(2024, 1, 8), true).businessDays).toBe(6);
    expect(difference(d(2024, 1, 1), d(2024, 1, 8), true).totalDays).toBe(8);
    // Sat → Sun: none.
    expect(difference(d(2024, 1, 6), d(2024, 1, 7), true).businessDays).toBe(0);
    expect(difference(d(2024, 1, 1), d(2024, 1, 1)).totalDays).toBe(0);
    expect(businessDaysBetween(10, 5)).toBe(0);
    // Before 1970 too: Mon 1969-12-29 → Mon 1970-01-05.
    const pre = difference(d(1969, 12, 29), d(1970, 1, 5));
    expect(pre.businessDays).toBe(5);
  });
});

describe("adding durations", () => {
  it("clamps month ends", () => {
    expect(addMonths(d(2024, 1, 31), 1)).toEqual(d(2024, 2, 29));
    expect(addMonths(d(2023, 1, 31), 1)).toEqual(d(2023, 2, 28));
    expect(addMonths(d(2024, 3, 31), -1)).toEqual(d(2024, 2, 29));
    expect(addMonths(d(2024, 11, 15), 3)).toEqual(d(2025, 2, 15));
  });

  it("adds and subtracts every part", () => {
    expect(formatDateTime(addDuration(d(2024, 1, 31), { ...NONE, months: 1, days: 1 }))).toBe(
      "2024-03-01T00:00",
    );
    expect(formatDateTime(addDuration(d(2024, 1, 1), { ...NONE, weeks: 2, hours: 36 }))).toBe(
      "2024-01-16T12:00",
    );
    expect(formatDateTime(addDuration(d(2024, 3, 1), { ...NONE, years: 1, days: 1 }, -1))).toBe(
      "2023-02-28T00:00",
    );
    expect(formatDateTime(addDuration(d(2024, 1, 1), { ...NONE, minutes: -30 }))).toBe(
      "2023-12-31T23:30",
    );
  });

  it("adds business days over weekends", () => {
    // Fri 2024-01-05 + 1 → Mon 2024-01-08; + 10 → Fri 2024-01-19.
    expect(addBusinessDays(d(2024, 1, 5), 1)).toEqual(d(2024, 1, 8));
    expect(addBusinessDays(d(2024, 1, 5), 10)).toEqual(d(2024, 1, 19));
    expect(addBusinessDays(d(2024, 1, 8), -1)).toEqual(d(2024, 1, 5));
    expect(addBusinessDays(d(2024, 1, 8), 0)).toEqual(d(2024, 1, 8));
  });
});

describe("readDateTime", () => {
  it("reads a date with an optional time", () => {
    expect(readDateTime("2024-01-31", "")).toEqual(d(2024, 1, 31));
    expect(readDateTime("2024-01-31", "09:30")).toEqual(d(2024, 1, 31, 9, 30));
  });
  it("names what is invalid", () => {
    expect(readDateTime("2024-02-30", "")).toBe("date");
    expect(readDateTime("nope", "09:00")).toBe("date");
    expect(readDateTime("2024-01-31", "25:00")).toBe("time");
  });
});
