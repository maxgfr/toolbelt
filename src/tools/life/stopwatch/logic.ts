/**
 * Stopwatch state as timestamps: the time accumulated before the current run plus the moment
 * the current run started. Elapsed time is always computed from the clock, so a throttled or
 * reloaded tab never drifts.
 */
import { formatClock } from "../_shared";

export type Watch = {
  /** Epoch ms when the current run started, null while stopped. */
  startedAt: number | null;
  /** Time accumulated by the previous runs, in ms. */
  base: number;
  /** Total elapsed time at each lap, in ms, oldest first. */
  laps: number[];
};

export const EMPTY: Watch = { startedAt: null, base: 0, laps: [] };

/** Reads a stored value back, falling back to a stopped, empty watch. */
export function normalize(v: unknown): Watch {
  if (!v || typeof v !== "object") return EMPTY;
  const o = v as Record<string, unknown>;
  const startedAt =
    typeof o.startedAt === "number" && Number.isFinite(o.startedAt) ? o.startedAt : null;
  const base = typeof o.base === "number" && Number.isFinite(o.base) && o.base >= 0 ? o.base : 0;
  const laps = Array.isArray(o.laps)
    ? o.laps.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0)
    : [];
  return { startedAt, base, laps };
}

export function elapsed(w: Watch, now: number): number {
  return w.base + (w.startedAt === null ? 0 : Math.max(0, now - w.startedAt));
}

export function running(w: Watch): boolean {
  return w.startedAt !== null;
}

export function start(w: Watch, now: number): Watch {
  return w.startedAt !== null ? w : { ...w, startedAt: now };
}

export function stop(w: Watch, now: number): Watch {
  return w.startedAt === null ? w : { ...w, base: elapsed(w, now), startedAt: null };
}

export function toggle(w: Watch, now: number): Watch {
  return w.startedAt === null ? start(w, now) : stop(w, now);
}

/** Records a lap at the current total (only while running, or when time has passed). */
export function lap(w: Watch, now: number): Watch {
  const total = elapsed(w, now);
  if (total <= 0 || total === w.laps[w.laps.length - 1]) return w;
  return { ...w, laps: [...w.laps, total] };
}

export interface LapRow {
  /** 1-based lap number. */
  n: number;
  split: number;
  total: number;
  best: boolean;
  worst: boolean;
}

/** Laps with their split time; the fastest and slowest are marked once there are two or more. */
export function lapRows(laps: number[]): LapRow[] {
  const splits = laps.map((t, i) => t - (i ? (laps[i - 1] as number) : 0));
  const mark = splits.length >= 2;
  const min = Math.min(...splits);
  const max = Math.max(...splits);
  const distinct = min !== max;
  return splits.map((split, i) => ({
    n: i + 1,
    split,
    total: laps[i] as number,
    best: mark && distinct && split === min,
    worst: mark && distinct && split === max,
  }));
}

/** The laps as a tab-separated table, for copying into a spreadsheet. */
export function lapsText(laps: number[], header: [string, string, string]): string {
  const rows = lapRows(laps).map(
    (r) => `${r.n}\t${formatClock(r.split, 2)}\t${formatClock(r.total, 2)}`,
  );
  return [header.join("\t"), ...rows].join("\n");
}
