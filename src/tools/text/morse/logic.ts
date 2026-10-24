/**
 * International Morse code (ITU), both ways. Letters are separated by a space
 * and words by " / ". Decoding accepts the usual look-alikes (·, •, −, –, _)
 * and "/", "|" or several spaces between words. Timings for playback follow
 * the PARIS standard: a dot lasts 1200 / WPM milliseconds.
 */

const TABLE: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
  // Letters with their own code (otherwise accents are dropped: Ê → E).
  À: ".--.-",
  Ä: ".-.-",
  Ç: "-.-..",
  É: "..-..",
  È: ".-..-",
  Ñ: "--.--",
  Ö: "---.",
  Ü: "..--",
};

const REVERSE: Record<string, string> = {};
for (const [k, v] of Object.entries(TABLE)) if (!(v in REVERSE)) REVERSE[v] = k;

export interface EncodeResult {
  morse: string;
  /** Characters that have no Morse code (left out). */
  unknown: string[];
}

export function encode(text: string): EncodeResult {
  const unknown = new Set<string>();
  const words = text
    .toUpperCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const codes: string[] = [];
      for (const ch of word) {
        const code = TABLE[ch] ?? TABLE[ch.normalize("NFD").replace(/\p{M}/gu, "")];
        if (code) codes.push(code);
        else unknown.add(ch);
      }
      return codes.join(" ");
    })
    .filter(Boolean);
  return { morse: words.join(" / "), unknown: [...unknown] };
}

export interface DecodeResult {
  text: string;
  /** Codes that match no character (shown as "?" in the text). */
  unknown: string[];
}

export function normalizeMorse(s: string): string {
  return s.replace(/[·•∙⋅]/g, ".").replace(/[−–—_‒]/g, "-");
}

export function decode(morse: string): DecodeResult {
  const unknown = new Set<string>();
  const words = normalizeMorse(morse)
    .trim()
    .split(/\s*[/|]\s*|\s{2,}|\n+/)
    .filter((w) => w.trim())
    .map((w) =>
      w
        .trim()
        .split(/\s+/)
        .map((code) => {
          const ch = REVERSE[code];
          if (ch) return ch;
          unknown.add(code);
          return "?";
        })
        .join(""),
    );
  return { text: words.join(" "), unknown: [...unknown] };
}

/** Whether a text looks like Morse rather than plain text. */
export function looksLikeMorse(s: string): boolean {
  const t = normalizeMorse(s).trim();
  return t !== "" && /^[.\-\s/|]+$/.test(t) && /[.-]/.test(t);
}

/** On/off durations in dot units: dot 1, dash 3, gap 1 inside a letter, 3 between letters, 7 between words. */
export function timings(morse: string): { on: boolean; units: number }[] {
  const out: { on: boolean; units: number }[] = [];
  const gap = (units: number) => {
    const last = out[out.length - 1];
    if (!last) return;
    if (!last.on) last.units = Math.max(last.units, units);
    else out.push({ on: false, units });
  };
  for (const word of normalizeMorse(morse)
    .trim()
    .split(/\s*[/|]\s*|\s{2,}|\n+/)) {
    gap(7);
    for (const letter of word.trim().split(/\s+/)) {
      gap(3);
      for (const sym of letter) {
        if (sym !== "." && sym !== "-") continue;
        gap(1);
        out.push({ on: true, units: sym === "." ? 1 : 3 });
      }
    }
  }
  return out;
}

export function dotMs(wpm: number): number {
  return 1200 / wpm;
}

export const CHART = Object.entries(TABLE);
