import { describe, expect, it } from "bun:test";
import { age, birthdayIn, dateAtAge, nextBirthday, nextMilestones } from "./logic";

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe("age", () => {
  it("counts years, months and days", () => {
    expect(age(d(1990, 5, 15), d(2026, 10, 24))).toMatchObject({ years: 36, months: 5, days: 9 });
    expect(age(d(2000, 1, 1), d(2000, 1, 1))).toMatchObject({
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
    });
    expect(age(d(2026, 1, 1), d(2025, 1, 1))).toBeNull();
  });

  it("borrows days from the right month", () => {
    // 15 Jan → 10 Mar 2023: 1 month (15 Feb) + 23 days.
    expect(age(d(2023, 1, 15), d(2023, 3, 10))).toMatchObject({ months: 1, days: 23 });
    // 31 Jan → 1 Mar 2023: 1 month (28 Feb, the month's last day) + 1 day.
    expect(age(d(2023, 1, 31), d(2023, 3, 1))).toMatchObject({ months: 1, days: 1 });
    expect(age(d(2023, 1, 31), d(2023, 2, 28))).toMatchObject({ months: 1, days: 0 });
  });

  it("gives totals", () => {
    const a = age(d(2000, 1, 1), d(2001, 1, 1));
    expect(a).toMatchObject({
      totalDays: 366,
      totalWeeks: 52,
      weekDays: 2,
      totalMonths: 12,
      totalHours: 8784,
    });
  });

  it("handles leap-day birthdays", () => {
    expect(birthdayIn(d(2000, 2, 29), 2001)).toEqual(d(2001, 2, 28));
    expect(birthdayIn(d(2000, 2, 29), 2004)).toEqual(d(2004, 2, 29));
    expect(age(d(2000, 2, 29), d(2001, 2, 28))).toMatchObject({ years: 1, months: 0, days: 0 });
  });
});

describe("next birthday", () => {
  it("counts down", () => {
    // From Sat 24 Oct 2026 to Sat 15 May 2027: 203 days.
    const n = nextBirthday(d(1990, 5, 15), d(2026, 10, 24));
    expect(n).toMatchObject({ date: d(2027, 5, 15), daysLeft: 203, turning: 37, weekday: 6 });
  });

  it("is today on the day", () => {
    expect(nextBirthday(d(1990, 10, 24), d(2026, 10, 24))).toMatchObject({
      daysLeft: 0,
      turning: 36,
    });
  });

  it("is null before birth", () => {
    expect(nextBirthday(d(2030, 1, 1), d(2026, 1, 1))).toBeNull();
  });
});

describe("date at a given age", () => {
  it("adds days, weeks, months, years", () => {
    expect(dateAtAge(d(2000, 1, 1), 10000, "days")).toEqual(d(2027, 5, 19));
    expect(dateAtAge(d(2000, 1, 1), 2, "weeks")).toEqual(d(2000, 1, 15));
    expect(dateAtAge(d(2000, 1, 31), 1, "months")).toEqual(d(2000, 2, 29));
    expect(dateAtAge(d(2000, 2, 29), 18, "years")).toEqual(d(2018, 2, 28));
    expect(dateAtAge(d(2000, 1, 1), 1.5, "years")).toBeNull();
  });

  it("lists the next 1 000-day milestones", () => {
    const m = nextMilestones(d(2000, 1, 1), d(2027, 5, 19));
    expect(m[0]).toEqual({ days: 11000, date: d(2030, 2, 12) });
    expect(m).toHaveLength(3);
  });
});
