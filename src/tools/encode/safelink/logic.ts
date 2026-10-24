/**
 * Link cleaner: unwraps redirect and "safe link" wrappers (Microsoft Safe Links, Google,
 * Facebook, Proofpoint URL Defense, …) and strips tracking parameters (utm_*, fbclid, gclid, …),
 * in a single URL or in every link of a pasted text. Pure: no DOM, no Preact.
 */

export interface Options {
  unwrap: boolean;
  strip: boolean;
}

export interface Cleaned {
  original: string;
  result: string;
  /** Names of the wrappers removed, outermost first. */
  unwrapped: string[];
  /** Tracking parameters removed (as written in the URL). */
  removed: string[];
  /** A wrapper whose target is stored on the service and cannot be decoded offline. */
  opaque: string | null;
}

/* --- Small URL helpers (string-based, so untouched parts keep their exact encoding) ------- */

function split(url: string): { base: string; query: string | null; hash: string } {
  const h = url.indexOf("#");
  const hash = h < 0 ? "" : url.slice(h);
  const rest = h < 0 ? url : url.slice(0, h);
  const q = rest.indexOf("?");
  return q < 0
    ? { base: rest, query: null, hash }
    : { base: rest.slice(0, q), query: rest.slice(q + 1), hash };
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/** The decoded value of the first non-empty query parameter named one of `names` (any case). */
function param(url: string, ...names: string[]): string | null {
  const { query } = split(url);
  if (query === null) return null;
  const wanted = names.map((n) => n.toLowerCase());
  for (const part of query.split("&")) {
    const eq = part.indexOf("=");
    const key = decode(eq < 0 ? part : part.slice(0, eq)).toLowerCase();
    if (wanted.includes(key) && eq >= 0 && eq < part.length - 1) return decode(part.slice(eq + 1));
  }
  return null;
}

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** A plausible link target: http(s) or ftp URL (decoded once more when still encoded). */
function target(v: string | null): string | null {
  if (!v) return null;
  let t = v.trim();
  if (/^(https?|ftp)%3A/i.test(t)) t = decode(t);
  if (/^\/\//.test(t)) t = `https:${t}`;
  return /^(https?|ftp):\/\/[^\s]+$/i.test(t) ? t : null;
}

function base64UrlDecode(s: string): string | null {
  try {
    let b = s.replace(/-/g, "+").replace(/_/g, "/");
    b += "=".repeat((4 - (b.length % 4)) % 4);
    const bin = atob(b);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/* --- Wrappers ------------------------------------------------------------------------------- */

/** Proofpoint URL Defense v2: `u=https-3A__example.com_path` ("-" → "%", "_" → "/"). */
export function proofpointV2(u: string): string {
  return decode(u.replace(/-/g, "%").replace(/_/g, "/"));
}

const RUN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Proofpoint URL Defense v3: `https://urldefense.com/v3/__<url>__;<base64url>!!…` where each
 * "*" in <url> stands for the next character of the decoded base64url string, and "**X" for a
 * run of (index of X in RUN + 2) characters.
 */
export function proofpointV3(url: string): string | null {
  const m = /\/v3\/__(.+?)__;([A-Za-z0-9_-]*)!/.exec(url);
  if (!m) return null;
  const embedded = m[1] as string;
  const chars = [...(base64UrlDecode(m[2] as string) ?? "")];
  let k = 0;
  return embedded.replace(/\*\*[A-Za-z0-9_-]|\*/g, (tok) => {
    const n = tok === "*" ? 1 : RUN.indexOf(tok.charAt(2)) + 2;
    const s = chars.slice(k, k + n).join("");
    k += n;
    return s;
  });
}

const OPAQUE: [RegExp, string][] = [
  [/^t\.co$/, "X / Twitter (t.co)"],
  [/^lnkd\.in$/, "LinkedIn (lnkd.in)"],
  [/(^|\.)mimecast\.com$/, "Mimecast"],
  [/^(bit\.ly|tinyurl\.com|ow\.ly|buff\.ly|goo\.gl|is\.gd|rebrand\.ly|cutt\.ly)$/, "shortener"],
];

const GENERIC_PARAMS = [
  "url",
  "u",
  "target",
  "dest",
  "destination",
  "redirect",
  "redirect_url",
  "redir",
  "goto",
  "link",
];

/** One layer of unwrapping, or null when `url` is not a known wrapper. */
export function unwrapOnce(url: string): { url: string; via: string } | null {
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  const hit = (via: string, t: string | null) => (t ? { url: t, via } : null);

  if (/(^|\.)safelinks\.protection\.(outlook\.com|office365\.us|outlook\.cn)$/.test(host))
    return hit("Microsoft Safe Links", target(param(url, "url")));
  if (host === "statics.teams.cdn.office.net" && path.includes("/safelinks/"))
    return hit("Microsoft Teams Safe Links", target(param(url, "url")));
  if (/^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) {
    if (path === "/url") return hit("Google", target(param(url, "q", "url")));
    if (path.startsWith("/amp/s/"))
      return hit("Google AMP", target(`https://${path.slice(7)}${u.search}`));
  }
  if (
    /^(l|lm)\.facebook\.com$|^l\.messenger\.com$|^l\.instagram\.com$|^l\.threads\.(net|com)$/.test(
      host,
    )
  )
    return hit("Facebook", target(param(url, "u")));
  if (host === "urldefense.proofpoint.com") {
    const v = param(url, "u");
    if (path.startsWith("/v2/") && v) return hit("Proofpoint URL Defense", target(proofpointV2(v)));
    if (path.startsWith("/v1/")) return hit("Proofpoint URL Defense", target(v));
  }
  if (host === "urldefense.com" && path.startsWith("/v3/__"))
    return hit("Proofpoint URL Defense", target(proofpointV3(url)));
  if (host === "slack-redir.net") return hit("Slack", target(param(url, "url")));
  if (/(^|\.)linkedin\.com$/.test(host) && /^\/(redir\/redirect|safety\/go)/.test(path))
    return hit("LinkedIn", target(param(url, "url")));
  if (/(^|\.)youtube\.com$/.test(host) && path === "/redirect")
    return hit("YouTube", target(param(url, "q")));
  if (host === "steamcommunity.com" && path.startsWith("/linkfilter"))
    return hit("Steam", target(param(url, "url", "u")));
  if (host === "out.reddit.com") return hit("Reddit", target(param(url, "url")));
  if (/(^|\.)vk\.com$/.test(host) && path === "/away.php")
    return hit("VK", target(param(url, "to")));
  if (/(^|\.)duckduckgo\.com$/.test(host) && path.startsWith("/l/"))
    return hit("DuckDuckGo", target(param(url, "uddg")));
  if (/(^|\.)bing\.com$/.test(host) && path === "/ck/a") {
    const v = param(url, "u");
    return hit("Bing", target(v?.startsWith("a1") ? base64UrlDecode(v.slice(2)) : null));
  }
  if (host === "r.search.yahoo.com") {
    const m = /\/RU=([^/]+)\//.exec(path);
    return hit("Yahoo", target(m ? decode(m[1] as string) : null));
  }
  if (host === "safe.menlosecurity.com")
    return hit("Menlo Security", target(path.slice(1) + u.search));
  if (host === "linkprotect.cudasvc.com") return hit("Barracuda", target(param(url, "a")));
  if (/\.protection\.sophos\.com$/.test(host)) {
    const v = param(url, "u");
    return hit("Sophos", target(v ? base64UrlDecode(v) : null));
  }
  if (/(^|\.)trendmicro\.com$/.test(host) && path.includes("/clicktime/"))
    return hit("Trend Micro", target(param(url, "url")));
  if (host === "go.skimresources.com" || host === "go.redirectingat.com")
    return hit("Skimlinks", target(param(url, "url")));

  // Generic: a redirect-looking endpoint carrying a full URL in a usual parameter.
  const looksRedirect =
    /(^|\/)(redirect|redir|r|out|away|click|clicks|track|goto|link|l|url|ck)(\.php|\.aspx?)?(\/|$)/i.test(
      path,
    ) || /^(click|clicks|links?|email|track|trk|go|r|redirect)\./.test(host);
  if (looksRedirect) {
    const t = target(param(url, ...GENERIC_PARAMS));
    if (t) return { url: t, via: host };
  }
  return null;
}

/* --- Tracking parameters --------------------------------------------------------------------- */

const TRACKING = new Set(
  [
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "gbraid",
    "wbraid",
    "gad_source",
    "gad_campaignid",
    "srsltid",
    "msclkid",
    "yclid",
    "ysclid",
    "twclid",
    "ttclid",
    "li_fat_id",
    "igshid",
    "igsh",
    "mc_cid",
    "mc_eid",
    "_ga",
    "_gl",
    "_hsenc",
    "_hsmi",
    "__hstc",
    "__hssc",
    "__hsfp",
    "hsctatracking",
    "mkt_tok",
    "epik",
    "s_cid",
    "rb_clickid",
    "wickedid",
    "irclickid",
    "_kx",
    "ck_subscriber_id",
    "oly_anon_id",
    "oly_enc_id",
    "vero_id",
    "vero_conv",
    "ref_src",
    "ref_url",
    "trk",
    "trkcampaign",
    "spm",
    "scm",
    "_branch_match_id",
    "_branch_referrer",
    "sc_cid",
    "ncid",
    "cmpid",
  ].map((s) => s.toLowerCase()),
);

const TRACKING_PREFIXES = ["utm_", "pk_", "mtm_", "hsa_", "stm_", "itm_", "_hs"];

/** Parameters that are tracking only on some sites. */
const HOST_TRACKING: [RegExp, string[]][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, ["si", "feature", "pp"]],
  [/(^|\.)spotify\.com$/, ["si", "context"]],
  [/(^|\.)(x\.com|twitter\.com)$/, ["s", "t"]],
  [/(^|\.)instagram\.com$/, ["igsh", "igshid", "img_index"]],
  [/(^|\.)tiktok\.com$/, ["_r", "_t", "is_from_webapp", "sender_device", "sender_web_id"]],
  [
    /(^|\.)linkedin\.com$/,
    ["trackingid", "lipi", "refid", "midtoken", "midsig", "trk", "trkemail", "eid"],
  ],
  [
    /(^|\.)amazon\.[a-z.]+$/,
    [
      "ref_",
      "pd_rd_r",
      "pd_rd_w",
      "pd_rd_wg",
      "pd_rd_i",
      "pf_rd_p",
      "pf_rd_r",
      "content-id",
      "crid",
      "sprefix",
    ],
  ],
];

export function isTracking(name: string, host = ""): boolean {
  const n = name.toLowerCase();
  if (TRACKING.has(n) || TRACKING_PREFIXES.some((p) => n.startsWith(p))) return true;
  return HOST_TRACKING.some(([re, list]) => re.test(host) && list.includes(n));
}

/** Removes tracking parameters, keeping every other parameter exactly as written. */
export function stripTracking(url: string): { url: string; removed: string[] } {
  const { base, query, hash } = split(url);
  if (query === null) return { url, removed: [] };
  const host = parse(url)?.hostname.toLowerCase() ?? "";
  const removed: string[] = [];
  const kept = query.split("&").filter((part) => {
    if (!part) return false;
    const key = decode(part.split("=")[0] as string);
    if (isTracking(key, host)) {
      if (!removed.includes(key)) removed.push(key);
      return false;
    }
    return true;
  });
  if (!removed.length) return { url, removed };
  return { url: `${base}${kept.length ? `?${kept.join("&")}` : ""}${hash}`, removed };
}

/* --- Whole links and texts --------------------------------------------------------------------- */

export function cleanUrl(url: string, opts: Options): Cleaned {
  let current = url;
  const unwrapped: string[] = [];
  const removed: string[] = [];
  if (opts.unwrap)
    for (let i = 0; i < 6; i++) {
      const next = unwrapOnce(current);
      if (!next || next.url === current) break;
      unwrapped.push(next.via);
      current = next.url;
    }
  if (opts.strip) {
    const s = stripTracking(current);
    current = s.url;
    removed.push(...s.removed);
  }
  let opaque: string | null = null;
  const host = parse(current)?.hostname.toLowerCase() ?? "";
  for (const [re, name] of OPAQUE) if (re.test(host)) opaque = name;
  return { original: url, result: current, unwrapped, removed, opaque };
}

/** Links in a text: http(s) URLs, with trailing punctuation and unbalanced brackets left out. */
export function findUrls(text: string): { start: number; end: number; url: string }[] {
  const out: { start: number; end: number; url: string }[] = [];
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>"'`]+/gi)) {
    let url = m[0];
    for (;;) {
      const last = url.at(-1) ?? "";
      if (/[.,;:!?*]/.test(last)) url = url.slice(0, -1);
      else if (last === ")" && (url.match(/\(/g) ?? []).length < (url.match(/\)/g) ?? []).length)
        url = url.slice(0, -1);
      else if (last === "]" && (url.match(/\[/g) ?? []).length < (url.match(/\]/g) ?? []).length)
        url = url.slice(0, -1);
      else break;
    }
    const start = m.index ?? 0;
    out.push({ start, end: start + url.length, url });
  }
  return out;
}

/** Cleans every link of a text; the rest of the text is kept as is. */
export function cleanText(text: string, opts: Options): { text: string; links: Cleaned[] } {
  const found = findUrls(text);
  const links: Cleaned[] = [];
  let out = "";
  let pos = 0;
  for (const f of found) {
    const c = cleanUrl(f.url, opts);
    links.push(c);
    out += text.slice(pos, f.start) + c.result;
    pos = f.end;
  }
  return { text: out + text.slice(pos), links };
}
