/**
 * Metronome timing, independent of any audio API: the ticks to schedule up to a given time
 * (the "lookahead" pattern: a timer wakes up often and queues the next ticks on the audio
 * clock), tap tempo, and tempo names.
 */

export const MIN_BPM = 30;
export const MAX_BPM = 300;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export interface Meter {
  bpm: number;
  /** Beats per bar (time signature numerator). */
  beats: number;
  /** Clicks per beat: 1 (none), 2 (eighths), 3 (triplets), 4 (sixteenths). */
  sub: number;
  /** Stress beat 1 (and the groups of three in 6/8, 9/8, 12/8). */
  accent: boolean;
  /** Time signature denominator, for compound meters. */
  unit: number;
}

export type TickKind = "accent" | "medium" | "beat" | "sub";

export interface Tick {
  /** Audio clock time, in seconds. */
  time: number;
  /** 0-based beat in the bar. */
  beat: number;
  /** 0-based subdivision in the beat. */
  sub: number;
  kind: TickKind;
}

export interface Cursor {
  /** Time of the next tick. */
  next: number;
  /** Position of the next tick in the bar, counted in subdivisions. */
  index: number;
}

/** Seconds between two clicks. */
export function interval(m: Meter): number {
  return 60 / clampBpm(m.bpm) / Math.max(1, m.sub);
}

/** The kind of click for a beat and subdivision. */
export function kindOf(m: Meter, beat: number, sub: number): TickKind {
  if (sub > 0) return "sub";
  if (!m.accent) return "beat";
  if (beat === 0) return "accent";
  if (m.unit === 8 && m.beats % 3 === 0 && m.beats > 3 && beat % 3 === 0) return "medium";
  return "beat";
}

/** The ticks from `cursor` up to (not including) `until`, and the cursor after them. */
export function schedule(
  cursor: Cursor,
  until: number,
  m: Meter,
): { ticks: Tick[]; cursor: Cursor } {
  const ticks: Tick[] = [];
  const subs = Math.max(1, m.sub);
  const bar = Math.max(1, m.beats) * subs;
  const step = interval(m);
  let { next, index } = cursor;
  index %= bar;
  for (let guard = 0; next < until && guard < 10_000; guard++) {
    const beat = Math.floor(index / subs);
    const sub = index % subs;
    ticks.push({ time: next, beat, sub, kind: kindOf(m, beat, sub) });
    next += step;
    index = (index + 1) % bar;
  }
  return { ticks, cursor: { next, index } };
}

/**
 * Tempo from taps (timestamps in ms): the average of the last intervals, ignoring taps older
 * than a pause of 2 s. Null until there are two taps in a row.
 */
export function tapTempo(taps: readonly number[], maxTaps = 8): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0; i--) {
    const t = taps[i] as number;
    const prev = recent[0];
    if (prev !== undefined && prev - t > 2000) break;
    recent.unshift(t);
    if (recent.length >= maxTaps) break;
  }
  if (recent.length < 2) return null;
  const span = (recent[recent.length - 1] as number) - (recent[0] as number);
  const avg = span / (recent.length - 1);
  return avg > 0 ? clampBpm(60_000 / avg) : null;
}

/** The Italian tempo name usually used around this tempo. */
export function tempoName(bpm: number): string {
  const names: [number, string][] = [
    [40, "Grave"],
    [60, "Largo"],
    [66, "Larghetto"],
    [76, "Adagio"],
    [108, "Andante"],
    [120, "Moderato"],
    [156, "Allegro"],
    [176, "Vivace"],
    [200, "Presto"],
  ];
  for (const [max, name] of names) if (bpm < max) return name;
  return "Prestissimo";
}

/** Time signatures offered, as [beats, unit]. */
export const SIGNATURES: [number, number][] = [
  [1, 4],
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [7, 4],
  [3, 8],
  [5, 8],
  [6, 8],
  [7, 8],
  [9, 8],
  [12, 8],
];
