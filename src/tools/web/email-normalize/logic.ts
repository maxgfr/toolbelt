/**
 * Email addresses: a practical syntax check (the RFC 5321/5322 subset that mail systems
 * actually accept), normalization (case, Gmail dots, plus-addressing tags of providers that
 * support them), IDN domains in Unicode and punycode, and de-duplication of a list.
 */

/* --- Punycode (RFC 3492) ------------------------------------------------------- */

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / 700) : delta >> 1;
  d += Math.floor(d / points);
  let k = 0;
  while (d > ((BASE - T_MIN) * T_MAX) >> 1) {
    d = Math.floor(d / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * d) / (d + 38));
}

function digit(c: number): number {
  if (c >= 48 && c <= 57) return c - 22;
  if (c >= 65 && c <= 90) return c - 65;
  if (c >= 97 && c <= 122) return c - 97;
  return -1;
}

/** Decodes one punycode label (without "xn--"), or null if malformed. */
export function punycodeDecode(input: string): string | null {
  let n = 128;
  let i = 0;
  let bias = 72;
  const out: number[] = [];
  const delim = input.lastIndexOf("-");
  for (let j = 0; j < Math.max(0, delim); j++) {
    const c = input.charCodeAt(j);
    if (c >= 0x80) return null;
    out.push(c);
  }
  let idx = delim >= 0 ? delim + 1 : 0;
  while (idx < input.length) {
    const old = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (idx >= input.length) return null;
      const d = digit(input.charCodeAt(idx++));
      if (d < 0) return null;
      i += d * w;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (d < t) break;
      w *= BASE - t;
      if (w > 0x7fffffff) return null;
    }
    bias = adapt(i - old, out.length + 1, old === 0);
    n += Math.floor(i / (out.length + 1));
    if (n > 0x10ffff) return null;
    i %= out.length + 1;
    out.splice(i, 0, n);
    i++;
  }
  return String.fromCodePoint(...out);
}

/** A domain in ASCII (punycode for IDN labels, via the platform's IDNA), or null. */
export function domainToAscii(domain: string): string | null {
  const d = domain.replace(/\.$/, "");
  if (!d) return null;
  if (/^[\x21-\x7e]+$/.test(d)) return d.toLowerCase();
  try {
    const host = new URL(`http://${d}/`).hostname;
    return host && !host.startsWith("[") ? host : null;
  } catch {
    return null;
  }
}

/** A domain with its xn-- labels decoded (left as is when malformed). */
export function domainToUnicode(domain: string): string {
  return domain
    .split(".")
    .map((label) =>
      /^xn--/i.test(label) ? (punycodeDecode(label.slice(4).toLowerCase()) ?? label) : label,
    )
    .join(".");
}

/* --- Validation -------------------------------------------------------------- */

export type Issue =
  | "empty"
  | "no-at"
  | "local-empty"
  | "local-long"
  | "local-chars"
  | "local-dots"
  | "quoted"
  | "unicode-local"
  | "domain-empty"
  | "domain-chars"
  | "domain-long"
  | "label-long"
  | "label-hyphen"
  | "no-dot"
  | "tld"
  | "ip-literal"
  | "too-long";

/** Issues that still make a deliverable address (shown as warnings). */
export const WARNINGS: ReadonlySet<Issue> = new Set(["quoted", "unicode-local", "ip-literal"]);

const ATEXT = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+$/;

/** Splits at the last @ that is not inside a quoted local part. */
export function splitAddress(addr: string): { local: string; domain: string } | null {
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  return { local: addr.slice(0, at), domain: addr.slice(at + 1) };
}

export interface Validation {
  ok: boolean;
  issues: Issue[];
  /** ASCII (punycode) domain when it could be computed. */
  asciiDomain: string | null;
}

export function validateEmail(input: string): Validation {
  const addr = input.trim();
  const issues: Issue[] = [];
  if (!addr) return { ok: false, issues: ["empty"], asciiDomain: null };
  const parts = splitAddress(addr);
  if (!parts) return { ok: false, issues: ["no-at"], asciiDomain: null };
  const { local, domain } = parts;

  // Local part: dot-atom, or a quoted string.
  if (!local) issues.push("local-empty");
  else if (local.startsWith('"') && local.endsWith('"') && local.length >= 2) {
    if (/(^|[^\\])"/.test(local.slice(1, -1)) || /[\r\n]/.test(local)) issues.push("local-chars");
    else issues.push("quoted");
  } else {
    if (local.startsWith(".") || local.endsWith(".") || local.includes(".."))
      issues.push("local-dots");
    const atoms = local.split(".").filter(Boolean);
    const unicode = atoms.some((a) => /[^\p{ASCII}]/u.test(a));
    const bad = atoms.some((a) => !ATEXT.test(a.replace(/[^\p{ASCII}]/gu, "a")));
    if (bad) issues.push("local-chars");
    else if (unicode) issues.push("unicode-local");
  }
  if (new TextEncoder().encode(local).length > 64) issues.push("local-long");

  // Domain: hostname, or an address literal.
  let asciiDomain: string | null = null;
  if (!domain) issues.push("domain-empty");
  else if (/^\[.*\]$/.test(domain)) {
    issues.push("ip-literal");
    asciiDomain = domain;
  } else {
    asciiDomain = domainToAscii(domain);
    if (!asciiDomain) issues.push("domain-chars");
    else {
      const labels = asciiDomain.split(".");
      if (asciiDomain.length > 253) issues.push("domain-long");
      if (labels.some((x) => !/^[a-z0-9-]+$/i.test(x))) issues.push("domain-chars");
      else {
        if (labels.some((x) => x.length > 63)) issues.push("label-long");
        if (labels.some((x) => x.startsWith("-") || x.endsWith("-"))) issues.push("label-hyphen");
        if (labels.length < 2) issues.push("no-dot");
        else {
          const tld = labels[labels.length - 1] ?? "";
          if (/^\d+$/.test(tld) || tld.length < 2) issues.push("tld");
        }
      }
    }
  }
  const total = new TextEncoder().encode(local).length + 1 + (asciiDomain ?? domain).length;
  if (total > 254) issues.push("too-long");
  return { ok: issues.every((i) => WARNINGS.has(i)), issues, asciiDomain };
}

/* --- Normalization -------------------------------------------------------------- */

const GMAIL = new Set(["gmail.com", "googlemail.com"]);

/** Providers where "user+tag@" is delivered to "user@". */
export const PLUS_PROVIDERS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "outlook.de",
  "outlook.at",
  "hotmail.com",
  "hotmail.fr",
  "hotmail.de",
  "hotmail.co.uk",
  "live.com",
  "live.fr",
  "live.de",
  "live.at",
  "msn.com",
  "fastmail.com",
  "fastmail.fm",
  "proton.me",
  "protonmail.com",
  "protonmail.ch",
  "pm.me",
  "icloud.com",
  "me.com",
  "mac.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "hey.com",
  "posteo.de",
  "posteo.net",
  "mailbox.org",
]);

export interface NormalizeOptions {
  /** Lowercase the local part too (domains are always lowercased). */
  lowercase: boolean;
  /** Apply provider rules: Gmail dots, googlemail → gmail, +tags of PLUS_PROVIDERS. */
  providers: boolean;
  /** Remove +tags on every domain. */
  plusEverywhere: boolean;
}

export const DEFAULT_OPTIONS: NormalizeOptions = {
  lowercase: true,
  providers: true,
  plusEverywhere: false,
};

export type Change = "lowercase" | "gmail-dots" | "googlemail" | "plus-tag" | "trailing-dot";

/** The normalized form of a syntactically valid address, with what was changed. */
export function normalizeEmail(
  input: string,
  opts: NormalizeOptions = DEFAULT_OPTIONS,
): { address: string; changes: Change[] } {
  const changes: Change[] = [];
  const parts = splitAddress(input.trim());
  if (!parts) return { address: input.trim(), changes };
  let { local, domain } = parts;
  if (domain.endsWith(".")) {
    domain = domain.slice(0, -1);
    changes.push("trailing-dot");
  }
  const ascii = /^\[/.test(domain) ? domain : (domainToAscii(domain) ?? domain.toLowerCase());
  domain = domainToUnicode(ascii).toLowerCase();
  const quoted = local.startsWith('"');
  if (opts.lowercase && !quoted && local !== local.toLowerCase()) {
    local = local.toLowerCase();
    changes.push("lowercase");
  }
  if (!quoted && (opts.plusEverywhere || (opts.providers && PLUS_PROVIDERS.has(domain)))) {
    const plus = local.indexOf("+");
    if (plus > 0) {
      local = local.slice(0, plus);
      changes.push("plus-tag");
    }
  }
  if (!quoted && opts.providers && GMAIL.has(domain)) {
    if (local.includes(".")) {
      local = local.replace(/\./g, "");
      changes.push("gmail-dots");
    }
    if (domain === "googlemail.com") {
      domain = "gmail.com";
      changes.push("googlemail");
    }
  }
  return { address: `${local}@${domain}`, changes };
}

/* --- Lists ------------------------------------------------------------------------ */

/** Pulls the address out of `Name <addr>`, `mailto:addr` or `<addr>`. */
export function extractAddress(item: string): string {
  let s = item.trim();
  const angle = /<([^<>]*)>\s*$/.exec(s);
  if (angle) s = angle[1] ?? "";
  s = s.replace(/^mailto:/i, "");
  const q = s.indexOf("?");
  if (/^[^"]*$/.test(s) && q > 0) s = s.slice(0, q);
  return s.trim();
}

/** Splits a pasted list on new lines, commas and semicolons (outside quotes and <…>). */
export function splitList(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote = false;
  let angle = false;
  for (const ch of text) {
    if (ch === '"') quote = !quote;
    else if (ch === "<" && !quote) angle = true;
    else if (ch === ">" && !quote) angle = false;
    if (!quote && !angle && /[\n\r,;]/.test(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface Row {
  input: string;
  address: string;
  validation: Validation;
  /** Normalized address (unicode domain), "" when invalid. */
  normalized: string;
  /** Same, with the domain in punycode. */
  ascii: string;
  changes: Change[];
  /** Index of the first row with the same normalized address. */
  duplicateOf: number | null;
}

export function processList(text: string, opts: NormalizeOptions = DEFAULT_OPTIONS): Row[] {
  const seen = new Map<string, number>();
  return splitList(text).map((input, i) => {
    const address = extractAddress(input);
    const validation = validateEmail(address);
    let normalized = "";
    let ascii = "";
    let changes: Change[] = [];
    let duplicateOf: number | null = null;
    if (validation.ok) {
      const n = normalizeEmail(address, opts);
      normalized = n.address;
      changes = n.changes;
      const at = normalized.lastIndexOf("@");
      const dom = normalized.slice(at + 1);
      ascii = `${normalized.slice(0, at)}@${dom.startsWith("[") ? dom : (domainToAscii(dom) ?? dom)}`;
      const key = ascii.toLowerCase();
      const first = seen.get(key);
      if (first === undefined) seen.set(key, i);
      else duplicateOf = first;
    }
    return { input, address, validation, normalized, ascii, changes, duplicateOf };
  });
}

/** The unique normalized addresses of valid rows, in order. */
export function uniqueAddresses(rows: Row[], punycode = false): string[] {
  return rows
    .filter((r) => r.validation.ok && r.duplicateOf === null)
    .map((r) => (punycode ? r.ascii : r.normalized));
}
