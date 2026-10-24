/**
 * JSON → TypeScript types and a Zod schema. The shape is inferred from the
 * sample: array items are merged (a key missing from some items becomes
 * optional, mixed items become a union), identical object shapes share one
 * named type.
 */
import { isPlainObject } from "../_shared";

type Prim = "string" | "number" | "boolean" | "null";

export type Shape =
  | { k: Prim }
  /** No information (the items of an empty array). */
  | { k: "unknown" }
  | { k: "array"; item: Shape }
  | { k: "object"; hint: string; fields: Map<string, { shape: Shape; optional: boolean }> }
  | { k: "union"; options: Shape[] };

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

export function infer(value: unknown, hint: string): Shape {
  if (value === null) return { k: "null" };
  if (typeof value === "string") return { k: "string" };
  if (typeof value === "number") return { k: "number" };
  if (typeof value === "boolean") return { k: "boolean" };
  if (Array.isArray(value)) {
    const h = singular(hint);
    let item: Shape = { k: "unknown" };
    for (const v of value) item = merge(item, infer(v, h));
    return { k: "array", item };
  }
  if (isPlainObject(value)) {
    const fields = new Map<string, { shape: Shape; optional: boolean }>();
    for (const [k, v] of Object.entries(value))
      fields.set(k, { shape: infer(v, k), optional: false });
    return { k: "object", hint, fields };
  }
  return { k: "unknown" };
}

function options(s: Shape): Shape[] {
  return s.k === "union" ? s.options : s.k === "unknown" ? [] : [s];
}

function mergeObjects(
  a: Extract<Shape, { k: "object" }>,
  b: Extract<Shape, { k: "object" }>,
): Shape {
  const fields = new Map<string, { shape: Shape; optional: boolean }>();
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
    const i = out.findIndex((o) => o.k === s.k);
    const prev = out[i];
    if (!prev) out.push(s);
    else if (prev.k === "object" && s.k === "object") out[i] = mergeObjects(prev, s);
    else if (prev.k === "array" && s.k === "array")
      out[i] = { k: "array", item: merge(prev.item, s.item) };
  }
  // null last: `string | null`.
  out.sort((x, y) => Number(x.k === "null") - Number(y.k === "null"));
  return out.length === 1 ? (out[0] as Shape) : { k: "union", options: out };
}

export interface Options {
  rootName: string;
  style: "interface" | "type";
  readonly: boolean;
}

interface Named {
  name: string;
  shape: Extract<Shape, { k: "object" }>;
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

/** Names every object shape (root first, then depth first); returns them in that order. */
function nameShapes(root: Shape, rootName: string) {
  const memo = new WeakMap<object, string>();
  const bySig = new Map<string, string>();
  const names = new Map<Shape, string>();
  const used = new Set<string>();
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

function childHint(s: Shape, key: string): string {
  return s.k === "array" ? singular(key) : key;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

function key(k: string): string {
  return IDENT.test(k) ? k : JSON.stringify(k);
}

/** TypeScript declarations for a JSON value. */
export function toTypeScript(value: unknown, o: Options): string {
  const root = infer(value, o.rootName);
  const { names, pre } = nameShapes(root, o.rootName);
  const ro = o.readonly ? "readonly " : "";
  const expr = (s: Shape): string => {
    switch (s.k) {
      case "object":
        return names.get(s) ?? "unknown";
      case "array": {
        const inner = expr(s.item);
        return `${ro}${s.item.k === "union" ? `(${inner})` : inner}[]`;
      }
      case "union":
        return s.options.map(expr).join(" | ");
      default:
        return s.k;
    }
  };
  const body = (s: Named["shape"]) =>
    s.fields.size
      ? `{\n${[...s.fields]
          .map(([k, f]) => `  ${ro}${key(k)}${f.optional ? "?" : ""}: ${expr(f.shape)};`)
          .join("\n")}\n}`
      : "Record<string, unknown>";
  const blocks = pre.map(({ name, shape }) =>
    o.style === "interface" && shape.fields.size
      ? `export interface ${name} ${body(shape)}`
      : `export type ${name} = ${body(shape)};`,
  );
  const rootName = pascal(o.rootName);
  if (root.k !== "object") blocks.unshift(`export type ${rootName} = ${expr(root)};`);
  return `${blocks.join("\n\n")}\n`;
}

/** A Zod schema (dependencies first) and its inferred types. */
export function toZod(value: unknown, o: Options): string {
  const root = infer(value, o.rootName);
  const { names, post } = nameShapes(root, o.rootName);
  const ro = o.readonly ? ".readonly()" : "";
  const expr = (s: Shape): string => {
    switch (s.k) {
      case "object":
        return `${names.get(s) ?? "Unknown"}Schema`;
      case "array":
        return `z.array(${expr(s.item)})${ro}`;
      case "union": {
        const rest = s.options.filter((x) => x.k !== "null");
        if (rest.length === 1 && rest[0]) return `${expr(rest[0])}.nullable()`;
        const u = `z.union([${rest.map(expr).join(", ")}])`;
        return rest.length < s.options.length ? `${u}.nullable()` : u;
      }
      case "unknown":
        return "z.unknown()";
      default:
        return `z.${s.k}()`;
    }
  };
  const lines = ['import { z } from "zod";', ""];
  for (const { name, shape } of post) {
    const fields = [...shape.fields]
      .map(([k, f]) => `  ${key(k)}: ${expr(f.shape)}${f.optional ? ".optional()" : ""},`)
      .join("\n");
    lines.push(
      `export const ${name}Schema = z.object({${fields ? `\n${fields}\n` : ""}})${ro};`,
      `export type ${name} = z.infer<typeof ${name}Schema>;`,
      "",
    );
  }
  if (root.k !== "object") {
    const name = pascal(o.rootName);
    lines.push(
      `export const ${name}Schema = ${expr(root)};`,
      `export type ${name} = z.infer<typeof ${name}Schema>;`,
      "",
    );
  }
  return lines.join("\n");
}
