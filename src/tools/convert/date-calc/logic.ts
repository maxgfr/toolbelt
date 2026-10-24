/**
 * Calendar arithmetic: the gap between two dates and a date plus a duration.
 * Everything is calendar time (no time zone, no DST): a day is always 24 h.
 */
import { daysInMonth, pad, utcMs } from "../_shared";

export interface DateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const DAY = 86400000;

function toMs(d: DateTime): number {
  return utcMs(d.year, d.month, d.day, d.hour, d.minute);
}

function fromMs(ms: number): DateTime {
  const t = new Date(ms);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
  };
}

/** Adds whole months, keeping the day when it exists, else the month's last day (Jan 31 + 1 → Feb 29). */
export function addMonths(d: DateTime, months: number): DateTime {
  const total = d.year * 12 + (d.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return { ...d, year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

/** Monday–Friday days in [from, to) (dates only). */
export function businessDaysBetween(fromDay: number, toDay: number): number {
  if (toDay <= fromDay) return 0;
  const n = toDay - fromDay;
  let count = Math.floor(n / 7) * 5;
  // Day 0 of the epoch (1970-01-01) was a Thursday: weekday = (day + 4) mod 7, 0 = Sunday.
  for (let i = fromDay + Math.floor(n / 7) * 7; i < toDay; i++) {
    const wd = (((i + 4) % 7) + 7) % 7;
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
}

export interface Difference {
  /** -1 when the end is before the start (the numbers are then for the swapped pair). */
  sign: 1 | -1;
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  totalMonths: number;
  totalDays: number;
  weeks: number;
  weekDays: number;
  totalHours: number;
  totalMinutes: number;
  businessDays: number;
}

/** The gap from `a` to `b`; `includeEnd` counts the end date as a whole day. */
export function difference(a: DateTime, b: DateTime, includeEnd = false): Difference {
  let start = a;
  let end = b;
  let sign: 1 | -1 = 1;
  if (toMs(b) < toMs(a)) {
    start = b;
    end = a;
    sign = -1;
  }
  const endMs = toMs(end) + (includeEnd ? DAY : 0);
  let months = (end.year - start.year) * 12 + (end.month - start.month);
  while (months > 0 && toMs(addMonths(start, months)) > endMs) months--;
  const rest = endMs - toMs(addMonths(start, months));
  const totalMs = endMs - toMs(start);
  const totalDays = Math.floor(totalMs / DAY);
  const startDay = Math.floor(utcMs(start.year, start.month, start.day) / DAY);
  const endDay = Math.floor(utcMs(end.year, end.month, end.day) / DAY) + (includeEnd ? 1 : 0);
  return {
    sign,
    years: Math.floor(months / 12),
    months: months % 12,
    days: Math.floor(rest / DAY),
    hours: Math.floor((rest % DAY) / 3600000),
    minutes: Math.floor((rest % 3600000) / 60000),
    totalMonths: months,
    totalDays,
    weeks: Math.floor(totalDays / 7),
    weekDays: totalDays % 7,
    totalHours: Math.floor(totalMs / 3600000),
    totalMinutes: Math.floor(totalMs / 60000),
    businessDays: businessDaysBetween(startDay, endDay),
  };
}

export interface Duration {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
}

/** `d` plus (or minus, with sign −1) a duration: years and months first, then the rest. */
export function addDuration(d: DateTime, dur: Duration, sign: 1 | -1 = 1): DateTime {
  const m = addMonths(d, sign * (dur.years * 12 + dur.months));
  const ms =
    toMs(m) + sign * ((dur.weeks * 7 + dur.days) * DAY + dur.hours * 3600000 + dur.minutes * 60000);
  return fromMs(ms);
}

/** `d` plus `n` working days (Monday–Friday), skipping weekends; negative goes back. */
export function addBusinessDays(d: DateTime, n: number): DateTime {
  let ms = toMs(d);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(Math.trunc(n));
  while (left > 0) {
    ms += step * DAY;
    const wd = new Date(ms).getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return fromMs(ms);
}

/** Weekday of a calendar date, 0 = Sunday. */
export function weekday(d: DateTime): number {
  return new Date(toMs(d)).getUTCDay();
}

/** "2024-01-31T09:30". */
export function formatDateTime(d: DateTime): string {
  return `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}T${pad(d.hour)}:${pad(d.minute)}`;
}

/** Milliseconds of a calendar date-time, to format it with Intl in UTC. */
export function calendarMs(d: DateTime): number {
  return toMs(d);
}
