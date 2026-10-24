/**
 * Pulls structured values out of free text: emails, URLs, domains, IP addresses, phone numbers,
 * hashtags, mentions, numbers, dates, colors and card-like numbers (Luhn-checked).
 */

export const KINDS = [
  "email",
  "url",
  "domain",
  "ipv4",
  "ipv6",
  "phone",
  "hashtag",
  "mention",
  "number",
  "date",
  "color",
  "card",
] as const;
export type Kind = (typeof KINDS)[number];

const TRAILING = /[.,;:!?'"’”»)\]}>]+$/;

/** Drops sentence punctuation stuck to the end of a URL, keeping balanced closing brackets. */
export function trimUrl(url: string): string {
  let u = url;
  for (;;) {
    const m = u.match(TRAILING);
    if (!m) return u;
    const last = u[u.length - 1] ?? "";
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    const open = pairs[last];
    if (open && count(u, open) >= count(u, last)) return u;
    u = u.slice(0, -1);
  }
}

function count(s: string, c: string): number {
  return s.split(c).length - 1;
}

/** True when the digits pass the Luhn checksum (payment cards, IMEI…). */
export function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 2) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Strict IPv6 check (with :: compression, an optional embedded IPv4 and a %zone). */
export function isIPv6(s: string): boolean {
  const addr = s.replace(/%[\w.-]+$/, "");
  if (!/^[0-9a-f:.]+$/i.test(addr) || !addr.includes(":")) return false;
  let groups = 8;
  let body = addr;
  const v4 = addr.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    if (!IPV4_EXACT.test(v4[1] ?? "")) return false;
    groups = 6;
    body = addr.slice(0, addr.length - (v4[1]?.length ?? 0));
    if (!body.endsWith("::")) body = body.slice(0, -1);
  }
  const halves = body.split("::");
  if (halves.length > 2) return false;
  const part = (h: string) => (h === "" ? [] : h.split(":"));
  const left = part(halves[0] ?? "");
  const right = halves.length === 2 ? part(halves[1] ?? "") : [];
  const all = [...left, ...right];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return false;
  if (halves.length === 2) return all.length < groups && /[0-9a-f]/i.test(addr);
  return all.length === groups;
}

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_EXACT = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`);

/** Two-letter country TLDs plus the common generic ones, to tell domains from file names. */
const TLDS = new Set(
  (
    "ac ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo br bs " +
    "bt bw by bz ca cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg " +
    "er es et eu fi fj fk fm fo fr ga gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn " +
    "hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc " +
    "li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na " +
    "nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru " +
    "rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st su sv sx sy sz tc td tf tg th tj tk tl tm " +
    "tn to tr tt tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw " +
    "com org net edu gov mil int info biz name pro mobi aero asia coop jobs museum tel travel " +
    "app dev page xyz online site tech store shop blog cloud art club design news live media " +
    "digital email agency studio world today space website fun top icu vip life wiki io ai " +
    "paris bzh alsace corsica eus quebec swiss berlin london nyc tokyo amsterdam brussels " +
    "academy games social solutions services systems network software company group link click " +
    "best one global capital consulting expert finance money bank health care law legal " +
    "photo photography pics gallery music video movie tv radio fm audio film book books " +
    "school university education training science energy eco green earth city town house " +
    "home garden auto car cars bike fit fitness run golf tennis football rugby team family " +
    "kids baby love dating wedding events party chat forum community foundation charity " +
    "ngo ong gratis free win zone works tools codes build host hosting domains " +
    "mozilla google amazon apple microsoft youtube gmail"
  ).split(/\s+/),
);
/** Two-letter TLDs that are much more often file extensions in two-part names (readme.md). */
const FILE_LIKE = new Set(["md", "sh", "py", "rs", "pl", "cc", "mk", "so", "ps", "ml", "pm"]);

// English, French and German month names and abbreviations.
const MONTHS =
  "j[äa]nner|januar|februar|m[äa]rz|mrz\\.?|juni|juli|oktober|okt\\.?|dezember|dez\\.?|" +
  "jan(?:uary|v(?:ier|\\.)?|\\.)?|feb(?:ruary|\\.)?|f[ée]v(?:rier|\\.)?|mar(?:ch|s|\\.)?|apr(?:il|\\.)?|avr(?:il|\\.)?|may|mai|june?|juin|july?|juil(?:let|\\.)?|aug(?:ust|\\.)?|ao[uû]t?|sept?(?:ember|embre|\\.)?|oct(?:ober|obre|\\.)?|nov(?:ember|embre|\\.)?|d[ée]c(?:ember|embre|\\.)?";

const RE: Record<Kind, RegExp> = {
  email: /[\p{L}\p{N}._%+-]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}{2,}/gu,
  url: /\b(?:https?|ftp):\/\/[^\s<>"'`]+|(?<![\w.@/-])www\.[^\s<>"'`]+/giu,
  domain:
    /(?<![\p{L}\p{N}_.-]|(?:^|[\s(])@)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?![\p{L}\p{N}_-]|\.[\p{L}\p{N}])/giu,
  ipv4: new RegExp(`(?<![\\d.])${OCTET}(?:\\.${OCTET}){3}(?![\\d]|\\.\\d)`, "g"),
  ipv6: /(?<![\w:.])(?:[0-9a-f]{0,4}:){2,7}(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f]{1,4}|:)?(?:%[\w.-]+)?(?![\w:]|\.\d)/gi,
  phone:
    /(?<![\w+.,])(?:\+|\b00)?(?:\(\d{1,4}\)|\d{1,5})(?:[ .-]?(?:\(\d{1,4}\)|\d{1,5})){1,7}(?![\w]|[.,]\d)/g,
  hashtag: /(?<![\p{L}\p{N}_&#/])#[\p{L}_][\p{L}\p{N}_]*/gu,
  mention: /(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}_](?:[\p{L}\p{N}_.]*[\p{L}\p{N}_])?/gu,
  number:
    /(?<![\p{L}\p{N}_.,])[-+−]?(?:\d{1,3}(?:(?<sep>[,.\u00a0\u202f])\d{3})(?:\k<sep>\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:[eE][-+]?\d+)?(?![.,]?\d)/gu,
  date: new RegExp(
    [
      "\\b\\d{4}-\\d{2}-\\d{2}(?:[T ]\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?(?![\\d-])",
      "\\b\\d{4}/\\d{1,2}/\\d{1,2}\\b",
      "\\b\\d{1,2}([/.-])\\d{1,2}\\1(?:\\d{4}|\\d{2})(?![\\d.-]\\d)",
      `\\b(?:1er|\\d{1,2})(?:st|nd|rd|th|\\.)? (?:of )?(?:${MONTHS})(?![\\p{L}])(?:,? \\d{4})?`,
      `(?<![\\p{L}])(?:${MONTHS}) \\d{1,2}(?:st|nd|rd|th)?(?:,? \\d{4})?\\b`,
    ].join("|"),
    "giu",
  ),
  color:
    /(?<![\p{L}\p{N}_&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\p{L}\p{N}_])|\b(?:rgba?|hsla?)\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)/giu,
  card: /(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d]|-\d)/g,
};

function validDate(s: string): boolean {
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return month(Number(iso[2])) && day(Number(iso[3]));
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d+$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    return (day(a) && month(b)) || (month(a) && day(b));
  }
  const dm = s.match(/^(?:1er|(\d{1,2}))/);
  if (dm?.[1]) return day(Number(dm[1]));
  const md = s.match(/ (\d{1,2})/);
  if (md && !/^\d/.test(s)) return day(Number(md[1]));
  return true;
}
const month = (n: number) => n >= 1 && n <= 12;
const day = (n: number) => n >= 1 && n <= 31;

function validPhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  const intl = /^(\+|00)/.test(s);
  if (/^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}$/.test(s)) return false;
  if (/^\d+(\.\d+){3}$/.test(s)) return false;
  const seps = new Set(s.replace(/^\+?\d{1,3} |\) /g, "").match(/[ .-]/g) ?? []);
  if (seps.has(".") && seps.size > 1) return false;
  if (!intl && !/[ .()-]/.test(s) && !s.startsWith("0")) return false;
  return true;
}

function validCard(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  if (new Set(s.match(/[ -]/g) ?? []).size > 1) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return luhn(digits);
}

function validDomain(s: string): boolean {
  const labels = s.toLowerCase().split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (!TLDS.has(tld)) return false;
  return !(labels.length === 2 && FILE_LIKE.has(tld));
}

const MAX_HITS = 20_000;

/** Kinds whose digits are not reported again as plain numbers. */
const HAS_DIGITS: Kind[] = ["url", "email", "ipv4", "ipv6", "phone", "date", "color", "card"];

/** Every occurrence of one kind, in text order (duplicates kept). */
export function extract(text: string, kind: Kind): string[] {
  return spans(text, kind).map((s) => s.value);
}

interface Span {
  value: string;
  start: number;
  end: number;
}

function spans(text: string, kind: Kind): Span[] {
  const out: Span[] = [];
  // Numbers inside a phone number, date, IP… are part of that value, not numbers of their own.
  const taken =
    kind === "number"
      ? HAS_DIGITS.flatMap((k) => spans(text, k)).sort((a, b) => a.start - b.start)
      : [];
  let t = 0;
  for (const m of text.matchAll(RE[kind])) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    // Matches come in text order: skip the taken spans that end before this one.
    while (t < taken.length && (taken[t]?.end ?? 0) <= start) t++;
    if ((taken[t]?.start ?? Number.POSITIVE_INFINITY) < end) continue;
    let v = m[0];
    switch (kind) {
      case "url":
        v = trimUrl(v);
        if (/^www\.$/i.test(v)) continue;
        break;
      case "email":
        v = v.replace(/^[._%+-]+/, "");
        if (!v.includes("@") || v.startsWith("@")) continue;
        break;
      case "domain":
        if (!validDomain(v)) continue;
        break;
      case "ipv6":
        if (!isIPv6(v)) continue;
        break;
      case "phone":
        v = v.trim();
        if (!validPhone(v)) continue;
        break;
      case "hashtag":
        if (/^#(?=.*\d)(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) continue;
        break;
      case "date":
        if (!validDate(v)) continue;
        break;
      case "card":
        if (!validCard(v)) continue;
        break;
      default:
    }
    out.push({ value: v, start, end: start + v.length });
    if (out.length >= MAX_HITS) break;
  }
  return out;
}

export interface Options {
  dedupe: boolean;
  sort: boolean;
}

/** Kinds compared without case when deduplicating. */
const CASELESS = new Set<Kind>(["email", "domain", "hashtag", "mention", "color"]);

/** The values of each requested kind, deduplicated and sorted on demand. */
export function extractAll(
  text: string,
  kinds: readonly Kind[],
  opts: Options,
): Record<Kind, string[]> {
  const out = Object.fromEntries(KINDS.map((k) => [k, [] as string[]])) as Record<Kind, string[]>;
  for (const k of kinds) {
    let values = extract(text, k);
    if (opts.dedupe) {
      const seen = new Set<string>();
      values = values.filter((v) => {
        const key = CASELESS.has(k) ? v.toLowerCase() : v;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (opts.sort) {
      const c = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
      values = [...values].sort(c.compare);
    }
    out[k] = values;
  }
  return out;
}

function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A two-column CSV (kind,value) of the results, in KINDS order. */
export function toCsv(results: Partial<Record<Kind, string[]>>): string {
  const rows = ["kind,value"];
  for (const k of KINDS) for (const v of results[k] ?? []) rows.push(`${k},${csvCell(v)}`);
  return `${rows.join("\n")}\n`;
}
