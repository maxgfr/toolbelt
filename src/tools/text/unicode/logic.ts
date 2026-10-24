/**
 * Unicode inspection: one row per code point (grouped by grapheme), with its
 * general category and script tested through \p{…}, its UTF-8 / UTF-16 forms
 * and, for the characters that matter here (invisible, spaces, bidi controls,
 * look-alike punctuation), its name. The full Unicode name database is not
 * bundled: other characters get no name.
 */

export type Flag = "bidi" | "zero-width" | "invisible" | "space" | "control";

export interface CodePointInfo {
  char: string;
  cp: number;
  /** "U+00E9" */
  hex: string;
  /** Index of the grapheme cluster it belongs to. */
  grapheme: number;
  name: string;
  category: string;
  script: string;
  utf8: string;
  utf16: string;
  flag: Flag | null;
}

const NAMES: Record<number, string> = {
  9: "CHARACTER TABULATION",
  10: "LINE FEED",
  11: "LINE TABULATION",
  12: "FORM FEED",
  13: "CARRIAGE RETURN",
  32: "SPACE",
  127: "DELETE",
  133: "NEXT LINE",
  160: "NO-BREAK SPACE",
  171: "LEFT-POINTING DOUBLE ANGLE QUOTATION MARK",
  173: "SOFT HYPHEN",
  187: "RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK",
  847: "COMBINING GRAPHEME JOINER",
  1564: "ARABIC LETTER MARK",
  4447: "HANGUL CHOSEONG FILLER",
  4448: "HANGUL JUNGSEONG FILLER",
  5760: "OGHAM SPACE MARK",
  6158: "MONGOLIAN VOWEL SEPARATOR",
  8192: "EN QUAD",
  8193: "EM QUAD",
  8194: "EN SPACE",
  8195: "EM SPACE",
  8196: "THREE-PER-EM SPACE",
  8197: "FOUR-PER-EM SPACE",
  8198: "SIX-PER-EM SPACE",
  8199: "FIGURE SPACE",
  8200: "PUNCTUATION SPACE",
  8201: "THIN SPACE",
  8202: "HAIR SPACE",
  8203: "ZERO WIDTH SPACE",
  8204: "ZERO WIDTH NON-JOINER",
  8205: "ZERO WIDTH JOINER",
  8206: "LEFT-TO-RIGHT MARK",
  8207: "RIGHT-TO-LEFT MARK",
  8208: "HYPHEN",
  8209: "NON-BREAKING HYPHEN",
  8210: "FIGURE DASH",
  8211: "EN DASH",
  8212: "EM DASH",
  8213: "HORIZONTAL BAR",
  8216: "LEFT SINGLE QUOTATION MARK",
  8217: "RIGHT SINGLE QUOTATION MARK",
  8218: "SINGLE LOW-9 QUOTATION MARK",
  8220: "LEFT DOUBLE QUOTATION MARK",
  8221: "RIGHT DOUBLE QUOTATION MARK",
  8222: "DOUBLE LOW-9 QUOTATION MARK",
  8226: "BULLET",
  8230: "HORIZONTAL ELLIPSIS",
  8232: "LINE SEPARATOR",
  8233: "PARAGRAPH SEPARATOR",
  8234: "LEFT-TO-RIGHT EMBEDDING",
  8235: "RIGHT-TO-LEFT EMBEDDING",
  8236: "POP DIRECTIONAL FORMATTING",
  8237: "LEFT-TO-RIGHT OVERRIDE",
  8238: "RIGHT-TO-LEFT OVERRIDE",
  8239: "NARROW NO-BREAK SPACE",
  8249: "SINGLE LEFT-POINTING ANGLE QUOTATION MARK",
  8250: "SINGLE RIGHT-POINTING ANGLE QUOTATION MARK",
  8287: "MEDIUM MATHEMATICAL SPACE",
  8288: "WORD JOINER",
  8289: "FUNCTION APPLICATION",
  8290: "INVISIBLE TIMES",
  8291: "INVISIBLE SEPARATOR",
  8292: "INVISIBLE PLUS",
  8294: "LEFT-TO-RIGHT ISOLATE",
  8295: "RIGHT-TO-LEFT ISOLATE",
  8296: "FIRST STRONG ISOLATE",
  8297: "POP DIRECTIONAL ISOLATE",
  8298: "INHIBIT SYMMETRIC SWAPPING",
  8299: "ACTIVATE SYMMETRIC SWAPPING",
  8300: "INHIBIT ARABIC FORM SHAPING",
  8301: "ACTIVATE ARABIC FORM SHAPING",
  8302: "NATIONAL DIGIT SHAPES",
  8303: "NOMINAL DIGIT SHAPES",
  8364: "EURO SIGN",
  8722: "MINUS SIGN",
  12288: "IDEOGRAPHIC SPACE",
  12644: "HANGUL FILLER",
  65279: "ZERO WIDTH NO-BREAK SPACE (BYTE ORDER MARK)",
  65440: "HALFWIDTH HANGUL FILLER",
  65532: "OBJECT REPLACEMENT CHARACTER",
  65533: "REPLACEMENT CHARACTER",
  917505: "LANGUAGE TAG",
  917631: "CANCEL TAG",
};

const C0 =
  "NULL,START OF HEADING,START OF TEXT,END OF TEXT,END OF TRANSMISSION,ENQUIRY,ACKNOWLEDGE,BELL,BACKSPACE,,,,,,SHIFT OUT,SHIFT IN,DATA LINK ESCAPE,DEVICE CONTROL ONE,DEVICE CONTROL TWO,DEVICE CONTROL THREE,DEVICE CONTROL FOUR,NEGATIVE ACKNOWLEDGE,SYNCHRONOUS IDLE,END OF TRANSMISSION BLOCK,CANCEL,END OF MEDIUM,SUBSTITUTE,ESCAPE,INFORMATION SEPARATOR FOUR,INFORMATION SEPARATOR THREE,INFORMATION SEPARATOR TWO,INFORMATION SEPARATOR ONE".split(
    ",",
  );

const DIGITS = "ZERO,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE".split(",");

/** The name of a code point, for the subset this tool knows; "" otherwise. */
export function charName(cp: number): string {
  if (cp < 0x20 && C0[cp]) return C0[cp] ?? "";
  if (NAMES[cp]) return NAMES[cp] ?? "";
  if (cp >= 0x41 && cp <= 0x5a) return `LATIN CAPITAL LETTER ${String.fromCharCode(cp)}`;
  if (cp >= 0x61 && cp <= 0x7a) return `LATIN SMALL LETTER ${String.fromCharCode(cp - 32)}`;
  if (cp >= 0x30 && cp <= 0x39) return `DIGIT ${DIGITS[cp - 0x30]}`;
  if (cp >= 0x80 && cp <= 0x9f) return "<control>";
  if (cp >= 0xfe00 && cp <= 0xfe0f) return `VARIATION SELECTOR-${cp - 0xfe00 + 1}`;
  if (cp >= 0xe0100 && cp <= 0xe01ef) return `VARIATION SELECTOR-${cp - 0xe0100 + 17}`;
  if (cp >= 0xe0020 && cp <= 0xe007e) {
    const base = charName(cp - 0xe0000);
    return base ? `TAG ${base}` : "";
  }
  if (cp >= 0x1f3fb && cp <= 0x1f3ff)
    return `EMOJI MODIFIER FITZPATRICK TYPE-${cp === 0x1f3fb ? "1-2" : cp - 0x1f3fb + 2}`;
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff)
    return `REGIONAL INDICATOR SYMBOL LETTER ${String.fromCharCode(cp - 0x1f1e6 + 65)}`;
  return "";
}

const CATEGORIES: [string, RegExp][] = [
  "Lu",
  "Ll",
  "Lt",
  "Lm",
  "Lo",
  "Mn",
  "Mc",
  "Me",
  "Nd",
  "Nl",
  "No",
  "Pc",
  "Pd",
  "Ps",
  "Pe",
  "Pi",
  "Pf",
  "Po",
  "Sm",
  "Sc",
  "Sk",
  "So",
  "Zs",
  "Zl",
  "Zp",
  "Cc",
  "Cf",
  "Cs",
  "Co",
].map((c) => [c, new RegExp(`^\\p{gc=${c}}$`, "u")]);

/** Two-letter general category (Lu, Nd, Zs, Cf…); Cn for unassigned. */
export function category(ch: string): string {
  for (const [c, re] of CATEGORIES) if (re.test(ch)) return c;
  return "Cn";
}

const SCRIPTS = [
  "Latin",
  "Greek",
  "Cyrillic",
  "Armenian",
  "Hebrew",
  "Arabic",
  "Devanagari",
  "Bengali",
  "Tamil",
  "Thai",
  "Georgian",
  "Hangul",
  "Hiragana",
  "Katakana",
  "Han",
  "Ethiopic",
  "Cherokee",
  "Mongolian",
  "Tibetan",
  "Inherited",
  "Common",
].map((s) => [s, new RegExp(`^\\p{Script=${s}}$`, "u")] as const);

/** The script among common ones; "" when another one. */
export function script(ch: string): string {
  for (const [s, re] of SCRIPTS) if (re.test(ch)) return s;
  return "";
}

const BIDI = new Set([
  0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x180e, 0x034f]);
const BLANK_LETTERS = new Set([0x115f, 0x1160, 0x3164, 0xffa0]);

/** Why a code point deserves attention (it does not show, or may fool a reader); null if it is ordinary. */
export function flagOf(cp: number, ch: string): Flag | null {
  if (BIDI.has(cp)) return "bidi";
  if (ZERO_WIDTH.has(cp)) return "zero-width";
  if (cp === 0x09 || cp === 0x0a || cp === 0x0d || cp === 0x20) return null;
  const cat = category(ch);
  if (cat === "Cc") return "control";
  if (cat === "Zs" || cat === "Zl" || cat === "Zp") return "space";
  if (
    cat === "Cf" ||
    BLANK_LETTERS.has(cp) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0xe0100 && cp <= 0xe01ef) ||
    cp === 0x00ad
  )
    return "invisible";
  return null;
}

function hex(n: number, width: number): string {
  return n.toString(16).toUpperCase().padStart(width, "0");
}

export function codePointHex(cp: number): string {
  return `U+${hex(cp, 4)}`;
}

const encoder = new TextEncoder();

/** Emoji graphemes keep their joiners, variation selectors and tags (families, hearts, flags). */
function isEmoji(grapheme: string): boolean {
  return /\p{Extended_Pictographic}|\u20E3|\p{Regional_Indicator}/u.test(grapheme);
}

/** The flag of a code point within its grapheme: joiners, selectors and tags of an emoji are ordinary. */
function flagIn(cp: number, ch: string, emoji: boolean): Flag | null {
  const f = flagOf(cp, ch);
  return emoji && (f === "zero-width" || f === "invisible") ? null : f;
}

export function inspect(text: string, limit = Number.POSITIVE_INFINITY): CodePointInfo[] {
  const rows: CodePointInfo[] = [];
  let g = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
    text,
  )) {
    const emoji = isEmoji(segment);
    for (const char of segment) {
      if (rows.length >= limit) return rows;
      const cp = char.codePointAt(0) ?? 0;
      rows.push({
        char,
        cp,
        hex: codePointHex(cp),
        grapheme: g,
        name: charName(cp),
        category: category(char),
        script: script(char),
        utf8: [...encoder.encode(char)].map((b) => hex(b, 2)).join(" "),
        utf16: Array.from({ length: char.length }, (_, i) => hex(char.charCodeAt(i), 4)).join(" "),
        flag: flagIn(cp, char, emoji),
      });
    }
    g++;
  }
  return rows;
}

export interface Summary {
  codePoints: number;
  graphemes: number;
  utf16: number;
  utf8: number;
  flagged: Record<Flag, number>;
}

export function summarize(text: string): Summary {
  const flagged: Record<Flag, number> = {
    bidi: 0,
    "zero-width": 0,
    invisible: 0,
    space: 0,
    control: 0,
  };
  let codePoints = 0;
  let graphemes = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
    text,
  )) {
    graphemes++;
    const emoji = isEmoji(segment);
    for (const ch of segment) {
      codePoints++;
      const f = flagIn(ch.codePointAt(0) ?? 0, ch, emoji);
      if (f) flagged[f]++;
    }
  }
  return { codePoints, graphemes, utf16: text.length, utf8: encoder.encode(text).length, flagged };
}

/**
 * Removes bidi controls, zero-width and other invisible characters (and
 * control characters except tab and newlines), leaving emoji sequences intact.
 */
export function removeInvisible(text: string): string {
  let out = "";
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
    text,
  )) {
    if (isEmoji(segment)) {
      out += segment;
      continue;
    }
    for (const ch of segment) {
      const f = flagOf(ch.codePointAt(0) ?? 0, ch);
      if (f !== "bidi" && f !== "zero-width" && f !== "invisible" && f !== "control") out += ch;
    }
  }
  return out;
}

/** Turns special spaces (no-break, thin, ideographic…) into plain spaces, and separators into newlines. */
export function normalizeSpaces(text: string): string {
  return text
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[^\S\n\r\t ]/gu, (c) => (/\p{Zs}/u.test(c) ? " " : c));
}

export const FORMS = ["NFC", "NFD", "NFKC", "NFKD"] as const;
export type Form = (typeof FORMS)[number];
