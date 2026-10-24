/**
 * Text cleaner: composable steps (spaces, invisible characters, quotes, dashes, line endings,
 * tabs, accents, punctuation…) applied in a fixed order, each reporting how many changes it made.
 */

export type LineEnding = "keep" | "lf" | "crlf";
export type Tabs = "keep" | "spaces" | "tabs";
/** "smart": English “…” ‘…’; "german": „…“ ‚…‘. */
export type Quotes = "keep" | "straight" | "smart" | "german";
export type Dashes = "keep" | "ascii" | "smart";
export type Ellipsis = "keep" | "ascii" | "smart";
export type BlankLines = "keep" | "collapse" | "remove";

export interface CleanOptions {
  zeroWidth: boolean;
  oddSpaces: boolean;
  lineEndings: LineEnding;
  tabs: Tabs;
  tabSize: number;
  collapseSpaces: boolean;
  trimTrailing: boolean;
  trimLeading: boolean;
  blankLines: BlankLines;
  trimText: boolean;
  quotes: Quotes;
  dashes: Dashes;
  ellipsis: Ellipsis;
  removeAccents: boolean;
  removePunctuation: boolean;
  removeDigits: boolean;
  removeEmoji: boolean;
}

export const DEFAULTS: CleanOptions = {
  zeroWidth: true,
  oddSpaces: true,
  lineEndings: "keep",
  tabs: "keep",
  tabSize: 4,
  collapseSpaces: true,
  trimTrailing: true,
  trimLeading: false,
  blankLines: "keep",
  trimText: false,
  quotes: "keep",
  dashes: "keep",
  ellipsis: "keep",
  removeAccents: false,
  removePunctuation: false,
  removeDigits: false,
  removeEmoji: false,
};

export type StepId =
  | "zeroWidth"
  | "oddSpaces"
  | "removeEmoji"
  | "removeAccents"
  | "quotes"
  | "dashes"
  | "ellipsis"
  | "removePunctuation"
  | "removeDigits"
  | "tabs"
  | "collapseSpaces"
  | "trimTrailing"
  | "trimLeading"
  | "blankLines"
  | "trimText"
  | "lineEndings";

export interface CleanResult {
  text: string;
  /** Changes per step that changed something, in the order applied. */
  changes: { step: StepId; count: number }[];
}

/** Invisible characters: zero-width space, word joiner, BOM, soft hyphen, bidi marks… */
const INVISIBLE = /[\u200b\u2060\ufeff\u00ad\u180e\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
/** Unusual spaces: no-break, narrow no-break, en/em/thin/hair…, ideographic, Ogham. */
const ODD_SPACES = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;
/** Emoji (not text-style symbols such as the copyright sign unless followed by VS16), with modifiers. */
const EMOJI =
  /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\ufe0f|\p{Regional_Indicator})(?:[\u{1f3fb}-\u{1f3ff}]|\ufe0f|\u20e3|\p{Regional_Indicator}|[\u{e0020}-\u{e007f}]|\u200d\p{Extended_Pictographic}\ufe0f?)*|[#*0-9]\ufe0f?\u20e3/gu;

/** Letters that do not decompose into a base letter + accent. */
const SPECIAL_LETTERS: Record<string, string> = {
  \u00d8: "O",
  \u00f8: "o",
  \u0152: "OE",
  \u0153: "oe",
  \u00c6: "AE",
  \u00e6: "ae",
  \u00df: "ss",
  \u0141: "L",
  \u0142: "l",
  \u0110: "D",
  \u0111: "d",
};

const GUILLEMETS_AND_CURLY =
  /\u00ab[ \u00a0\u202f]?|[ \u00a0\u202f]?\u00bb|\u2039[ \u00a0\u202f]?|[ \u00a0\u202f]?\u203a|[\u2018\u2019\u201a\u201b\u2032\u201c\u201d\u201e\u201f\u2033]/g;

/**
 * Removes zero-width joiners / non-joiners except where they mean something: inside emoji
 * sequences (\ud83d\udc69\u200d\ud83d\udcbb) and between letters of non-Latin scripts (Persian, Indic\u2026).
 */
function removeJoiners(text: string): [string, number] {
  const keepBefore =
    /(?:\p{Extended_Pictographic}|\p{Emoji_Modifier})\ufe0f?$|(?!\p{Script=Latin})[\p{L}\p{M}]$/u;
  const keepAfter = /^(?:\p{Extended_Pictographic}|(?!\p{Script=Latin})\p{L})/u;
  return replaceCount(text, /[\u200c\u200d]/g, (m, i, s) => {
    const at = i as number;
    const str = s as string;
    return keepBefore.test(str.slice(Math.max(0, at - 3), at)) && keepAfter.test(str.slice(at + 1))
      ? m
      : "";
  });
}

function replaceCount(
  text: string,
  re: RegExp,
  by: string | ((m: string, ...rest: unknown[]) => string),
): [string, number] {
  let n = 0;
  const out = text.replace(re, (...args: unknown[]) => {
    const m = args[0] as string;
    const r = typeof by === "string" ? by : by(m, ...args.slice(1));
    if (r !== m) n++;
    return r;
  });
  return [out, n];
}

/** Expands tabs to spaces at tab stops of `size` columns. */
export function expandTabs(line: string, size: number): string {
  let out = "";
  for (const ch of line) {
    if (ch === "\t") out += " ".repeat(size - (out.length % size));
    else out += ch;
  }
  return out;
}

/**
 * Straight quotes → typographic ones: opening after a space or bracket, closing otherwise. An
 * apostrophe between letters is always ’ (it’s, geht’s), whatever the quote style.
 */
function smartQuotes(text: string, german = false): [string, number] {
  let n = 0;
  const out = text.replace(/["']/g, (q, i: number, s: string) => {
    const prev = s[i - 1] ?? "";
    const opening = prev === "" || /[\s([{—–-]/.test(prev);
    n++;
    if (q === "'") {
      if (opening) return german ? "‚" : "‘";
      if (german && !/[\p{L}\p{N}]/u.test(s[i + 1] ?? "")) return "‘";
      return "’";
    }
    if (german) return opening ? "„" : "“";
    return opening ? "“" : "”";
  });
  return [out, n];
}

export function clean(input: string, o: CleanOptions): CleanResult {
  let text = input;
  const changes: CleanResult["changes"] = [];
  const step = (id: StepId, fn: (t: string) => [string, number]) => {
    const [t, n] = fn(text);
    text = t;
    if (n > 0) changes.push({ step: id, count: n });
  };
  const tab = Math.min(16, Math.max(1, Math.round(o.tabSize) || 4));

  // Line endings are normalized to \n while working, and converted at the end.
  const crlf = (text.match(/\r\n?/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  text = text.replace(/\r\n?/g, "\n");

  if (o.zeroWidth)
    step("zeroWidth", (t) => {
      const [a, n1] = replaceCount(t, INVISIBLE, "");
      const [b, n2] = removeJoiners(a);
      return [b, n1 + n2];
    });
  if (o.oddSpaces) step("oddSpaces", (t) => replaceCount(t, ODD_SPACES, " "));
  if (o.removeEmoji) step("removeEmoji", (t) => replaceCount(t, EMOJI, ""));
  if (o.removeAccents)
    step("removeAccents", (t) => {
      const [r, n] = replaceCount(
        t.normalize("NFD"),
        /\p{L}\p{M}+|[ØøŒœÆæßŁłĐđ]/gu,
        (m) => SPECIAL_LETTERS[m] ?? m.replace(/\p{M}/gu, ""),
      );
      return [r.normalize("NFC"), n];
    });

  if (o.quotes === "straight")
    step("quotes", (t) =>
      // French guillemets come with a (no-break) space inside: « mot » → "mot".
      replaceCount(t, GUILLEMETS_AND_CURLY, (m) => (/[‹›‘’‚‛′]/.test(m) ? "'" : '"')),
    );
  if (o.quotes === "smart") step("quotes", (t) => smartQuotes(t));
  if (o.quotes === "german") step("quotes", (t) => smartQuotes(t, true));

  if (o.dashes === "ascii") step("dashes", (t) => replaceCount(t, /[‐‑‒–—―−]/g, "-"));
  if (o.dashes === "smart")
    step("dashes", (t) => {
      const [a, n1] = replaceCount(t, /(?<=\S) ?--- ?(?=\S)|(?<=\S)--(?=\S)/g, "—");
      const [b, n2] = replaceCount(a, /(?<=\S) -{1,2} (?=\S)/g, " – ");
      const [c, n3] = replaceCount(b, /(?<=\d)-(?=\d)/g, "–");
      return [c, n1 + n2 + n3];
    });
  if (o.ellipsis === "ascii") step("ellipsis", (t) => replaceCount(t, /…/g, "..."));
  if (o.ellipsis === "smart") step("ellipsis", (t) => replaceCount(t, /\.{3}/g, "…"));

  if (o.removePunctuation) step("removePunctuation", (t) => replaceCount(t, /\p{P}/gu, ""));
  if (o.removeDigits) step("removeDigits", (t) => replaceCount(t, /\p{Nd}/gu, ""));

  if (o.tabs === "spaces")
    step("tabs", (t) => {
      const n = (t.match(/\t/g) ?? []).length;
      return [
        t
          .split("\n")
          .map((l) => expandTabs(l, tab))
          .join("\n"),
        n,
      ];
    });
  if (o.tabs === "tabs")
    step("tabs", (t) =>
      replaceCount(t, /^[ \t]+/gm, (indent) => {
        const width = expandTabs(indent, tab).length;
        return "\t".repeat(Math.floor(width / tab)) + " ".repeat(width % tab);
      }),
    );

  if (o.collapseSpaces) step("collapseSpaces", (t) => replaceCount(t, /(?<=\S) {2,}(?=\S)/g, " "));
  if (o.trimTrailing) step("trimTrailing", (t) => replaceCount(t, /[ \t]+$/gm, ""));
  if (o.trimLeading) step("trimLeading", (t) => replaceCount(t, /^[ \t]+/gm, ""));
  if (o.blankLines === "collapse")
    step("blankLines", (t) => replaceCount(t, /\n(?:[ \t]*\n){2,}/g, "\n\n"));
  if (o.blankLines === "remove")
    step("blankLines", (t) => replaceCount(t, /\n(?:[ \t]*\n)+/g, "\n"));
  if (o.trimText)
    step("trimText", (t) => {
      const r = t.replace(/^\s+|\s+$/g, "");
      return [r, r === t ? 0 : 1];
    });

  // "keep" uses the input's most frequent line ending (mixed endings get unified).
  const toCrlf = o.lineEndings === "crlf" || (o.lineEndings === "keep" && crlf > lf);
  const converted = o.lineEndings === "keep" ? Math.min(crlf, lf) : toCrlf ? lf : crlf;
  if (toCrlf) text = text.replace(/\n/g, "\r\n");
  if (converted > 0) changes.push({ step: "lineEndings", count: converted });
  return { text, changes };
}

export interface Findings {
  oddSpaces: number;
  invisible: number;
  tabs: number;
  crlf: number;
  trailing: number;
  smartQuotes: number;
  nonAscii: number;
}

/** What the input contains that a cleaner may want to fix. */
export function inspect(text: string): Findings {
  const c = (re: RegExp) => (text.match(re) ?? []).length;
  return {
    oddSpaces: c(ODD_SPACES),
    invisible: c(INVISIBLE) + c(/[\u200c\u200d]/g),
    tabs: c(/\t/g),
    crlf: c(/\r\n|\r(?!\n)/g),
    trailing: c(/[ \t]+(?=\r?\n|$)/g),
    smartQuotes: c(/[‘’‚“”„«»‹›]/g),
    nonAscii: c(/\P{ASCII}/gu),
  };
}

/** How many lines differ between two texts (by position, plus added/removed lines). */
export function changedLines(a: string, b: string): number {
  const la = a.split(/\r?\n/);
  const lb = b.split(/\r?\n/);
  let n = Math.abs(la.length - lb.length);
  for (let i = 0; i < Math.min(la.length, lb.length); i++) if (la[i] !== lb[i]) n++;
  return n;
}
