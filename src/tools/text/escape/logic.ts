/**
 * Escape and unescape text for the places it gets pasted into: JSON and
 * JavaScript strings, HTML and XML, SQL and CSV literals, regular expressions
 * and single-quoted shell words. Unescaping never evaluates code.
 */

export type Format = "json" | "js" | "html" | "xml" | "sql" | "csv" | "regex" | "shell";

export const FORMATS: Format[] = ["json", "js", "html", "xml", "sql", "csv", "regex", "shell"];

export type ErrorCode =
  | "trailing-backslash"
  | "bad-escape"
  | "unterminated"
  | "stray-quote"
  | "json";

/** On failure, `detail` is the offending escape or quote, or the JSON parser's message. */
export type Result = { ok: true; value: string } | { ok: false; code: ErrorCode; detail: string };

function hex(n: number, width: number): string {
  return n.toString(16).toUpperCase().padStart(width, "0");
}

/* --- JSON ------------------------------------------------------------------ */

export function escapeJson(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}

export function unescapeJson(s: string): Result {
  const quoted = /^".*"$/s.test(s) && s.length >= 2 ? s : `"${s}"`;
  try {
    // Raw newlines and tabs are not valid in a JSON string; accept them anyway.
    const v = JSON.parse(quoted.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"));
    return typeof v === "string" ? { ok: true, value: v } : { ok: false, code: "json", detail: s };
  } catch (err) {
    return { ok: false, code: "json", detail: err instanceof Error ? err.message : String(err) };
  }
}

/* --- JavaScript ------------------------------------------------------------ */

const JS_ESC: Record<string, string> = {
  "\\": "\\\\",
  "'": "\\'",
  '"': '\\"',
  "`": "\\`",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
  "\v": "\\v",
  "\0": "\\0",
};

/** Safe inside '…', "…" and `…`; non-ASCII as \u escapes on request. */
export function escapeJs(s: string, asciiOnly: boolean): string {
  let out = "";
  const chars = [...s];
  chars.forEach((ch, i) => {
    const cp = ch.codePointAt(0) ?? 0;
    const known = JS_ESC[ch];
    // "\0" followed by a digit would read as an octal escape.
    if (cp === 0 && /\d/.test(chars[i + 1] ?? "")) out += "\\x00";
    else if (known) out += known;
    else if (ch === "$") out += "\\$";
    else if (cp < 0x20 || cp === 0x7f) out += `\\x${hex(cp, 2)}`;
    else if (cp === 0x2028 || cp === 0x2029) out += `\\u${hex(cp, 4)}`;
    else if (cp >= 0xd800 && cp <= 0xdfff) out += `\\u${hex(cp, 4)}`;
    else if (asciiOnly && cp > 0x7e) out += cp > 0xffff ? `\\u{${hex(cp, 1)}}` : `\\u${hex(cp, 4)}`;
    else out += ch;
  });
  return out;
}

const JS_SIMPLE: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
};

export function unescapeJs(input: string): Result {
  let s = input;
  if (s.length >= 2 && /^(['"`]).*\1$/s.test(s)) s = s.slice(1, -1);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i] ?? "";
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = s[i + 1];
    if (n === undefined) return { ok: false, code: "trailing-backslash", detail: "\\" };
    i++;
    if (n === "x") {
      const h = s.slice(i + 1, i + 3);
      if (!/^[0-9a-f]{2}$/i.test(h)) return { ok: false, code: "bad-escape", detail: `\\x${h}` };
      out += String.fromCharCode(Number.parseInt(h, 16));
      i += 2;
    } else if (n === "u") {
      if (s[i + 1] === "{") {
        const end = s.indexOf("}", i);
        const h = end > 0 ? s.slice(i + 2, end) : "";
        const cp = Number.parseInt(h, 16);
        if (!/^[0-9a-f]{1,6}$/i.test(h) || cp > 0x10ffff)
          return { ok: false, code: "bad-escape", detail: `\\u{${h}}` };
        out += String.fromCodePoint(cp);
        i = end;
      } else {
        const h = s.slice(i + 1, i + 5);
        if (!/^[0-9a-f]{4}$/i.test(h)) return { ok: false, code: "bad-escape", detail: `\\u${h}` };
        out += String.fromCharCode(Number.parseInt(h, 16));
        i += 4;
      }
    } else if (n === "\r" && s[i + 1] === "\n") i++;
    else if (n === "\n" || n === "\r" || n === "\u2028" || n === "\u2029") {
      // Line continuation: nothing.
    } else out += JS_SIMPLE[n] ?? n;
  }
  return { ok: true, value: out };
}

/* --- HTML & XML --------------------------------------------------------------- */

/** Latin-1 entity names, U+00A0 to U+00FF in order. */
const LATIN1 =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml".split(
    " ",
  );

const ENTITIES: Record<string, number> = {
  amp: 38,
  lt: 60,
  gt: 62,
  quot: 34,
  apos: 39,
  OElig: 0x152,
  oelig: 0x153,
  Scaron: 0x160,
  scaron: 0x161,
  Yuml: 0x178,
  fnof: 0x192,
  circ: 0x2c6,
  tilde: 0x2dc,
  ensp: 0x2002,
  emsp: 0x2003,
  thinsp: 0x2009,
  zwnj: 0x200c,
  zwj: 0x200d,
  lrm: 0x200e,
  rlm: 0x200f,
  ndash: 0x2013,
  mdash: 0x2014,
  lsquo: 0x2018,
  rsquo: 0x2019,
  sbquo: 0x201a,
  ldquo: 0x201c,
  rdquo: 0x201d,
  bdquo: 0x201e,
  dagger: 0x2020,
  Dagger: 0x2021,
  bull: 0x2022,
  hellip: 0x2026,
  permil: 0x2030,
  prime: 0x2032,
  Prime: 0x2033,
  lsaquo: 0x2039,
  rsaquo: 0x203a,
  euro: 0x20ac,
  trade: 0x2122,
  larr: 0x2190,
  uarr: 0x2191,
  rarr: 0x2192,
  darr: 0x2193,
  harr: 0x2194,
  minus: 0x2212,
  infin: 0x221e,
  ne: 0x2260,
  le: 0x2264,
  ge: 0x2265,
  asymp: 0x2248,
  hearts: 0x2665,
  check: 0x2713,
  Alpha: 0x391,
  alpha: 0x3b1,
  beta: 0x3b2,
  gamma: 0x3b3,
  delta: 0x3b4,
  pi: 0x3c0,
  sigma: 0x3c3,
  mu: 0x3bc,
  lambda: 0x3bb,
  omega: 0x3c9,
  Omega: 0x3a9,
};
LATIN1.forEach((name, i) => {
  ENTITIES[name] = 0xa0 + i;
});

/** HTML: & < > " ' escaped; optionally every non-ASCII character as &#…; too. */
export function escapeHtml(s: string, asciiOnly: boolean): string {
  const base = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  if (!asciiOnly) return base;
  let out = "";
  for (const c of base) {
    const cp = c.codePointAt(0) ?? 0;
    out += cp > 0x7e ? `&#${cp};` : c;
  }
  return out;
}

export function escapeXml(s: string, asciiOnly: boolean): string {
  return escapeHtml(s, asciiOnly).replace(/&#39;/g, "&apos;");
}

/** Decodes numeric entities and the named entities in use (unknown names are left as they are). */
export function unescapeEntities(s: string, xmlOnly: boolean): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const cp =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number(body.slice(1));
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)
        ? String.fromCodePoint(cp)
        : "\uFFFD";
    }
    if (xmlOnly && !["amp", "lt", "gt", "quot", "apos"].includes(body)) return whole;
    const cp = ENTITIES[body];
    return cp === undefined ? whole : String.fromCodePoint(cp);
  });
}

/* --- SQL, CSV, regex, shell ------------------------------------------------- */

export function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

export function unescapeSql(input: string): string {
  const s =
    input.length >= 2 && input.startsWith("'") && input.endsWith("'") ? input.slice(1, -1) : input;
  return s.replace(/''/g, "'");
}

/** A CSV field: quoted only when it has to be (delimiter, quote, newline, edge spaces). */
export function escapeCsv(s: string, delimiter = ","): string {
  const needs = s.includes(delimiter) || /["\r\n]/.test(s) || /^\s|\s$/.test(s);
  return needs ? `"${s.replace(/"/g, '""')}"` : s;
}

export function unescapeCsv(s: string): Result {
  const t = s.trim();
  if (!t.startsWith('"')) return { ok: true, value: s };
  if (t.length < 2 || !t.endsWith('"')) return { ok: false, code: "unterminated", detail: '"' };
  const inner = t.slice(1, -1);
  if (/(^|[^"])"(?!")/.test(inner.replace(/""/g, "")))
    return { ok: false, code: "stray-quote", detail: '"' };
  return { ok: true, value: inner.replace(/""/g, '"') };
}

export function escapeRegexText(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

export function unescapeRegexText(s: string): string {
  return s.replace(/\\([.*+?^${}()|[\]\\/-])/g, "$1");
}

/** A single-quoted shell word: safe in sh, bash and zsh. */
export function escapeShell(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/** Reads a POSIX shell word: '…' literal, "…" with \" \\ \$ \`, and \x outside quotes. */
export function unescapeShell(s: string): Result {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i] ?? "";
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      if (end < 0) return { ok: false, code: "unterminated", detail: "'" };
      out += s.slice(i + 1, end);
      i = end + 1;
    } else if (c === '"') {
      i++;
      let closed = false;
      while (i < s.length) {
        const d = s[i] ?? "";
        if (d === '"') {
          closed = true;
          i++;
          break;
        }
        if (d === "\\" && /["\\$`\n]/.test(s[i + 1] ?? "")) {
          if (s[i + 1] !== "\n") out += s[i + 1];
          i += 2;
        } else {
          out += d;
          i++;
        }
      }
      if (!closed) return { ok: false, code: "unterminated", detail: '"' };
    } else if (c === "\\") {
      if (s[i + 1] !== "\n") out += s[i + 1] ?? "";
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return { ok: true, value: out };
}

/* --- Dispatch ------------------------------------------------------------------- */

export interface EscapeOptions {
  /** JS / HTML / XML: escape every non-ASCII character too. */
  asciiOnly: boolean;
}

export function escapeAs(format: Format, s: string, o: EscapeOptions): string {
  switch (format) {
    case "json":
      return escapeJson(s);
    case "js":
      return escapeJs(s, o.asciiOnly);
    case "html":
      return escapeHtml(s, o.asciiOnly);
    case "xml":
      return escapeXml(s, o.asciiOnly);
    case "sql":
      return escapeSql(s);
    case "csv":
      return escapeCsv(s);
    case "regex":
      return escapeRegexText(s);
    case "shell":
      return escapeShell(s);
  }
}

export function unescapeAs(format: Format, s: string): Result {
  switch (format) {
    case "json":
      return unescapeJson(s);
    case "js":
      return unescapeJs(s);
    case "html":
      return { ok: true, value: unescapeEntities(s, false) };
    case "xml":
      return { ok: true, value: unescapeEntities(s, true) };
    case "sql":
      return { ok: true, value: unescapeSql(s) };
    case "csv":
      return unescapeCsv(s);
    case "regex":
      return { ok: true, value: unescapeRegexText(s) };
    case "shell":
      return unescapeShell(s);
  }
}
