/**
 * Countdown timers kept as end timestamps: a running timer stores when it ends, so it stays
 * exact in a background tab and after a reload. A timer whose end has passed is "done" (it
 * rings) until it is reset or restarted.
 */
import { formatRemaining } from "../_shared";

export type Timer = {
  id: string;
  name: string;
  /** Length it was set to, in ms. */
  duration: number;
  /** Epoch ms when it ends, while running or done; null when idle or paused. */
  endAt: number | null;
  /** Time left while idle or paused, in ms. */
  left: number;
};

export type Status = "idle" | "running" | "paused" | "done";

export const MAX_DURATION = 100 * 3600_000;

export function makeTimer(id: string, name: string, duration: number): Timer {
  const d = clampDuration(duration);
  return { id, name, duration: d, endAt: null, left: d };
}

function clampDuration(ms: number): number {
  return Math.min(MAX_DURATION, Math.max(1000, Math.round(ms / 1000) * 1000));
}

export function remaining(t: Timer, now: number): number {
  return t.endAt === null ? t.left : Math.max(0, t.endAt - now);
}

export function status(t: Timer, now: number): Status {
  if (t.endAt !== null) return t.endAt <= now ? "done" : "running";
  return t.left < t.duration ? "paused" : "idle";
}

/** 0 at the start, 1 at the end. */
export function progress(t: Timer, now: number): number {
  const r = remaining(t, now);
  const total = Math.max(t.duration, r);
  return total <= 0 ? 1 : 1 - r / total;
}

export function startTimer(t: Timer, now: number): Timer {
  const s = status(t, now);
  if (s === "running") return t;
  if (s === "done" || t.left <= 0) return { ...t, endAt: now + t.duration, left: t.duration };
  return { ...t, endAt: now + t.left };
}

export function pauseTimer(t: Timer, now: number): Timer {
  if (status(t, now) !== "running") return t;
  return { ...t, endAt: null, left: remaining(t, now) };
}

export function resetTimer(t: Timer): Timer {
  return { ...t, endAt: null, left: t.duration };
}

/** Adds (or removes, if negative) time. A done timer starts again with the added time. */
export function addTime(t: Timer, ms: number, now: number): Timer {
  const s = status(t, now);
  if (s === "running") {
    const endAt = Math.max(now, (t.endAt as number) + ms);
    return { ...t, endAt, duration: Math.max(t.duration, endAt - now) };
  }
  if (s === "done") return ms > 0 ? { ...t, endAt: now + ms } : t;
  const left = Math.min(MAX_DURATION, Math.max(0, t.left + ms));
  return { ...t, left, duration: Math.max(t.duration, left) };
}

/** The key under which the end of one run of a timer is announced (once). */
export function endKey(t: Timer): string {
  return `${t.id}@${t.endAt}`;
}

/** Timers that are done and not yet announced. */
export function newlyDone(timers: Timer[], announced: ReadonlySet<string>, now: number): Timer[] {
  return timers.filter((t) => status(t, now) === "done" && !announced.has(endKey(t)));
}

/** The page title: the done timers first, then the one ending soonest. */
export function titleText(timers: Timer[], now: number): string | null {
  const done = timers.filter((t) => status(t, now) === "done");
  if (done.length) return `⏰ ${done.map((t) => t.name).join(", ")}`;
  const run = timers
    .filter((t) => status(t, now) === "running")
    .sort((a, b) => (a.endAt as number) - (b.endAt as number))[0];
  return run ? `⏳ ${formatRemaining(remaining(run, now))} · ${run.name}` : null;
}

/**
 * Reads a duration typed by a person: "5" (minutes), "1:30" (m:s), "1:02:03" (h:m:s),
 * "90s", "5m", "1h30", "1h 30m 15s", "2.5 min". Returns ms, or null if it does not parse.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  let ms: number;
  if (/^\d+(\.\d+)?$/.test(s)) ms = Number(s) * 60_000;
  else if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    const parts = s.split(":").map(Number);
    if (parts.slice(1).some((p) => p >= 60)) return null;
    ms = parts.reduce((acc, p) => acc * 60 + p, 0) * 1000;
  } else {
    const re =
      /(\d+(?:\.\d+)?)\s*(hours?|heures?|hrs?|h|minutes?|mins?|mn|m|secondes?|seconds?|secs?|s)?/g;
    const rest = s.replace(re, "").replace(/\s+/g, "");
    if (rest) return null;
    ms = 0;
    let lastUnit = "";
    let any = false;
    for (const m of s.matchAll(re)) {
      if (!m[1]) continue;
      any = true;
      const n = Number(m[1]);
      let unit = m[2] ?? "";
      // "1h30" means 1 h 30 min; "5m30" means 5 min 30 s.
      if (!unit) unit = lastUnit.startsWith("h") ? "m" : lastUnit.startsWith("m") ? "s" : "m";
      lastUnit = unit;
      ms += n * (unit.startsWith("h") ? 3600_000 : unit.startsWith("s") ? 1000 : 60_000);
    }
    if (!any) return null;
  }
  if (!Number.isFinite(ms) || ms < 1000 || ms > MAX_DURATION) return null;
  return Math.round(ms / 1000) * 1000;
}

/** Reads stored timers back, dropping anything malformed. */
export function normalizeTimers(v: unknown): Timer[] {
  if (!Array.isArray(v)) return [];
  const out: Timer[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.duration !== "number" || !(o.duration > 0)) continue;
    out.push({
      id: o.id,
      name: typeof o.name === "string" ? o.name : "",
      duration: o.duration,
      endAt: typeof o.endAt === "number" && Number.isFinite(o.endAt) ? o.endAt : null,
      left: typeof o.left === "number" && o.left >= 0 ? o.left : o.duration,
    });
  }
  return out;
}
