/** Unix timestamps ↔ dates: unit detection, date parsing in a zone, and every common format. */
import {
  dayOfYear,
  formatOffset,
  isoDate,
  isoWeek,
  pad,
  utcMs,
  wallClock,
  zonedToUtc,
  zoneOffset,
} from "../_shared";

export type Unit = "s" | "ms" | "us" | "ns";
export type UnitChoice = Unit | "auto";

export type Parsed =
  | {
      ok: true;
      ms: number;
      kind: "number";
      unit: Unit /** Sub-millisecond rest, in ns. */;
      subMs: number;
    }
  | { ok: true; ms: number; kind: "date"; format: string }
  | { ok: false; error: "empty" | "invalid" | "range" };

/** JavaScript dates stop at ±8.64e15 ms (about ±275,000 years). */
const MAX_MS = 8.64e15;

const PER_MS: Record<Unit, bigint> = { s: 0n, ms: 1n, us: 1000n, ns: 1000000n };

/**
 * The unit a bare number most likely is, by size: up to 1e11 is seconds
 * (until year 5138), then milliseconds, microseconds, nanoseconds.
 */
export function detectUnit(n: number): Unit {
  const a = Math.abs(n);
  if (a < 1e11) return "s";
  if (a < 1e14) return "ms";
  if (a < 1e17) return "us";
  return "ns";
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NAMED: Record<string, number> = {
  gmt: 0,
  ut: 0,
  utc: 0,
  z: 0,
  est: -300,
  edt: -240,
  cst: -360,
  cdt: -300,
  mst: -420,
  mdt: -360,
  pst: -480,
  pdt: -420,
};

/** "+02:00", "-0530", "Z", "GMT" → minutes, undefined when absent, null when malformed. */
function offsetOf(s: string | undefined): number | undefined | null {
  if (!s) return undefined;
  const named = NAMED[s.toLowerCase()];
  if (named !== undefined) return named;
  const m = /^([+-])(\d{2}):?(\d{2})?$/.exec(s);
  if (!m) return null;
  const v = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -v : v;
}

interface Fields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
}

function toMs(f: Fields, offset: number | undefined, zone: string): number | null {
  if (f.month < 1 || f.month > 12 || f.day < 1 || f.day > 31) return null;
  if (f.hour > 24 || f.minute > 59 || f.second > 60) return null;
  const check = new Date(utcMs(f.year, f.month, f.day));
  if (check.getUTCDate() !== f.day) return null;
  if (offset === undefined) return zonedToUtc(f, zone, f.ms).getTime();
  return utcMs(f.year, f.month, f.day, f.hour, f.minute, f.second, f.ms) - offset * 60000;
}

/**
 * Parses a timestamp or a date. Numbers are read in `unit` (or guessed). Dates
 * without an offset ("2024-01-31 12:00") are read in `zone`.
 */
export function parseInput(input: string, unit: UnitChoice, zone: string): Parsed {
  const s = input.trim();
  if (!s) return { ok: false, error: "empty" };

  const num = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s.replace(/[\s_,]/g, ""));
  if (num) {
    const n = Number(`${num[1]}${num[2]}.${num[3] ?? 0}`);
    const u = unit === "auto" ? detectUnit(n) : unit;
    let ms: number;
    let subMs = 0;
    if (u === "s") ms = n * 1000;
    else if (u === "ms") ms = n;
    else {
      // BigInt so nanoseconds keep their precision.
      const big = BigInt(`${num[1]}${num[2]}`);
      const per = PER_MS[u];
      ms = Number(big / per);
      subMs = Number(big % per) * (u === "us" ? 1000 : 1);
      if (big < 0n && subMs) {
        ms -= 1;
        subMs += Number(per) * (u === "us" ? 1000 : 1);
      }
    }
    ms = Math.floor(ms);
    if (Math.abs(ms) > MAX_MS) return { ok: false, error: "range" };
    return { ok: true, ms, kind: "number", unit: u, subMs };
  }

  // ISO 8601 and its common relaxed forms: "2024-01-31", "2024-01-31 12:00", "…T12:00:00.123+02:00".
  const iso =
    /^([+-]?\d{4,6})-(\d{2})-(\d{2})(?:[T\s]+(\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}:?\d{2}|[+-]\d{2})?$/i.exec(
      s,
    );
  if (iso) {
    const off = offsetOf(iso[8]?.length === 3 ? `${iso[8]}:00` : iso[8]);
    if (off === null) return { ok: false, error: "invalid" };
    const ms = toMs(
      {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
        hour: Number(iso[4] ?? 0),
        minute: Number(iso[5] ?? 0),
        second: Number(iso[6] ?? 0),
        ms: Number((iso[7] ?? "0").padEnd(3, "0").slice(0, 3)),
      },
      off,
      zone,
    );
    if (ms === null) return { ok: false, error: "invalid" };
    return { ok: true, ms, kind: "date", format: "ISO 8601" };
  }

  // RFC 2822: "Wed, 31 Jan 2024 12:00:00 +0000".
  const rfc =
    /^(?:[a-z]{3},?\s+)?(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|[a-z]{1,3})?$/i.exec(
      s,
    );
  if (rfc) {
    const month = MONTHS.indexOf((rfc[2] ?? "").toLowerCase()) + 1;
    const off = offsetOf(rfc[7]);
    if (!month || off === null) return { ok: false, error: "invalid" };
    const ms = toMs(
      {
        year: Number(rfc[3]),
        month,
        day: Number(rfc[1]),
        hour: Number(rfc[4]),
        minute: Number(rfc[5]),
        second: Number(rfc[6] ?? 0),
        ms: 0,
      },
      off,
      zone,
    );
    if (ms === null) return { ok: false, error: "invalid" };
    return { ok: true, ms, kind: "date", format: "RFC 2822" };
  }

  // Anything else the engine understands, as long as it says its offset.
  if (/(Z|GMT|UTC|[+-]\d{2}:?\d{2})\b/i.test(s)) {
    const ms = Date.parse(s);
    if (!Number.isNaN(ms)) return { ok: true, ms, kind: "date", format: "Date.parse" };
  }
  return { ok: false, error: "invalid" };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = MONTHS.map((m) => m.charAt(0).toUpperCase() + m.slice(1));

/** "2024-01-31T13:00:00.000+01:00" in `zone`. */
export function isoInZone(ms: number, zone: string): string {
  const d = new Date(ms);
  const w = wallClock(d, zone);
  const off = zoneOffset(d, zone);
  const frac = pad(((ms % 1000) + 1000) % 1000, 3);
  return `${isoDate(w)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}.${frac}${off === 0 ? "Z" : formatOffset(off)}`;
}

/** "Wed, 31 Jan 2024 13:00:00 +0100" in `zone`. */
export function rfc2822(ms: number, zone: string): string {
  const d = new Date(ms);
  const w = wallClock(d, zone);
  const off = formatOffset(zoneOffset(d, zone)).replace(":", "");
  return `${DAY_NAMES[w.weekday]}, ${pad(w.day)} ${MONTH_NAMES[w.month - 1]} ${w.year} ${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)} ${off}`;
}

export interface Breakdown {
  isoUtc: string;
  isoZone: string;
  rfc2822: string;
  dayOfYear: number;
  week: { year: number; week: number };
  seconds: string;
  millis: string;
  micros: string;
  nanos: string;
}

/** Everything shown for one instant (`subMs` keeps nanoseconds that do not fit in a Date). */
export function breakdown(ms: number, zone: string, subMs = 0): Breakdown {
  const w = wallClock(new Date(ms), zone);
  const big = BigInt(ms) * 1000000n + BigInt(subMs);
  return {
    isoUtc: new Date(ms).toISOString(),
    isoZone: isoInZone(ms, zone),
    rfc2822: rfc2822(ms, zone),
    dayOfYear: dayOfYear(w.year, w.month, w.day),
    week: isoWeek(w.year, w.month, w.day),
    seconds: String(Math.floor(ms / 1000)),
    millis: String(ms),
    micros: String(big / 1000n - (big < 0n && big % 1000n ? 1n : 0n)),
    nanos: String(big),
  };
}
