/**
 * Browser side of the life tools' sounds and alerts: an AudioContext that never throws, beeps
 * scheduled on the audio clock (so they fire on time even in a background tab), and system
 * notifications. Nothing here records or sends anything.
 */
import { patternLength, type Tone } from "./_shared";

/** A new AudioContext, or null when the browser has none. */
export function makeAudio(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

/**
 * Plays `tones` on `ac` starting at audio time `start`, through `dest`, at `volume` (0–1).
 * Returns a function that silences them (also the ones not yet started).
 */
export function playTones(
  ac: AudioContext,
  tones: Tone[],
  start = ac.currentTime + 0.02,
  volume = 0.3,
  dest: AudioNode = ac.destination,
  type: OscillatorType = "sine",
): () => void {
  const out = ac.createGain();
  out.gain.value = volume;
  out.connect(dest);
  const oscs: OscillatorNode[] = [];
  for (const t of tones) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = t.freq;
    const g = ac.createGain();
    const at = start + t.at;
    const peak = t.gain ?? 1;
    const ramp = Math.min(0.01, t.dur / 4);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + ramp);
    g.gain.setValueAtTime(peak, at + t.dur - ramp);
    g.gain.linearRampToValueAtTime(0, at + t.dur);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + t.dur + 0.02);
    oscs.push(osc);
  }
  let done = false;
  const end = start + patternLength(tones) + 0.1;
  const cleanup = () => {
    if (done) return;
    done = true;
    for (const o of oscs) {
      try {
        o.stop();
      } catch {}
    }
    try {
      out.disconnect();
    } catch {}
  };
  const last = oscs[oscs.length - 1];
  if (last) last.onended = () => ac.currentTime >= end - 0.2 && cleanup();
  return cleanup;
}

export function canNotify(): boolean {
  return typeof Notification !== "undefined";
}

/** Asks for permission to show notifications (call from a click). Resolves true when allowed. */
export async function askNotify(): Promise<boolean> {
  if (!canNotify()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Shows a system notification when allowed; clicking it brings the tab back. */
export function notify(title: string, body: string, tag?: string): void {
  if (!canNotify() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, ...(tag ? { tag } : {}) });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
