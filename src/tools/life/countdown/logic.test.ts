import { describe, expect, test } from "bun:test";
import {
  breakdown,
  calendarDays,
  nextAnnual,
  normalizeCountdowns,
  parseLocal,
  workingDays,
} from "./logic";

const d = (s: string) => parseLocal(s) as Date;

describe("parseLocal", () => {
  test("dates and times", () => {
    expect(d("2026-12-25").getTime()).toBe(new Date(2026, 11, 25).getTime());
    expect(d("2026-12-25T18:30").getHours()).toBe(18);
    expect(d("2026-12-25 18:30:15").getSeconds()).toBe(15);
  });
  test.each(["", "2026-02-31", "2026-13-01", "2026-12-25T24:00", "25/12/2026", "2026-1-5"])(
    "rejects %p",
    (s) => {
      expect(parseLocal(s)).toBeNull();
    },
  );
});

describe("breakdown", () => {
  test("splits days, hours, minutes, seconds", () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 + 999;
    expect(breakdown(ms, 0)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, past: false });
  });
  test("past dates count the time since", () => {
    expect(breakdown(0, 90_000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 30,
      past: true,
    });
  });
});

describe("workingDays", () => {
  // 2026-10-19 is a Monday.
  test("a full week has 5", () => {
    expect(workingDays(d("2026-10-19"), d("2026-10-26"))).toBe(5);
  });
  test("today included, the day itself excluded", () => {
    expect(workingDays(d("2026-10-19T17:00"), d("2026-10-20"))).toBe(1);
    expect(workingDays(d("2026-10-19"), d("2026-10-19T23:00"))).toBe(0);
  });
  test("weekends do not count", () => {
    // Friday → next Monday: only Friday.
    expect(workingDays(d("2026-10-23"), d("2026-10-26"))).toBe(1);
    // Saturday → Monday: none.
    expect(workingDays(d("2026-10-24"), d("2026-10-26"))).toBe(0);
  });
  test("long ranges match a day-by-day count", () => {
    const a = d("2026-01-01");
    const b = d("2027-03-15");
    let n = 0;
    for (const x = new Date(a); x < b; x.setDate(x.getDate() + 1))
      if (x.getDay() !== 0 && x.getDay() !== 6) n++;
    expect(workingDays(a, b)).toBe(n);
  });
  test("past dates give 0; holidays on weekdays are removed once", () => {
    expect(workingDays(d("2026-10-26"), d("2026-10-19"))).toBe(0);
    expect(
      workingDays(d("2026-10-19"), d("2026-10-26"), [
        "2026-10-21",
        "2026-10-21",
        "2026-10-24",
        "x",
      ]),
    ).toBe(4);
  });
  test("calendar days", () => {
    expect(calendarDays(d("2026-10-24T23:59"), d("2026-10-25T00:01"))).toBe(1);
    expect(calendarDays(d("2026-03-01"), d("2026-02-01"))).toBe(-28);
  });
});

describe("nextAnnual", () => {
  test("this year if not passed, next year otherwise", () => {
    expect(nextAnnual(12, 25, d("2026-10-24"))).toBe("2026-12-25");
    expect(nextAnnual(1, 1, d("2026-10-24"))).toBe("2027-01-01");
    expect(nextAnnual(10, 24, d("2026-10-24T15:00"))).toBe("2026-10-24");
  });
  test("February 29 waits for a leap year", () => {
    expect(nextAnnual(2, 29, d("2026-10-24"))).toBe("2028-02-29");
  });
});

test("normalize drops junk", () => {
  expect(normalizeCountdowns([{ id: "a", date: "2026-01-01" }, null, { id: 3 }])).toEqual([
    { id: "a", name: "", date: "2026-01-01" },
  ]);
  expect(normalizeCountdowns("x")).toEqual([]);
});
