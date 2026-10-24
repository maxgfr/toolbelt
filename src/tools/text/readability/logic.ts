/**
 * Readability scores for English (Flesch, Flesch–Kincaid, Gunning fog, SMOG, Coleman–Liau, ARI),
 * French (Kandel–Moles) and German (Flesch–Amstad, Wiener Sachtextformel), plus LIX for all,
 * with heuristic syllable counting per language.
 */

export type Lang = "en" | "fr" | "de";

/** Vowel groups of an English word, with the usual silent-e and diphthong corrections. */
export function syllablesEn(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!lower) return 0;
  if (lower.length <= 3) return 1;
  // Silent endings: make, tables, jumped (but not wanted, needed, table).
  const w = lower.replace(/(?:[^laeiouy]es|[^laeiouydt]ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  let n = (w.match(/[aeiouy]+/g) ?? []).length;
  // Vowel pairs that are usually two syllables: li-on, pi-a-no, ac-tu-al (not na-tion, qual-i-ty).
  n += (w.match(/(?:^|[^cgst])i[ao]|[^gq]ua/g) ?? []).length;
  return Math.max(1, n);
}

const FR_VOWELS = "aeiouyàâäéèêëîïôöùûüÿœæ";

/** Vowel groups of a French word, ignoring the final mute e / es / ent of most words. */
export function syllablesFr(word: string): number {
  let w = word.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿœæç]/g, "");
  if (!w) return 0;
  if (w.length <= 2) return 1;
  // Mute endings: "table", "tables", "parlent" (verbs; "moment", "souvent" are miscounted by one).
  w = w.replace(/([^aeiouyéèêëàâîïôûù])(?:e|es|ent)$/, "$1");
  // A diaeresis starts a new syllable: na-ïf, No-ël.
  const groups =
    w.match(new RegExp(`[ïëüÿ]|[${FR_VOWELS}]+?(?=[ïëüÿ])|[${FR_VOWELS}]+`, "g")) ?? [];
  let n = groups.length;
  // "i" / "u" before another vowel after two consonants is often its own syllable (cri-er).
  n += (w.match(/[bcdfgkptv][lr]i[aeoéèu]/g) ?? []).length;
  return Math.max(1, n);
}

/** Vowel pairs that German reads as one sound: diphthongs, long double vowels, "ie". */
const DE_NUCLEI = /^(?:ei|ai|ey|ay|au|eu|äu|ie|aa|ee|oo)/;

/**
 * Syllables of a German word: one per vowel, except that diphthongs and long vowels (ei, au,
 * eu, äu, ie, aa, ee, oo) count once and the "u" of "qu" is not a vowel. So "Theater" (e-a) and
 * "Nation" (i-o) get their hiatus, "Feuer" splits as eu-e. Misses: "Museum", "Familie".
 */
export function syllablesDe(word: string): number {
  const w = word
    .toLowerCase()
    .replace(/[^a-zäöüß]/g, "")
    .replace(/qu/g, "q");
  if (!w) return 0;
  let n = 0;
  for (const group of w.match(/[aeiouyäöü]+/g) ?? []) {
    let i = 0;
    while (i < group.length) {
      i += DE_NUCLEI.test(group.slice(i)) ? 2 : 1;
      n++;
    }
  }
  return Math.max(1, n);
}

export function syllables(word: string, lang: Lang): number {
  if (lang === "fr") return syllablesFr(word);
  if (lang === "de") return syllablesDe(word);
  return syllablesEn(word);
}

export interface Sentence {
  start: number;
  end: number;
  words: number;
}

const ELISION = /^(?:l|d|j|m|n|s|t|c|qu|jusqu|lorsqu|puisqu|quoiqu)['’]/i;

/** Words of a text: letters and digits, apostrophes inside; French elisions are split off. */
export function words(text: string, lang: Lang): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)) {
    let w = m[0];
    if (lang === "fr") {
      const e = w.match(ELISION);
      if (e && w.length > e[0].length) {
        out.push(e[0].slice(0, -1));
        w = w.slice(e[0].length);
      }
    }
    out.push(w);
  }
  return out;
}

const DE_ABBR =
  /(?:^|[^\p{L}])(?:z\.\s?B|d\.\s?h|u\.\s?a|bzw|vgl|ca|evtl|ggf|inkl|sog|Nr|Hr|Fr|Str|Abb|Kap|Jh|geb)\.$/u;
const DE_AFTER_ORDINAL =
  /^(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jahrhundert|Klasse|Mal|Platz|Stock)\b/u;

/** A German abbreviation, or an ordinal before a month, does not end the sentence. */
function germanGlue(before: string, next: string): boolean {
  return DE_ABBR.test(before) || (/\d\.$/.test(before) && DE_AFTER_ORDINAL.test(next));
}

/** Sentences (end punctuation or blank lines), with their position and word count. */
export function sentences(text: string, lang: Lang): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?…\n]+(?:[.!?…]+["'’”»)\]]*|\n|$)|\n/gu;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    // Abbreviations and decimals: "Dr. Smith", "e.g. this", "3.5" do not end a sentence.
    const count = words(raw, lang).filter((w) => /\p{L}/u.test(w)).length;
    if (count === 0) continue;
    const start = (m.index ?? 0) + (raw.length - raw.trimStart().length);
    const end = (m.index ?? 0) + raw.trimEnd().length;
    const prev = out[out.length - 1];
    const before = prev ? text.slice(prev.start, prev.end) : "";
    const next = text.slice(start, end);
    const between = prev ? text.slice(prev.end, start) : "";
    // Titles and initials are followed by a name; other abbreviations and decimals by lowercase.
    // German capitalizes nouns, so its abbreviations ("z. B.", "bzw.", "Nr.") glue whatever
    // follows, and so does an ordinal before a month ("am 3. Oktober").
    const glue =
      !between.includes("\n") &&
      (/(?:^|[^\p{L}])(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|M|Mme|Mlle|Me|Pr|\p{Lu})\.$/u.test(before) ||
        (/(?:^|[^\p{L}])\p{L}\.$/u.test(before) && /^\p{L}\./u.test(next)) ||
        (lang === "de" && germanGlue(before, next)) ||
        (/(?:(?:^|[^\p{L}])(?:vs|etc|usw|e\.g|i\.e|cf|p|ex|av|apr|J\.-C|\p{Ll})\.|\d\.)$/u.test(
          before,
        ) &&
          /^[\p{Ll}\d]/u.test(next)));
    if (glue && prev) {
      prev.end = end;
      prev.words += count;
    } else out.push({ start, end, words: count });
  }
  return out;
}

export interface Analysis {
  lang: Lang;
  sentences: Sentence[];
  words: number;
  letters: number;
  syllables: number;
  /** Words of 3 syllables or more. */
  complex: number;
  /** Words of one syllable (Wiener Sachtextformel). */
  mono: number;
  /** Words of more than 6 letters (LIX). */
  long: number;
  scores: Score[];
}

export type ScoreId =
  | "flesch"
  | "fk"
  | "fog"
  | "smog"
  | "cli"
  | "ari"
  | "kandel"
  | "amstad"
  | "wstf"
  | "lix";

/** The usual name of each score. */
export const SCORE_NAMES: Record<ScoreId, string> = {
  flesch: "Flesch Reading Ease",
  fk: "Flesch–Kincaid Grade",
  fog: "Gunning Fog",
  smog: "SMOG",
  cli: "Coleman–Liau",
  ari: "Automated Readability Index",
  kandel: "Kandel & Moles",
  amstad: "Flesch–Amstad",
  wstf: "Wiener Sachtextformel",
  lix: "LIX",
};

export interface Score {
  id: ScoreId;
  value: number;
  /** A school grade (US) or years of schooling, when the score maps to one. */
  grade: number | null;
  /** 0 (very easy) … 4 (very hard). */
  level: 0 | 1 | 2 | 3 | 4;
  /** The formula is unreliable on such a short text (SMOG wants 30 sentences). */
  shaky: boolean;
}

/** Guesses English, French or German from common function words. */
export function detectLang(text: string): Lang {
  const w = text.toLowerCase().match(/[\p{L}'’]+/gu) ?? [];
  const FR = new Set(
    "le la les des du un une et est que qui dans pour pas sur au aux ce cette il elle nous vous ils sont avec mais ou où plus être été c'est l'".split(
      " ",
    ),
  );
  const EN = new Set(
    "the and is are of to in that it for was with as on be this have not you he she they but or at by from".split(
      " ",
    ),
  );
  const DE = new Set(
    "der die das und ist nicht ein eine einen dem den des zu von mit sich auf für im auch es ich sie er wir ihr wird sind war als nach wie aus bei oder aber noch über dass".split(
      " ",
    ),
  );
  let fr = 0;
  let en = 0;
  let de = 0;
  for (const x of w) {
    if (FR.has(x) || /^(?:l|d|qu|c|n|s|j)['’]/.test(x) || /[éèêàçù]/.test(x)) fr++;
    if (EN.has(x)) en++;
    if (DE.has(x) || /[äöüß]/.test(x)) de++;
  }
  if (de > en && de > fr) return "de";
  return fr > en ? "fr" : "en";
}

function level(value: number, bands: number[], higherIsEasier: boolean): Score["level"] {
  const i = bands.findIndex((b) => (higherIsEasier ? value >= b : value <= b));
  return (i < 0 ? 4 : i) as Score["level"];
}

const round = (n: number) => Math.round(n * 10) / 10;

export function analyze(text: string, lang: Lang): Analysis {
  const sents = sentences(text, lang);
  const ws = words(text, lang).filter((w) => /\p{L}/u.test(w));
  const S = Math.max(1, sents.length);
  const W = ws.length;
  let syl = 0;
  let complex = 0;
  let mono = 0;
  let long = 0;
  let letters = 0;
  for (const w of ws) {
    const n = syllables(w, lang);
    syl += n;
    if (n >= 3) complex++;
    if (n === 1) mono++;
    const len = [...w.replace(/['’]/g, "")].length;
    letters += len;
    if (len > 6) long++;
  }
  const base = { lang, sentences: sents, words: W, letters, syllables: syl, complex, mono, long };
  if (W === 0) return { ...base, scores: [] };

  const wps = W / S;
  const spw = syl / W;
  const scores: Score[] = [];
  const grade = (g: number) => Math.max(0, round(g));
  const gradeLevel = (g: number) => level(g, [6, 9, 12, 16], false);

  if (lang === "en") {
    const flesch = 206.835 - 1.015 * wps - 84.6 * spw;
    scores.push({
      id: "flesch",
      value: round(flesch),
      grade: null,
      level: level(flesch, [80, 60, 50, 30], true),
      shaky: false,
    });
    const fk = 0.39 * wps + 11.8 * spw - 15.59;
    scores.push({
      id: "fk",
      value: grade(fk),
      grade: grade(fk),
      level: gradeLevel(fk),
      shaky: false,
    });
    const fog = 0.4 * (wps + (100 * complex) / W);
    scores.push({
      id: "fog",
      value: grade(fog),
      grade: grade(fog),
      level: gradeLevel(fog),
      shaky: false,
    });
    const smog = 1.043 * Math.sqrt((complex * 30) / S) + 3.1291;
    scores.push({
      id: "smog",
      value: grade(smog),
      grade: grade(smog),
      level: gradeLevel(smog),
      shaky: sents.length < 30,
    });
    const L = (letters / W) * 100;
    const S100 = (S / W) * 100;
    const cli = 0.0588 * L - 0.296 * S100 - 15.8;
    scores.push({
      id: "cli",
      value: grade(cli),
      grade: grade(cli),
      level: gradeLevel(cli),
      shaky: false,
    });
    const ari = 4.71 * (letters / W) + 0.5 * wps - 21.43;
    scores.push({
      id: "ari",
      value: grade(ari),
      grade: grade(ari),
      level: gradeLevel(ari),
      shaky: false,
    });
  } else if (lang === "de") {
    // Amstad (1978): Flesch's reading ease recalibrated for German's longer words.
    const amstad = 180 - wps - 58.5 * spw;
    scores.push({
      id: "amstad",
      value: round(amstad),
      grade: null,
      level: level(amstad, [80, 60, 50, 30], true),
      shaky: false,
    });
    // Bamberger & Vanecek (1984), first Wiener Sachtextformel: roughly the school year (4–15).
    const pct = (n: number) => (100 * n) / W;
    const wstf =
      0.1935 * pct(complex) + 0.1672 * wps + 0.1297 * pct(long) - 0.0327 * pct(mono) - 0.875;
    scores.push({
      id: "wstf",
      value: grade(wstf),
      grade: null,
      level: level(wstf, [6, 8, 10, 12], false),
      shaky: false,
    });
  } else {
    const km = 207 - 1.015 * wps - 73.6 * spw;
    scores.push({
      id: "kandel",
      value: round(km),
      grade: null,
      level: level(km, [80, 60, 50, 30], true),
      shaky: false,
    });
  }
  const lix = wps + (100 * long) / W;
  scores.push({
    id: "lix",
    value: round(lix),
    grade: null,
    level: level(lix, [30, 40, 50, 60], false),
    shaky: false,
  });
  return { ...base, scores };
}
