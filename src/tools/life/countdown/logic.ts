/**
 * Countdowns to dates: parse a local date (and time), split the time left into days, hours,
 * minutes and seconds, and count the working days (Monday to Friday) before the day.
 */

export type Countdown = {
  id: string;
  name: string;
  /** Local date "YYYY-MM-DD" or date and time "YYYY-MM-DDTHH:mm". */
  date: string;
};

/** A local date ("YYYY-MM-DD", optionally "THH:mm" or "THH:mm:ss"), or null if invalid. */
export function parseLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m
    .slice(1)
    .map((x) => (x === undefined ? 0 : Number(x))) as number[];
  const date = new Date(y as number, (mo as number) - 1, d, h, mi, se);
  // Reject 2026-02-31 and friends (Date would roll them over) and 24:00.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== (mo as number) - 1 ||
    date.getDate() !== d ||
    (h as number) > 23 ||
    (mi as number) > 59 ||
    (se as number) > 59
  )
    return null;
  return date;
}

export interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when the date is in the past (the parts then count the time since). */
  past: boolean;
}

/** Splits `target - now` into whole days, hours, minutes, seconds (rounded down). */
export function breakdown(target: number, now: number): Parts {
  const diff = target - now;
  const past = diff < 0;
  const total = Math.floor(Math.abs(diff) / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    past,
  };
}

/** The local calendar day of a date as a day number (days since 1970-01-01). */
function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Weekdays (Monday–Friday) in the day numbers [a, b). */
function weekdaysBetween(a: number, b: number): number {
  if (b <= a) return 0;
  const n = b - a;
  let count = Math.floor(n / 7) * 5;
  for (let i = a + Math.floor(n / 7) * 7; i < b; i++) {
    const wd = (((i + 4) % 7) + 7) % 7; // 0 = Sunday; 1970-01-01 was a Thursday.
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
}

/**
 * Working days (Monday–Friday) from `from`'s day, included, up to `to`'s day, excluded: the
 * days left to work before the event. Days listed in `holidays` ("YYYY-MM-DD") are skipped.
 */
export function workingDays(from: Date, to: Date, holidays: string[] = []): number {
  const a = dayNumber(from);
  const b = dayNumber(to);
  let n = weekdaysBetween(a, b);
  const seen = new Set<number>();
  for (const h of holidays) {
    const d = parseLocal(h);
    if (!d) continue;
    const k = dayNumber(d);
    const wd = (((k + 4) % 7) + 7) % 7;
    if (k >= a && k < b && wd !== 0 && wd !== 6 && !seen.has(k)) {
      seen.add(k);
      n--;
    }
  }
  return n;
}

/** Calendar days from `from`'s day to `to`'s day (negative if before). */
export function calendarDays(from: Date, to: Date): number {
  return dayNumber(to) - dayNumber(from);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The next time a yearly date comes (today counts if it is today), as "YYYY-MM-DD". */
export function nextAnnual(month: number, day: number, now: Date): string {
  let y = now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Feb 29 only exists in leap years: look further ahead when needed.
  for (let i = 0; i < 9; i++, y++) {
    const d = new Date(y, month - 1, day);
    if (d.getMonth() === month - 1 && d.getTime() >= today) return `${y}-${pad(month)}-${pad(day)}`;
  }
  return `${y}-${pad(month)}-${pad(day)}`;
}

export function normalizeCountdowns(v: unknown): Countdown[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.date !== "string") return [];
    return [{ id: o.id, name: typeof o.name === "string" ? o.name : "", date: o.date }];
  });
}
