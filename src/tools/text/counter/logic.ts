/** Counting characters, words, lines, sentences, bytes, and reading time. */

export interface TextStats {
  characters: number;
  graphemes: number;
  noSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  bytes: number;
  tokens: number;
  readingMinutes: number;
  speakingMinutes: number;
}

const WPM_READ = 238;
const WPM_SPEAK = 150;

function segmenter(granularity: "grapheme" | "word" | "sentence", locale?: string) {
  return new Intl.Segmenter(locale, { granularity });
}

export function countWords(text: string, locale?: string): number {
  let n = 0;
  for (const s of segmenter("word", locale).segment(text)) if (s.isWordLike) n++;
  return n;
}

export function textStats(text: string, locale?: string): TextStats {
  let graphemes = 0;
  for (const _ of segmenter("grapheme", locale).segment(text)) graphemes++;
  let sentences = 0;
  for (const s of segmenter("sentence", locale).segment(text)) if (s.segment.trim()) sentences++;
  const words = countWords(text, locale);
  return {
    characters: text.length,
    graphemes,
    noSpaces: [...text.replace(/\s/gu, "")].length,
    words,
    lines: text === "" ? 0 : text.split(/\r\n|\r|\n/).length,
    sentences,
    paragraphs: text.split(/(?:\r?\n\s*){2,}/).filter((p) => p.trim()).length,
    bytes: new TextEncoder().encode(text).length,
    // A rough estimate for LLM tokenizers: about 4 characters per token in English.
    tokens: Math.ceil(text.length / 4),
    readingMinutes: words / WPM_READ,
    speakingMinutes: words / WPM_SPEAK,
  };
}

/** The most frequent words (lowercased), longest first on ties. */
export function wordFrequency(
  text: string,
  limit = 10,
  minLength = 1,
  locale?: string,
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of segmenter("word", locale).segment(text)) {
    if (!s.isWordLike) continue;
    const w = s.segment.toLocaleLowerCase(locale);
    if ([...w].length < minLength) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort(
      (a, b) => b.count - a.count || b.word.length - a.word.length || a.word.localeCompare(b.word),
    )
    .slice(0, limit);
}

/** "3 min 20 s", "45 s". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes * 60);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** Common length limits, to see at a glance whether a text fits. */
export const LIMITS = [
  { id: "x", label: "X / Twitter", max: 280 },
  { id: "sms", label: "SMS", max: 160 },
  { id: "title", label: "SEO title", max: 60 },
  { id: "meta", label: "Meta description", max: 160 },
  { id: "linkedin", label: "LinkedIn", max: 3000 },
] as const;
