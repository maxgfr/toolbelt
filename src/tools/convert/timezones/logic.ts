/** One wall-clock time in a source zone, seen from several other zones. */
import {
  isoDate,
  isValidZone,
  pad,
  parseIsoDate,
  parseTime,
  utcMs,
  wallClock,
  zonedToUtc,
  zoneOffset,
} from "../_shared";

export interface ZoneRow {
  zone: string;
  /** "YYYY-MM-DD" there. */
  date: string;
  /** "HH:mm" there. */
  time: string;
  hour: number;
  weekday: number;
  /** Offset from UTC, in minutes. */
  offset: number;
  /** Calendar days ahead (+1) or behind (−1) of the source date. */
  dayShift: number;
  /** Minutes ahead of the source zone. */
  diff: number;
}

export type Conversion =
  | {
      ok: true;
      instant: Date;
      source: ZoneRow;
      rows: ZoneRow[];
      /** The typed time does not exist in the source zone (DST gap); it was moved forward. */
      shifted: boolean;
    }
  | { ok: false; error: "date" | "time" | "zone" };

function row(instant: Date, zone: string, sourceDay: number, sourceOffset: number): ZoneRow {
  const w = wallClock(instant, zone);
  const offset = zoneOffset(instant, zone);
  return {
    zone,
    date: isoDate(w),
    time: `${pad(w.hour)}:${pad(w.minute)}`,
    hour: w.hour,
    weekday: w.weekday,
    offset,
    dayShift: Math.round((utcMs(w.year, w.month, w.day) - sourceDay) / 86400000),
    diff: offset - sourceOffset,
  };
}

/** Converts "2024-01-31" "09:00" in `source` to every zone of `targets` (invalid ones skipped). */
export function convertZones(
  date: string,
  time: string,
  source: string,
  targets: string[],
): Conversion {
  const d = parseIsoDate(date);
  if (!d) return { ok: false, error: "date" };
  const t = parseTime(time);
  if (!t) return { ok: false, error: "time" };
  if (!isValidZone(source)) return { ok: false, error: "zone" };
  const instant = zonedToUtc({ ...d, ...t }, source);
  const back = wallClock(instant, source);
  const shifted = back.hour !== t.hour || back.minute !== t.minute || back.day !== d.day;
  const srcOffset = zoneOffset(instant, source);
  const srcDay = utcMs(d.year, d.month, d.day);
  return {
    ok: true,
    instant,
    shifted,
    source: row(instant, source, srcDay, srcOffset),
    rows: targets.filter(isValidZone).map((z) => row(instant, z, srcDay, srcOffset)),
  };
}

/** The current date and time ("YYYY-MM-DD", "HH:mm") in a zone. */
export function nowIn(zone: string, now = new Date()): { date: string; time: string } {
  const w = wallClock(now, isValidZone(zone) ? zone : "UTC");
  return { date: isoDate(w), time: `${pad(w.hour)}:${pad(w.minute)}` };
}

/** "+5 h 30" style difference: minutes → { sign, hours, minutes }. */
export function splitDiff(minutes: number): {
  sign: "+" | "-" | "";
  hours: number;
  minutes: number;
} {
  const a = Math.abs(minutes);
  return {
    sign: minutes > 0 ? "+" : minutes < 0 ? "-" : "",
    hours: Math.floor(a / 60),
    minutes: a % 60,
  };
}

/** Whether a local hour falls in usual working hours (9–18), to spot good meeting times. */
export function isWorkingHour(hour: number, weekday: number): boolean {
  return weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 18;
}
