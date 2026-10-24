/**
 * Pure helpers shared by the life tools: an injectable source of random integers (crypto by
 * default, seeded in tests), clock formatting, local date keys and alarm sound patterns.
 * No DOM, no Preact.
 */

/** A uniform random integer in [0, max). Tools take one so tests can inject a seeded source. */
export type RandomInt = (max: number) => number;

const TWO32 = 2 ** 32;
const TWO53 = 2 ** 53;

/**
 * A uniform integer in [0, max) from crypto.getRandomValues, by rejection sampling (no modulo
 * bias). Accepts any safe integer `max` up to 2^53.
 */
export function cryptoInt(max: number): number {
  if (!Number.isSafeInteger(max) || max < 1 || max > TWO53) throw new RangeError("max");
  if (max === 1) return 0;
  const buf = new Uint32Array(2);
  if (max <= TWO32) {
    const limit = TWO32 - (TWO32 % max);
    for (;;) {
      crypto.getRandomValues(buf);
      const x = buf[0] as number;
      if (x < limit) return x % max;
    }
  }
  const limit = TWO53 - (TWO53 % max);
  for (;;) {
    crypto.getRandomValues(buf);
    const x = ((buf[0] as number) & 0x1fffff) * TWO32 + (buf[1] as number);
    if (x < limit) return x % max;
  }
}

/** A deterministic source (mulberry32) for tests: same seed, same draws. */
export function seededInt(seed: number): RandomInt {
  let a = seed >>> 0;
  return (max: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(r * max);
  };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/**
 * A duration as a clock: `m:ss`, or `h:mm:ss` from one hour (or always with `hours`), with
 * `digits` decimals of seconds (0, 1 or 2), truncated like a stopwatch. Negative values get a
 * minus sign.
 */
export function formatClock(ms: number, digits: 0 | 1 | 2 = 0, hours = false): string {
  if (!Number.isFinite(ms)) return "–";
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const unit = digits === 0 ? 1000 : digits === 1 ? 100 : 10;
  const ticks = Math.floor(abs / unit + 1e-9);
  const perSec = 1000 / unit;
  const totalSec = Math.floor(ticks / perSec);
  const frac = ticks % perSec;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const head = h > 0 || hours ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return `${sign}${head}${digits ? `.${pad(frac, digits)}` : ""}`;
}

/** Time left, rounded up to the second (a countdown shows 0:01 until it really ends). */
export function formatRemaining(ms: number): string {
  return formatClock(Math.max(0, Math.ceil(ms / 1000 - 1e-9)) * 1000);
}

/** Splits milliseconds into whole hours, minutes and seconds. */
export function hms(ms: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.round(ms / 1000));
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

/** The local calendar day of a date, as YYYY-MM-DD. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A short random id for list items (not security sensitive). */
export function newId(rand: RandomInt = (n) => Math.floor(Math.random() * n)): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += "abcdefghijklmnopqrstuvwxyz0123456789"[rand(36)];
  return out;
}

/** One beep: start offset (s), duration (s), frequency (Hz), relative loudness 0–1. */
export interface Tone {
  at: number;
  dur: number;
  freq: number;
  gain?: number;
}

/** Groups of short beeps, like a kitchen timer: `groups` bursts of `beeps` beeps. */
export function beepPattern(groups = 4, beeps = 4, freq = 880): Tone[] {
  const out: Tone[] = [];
  for (let g = 0; g < groups; g++)
    for (let b = 0; b < beeps; b++) out.push({ at: g * 1.4 + b * 0.16, dur: 0.1, freq });
  return out;
}

/** A gentle three-note chime (rising or falling). */
export function chime(rising = true): Tone[] {
  const notes = rising ? [660, 880, 1320] : [1320, 880, 660];
  return notes.map((freq, i) => ({ at: i * 0.22, dur: 0.45, freq, gain: 0.8 }));
}

/** How long a pattern lasts, in seconds. */
export function patternLength(tones: Tone[]): number {
  return tones.reduce((m, t) => Math.max(m, t.at + t.dur), 0);
}
