/**
 * URL parsing with the WHATWG URL parser: parts, decoded query parameters, rebuilding a URL from
 * edited parameters, and query string ↔ JSON (repeated keys become arrays, `a[b]` nests).
 */
import { fail } from "../_shared";

export type Param = [key: string, value: string];

export interface ParsedUrl {
  href: string;
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  /** The explicit port, or "" when it is the scheme's default. */
  port: string;
  pathname: string;
  /** Decoded path segments. */
  segments: string[];
  search: string;
  hash: string;
  origin: string;
  params: Param[];
  /** "https://" was added because the input had no scheme. */
  assumedScheme: boolean;
  /** The input was a path (starting with / ? or #), parsed against a placeholder origin. */
  relative: boolean;
}

const BASE = "http://relative.invalid";

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function toUrl(text: string): { url: URL; assumedScheme: boolean; relative: boolean } {
  const t = text.trim();
  if (!t) fail("Enter a URL.", "Saisis une URL.");
  if (/^[/?#]/.test(t)) return { url: new URL(t, BASE), assumedScheme: false, relative: true };
  // "localhost:3000/x" would otherwise parse with "localhost:" as its scheme.
  const hostPort = /^[^\s/:?#]+:\d+(?:[/?#]|$)/.test(t);
  if (!hostPort && URL.canParse(t) && /^[a-z][a-z0-9+.-]*:/i.test(t))
    return { url: new URL(t), assumedScheme: false, relative: false };
  // "example.com/path": a host without scheme.
  const bareHost = /^(?:[^\s/:?#]+\.[^\s/:?#]+|localhost)(?::\d+)?(?:[/?#]|$)/i.test(t);
  if ((hostPort || bareHost) && URL.canParse(`https://${t}`))
    return { url: new URL(`https://${t}`), assumedScheme: true, relative: false };
  fail(
    "This is not a valid URL (e.g. https://example.com/path?q=1).",
    "Ce n'est pas une URL valide (par ex. https://example.com/chemin?q=1).",
  );
}

export function parseUrl(text: string): ParsedUrl {
  const { url, assumedScheme, relative } = toUrl(text);
  return {
    href: url.href,
    protocol: relative ? "" : url.protocol.replace(/:$/, ""),
    username: safeDecode(url.username),
    password: safeDecode(url.password),
    hostname: relative ? "" : url.hostname,
    port: url.port,
    pathname: url.pathname,
    segments: url.pathname.split("/").filter(Boolean).map(safeDecode),
    search: url.search,
    hash: safeDecode(url.hash.replace(/^#/, "")),
    origin: relative || url.origin === "null" ? "" : url.origin,
    params: [...url.searchParams],
    assumedScheme,
    relative,
  };
}

/** The input URL with its query replaced by `params`, in the same form it was written. */
export function withParams(text: string, params: Param[]): string {
  const { url, assumedScheme, relative } = toUrl(text);
  const sp = new URLSearchParams();
  for (const [k, v] of params) if (k || v) sp.append(k, v);
  url.search = sp.toString();
  if (relative) return url.href.slice(BASE.length);
  if (assumedScheme) return url.href.replace(/^https:\/\//, "");
  return url.href;
}

/* --- Query string ↔ JSON ------------------------------------------------------------ */

type JsonValue = string | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

/** `a[b][]` → ["a", "b", ""]. */
function keyPath(key: string): string[] {
  const m = /^([^[\]]*)((?:\[[^[\]]*\])*)$/.exec(key);
  if (!m?.[2]) return [key];
  return [m[1] ?? "", ...[...m[2].matchAll(/\[([^[\]]*)\]/g)].map((x) => x[1] ?? "")];
}

function assign(target: JsonObject, path: string[], value: string): void {
  const [head, ...rest] = path;
  if (head === undefined) return;
  if (!rest.length) {
    const prev = target[head];
    if (prev === undefined) target[head] = value;
    else if (Array.isArray(prev)) prev.push(value);
    else target[head] = [prev, value];
    return;
  }
  if (rest[0] === "" && rest.length === 1) {
    const prev = target[head];
    if (Array.isArray(prev)) prev.push(value);
    else target[head] = prev === undefined ? [value] : [prev as JsonValue, value];
    return;
  }
  let child = target[head];
  if (!child || typeof child !== "object" || Array.isArray(child)) {
    child = {};
    target[head] = child;
  }
  assign(child, rest, value);
}

/** Parses "?a=1&a=2&b[c]=x" (or a full URL) into { a: ["1", "2"], b: { c: "x" } }. */
export function queryToJson(text: string): JsonObject {
  let q = text.trim();
  const qi = q.indexOf("?");
  if (qi >= 0 && /^[a-z][a-z0-9+.-]*:|^\//i.test(q)) q = q.slice(qi);
  q = q.replace(/^\?/, "").replace(/#.*$/, "");
  const out: JsonObject = {};
  for (const [k, v] of new URLSearchParams(q)) assign(out, keyPath(k), v);
  return out;
}

/** Builds a query string (without "?") from a JSON object; nested objects use brackets. */
export function jsonToQuery(json: string): string {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (err) {
    fail(
      `Invalid JSON: ${err instanceof Error ? err.message : err}`,
      `JSON invalide : ${err instanceof Error ? err.message : err}`,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(
      'The JSON must be an object, e.g. {"q": "search", "page": 2}.',
      'Le JSON doit être un objet, par ex. {"q": "recherche", "page": 2}.',
    );
  const sp = new URLSearchParams();
  const walk = (prefix: string, v: unknown) => {
    if (Array.isArray(v)) for (const x of v) walk(prefix, x);
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) walk(prefix ? `${prefix}[${k}]` : k, x);
    else sp.append(prefix, v === null || v === undefined ? "" : String(v));
  };
  walk("", value);
  return sp.toString();
}
