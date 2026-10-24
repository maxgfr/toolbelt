/**
 * Shape inference from a JSON sample, shared by the code generators (json-to-ts, json-to-code,
 * json-schema). Array items are merged: a key missing from some items becomes optional, mixed
 * items become a union. Identical object shapes can share one name.
 */
import { isPlainObject } from "./_shared";

export type Prim = "string" | "number" | "integer" | "boolean" | "null";

export interface Field {
  shape: Shape;
  optional: boolean;
}

export type Shape =
  /** `format` is only set when `InferOptions.formats` detected one on every sample. */
  | { k: "string"; format?: string }
  | { k: Exclude<Prim, "string"> }
  /** No information (the items of an empty array). */
  | { k: "unknown" }
  | { k: "array"; item: Shape }
  | { k: "object"; hint: string; fields: Map<string, Field> }
  | { k: "union"; options: Shape[] };

export type ObjectShape = Extract<Shape, { k: "object" }>;

export interface InferOptions {
  /** Tell whole numbers ("integer") from the others ("number"). Default false. */
  ints?: boolean;
  /** Detect a string format (see `stringFormat`). Default false. */
  formats?: boolean;
}

/** "categories" → "category", "boxes" → "box", "data" → "dataItem". */
export function singular(word: string): string {
  if (/ies$/i.test(word) && word.length > 3) return word.replace(/ies$/i, "y");
  if (/(ss|us|is)$/i.test(word)) return `${word}Item`;
  if (/(x|ch|sh|ss)es$/i.test(word)) return word.replace(/es$/i, "");
  if (/[^s]s$/i.test(word)) return word.slice(0, -1);
  return `${word}Item`;
}

/** "user_profile" → "UserProfile"; never empty, never starts with a digit. */
export function pascal(s: string): string {
  const words = s.match(/[A-Za-z0-9]+/g) ?? [];
  const out = words.map((w) => (w[0] ?? "").toUpperCase() + w.slice(1)).join("");
  if (!out) return "Item";
  return /^\d/.test(out) ? `T${out}` : out;
}

const FORMATS: [string, RegExp][] = [
  ["date-time", /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:?\d{2})$/],
  ["date", /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/],
  ["time", /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?$/],
  ["email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/],
  ["uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i],
  ["uri", /^[a-z][a-z0-9+.-]*:\/\/\S+$/i],
  ["ipv4", /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/],
];

/** The JSON Schema format a string clearly has (date-time, date, email, uri, uuid…), if any. */
export function stringFormat(s: string): string | undefined {
  for (const [name, re] of FORMATS) if (re.test(s)) return name;
  return undefined;
}

export function infer(value: unknown, hint: string, o: InferOptions = {}): Shape {
  if (value === null) return { k: "null" };
  if (typeof value === "string") {
    const format = o.formats ? stringFormat(value) : undefined;
    return format ? { k: "string", format } : { k: "string" };
  }
  if (typeof value === "number")
    return { k: o.ints && Number.isSafeInteger(value) ? "integer" : "number" };
  if (typeof value === "boolean") return { k: "boolean" };
  if (Array.isArray(value)) {
    const h = singular(hint);
    let item: Shape = { k: "unknown" };
    for (const v of value) item = merge(item, infer(v, h, o));
    return { k: "array", item };
  }
  if (isPlainObject(value)) {
    const fields = new Map<string, Field>();
    for (const [k, v] of Object.entries(value))
      fields.set(k, { shape: infer(v, k, o), optional: false });
    return { k: "object", hint, fields };
  }
  return { k: "unknown" };
}

function options(s: Shape): Shape[] {
  return s.k === "union" ? s.options : s.k === "unknown" ? [] : [s];
}

function mergeObjects(a: ObjectShape, b: ObjectShape): Shape {
  const fields = new Map<string, Field>();
  for (const [k, fa] of a.fields) {
    const fb = b.fields.get(k);
    fields.set(
      k,
      fb
        ? { shape: merge(fa.shape, fb.shape), optional: fa.optional || fb.optional }
        : { shape: fa.shape, optional: true },
    );
  }
  for (const [k, fb] of b.fields) if (!a.fields.has(k)) fields.set(k, { ...fb, optional: true });
  return { k: "object", hint: a.hint, fields };
}

/** The shape that accepts both. */
export function merge(a: Shape, b: Shape): Shape {
  const all = [...options(a), ...options(b)];
  if (!all.length) return { k: "unknown" };
  const out: Shape[] = [];
  for (const s of all) {
    // Whole and other numbers merge into "number".
    const kind = (x: Shape) => (x.k === "integer" ? "number" : x.k);
    const i = out.findIndex((o) => kind(o) === kind(s));
    const prev = out[i];
    if (!prev) out.push(s);
    else if (prev.k === "object" && s.k === "object") out[i] = mergeObjects(prev, s);
    else if (prev.k === "array" && s.k === "array")
      out[i] = { k: "array", item: merge(prev.item, s.item) };
    else if (prev.k !== s.k) out[i] = { k: "number" };
    else if (prev.k === "string" && s.k === "string" && prev.format !== s.format)
      out[i] = { k: "string" };
  }
  // null last: `string | null`.
  out.sort((x, y) => Number(x.k === "null") - Number(y.k === "null"));
  return out.length === 1 ? (out[0] as Shape) : { k: "union", options: out };
}

export interface Named {
  name: string;
  shape: ObjectShape;
}

/** A structural signature, so identical object shapes get one name. */
function signature(s: Shape, memo: WeakMap<object, string>): string {
  if (s.k !== "object" && s.k !== "array" && s.k !== "union") return s.k;
  const cached = memo.get(s);
  if (cached) return cached;
  let sig: string;
  if (s.k === "array") sig = `${signature(s.item, memo)}[]`;
  else if (s.k === "union") sig = `(${s.options.map((o) => signature(o, memo)).join("|")})`;
  else
    sig = `{${[...s.fields]
      .map(([k, f]) => `${JSON.stringify(k)}${f.optional ? "?" : ""}:${signature(f.shape, memo)}`)
      .join(",")}}`;
  memo.set(s, sig);
  return sig;
}

function childHint(s: Shape, key: string): string {
  return s.k === "array" ? singular(key) : key;
}

/**
 * Names every object shape (root first, then depth first). `pre` lists them parents first,
 * `post` dependencies first. `taken` names are never given out (reserved words, the root alias).
 */
export function nameShapes(root: Shape, rootName: string, taken: Iterable<string> = []) {
  const memo = new WeakMap<object, string>();
  const bySig = new Map<string, string>();
  const names = new Map<Shape, string>();
  const used = new Set<string>(taken);
  const pre: Named[] = [];
  const post: Named[] = [];
  const base = pascal(rootName);
  const unique = (want: string) => {
    let n = want;
    for (let i = 2; used.has(n); i++) n = `${want}${i}`;
    used.add(n);
    return n;
  };
  const visit = (s: Shape, suggested: string) => {
    if (s.k === "array") return visit(s.item, suggested);
    if (s.k === "union") {
      for (const o of s.options) visit(o, suggested);
      return;
    }
    if (s.k !== "object") return;
    const sig = signature(s, memo);
    const known = bySig.get(sig);
    if (known) {
      names.set(s, known);
      return;
    }
    const name = unique(suggested);
    bySig.set(sig, name);
    names.set(s, name);
    const entry = { name, shape: s };
    pre.push(entry);
    for (const [k, f] of s.fields)
      visit(f.shape, pascal(k === "" ? "Field" : childHint(f.shape, k)));
    post.push(entry);
  };
  if (root.k !== "object") used.add(base);
  visit(root, root.k === "object" ? base : `${base}Item`);
  return { names, pre, post };
}
