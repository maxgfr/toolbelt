/** Exact age in years, months and days, the next birthday, totals, and the date at a given age. */
import { dayNumber, daysInMonth, fromDayNumber, isLeap, weekday, type Ymd } from "../_shared";

/** Adds whole months, keeping the day when it exists, else the month's last day. */
export function addMonths(d: Ymd, months: number): Ymd {
  const total = d.year * 12 + (d.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

export interface Age {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  /** Days left over after whole weeks. */
  weekDays: number;
  totalMonths: number;
  totalHours: number;
}

/** Age on `on` of someone born on `birth`; null when `on` is before the birth. */
export function age(birth: Ymd, on: Ymd): Age | null {
  const totalDays = dayNumber(on) - dayNumber(birth);
  if (totalDays < 0) return null;
  let totalMonths = (on.year - birth.year) * 12 + (on.month - birth.month);
  if (on.day < birth.day) totalMonths--;
  // A month anniversary that would fall on a missing day (31st) counts on the month's last day.
  if (dayNumber(addMonths(birth, totalMonths + 1)) <= dayNumber(on)) totalMonths++;
  const anchor = addMonths(birth, totalMonths);
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: dayNumber(on) - dayNumber(anchor),
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    weekDays: totalDays % 7,
    totalMonths,
    totalHours: totalDays * 24,
  };
}

/** The birthday in a given year; 29 February falls on 28 February in common years. */
export function birthdayIn(birth: Ymd, year: number): Ymd {
  if (birth.month === 2 && birth.day === 29 && !isLeap(year)) return { year, month: 2, day: 28 };
  return { year, month: birth.month, day: birth.day };
}

export interface NextBirthday {
  date: Ymd;
  /** 0 when it's today. */
  daysLeft: number;
  /** The age turned on that day. */
  turning: number;
  weekday: number;
}

export function nextBirthday(birth: Ymd, today: Ymd): NextBirthday | null {
  if (dayNumber(today) < dayNumber(birth)) return null;
  let date = birthdayIn(birth, today.year);
  if (dayNumber(date) < dayNumber(today)) date = birthdayIn(birth, today.year + 1);
  return {
    date,
    daysLeft: dayNumber(date) - dayNumber(today),
    turning: date.year - birth.year,
    weekday: weekday(date),
  };
}

export type AgeUnit = "days" | "weeks" | "months" | "years";

/** The date when someone born on `birth` is `n` units old. */
export function dateAtAge(birth: Ymd, n: number, unit: AgeUnit): Ymd | null {
  if (!Number.isFinite(n) || !Number.isInteger(n) || Math.abs(n) > 100000) return null;
  switch (unit) {
    case "days":
      return fromDayNumber(dayNumber(birth) + n);
    case "weeks":
      return fromDayNumber(dayNumber(birth) + 7 * n);
    case "months":
      return addMonths(birth, n);
    case "years":
      return addMonths(birth, 12 * n);
  }
}

/** The next round numbers of days lived (multiples of 1 000) after `today`, with their dates. */
export function nextMilestones(birth: Ymd, today: Ymd, count = 3): { days: number; date: Ymd }[] {
  const lived = dayNumber(today) - dayNumber(birth);
  if (lived < 0) return [];
  const out: { days: number; date: Ymd }[] = [];
  let k = Math.floor(lived / 1000) + 1;
  while (out.length < count) {
    out.push({ days: k * 1000, date: fromDayNumber(dayNumber(birth) + k * 1000) });
    k++;
  }
  return out;
}
