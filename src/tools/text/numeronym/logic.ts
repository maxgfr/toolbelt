/**
 * Numeronyms: a word shortened to its first letter, the number of letters in between and its
 * last letter (internationalization → i18n), and the reverse lookup of well-known ones.
 */

/** The numeronym of one word, or the word unchanged when shorter than `minLength` letters. */
export function numeronym(word: string, minLength = 4): string {
  const chars = Array.from(word);
  if (chars.length < Math.max(3, minLength)) return word;
  return `${chars[0]}${chars.length - 2}${chars[chars.length - 1]}`;
}

export interface Options {
  /** Words shorter than this stay as they are (default 4). */
  minLength: number;
  lowercase: boolean;
}

const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/**
 * Replaces every word of the text with its numeronym, keeping spaces and punctuation. A word is
 * a run of letters and digits: "kebab-case" gives two words, "l'été" too.
 */
export function numeronymize(text: string, opts: Options): string {
  return text.replace(WORD, (w) => {
    const word = opts.lowercase ? w.toLowerCase() : w;
    if (/^\p{N}+$/u.test(word)) return word;
    return numeronym(word.normalize("NFC"), opts.minLength);
  });
}

export interface Known {
  word: string;
  /** French equivalent or explanation. */
  fr: string;
}

/** Well-known numeronyms, by the words they stand for. */
export const KNOWN: Known[] = [
  { word: "internationalization", fr: "internationalisation" },
  { word: "localization", fr: "localisation" },
  { word: "globalization", fr: "globalisation" },
  { word: "multilingualization", fr: "multilinguisation" },
  { word: "translation", fr: "traduction" },
  { word: "localizability", fr: "localisabilité" },
  { word: "accessibility", fr: "accessibilité" },
  { word: "kubernetes", fr: "Kubernetes (orchestrateur de conteneurs)" },
  { word: "canonicalization", fr: "canonicalisation" },
  { word: "containerization", fr: "conteneurisation" },
  { word: "observability", fr: "observabilité" },
  { word: "personalization", fr: "personnalisation" },
  { word: "serialization", fr: "sérialisation" },
  { word: "interoperability", fr: "interopérabilité" },
  { word: "virtualization", fr: "virtualisation" },
  { word: "externalization", fr: "externalisation" },
  { word: "modularization", fr: "modularisation" },
  { word: "authentication", fr: "authentification" },
  { word: "authorization", fr: "autorisation" },
  { word: "electrolysis", fr: "Electrolysis (Firefox multi-processus)" },
  { word: "andreessenhorowitz", fr: "Andreessen Horowitz (fonds d'investissement)" },
  { word: "documentation", fr: "documentation" },
  { word: "reliability", fr: "fiabilité" },
  { word: "scalability", fr: "scalabilité" },
  { word: "development", fr: "développement" },
  { word: "everything", fr: "tout" },
];

/** Known words a numeronym (e.g. "a11y", "K8s") may stand for; empty when unknown or malformed. */
export function expand(token: string): Known[] {
  const m = token.trim().match(/^(\p{L})(\d+)(\p{L})$/u);
  if (!m) return [];
  const first = (m[1] ?? "").toLowerCase();
  const n = Number(m[2]);
  const last = (m[3] ?? "").toLowerCase();
  return KNOWN.filter((k) => {
    const c = Array.from(k.word.toLowerCase());
    return c.length === n + 2 && c[0] === first && c[c.length - 1] === last;
  });
}

/** Every numeronym-looking token in a text, with its known expansions (deduplicated). */
export function lookupAll(text: string): { token: string; matches: Known[] }[] {
  const seen = new Set<string>();
  const out: { token: string; matches: Known[] }[] = [];
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])\p{L}\d+\p{L}(?![\p{L}\p{N}])/gu)) {
    const key = m[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ token: m[0], matches: expand(m[0]) });
  }
  return out;
}
