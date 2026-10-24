/**
 * Find & replace, plain or regex. Matches are found once and the output is
 * built from them, so the preview, the count and the result always agree.
 * Replacements in regex mode support $1, $<name>, $&, $` and $'.
 */
import {
  collectMatches,
  compileRegex,
  escapeRegex,
  expandReplacement,
  type RegexHint,
  regexHint,
} from "../_shared";

export interface ReplaceOptions {
  regex: boolean;
  /** Any of g, i, m, s, u. */
  flags: string;
  /** Plain mode: only match whole words. */
  wholeWord: boolean;
  /** Read \n, \t, \r and \\ in the search (plain mode) and in the replacement. */
  escapes: boolean;
}

export interface Hit {
  start: number;
  end: number;
  replacement: string;
}

export type ReplaceResult =
  | { ok: true; output: string; hits: Hit[] }
  | { ok: false; message: string; hint: RegexHint };

export function unescapeBasic(s: string): string {
  return s.replace(/\\([ntr\\])/g, (_, c: string) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : "\\",
  );
}

/** The regular expression for the search, or why it does not compile. */
export function buildRegex(
  find: string,
  o: ReplaceOptions,
): { ok: true; re: RegExp } | { ok: false; message: string } {
  if (o.regex) return compileRegex(find, o.flags);
  const plain = escapeRegex(o.escapes ? unescapeBasic(find) : find);
  const pattern = o.wholeWord ? `(?<![\\p{L}\\p{N}_])${plain}(?![\\p{L}\\p{N}_])` : plain;
  const flags = [...new Set([...o.flags.replace(/[ms]/g, ""), ...(o.wholeWord ? "u" : "")])].join(
    "",
  );
  return compileRegex(pattern, flags);
}

export function findReplace(
  text: string,
  find: string,
  replace: string,
  o: ReplaceOptions,
): ReplaceResult {
  if (find === "") return { ok: true, output: text, hits: [] };
  const c = buildRegex(find, o);
  if (!c.ok) return { ok: false, message: c.message, hint: regexHint(c.message) };
  const template = o.escapes ? unescapeBasic(replace) : replace;
  const hits: Hit[] = [];
  let output = "";
  let pos = 0;
  for (const m of collectMatches(c.re, text, Number.POSITIVE_INFINITY)) {
    const replacement = o.regex ? expandReplacement(template, m, text) : template;
    hits.push({ start: m.index, end: m.index + m[0].length, replacement });
    output += text.slice(pos, m.index) + replacement;
    pos = m.index + m[0].length;
  }
  return { ok: true, output: output + text.slice(pos), hits };
}

/** How many distinct lines contain the start of a hit. */
export function linesTouched(text: string, hits: Hit[]): number {
  let n = 0;
  let line = -1;
  let pos = 0;
  let current = 0;
  for (const h of hits) {
    for (; pos < h.start; pos++) if (text[pos] === "\n") current++;
    if (current !== line) {
      n++;
      line = current;
    }
  }
  return n;
}
