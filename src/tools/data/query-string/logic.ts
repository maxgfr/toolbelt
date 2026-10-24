/**
 * Query strings ↔ JSON. Accepts a bare query or a whole URL; repeated keys
 * become arrays; `a[b]=1&a[c][]=2` can be read as nested objects and arrays.
 */
import { inferScalar, isPlainObject, setKey } from "../_shared";

export interface QsOptions {
  /** Read "+" as a space (HTML forms); write spaces as "+". */
  plus: boolean;
  /** Read and write `a[b]=1` / `a[]=1` as nesting. */
  brackets: boolean;
  /** Turn "1", "true", "null" into numbers, booleans, null. */
  infer?: boolean;
}

export interface Pair {
  key: string;
  value: string;
}

export interface QsParsed {
  value: Record<string, unknown>;
  pairs: Pair[];
  /** Parts whose %-encoding is broken (kept as typed). */
  badEncoding: string[];
  /** Keys used both as a value and as a container (the later one wins). */
  conflicts: string[];
}

/** The query part of a URL, or the text itself when it is not a URL. */
export function extractQuery(input: string): string {
  let s = input.trim();
  const isUrl = /^[a-z][\w+.-]*:\/\//i.test(s) || s.startsWith("/");
  if (isUrl || s.startsWith("?")) {
    const q = s.indexOf("?");
    s = q < 0 ? "" : s.slice(q + 1);
  }
  const hash = s.indexOf("#");
  return hash < 0 ? s : s.slice(0, hash);
}

/** `a[b][]` → ["a", "b", ""]; a key without brackets is one segment. */
export function keyPath(key: string): string[] {
  const m = /^([^[\]]*)((?:\[[^[\]]*\])+)$/.exec(key);
  if (!m || m[1] === "") return [key];
  return [
    m[1] as string,
    ...[...(m[2] as string).matchAll(/\[([^[\]]*)\]/g)].map((x) => x[1] ?? ""),
  ];
}

function isContainer(v: unknown): boolean {
  return Array.isArray(v) || isPlainObject(v);
}

/** Adds a value at a key: a second value for the same key turns it into an array. */
function addValue(obj: Record<string, unknown>, key: string, v: unknown): void {
  if (!Object.hasOwn(obj, key)) setKey(obj, key, v);
  else {
    const prev = obj[key];
    setKey(obj, key, Array.isArray(prev) ? [...prev, v] : [prev, v]);
  }
}

/** The key `[]` appends at: one past the largest numeric key. */
function nextIndex(obj: Record<string, unknown>): string {
  let n = -1;
  for (const k of Object.keys(obj)) if (/^\d+$/.test(k)) n = Math.max(n, Number(k));
  return String(n + 1);
}

/** Nested objects whose keys are all indices become arrays (in index order, without holes). */
function arrays(v: unknown, top = false): unknown {
  if (Array.isArray(v)) return v.map((x) => arrays(x));
  if (!isPlainObject(v)) return v;
  const keys = Object.keys(v);
  if (!top && keys.length && keys.every((k) => /^\d+$/.test(k)))
    return keys.sort((a, b) => Number(a) - Number(b)).map((k) => arrays(v[k]));
  for (const k of keys) setKey(v, k, arrays(v[k]));
  return v;
}

function decode(s: string, plus: boolean, bad: string[]): string {
  const t = plus ? s.replace(/\+/g, " ") : s;
  try {
    return decodeURIComponent(t);
  } catch {
    bad.push(s);
    return t;
  }
}

export function parseQuery(input: string, o: QsOptions): QsParsed {
  const value: Record<string, unknown> = {};
  const pairs: Pair[] = [];
  const badEncoding: string[] = [];
  const conflicts: string[] = [];
  for (const part of extractQuery(input).split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = decode(eq < 0 ? part : part.slice(0, eq), o.plus, badEncoding);
    const raw = eq < 0 ? "" : decode(part.slice(eq + 1), o.plus, badEncoding);
    pairs.push({ key, value: raw });
    const v = o.infer ? inferScalar(raw, false) : raw;
    const path = o.brackets ? keyPath(key) : [key];
    if (path.length === 1) {
      addValue(value, key, v);
      continue;
    }
    let cur = value;
    path.forEach((name, i) => {
      const seg = name === "" ? nextIndex(cur) : name;
      if (i === path.length - 1) {
        addValue(cur, seg, v);
        return;
      }
      const has = Object.hasOwn(cur, seg);
      if (has && !isPlainObject(cur[seg])) conflicts.push(key);
      if (!has || !isPlainObject(cur[seg])) setKey(cur, seg, {});
      cur = cur[seg] as Record<string, unknown>;
    });
  }
  return { value: arrays(value, true) as Record<string, unknown>, pairs, badEncoding, conflicts };
}

function enc(s: string, plus: boolean): string {
  const e = encodeURIComponent(s);
  return plus ? e.replace(/%20/g, "+") : e;
}

function scalar(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** A JSON object as a query string (without the leading "?"). */
export function toQuery(value: unknown, o: QsOptions): { ok: true; text: string } | { ok: false } {
  if (!isPlainObject(value)) return { ok: false };
  const out: string[] = [];
  const push = (key: string, v: unknown) => out.push(`${key}=${enc(scalar(v), o.plus)}`);
  const walk = (key: string, v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (!o.brackets) push(key, item);
        else if (isContainer(item)) walk(`${key}[${i}]`, item);
        else push(`${key}[]`, item);
      });
    } else if (isPlainObject(v) && o.brackets) {
      for (const [k, x] of Object.entries(v)) walk(`${key}[${enc(k, o.plus)}]`, x);
    } else push(key, v);
  };
  for (const [k, v] of Object.entries(value)) walk(enc(k, o.plus), v);
  return { ok: true, text: out.join("&") };
}
