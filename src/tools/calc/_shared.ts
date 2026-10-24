/** Pure helpers shared by the everyday calculators. */
export { parseNumber } from "../convert/_shared";

/** Removes floating-point noise: 0.1 + 0.2 → 0.3. */
export function clean(n: number): number {
  return Number.isFinite(n) ? Number(n.toPrecision(12)) : n;
}

/** Rounds to `digits` decimals, half away from zero (1.005 → 1.01). */
export function roundTo(n: number, digits = 2): number {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** digits;
  return (Math.sign(n) * Math.round(Math.abs(n) * f + 1e-9)) / f;
}

/** A finite number, or the fallback. */
export function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

export interface Ymd {
  year: number;
  month: number;
  day: number;
}

/** "2024-02-29" → { 2024, 2, 29 }; null when not a real date. */
export function parseYmd(s: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 30;
}

/** Days since 1970-01-01 (UTC calendar, no time zone). */
export function dayNumber(d: Ymd): number {
  return Math.round(Date.UTC(d.year, d.month - 1, d.day) / 86400000);
}

export function fromDayNumber(n: number): Ymd {
  const t = new Date(n * 86400000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

export function ymdString(d: Ymd): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.year, 4)}-${p(d.month)}-${p(d.day)}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(d: Ymd): number {
  return (((dayNumber(d) + 4) % 7) + 7) % 7;
}
