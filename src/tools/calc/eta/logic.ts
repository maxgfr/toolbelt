/** Time to finish: from the progress so far (rate = done ÷ elapsed) or from a known pace. */

const HOUR = 3600000;

/** "2026-10-24T09:30" (an <input type="datetime-local"> value) → ms, in local time; null if invalid. */
export function parseLocal(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, sec] = m.slice(1).map((x) => Number(x ?? 0)) as number[];
  const t = new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, sec ?? 0);
  if (t.getMonth() !== (mo ?? 1) - 1 || t.getDate() !== d) return null;
  return t.getTime();
}

/** ms → "2026-10-24T09:30" in local time. */
export function toLocalInput(ms: number): string {
  const t = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
}

export interface Progress {
  total: number;
  done: number;
  startMs: number;
  nowMs: number;
}

export interface EtaResult {
  /** 0–100. */
  percent: number;
  elapsedMs: number;
  /** Items per hour so far (0 when nothing is done yet). */
  perHour: number;
  remaining: number;
  /** Infinity when the rate is 0. */
  remainingMs: number;
  /** When it will be done; null when it can't be known. */
  finishMs: number | null;
  /** Expected total duration from the start. */
  totalMs: number;
}

export type EtaError = "total" | "done" | "start";

export function eta(p: Progress): EtaResult | EtaError {
  if (!(p.total > 0)) return "total";
  if (!(p.done >= 0) || p.done > p.total) return "done";
  const elapsedMs = p.nowMs - p.startMs;
  if (!(elapsedMs > 0)) return "start";
  const perHour = (p.done / elapsedMs) * HOUR;
  const remaining = p.total - p.done;
  const remainingMs =
    remaining === 0 ? 0 : perHour > 0 ? (remaining / perHour) * HOUR : Number.POSITIVE_INFINITY;
  return {
    percent: (p.done / p.total) * 100,
    elapsedMs,
    perHour,
    remaining,
    remainingMs,
    finishMs: Number.isFinite(remainingMs) ? p.nowMs + remainingMs : null,
    totalMs: elapsedMs + remainingMs,
  };
}

export type PaceUnit = "minute" | "hour" | "day";

/** Items per hour for one item per `unit` of a pace typed per minute, hour or day. */
export const PER_HOUR: Record<PaceUnit, number> = { minute: 60, hour: 1, day: 1 / 24 };

/** Time to do `remaining` items at `perHour`; null when the pace is 0. */
export function timeAtPace(remaining: number, perHour: number): number | null {
  if (!(remaining >= 0) || !(perHour > 0)) return null;
  return (remaining / perHour) * HOUR;
}

/** Items per hour needed to finish `remaining` items by `deadlineMs`; null if the deadline passed. */
export function requiredPace(remaining: number, nowMs: number, deadlineMs: number): number | null {
  const left = deadlineMs - nowMs;
  if (!(left > 0) || !(remaining >= 0)) return null;
  return (remaining / left) * HOUR;
}

/** 5 400 000 ms → { d: 0, h: 1, m: 30 } (rounded to the minute). */
export function splitDuration(ms: number): { d: number; h: number; m: number } {
  const total = Math.round(ms / 60000);
  return { d: Math.floor(total / 1440), h: Math.floor((total % 1440) / 60), m: total % 60 };
}
