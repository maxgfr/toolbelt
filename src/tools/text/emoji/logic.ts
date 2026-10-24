/**
 * The emoji catalogue (parsed from the generated data module), search, skin tones, code points
 * and shortcode-like names.
 */

export const GROUP_IDS = [
  "smileys",
  "people",
  "animals",
  "food",
  "travel",
  "activities",
  "objects",
  "symbols",
  "flags",
] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export interface Emoji {
  /** The fully-qualified emoji, default (yellow) skin. */
  e: string;
  /** Takes the five skin tone modifiers. */
  tones: boolean;
  en: string;
  /** French CLDR name ("" when none, use `en`). */
  fr: string;
  keywords: string[];
  group: GroupId;
}

export interface Group {
  id: GroupId;
  items: Emoji[];
}

/** Parses the tab-separated catalogue (see data.ts). */
export function parseCatalog(data: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  for (const line of data.split("\n")) {
    if (line.startsWith("=")) {
      const id = line.slice(1) as GroupId;
      cur = { id, items: [] };
      groups.push(cur);
      continue;
    }
    if (!cur || !line) continue;
    const [e = "", tone = "", en = "", fr = "", kw = ""] = line.split("\t");
    if (!e) continue;
    cur.items.push({
      e,
      tones: tone === "1",
      en,
      fr: fr || en,
      keywords: kw ? kw.split("|") : [],
      group: cur.id,
    });
  }
  return groups;
}

/** Skin tones: 0 = default (no modifier), 1–5 = light → dark (U+1F3FB…U+1F3FF). */
export const TONE_SWATCHES = ["✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"];

const MOD_BASE = /\p{Emoji_Modifier_Base}/u;

/**
 * The emoji with a skin tone (1–5): the modifier goes after every person or hand in the
 * sequence (a handshake between two people stays yellow), replacing a following VS16.
 */
export function withTone(e: string, tone: number): string {
  if (tone < 1 || tone > 5) return e;
  const mod = String.fromCodePoint(0x1f3fa + tone);
  const cps = [...e];
  let out = "";
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i] ?? "";
    const inZwj = cps[i - 1] === "\u200d" && cps[i + 1] === "\u200d";
    if (MOD_BASE.test(c) && !(c === "🤝" && inZwj)) {
      out += c + mod;
      if (cps[i + 1] === "\ufe0f") i++;
    } else out += c;
  }
  return out;
}

/** "U+1F44B U+1F3FD" */
export function codePoints(s: string): string {
  return [...s]
    .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");
}

/** A Slack/GitHub-style name built from the English name (not an official shortcode). */
export function shortcode(name: string): string {
  const base = fold(name)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `:${base}:`;
}

/** Lowercase, accents removed (so "cafe" finds "café"). */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/[’']/g, "'");
}

interface Indexed {
  emoji: Emoji;
  names: string;
  words: string[];
}

/** A search index over the catalogue; build it once. */
export function buildIndex(groups: Group[]): Indexed[] {
  const out: Indexed[] = [];
  for (const g of groups)
    for (const emoji of g.items) {
      const names = fold(`${emoji.en} | ${emoji.fr}`);
      const words = fold([emoji.en, emoji.fr, ...emoji.keywords].join(" "))
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);
      out.push({ emoji, names, words });
    }
  return out;
}

/**
 * Emojis whose names or keywords contain every word of the query (each as a word prefix), best
 * first: exact name, name prefix, words in the name, then keyword matches. Pasting an emoji finds
 * it too.
 */
export function search(index: Indexed[], query: string, limit = 400): Emoji[] {
  const q = fold(query.trim());
  if (!q) return [];
  const terms = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const scored: { emoji: Emoji; score: number; i: number }[] = [];
  index.forEach((it, i) => {
    const raw = query.trim();
    if (it.emoji.e === raw || it.emoji.e.replace(/\ufe0f/g, "") === raw.replace(/\ufe0f/g, "")) {
      scored.push({ emoji: it.emoji, score: -1, i });
      return;
    }
    if (terms.length === 0) return;
    if (!terms.every((t) => it.words.some((w) => w.startsWith(t)))) return;
    const en = fold(it.emoji.en);
    const fr = fold(it.emoji.fr);
    let score = 4;
    if (en === q || fr === q) score = 0;
    else if (en.startsWith(q) || fr.startsWith(q)) score = 1;
    else if (it.names.includes(q)) score = 2;
    else if (terms.every((t) => it.names.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(t))))
      score = 3;
    scored.push({ emoji: it.emoji, score, i });
  });
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.emoji);
}

/** Recently copied list: newest first, no duplicates, capped. */
export function pushRecent(list: readonly string[], e: string, max = 24): string[] {
  return [e, ...list.filter((x) => x !== e)].slice(0, max);
}
