/**
 * Pitch detection with the YIN algorithm (de Cheveigné & Kawahara, 2002) on a buffer of
 * samples, and the musical side: nearest note, cents off, guitar strings. Pure: it runs the
 * same on a microphone buffer and on a synthesized sine in tests.
 */

export interface PitchOptions {
  minFreq?: number;
  maxFreq?: number;
  /** YIN absolute threshold (lower is stricter). */
  threshold?: number;
  /** Deepest dip accepted when none is under the threshold (higher is looser). */
  fallback?: number;
  /** Below this RMS level the buffer is treated as silence. */
  minRms?: number;
}

export interface Pitch {
  freq: number;
  /** 0–1: how periodic the signal is (1 − the YIN dip). */
  clarity: number;
}

export function rms(buf: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] as number;
    s += v * v;
  }
  return buf.length ? Math.sqrt(s / buf.length) : 0;
}

/** The fundamental frequency of `buf`, or null for silence, noise or a too-short buffer. */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  opts: PitchOptions = {},
): Pitch | null {
  const minFreq = opts.minFreq ?? 50;
  const maxFreq = opts.maxFreq ?? 1500;
  const threshold = opts.threshold ?? 0.15;
  if (rms(buf) < (opts.minRms ?? 0.01)) return null;
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.ceil(sampleRate / minFreq);
  const w = buf.length - tauMax - 1;
  if (w < tauMax) return null;

  // Difference function and its cumulative mean normalized version.
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let s = 0;
    for (let j = 0; j < w; j++) {
      const diff = (buf[j] as number) - (buf[j + tau] as number);
      s += diff * diff;
    }
    d[tau] = s;
  }
  const cmnd = new Float32Array(tauMax + 2);
  cmnd[0] = 1;
  let sum = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    sum += d[tau] as number;
    cmnd[tau] = sum > 0 ? ((d[tau] as number) * tau) / sum : 1;
  }

  // First dip under the threshold, followed down to its local minimum.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if ((cmnd[t] as number) < threshold) {
      while (t + 1 <= tauMax && (cmnd[t + 1] as number) < (cmnd[t] as number)) t++;
      tau = t;
      break;
    }
  }
  // None under the threshold: fall back to the deepest dip if it is still clearly periodic
  // (a busy signal, a buzzing string), as YIN's "best local estimate".
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++)
      if ((cmnd[t] as number) < (cmnd[best] as number)) best = t;
    if ((cmnd[best] as number) >= (opts.fallback ?? 0.3)) return null;
    tau = best;
  }

  // Parabolic interpolation around the minimum for sub-sample precision.
  const a = cmnd[tau - 1] as number;
  const b = cmnd[tau] as number;
  const c = cmnd[tau + 1] as number;
  const denom = a - 2 * b + c;
  const shift = denom > 0 ? (a - c) / (2 * denom) : 0;
  const period = tau + Math.max(-1, Math.min(1, shift));
  return { freq: sampleRate / period, clarity: Math.max(0, Math.min(1, 1 - b)) };
}

export const NOTES_EN = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const NOTES_FR = [
  "do",
  "do♯",
  "ré",
  "ré♯",
  "mi",
  "fa",
  "fa♯",
  "sol",
  "sol♯",
  "la",
  "la♯",
  "si",
];

/**
 * German names: H is B natural and B is B♭ (A♯ here, since notes are spelled with sharps).
 */
export const NOTES_DE = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "B", "H"];

const NOTE_NAMES = { en: NOTES_EN, fr: NOTES_FR, de: NOTES_DE };

export interface Note {
  /** MIDI number (A4 = 69). */
  midi: number;
  /** 0 = C … 11 = B. */
  pc: number;
  octave: number;
  /** How far the frequency is from the note, −50 … +50. */
  cents: number;
  /** The exact frequency of the note. */
  target: number;
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Cents from `ref` to `freq` (positive when `freq` is higher). */
export function centsBetween(freq: number, ref: number): number {
  return 1200 * Math.log2(freq / ref);
}

export function noteFromFreq(freq: number, a4 = 440): Note | null {
  if (!(freq > 0) || !(a4 > 0)) return null;
  const exact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(exact);
  const pc = ((midi % 12) + 12) % 12;
  return {
    midi,
    pc,
    octave: Math.floor(midi / 12) - 1,
    cents: (exact - midi) * 100,
    target: midiToFreq(midi, a4),
  };
}

export function noteName(
  n: { pc: number; octave: number },
  lang: "en" | "fr" | "de" = "en",
): string {
  // French and German octave numbers follow the same scientific convention here (la3 = A4 in
  // some French books; Helmholtz a′ in German ones).
  return `${(NOTE_NAMES[lang] ?? NOTES_EN)[n.pc]}${n.octave}`;
}

/** Standard guitar tuning, low to high (E2 A2 D3 G3 B3 E4), as MIDI numbers. */
export const GUITAR = [40, 45, 50, 55, 59, 64];

/** The guitar string closest to `freq`, and how many cents off it is. */
export function nearestString(
  freq: number,
  a4 = 440,
): { index: number; midi: number; cents: number } | null {
  if (!(freq > 0)) return null;
  let best: { index: number; midi: number; cents: number } | null = null;
  GUITAR.forEach((midi, index) => {
    const cents = centsBetween(freq, midiToFreq(midi, a4));
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { index, midi, cents };
  });
  return best;
}

/** The median of a few values (steadies the needle). */
export function median(values: readonly number[]): number {
  if (!values.length) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Whether the tuning is close enough to call it in tune. */
export function inTune(cents: number, tolerance = 5): boolean {
  return Math.abs(cents) <= tolerance;
}
