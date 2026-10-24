/**
 * Small pure helpers for the camera & microphone test: level meter maths (dBFS, peak hold),
 * resolution names and aspect ratios, device labels and the recording format to use.
 */

/** dBFS of an RMS level (0 dB = full scale); −Infinity for silence. */
export function toDb(rms: number): number {
  return rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY;
}

/** Position of a dBFS level on a meter from `floor` dB (0) to 0 dB (1). */
export function meterFraction(db: number, floor = -60): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db - floor) / -floor));
}

/**
 * Peak hold: the peak follows any louder level at once, then falls by `fallPerSec` dB per
 * second after `holdMs` without a new peak.
 */
export function nextPeak(
  peak: { db: number; at: number },
  db: number,
  now: number,
  holdMs = 1000,
  fallPerSec = 20,
): { db: number; at: number } {
  if (!Number.isFinite(peak.db) || db >= peak.db) return { db, at: now };
  const since = now - peak.at;
  if (since <= holdMs) return peak;
  const fallen = peak.db - (fallPerSec * (since - holdMs)) / 1000;
  return fallen <= db ? { db, at: now } : { db: fallen, at: peak.at };
}

/** A common name for a video size ("720p", "1080p", "4K") or null. */
export function resolutionName(w: number, h: number): string | null {
  const short = Math.min(w, h);
  const names: [number, string][] = [
    [2160, "4K"],
    [1440, "1440p"],
    [1080, "1080p"],
    [720, "720p"],
    [480, "480p"],
    [360, "360p"],
    [240, "240p"],
  ];
  for (const [px, name] of names) if (short === px) return name;
  return null;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** The aspect ratio as "16:9", "4:3"…, or a decimal ratio when it has no simple form. */
export function aspectRatio(w: number, h: number): string {
  if (!(w > 0 && h > 0)) return "–";
  const known: [number, string][] = [
    [16 / 9, "16:9"],
    [4 / 3, "4:3"],
    [3 / 2, "3:2"],
    [1, "1:1"],
    [21 / 9, "21:9"],
    [16 / 10, "16:10"],
    [9 / 16, "9:16"],
    [3 / 4, "3:4"],
  ];
  const r = w / h;
  for (const [v, name] of known) if (Math.abs(r - v) < 0.01) return name;
  const g = gcd(Math.round(w), Math.round(h));
  const a = Math.round(w) / g;
  const b = Math.round(h) / g;
  return a <= 50 && b <= 50 ? `${a}:${b}` : `${r.toFixed(2)}:1`;
}

/** A device's label, or a numbered fallback before permission is given (labels are empty then). */
export function deviceLabel(label: string, index: number, fallback: string): string {
  return label.trim() || `${fallback} ${index + 1}`;
}

/** The first recording format the browser supports, or "" to let it choose. */
export function pickMime(isSupported: (t: string) => boolean): string {
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"])
    if (isSupported(t)) return t;
  return "";
}

/** Frames per second from frame timestamps (ms), over the last second. */
export function measuredFps(times: readonly number[]): number | null {
  if (times.length < 2) return null;
  const last = times[times.length - 1] as number;
  const recent = times.filter((t) => last - t <= 1000);
  if (recent.length < 2) return null;
  const span = last - (recent[0] as number);
  return span > 0 ? ((recent.length - 1) * 1000) / span : null;
}
