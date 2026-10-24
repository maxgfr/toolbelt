/**
 * Pomodoro cycle as timestamps: work sessions, short breaks and, every N sessions, a long
 * break. `advance` replays every phase that ended since the last look (several, if the tab
 * slept), auto-starting the next ones from the exact end of the previous phase.
 */
import { localDateKey } from "../_shared";

export type Phase = "work" | "short" | "long";

export type Settings = {
  /** Minutes. */
  work: number;
  short: number;
  long: number;
  /** Work sessions before a long break. */
  cycles: number;
  autoBreak: boolean;
  autoWork: boolean;
};

export const DEFAULTS: Settings = {
  work: 25,
  short: 5,
  long: 15,
  cycles: 4,
  autoBreak: true,
  autoWork: false,
};

export type Pomo = {
  phase: Phase;
  /** Epoch ms when the phase ends, while running. */
  endAt: number | null;
  /** Time left while paused; null when the phase has not started (it then lasts its full length). */
  left: number | null;
  /** Work sessions finished since the last long break. */
  done: number;
  /** Day (YYYY-MM-DD) of `count`, and work sessions finished that day. */
  day: string;
  count: number;
};

export const INITIAL: Pomo = { phase: "work", endAt: null, left: null, done: 0, day: "", count: 0 };

export function phaseMs(s: Settings, phase: Phase): number {
  return Math.max(1, s[phase]) * 60_000;
}

/** The phase after `phase`, and the work count since the last long break. */
export function nextPhase(
  phase: Phase,
  done: number,
  cycles: number,
): { phase: Phase; done: number } {
  if (phase === "work") {
    const d = done + 1;
    return { phase: d >= Math.max(1, cycles) ? "long" : "short", done: d };
  }
  return { phase: "work", done: phase === "long" ? 0 : done };
}

export function remaining(p: Pomo, s: Settings, now: number): number {
  if (p.endAt !== null) return Math.max(0, p.endAt - now);
  return p.left ?? phaseMs(s, p.phase);
}

/** 0 at the start of the phase, 1 at its end. */
export function progress(p: Pomo, s: Settings, now: number): number {
  const total = Math.max(phaseMs(s, p.phase), remaining(p, s, now));
  return 1 - remaining(p, s, now) / total;
}

export function start(p: Pomo, s: Settings, now: number): Pomo {
  if (p.endAt !== null) return p;
  return { ...p, endAt: now + remaining(p, s, now), left: null };
}

export function pause(p: Pomo, s: Settings, now: number): Pomo {
  if (p.endAt === null) return p;
  return { ...p, endAt: null, left: remaining(p, s, now) };
}

/** Back to the start of the current phase, stopped. */
export function restartPhase(p: Pomo): Pomo {
  return { ...p, endAt: null, left: null };
}

/** Back to the first work session (today's count is kept). */
export function resetCycle(p: Pomo): Pomo {
  return { ...p, phase: "work", endAt: null, left: null, done: 0 };
}

/** Jumps to the next phase without counting the skipped one; keeps running if it was. */
export function skip(p: Pomo, s: Settings, now: number): Pomo {
  const n =
    p.phase === "work"
      ? { phase: (p.done + 1 >= s.cycles ? "long" : "short") as Phase, done: p.done }
      : nextPhase(p.phase, p.done, s.cycles);
  const running = p.endAt !== null;
  return {
    ...p,
    phase: n.phase,
    done: n.phase === "long" ? p.done : n.done,
    endAt: running ? now + phaseMs(s, n.phase) : null,
    left: null,
  };
}

export interface PhaseEnd {
  phase: Phase;
  at: number;
  next: Phase;
}

/**
 * Applies every phase end up to `now`. A finished work session counts for its day. The next
 * phase starts at once (from the previous end) when its auto-start option is on.
 */
export function advance(
  p: Pomo,
  s: Settings,
  now: number,
  dayOf: (ms: number) => string = (ms) => localDateKey(new Date(ms)),
): { state: Pomo; events: PhaseEnd[] } {
  const events: PhaseEnd[] = [];
  let cur = p;
  for (let guard = 0; guard < 10_000 && cur.endAt !== null && cur.endAt <= now; guard++) {
    const at = cur.endAt;
    let { day, count } = cur;
    if (cur.phase === "work") {
      const d = dayOf(at);
      count = d === day ? count + 1 : 1;
      day = d;
    }
    const n = nextPhase(cur.phase, cur.done, s.cycles);
    const auto = n.phase === "work" ? s.autoWork : s.autoBreak;
    events.push({ phase: cur.phase, at, next: n.phase });
    cur = {
      phase: n.phase,
      done: n.done,
      endAt: auto ? at + phaseMs(s, n.phase) : null,
      left: null,
      day,
      count,
    };
  }
  return { state: cur, events };
}

/** Work sessions finished on `today`. */
export function todayCount(p: Pomo, today: string): number {
  return p.day === today ? p.count : 0;
}

/** Position in the cycle for the dots: how many of `cycles` work sessions are done. */
export function cycleDots(p: Pomo, cycles: number): boolean[] {
  const filled = p.phase === "long" ? cycles : p.done % Math.max(1, cycles);
  return Array.from({ length: cycles }, (_, i) => i < filled);
}

function num(v: unknown, d: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
}

export function normalizeSettings(v: unknown): Settings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    work: num(o.work, DEFAULTS.work, 1, 180),
    short: num(o.short, DEFAULTS.short, 1, 60),
    long: num(o.long, DEFAULTS.long, 1, 120),
    cycles: Math.round(num(o.cycles, DEFAULTS.cycles, 1, 12)),
    autoBreak: typeof o.autoBreak === "boolean" ? o.autoBreak : DEFAULTS.autoBreak,
    autoWork: typeof o.autoWork === "boolean" ? o.autoWork : DEFAULTS.autoWork,
  };
}

export function normalizePomo(v: unknown): Pomo {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const phase = o.phase === "short" || o.phase === "long" ? o.phase : "work";
  return {
    phase,
    endAt: typeof o.endAt === "number" && Number.isFinite(o.endAt) ? o.endAt : null,
    left: typeof o.left === "number" && o.left >= 0 ? o.left : null,
    done: num(o.done, 0, 0, 1000),
    day: typeof o.day === "string" ? o.day : "",
    count: num(o.count, 0, 0, 10_000),
  };
}
