/**
 * Pure helpers shared by several text tools: line splitting, a seeded random
 * generator, and regular expressions compiled without throwing (for the find &
 * replace and regex tester tools).
 */

/** Lines of a text; a single trailing newline does not make an extra empty line. */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** A small deterministic PRNG (mulberry32): same seed, same sequence. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The visible characters (grapheme clusters) of a string. */
export function graphemes(text: string): string[] {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (s) => s.segment,
  );
}

export type Compiled = { ok: true; re: RegExp } | { ok: false; message: string };

/** Flags the tools offer, in canonical order. */
export const FLAGS = ["g", "i", "m", "s", "u"] as const;
export type Flag = (typeof FLAGS)[number];

export function compileRegex(pattern: string, flags: string): Compiled {
  try {
    return { ok: true, re: new RegExp(pattern, flags) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * Every match of `re` in `text` (only the first one without the g flag), up to
 * `limit`. Empty matches advance by one code point (with u) so it always ends.
 */
export function collectMatches(re: RegExp, text: string, limit = 10_000): RegExpExecArray[] {
  const copy = new RegExp(re.source, re.flags);
  if (!re.global) {
    const first = copy.exec(text);
    return first ? [first] : [];
  }
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null = copy.exec(text);
  while (m && out.length < limit) {
    out.push(m);
    if (m[0] === "") {
      const cp = text.codePointAt(copy.lastIndex);
      copy.lastIndex += re.unicode && cp !== undefined && cp > 0xffff ? 2 : 1;
      if (copy.lastIndex > text.length) break;
    }
    m = copy.exec(text);
  }
  return out;
}

/** Why a pattern does not compile, as a hint id the views translate (engine messages vary). */
export type RegexHint =
  | "repeat"
  | "class"
  | "group"
  | "paren"
  | "backslash"
  | "name"
  | "escape"
  | "brace"
  | "range"
  | "flags"
  | "lookbehind"
  | null;

export function regexHint(message: string): RegexHint {
  // V8 puts the pattern itself in the message ("…: /a(/: Unterminated group"): keep the tail.
  const at = message.lastIndexOf(": ");
  const m = (at >= 0 ? message.slice(at + 2) : message).toLowerCase();
  if (/nothing to repeat/.test(m)) return "repeat";
  if (/numbers out of order|incomplete.*quantifier|lone quantifier|brace/.test(m)) return "brace";
  if (/range out of order|invalid range/.test(m)) return "range";
  if (/character class|terminating \]/.test(m)) return "class";
  if (/unmatched|unbalanced/.test(m)) return "paren";
  if (/unterminated group|missing \)/.test(m)) return "group";
  if (/\\ at end/.test(m)) return "backslash";
  if (/group (specifier )?name|capture group name/.test(m)) return "name";
  if (/escape|property/.test(m)) return "escape";
  if (/flag/.test(m)) return "flags";
  if (/lookbehind|assertion/.test(m)) return "lookbehind";
  return null;
}

/**
 * The replacement string for one match, as String.prototype.replace computes it:
 * $$, $&, $`, $', $1…$99 and $<name>.
 */
export function expandReplacement(template: string, m: RegExpExecArray, input: string): string {
  const groups = m.length - 1;
  let out = "";
  for (let i = 0; i < template.length; i++) {
    const c = template[i];
    if (c !== "$" || i === template.length - 1) {
      out += c;
      continue;
    }
    const n = template[i + 1] ?? "";
    if (n === "$") {
      out += "$";
      i++;
    } else if (n === "&") {
      out += m[0];
      i++;
    } else if (n === "`") {
      out += input.slice(0, m.index);
      i++;
    } else if (n === "'") {
      out += input.slice(m.index + m[0].length);
      i++;
    } else if (n >= "0" && n <= "9") {
      const two = template.slice(i + 1, i + 3);
      const nn = /^\d\d$/.test(two) ? Number(two) : Number.NaN;
      if (nn >= 1 && nn <= groups) {
        out += m[nn] ?? "";
        i += 2;
      } else if (Number(n) >= 1 && Number(n) <= groups) {
        out += m[Number(n)] ?? "";
        i++;
      } else out += "$";
    } else if (n === "<" && m.groups) {
      const end = template.indexOf(">", i + 2);
      if (end < 0) {
        out += "$";
        continue;
      }
      out += m.groups[template.slice(i + 2, end)] ?? "";
      i = end;
    } else out += "$";
  }
  return out;
}
