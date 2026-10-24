/**
 * Pure helpers for text to speech: voice filtering by language, splitting long texts into
 * chunks the engines read reliably, and finding the word a boundary event points at.
 */

/** The parts of SpeechSynthesisVoice the tool uses (so tests need no browser). */
export interface VoiceLike {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
  voiceURI?: string;
}

/** "fr-FR" / "fr_FR" → "fr". */
export function baseLang(tag: string): string {
  return (tag.split(/[-_]/)[0] ?? "").toLowerCase();
}

/** Base languages present, the preferred one first, then alphabetical. */
export function languages(voices: readonly VoiceLike[], preferred = ""): string[] {
  const set = new Set(voices.map((v) => baseLang(v.lang)).filter(Boolean));
  const list = [...set].sort();
  const p = baseLang(preferred);
  return set.has(p) ? [p, ...list.filter((x) => x !== p)] : list;
}

/** Voices of a base language ("" or "all" = every voice), local and default voices first. */
export function voicesFor(voices: readonly VoiceLike[], lang: string): VoiceLike[] {
  const want = lang === "all" ? "" : baseLang(lang);
  return voices
    .filter((v) => !want || baseLang(v.lang) === want)
    .sort(
      (a, b) =>
        Number(!!b.default) - Number(!!a.default) ||
        Number(!!b.localService) - Number(!!a.localService) ||
        a.lang.localeCompare(b.lang) ||
        a.name.localeCompare(b.name),
    );
}

/** The voice to use: the remembered one if it is still in the list, else the first. */
export function pickVoice(list: readonly VoiceLike[], remembered: string): VoiceLike | null {
  return list.find((v) => (v.voiceURI ?? v.name) === remembered) ?? list[0] ?? null;
}

export interface Chunk {
  text: string;
  /** Offset of the chunk in the full text, to map boundary events back. */
  offset: number;
}

/**
 * Splits a text into chunks of at most `max` characters, at sentence ends when possible, then at
 * commas or spaces. Some engines stop reading long utterances after ~15 s; short ones avoid it.
 * Blank chunks are dropped.
 */
export function chunkText(text: string, max = 220): Chunk[] {
  const out: Chunk[] = [];
  const re = /[^.!?…。\n]*(?:[.!?…。]+["'’”»)\]]*|\n+|$)/gu;
  for (const m of text.matchAll(re)) {
    if (!m[0]) continue;
    pushPiece(out, m[0], m.index ?? 0, max);
  }
  return out.filter((c) => c.text.trim() !== "");
}

function pushPiece(out: Chunk[], piece: string, offset: number, max: number): void {
  let rest = piece;
  let at = offset;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "));
    if (cut < max / 3) cut = window.lastIndexOf(" ");
    if (cut < 1) cut = max - 1;
    out.push({ text: rest.slice(0, cut + 1), offset: at });
    at += cut + 1;
    rest = rest.slice(cut + 1);
  }
  if (rest) out.push({ text: rest, offset: at });
}

/**
 * The word starting at (or containing) `index` in `text`: [start, end). `length` comes from the
 * boundary event when the engine gives it (charLength), else the word is read from the text.
 */
export function wordAt(text: string, index: number, length = 0): [number, number] | null {
  if (index < 0 || index >= text.length) return null;
  if (length > 0) return [index, Math.min(text.length, index + length)];
  let start = index;
  let end = index;
  const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}\p{M}'’-]/u.test(c);
  if (!isWord(text[index])) {
    // Some engines point at the space before the word.
    while (start < text.length && !isWord(text[start])) start++;
    end = start;
  }
  while (start > 0 && isWord(text[start - 1])) start--;
  while (end < text.length && isWord(text[end])) end++;
  return end > start ? [start, end] : null;
}

/** Clamps the three utterance settings to what the Web Speech API accepts. */
export function clampSettings(rate: number, pitch: number, volume: number) {
  const c = (n: number, lo: number, hi: number, d: number) =>
    Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  return { rate: c(rate, 0.1, 10, 1), pitch: c(pitch, 0, 2, 1), volume: c(volume, 0, 1, 1) };
}
