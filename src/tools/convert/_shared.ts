/**
 * Pure helpers shared by the time & number tools: lenient number parsing, and
 * time zone arithmetic on top of Intl (wall clock in a zone, offsets, and the
 * reverse: which instant a wall-clock time in a zone is).
 */

/** "1 234,5", "1,234.5", "1_000", "-3" → a number; null when empty or not a number. */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/[\s  _']/g, "");
  if (!s) return null;
  s = s.replace(/^−/, "-");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Both: the last one is the decimal separator, the other groups thousands.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // Only commas: one is a decimal comma, several group thousands.
    s = s.split(",").length === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (s.split(".").length > 2) {
    s = s.replace(/\./g, "");
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 3725.5 → { days: 0, hours: 1, minutes: 2, seconds: 5.5 }. */
export function splitSeconds(total: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total - days * 86400 - hours * 3600 - minutes * 60;
  return { days, hours, minutes, seconds };
}

/* --- Time zones ------------------------------------------------------------ */

/** Every IANA zone the engine knows, plus UTC. */
export function timeZones(): string[] {
  let list: string[] = [];
  try {
    list = Intl.supportedValuesOf("timeZone");
  } catch {}
  if (!list.length) list = ["Europe/London", "Europe/Paris", "America/New_York", "Asia/Tokyo"];
  return list.includes("UTC") ? list : ["UTC", ...list];
}

export function isValidZone(zone: string): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The machine's zone (the browser's, in the app). */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormat(zone: string): Intl.DateTimeFormat {
  let f = partsCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      era: "short",
    });
    partsCache.set(zone, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** What a clock on the wall in `zone` shows at instant `date`. */
export function wallClock(date: Date, zone: string): WallClock {
  const p: Record<string, string> = {};
  for (const part of partsFormat(zone).formatToParts(date)) p[part.type] = part.value;
  const y = Number(p.year);
  return {
    year: p.era === "BC" || p.era === "B" ? 1 - y : y,
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: Math.max(0, WEEKDAYS.indexOf(p.weekday ?? "")),
  };
}

/** Milliseconds since the epoch of a wall-clock time read as UTC (years 0–99 included). */
export function utcMs(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number {
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  t.setUTCHours(h, mi, s, ms);
  return t.getTime();
}

/** Offset of `zone` from UTC at instant `date`, in minutes (Paris in winter: 60). */
export function zoneOffset(date: Date, zone: string): number {
  const w = wallClock(date, zone);
  const asUtc = utcMs(w.year, w.month, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * The instant at which the wall clock in `zone` shows the given time. In a DST
 * gap (a time that does not exist), it lands after the jump, like most
 * calendars; in an overlap, the earlier of the two instants.
 */
export function zonedToUtc(
  w: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  zone: string,
  ms = 0,
): Date {
  const guess = utcMs(w.year, w.month, w.day, w.hour ?? 0, w.minute ?? 0, w.second ?? 0, ms);
  const o1 = zoneOffset(new Date(guess), zone);
  const o2 = zoneOffset(new Date(guess - o1 * 60000), zone);
  if (o1 === o2) {
    // Overlap: prefer the earlier instant if the bigger offset gives the same wall time.
    const o0 = zoneOffset(new Date(guess - o1 * 60000 - 3600000), zone);
    if (o0 > o1) {
      const earlier = guess - o0 * 60000;
      if (zoneOffset(new Date(earlier), zone) === o0) return new Date(earlier);
    }
    return new Date(guess - o1 * 60000);
  }
  // The offset changed between the guess and the result: a DST gap.
  return new Date(guess - Math.min(o1, o2) * 60000);
}

/** 60 → "+01:00", -330 → "-05:30". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const a = Math.abs(minutes);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function pad(n: number, width = 2): string {
  const s = String(Math.abs(n)).padStart(width, "0");
  return n < 0 ? `-${s}` : s;
}

/** "2024-01-31" → { year, month, day }, or null if it is not a real date. */
export function parseIsoDate(s: string): { year: number; month: number; day: number } | null {
  const m = /^\s*(-?\d{1,6})-(\d{1,2})-(\d{1,2})\s*$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** "09:30", "9:30:15" → { hour, minute, second }, or null. */
export function parseTime(s: string): { hour: number; minute: number; second: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = Number(m[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
}

/** Day of the year, 1–366. */
export function dayOfYear(y: number, m: number, d: number): number {
  return Math.round((utcMs(y, m, d) - utcMs(y, 1, 1)) / 86400000) + 1;
}

/** ISO 8601 week: weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeek(y: number, m: number, d: number): { year: number; week: number } {
  const t = new Date(utcMs(y, m, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - utcMs(year, 1, 1)) / 86400000 + 1) / 7);
  return { year, week };
}

/** "3 days ago", "in 2 hours", in `locale`. */
export function relative(ms: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const sec = (ms - now) / 1000;
  const a = Math.abs(sec);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31556952],
    ["month", 2629746],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [u, size] of units) if (a >= size) return rtf.format(Math.trunc(sec / size), u);
  return rtf.format(Math.trunc(sec), "second");
}

/** "YYYY-MM-DD" of a wall clock. */
export function isoDate(w: { year: number; month: number; day: number }): string {
  const y = w.year < 0 ? `-${pad(-w.year, 6)}` : w.year > 9999 ? `+${w.year}` : pad(w.year, 4);
  return `${y}-${pad(w.month)}-${pad(w.day)}`;
}

/** Common abbreviations people type when looking for a zone. */
const ZONE_ALIASES: Record<string, string[]> = {
  utc: ["UTC"],
  gmt: ["UTC", "Europe/London"],
  bst: ["Europe/London"],
  cet: ["Europe/Paris", "Europe/Berlin"],
  cest: ["Europe/Paris", "Europe/Berlin"],
  eet: ["Europe/Athens", "Europe/Helsinki"],
  est: ["America/New_York"],
  edt: ["America/New_York"],
  et: ["America/New_York"],
  cst: ["America/Chicago"],
  cdt: ["America/Chicago"],
  mst: ["America/Denver", "America/Phoenix"],
  pst: ["America/Los_Angeles"],
  pdt: ["America/Los_Angeles"],
  pt: ["America/Los_Angeles"],
  ist: ["Asia/Kolkata", "Asia/Calcutta"],
  jst: ["Asia/Tokyo"],
  kst: ["Asia/Seoul"],
  aest: ["Australia/Sydney"],
  nzst: ["Pacific/Auckland"],
  "new york": ["America/New_York"],
  "san francisco": ["America/Los_Angeles"],
  "los angeles": ["America/Los_Angeles"],
  mumbai: ["Asia/Kolkata", "Asia/Calcutta"],
  delhi: ["Asia/Kolkata", "Asia/Calcutta"],
  beijing: ["Asia/Shanghai"],
  pékin: ["Asia/Shanghai"],
  londres: ["Europe/London"],
  bruxelles: ["Europe/Brussels"],
  genève: ["Europe/Zurich"],
  geneva: ["Europe/Zurich"],
  montréal: ["America/Toronto"],
  montreal: ["America/Toronto"],
  mez: ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich"],
  mesz: ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich"],
  wez: ["Europe/Lisbon", "Europe/London"],
  oez: ["Europe/Athens", "Europe/Helsinki"],
  münchen: ["Europe/Berlin"],
  hamburg: ["Europe/Berlin"],
  frankfurt: ["Europe/Berlin"],
  köln: ["Europe/Berlin"],
  wien: ["Europe/Vienna"],
  genf: ["Europe/Zurich"],
  brüssel: ["Europe/Brussels"],
  rom: ["Europe/Rome"],
  prag: ["Europe/Prague"],
  warschau: ["Europe/Warsaw"],
  kopenhagen: ["Europe/Copenhagen"],
  lissabon: ["Europe/Lisbon"],
  athen: ["Europe/Athens"],
  moskau: ["Europe/Moscow"],
  kairo: ["Africa/Cairo"],
  tokio: ["Asia/Tokyo"],
  peking: ["Asia/Shanghai"],
};

function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[_/]+/g, " ").trim();
}

/** "Europe/Paris" → "Paris", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function zoneCity(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/** Zones matching a search ("paris", "new york", "est", "+05:30"), best matches first. */
export function searchZones(query: string, zones: string[], at = new Date()): string[] {
  const q = fold(query);
  if (!q) return zones;
  const aliased = Object.entries(ZONE_ALIASES)
    .filter(([k]) => fold(k).startsWith(q))
    .flatMap(([, v]) => v)
    .filter((z) => zones.includes(z));
  const scored: { z: string; score: number }[] = [];
  const offsetQuery = /^(utc|gmt)?\s*[+-]\d/.test(q) ? q.replace(/^(utc|gmt)\s*/, "") : null;
  for (const z of zones) {
    const f = fold(z);
    const city = fold(zoneCity(z));
    let score = 0;
    if (city === q) score = 5;
    else if (city.startsWith(q)) score = 4;
    else if (f.split(" ").some((w) => w.startsWith(q))) score = 3;
    else if (f.includes(q)) score = 2;
    else if (
      offsetQuery &&
      formatOffset(zoneOffset(at, z)).startsWith(normalizeOffset(offsetQuery))
    )
      score = 1;
    if (score) scored.push({ z, score });
  }
  scored.sort((a, b) => b.score - a.score || a.z.localeCompare(b.z));
  return [...new Set([...aliased, ...scored.map((s) => s.z)])];
}

/** "+5:30" → "+05:30", "-8" → "-08". */
function normalizeOffset(q: string): string {
  const m = /^([+-])(\d{1,2})(?::?(\d{0,2}))?/.exec(q.replace(/\s/g, ""));
  if (!m) return q;
  return `${m[1]}${pad(Number(m[2]))}${m[3] ? `:${m[3]}` : ""}`;
}
