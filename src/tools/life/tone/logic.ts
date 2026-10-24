/**
 * Tone and noise generator maths: white, pink and brown noise samples, a perceptual volume
 * curve with a low ceiling, a logarithmic frequency slider and the sleep timer.
 */

export type NoiseKind = "white" | "pink" | "brown";

export const MIN_FREQ = 20;
export const MAX_FREQ = 20_000;

/**
 * `n` samples of noise from `random` (uniform in [0, 1)), scaled to the same loudness (RMS)
 * for every color. Pink uses Paul Kellet's filter (−3 dB/octave), brown a leaky integrator
 * (−6 dB/octave).
 */
export function noiseSamples(kind: NoiseKind, n: number, random: () => number): Float32Array {
  const out = new Float32Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = random() * 2 - 1;
    if (kind === "white") out[i] = w;
    else if (kind === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      out[i] = last;
    }
  }
  // Remove any offset, then match a common RMS so switching colors keeps the level.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += out[i] as number;
  mean /= n || 1;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const v = (out[i] as number) - mean;
    out[i] = v;
    sq += v * v;
  }
  const rms = Math.sqrt(sq / (n || 1));
  const k = rms > 0 ? 0.25 / rms : 0;
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, (out[i] as number) * k));
  return out;
}

/** Crossfades the end of a looped buffer into its start, so the loop has no click. */
export function smoothLoop(buf: Float32Array, fade: number): Float32Array {
  const n = buf.length;
  const f = Math.min(fade, Math.floor(n / 2));
  const out = buf.slice(0, n - f);
  for (let i = 0; i < f; i++) {
    const t = i / f;
    out[i] = (buf[i] as number) * t + (buf[n - f + i] as number) * (1 - t);
  }
  return out;
}

/** Output gain for a 0–100 volume: a squared curve (closer to how loud it sounds), capped at 0.5. */
export function volumeToGain(percent: number): number {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0)) / 100;
  return 0.5 * p * p;
}

/** Slider position 0–1000 to a frequency on a log scale from 20 Hz to 20 kHz. */
export function sliderToFreq(x: number): number {
  const t = Math.max(0, Math.min(1000, x)) / 1000;
  return MIN_FREQ * (MAX_FREQ / MIN_FREQ) ** t;
}

export function freqToSlider(f: number): number {
  const c = Math.max(MIN_FREQ, Math.min(MAX_FREQ, f));
  return (1000 * Math.log(c / MIN_FREQ)) / Math.log(MAX_FREQ / MIN_FREQ);
}

export function clampFreq(f: number): number {
  return Number.isFinite(f) ? Math.max(MIN_FREQ, Math.min(MAX_FREQ, f)) : 440;
}

/** Rounds a frequency for display: 0.1 Hz below 1 kHz, 1 Hz above. */
export function roundFreq(f: number): number {
  return f < 1000 ? Math.round(f * 10) / 10 : Math.round(f);
}

/** Ms left on the sleep timer, or null when it is off. */
export function sleepLeft(endAt: number | null, now: number): number | null {
  return endAt === null ? null : Math.max(0, endAt - now);
}
