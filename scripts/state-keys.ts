/**
 * Reads every tool's View for its `useToolState(key, initial, opts)` calls: the keys a share link
 * can carry (`#/<tool>?s=…`), with their type and default. Used by scripts/build-skill.ts to
 * generate cli/gen/state-keys.ts, so the CLI's `link` command never drifts from the views.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type StateType = "string" | "number" | "boolean" | "array" | "object" | "json";

export interface StateKey {
  key: string;
  type: StateType;
  /** The default, when it is a literal or a constant the generator could evaluate. */
  default?: unknown;
  /** The default's source, when it could not be evaluated (computed at runtime). */
  expr?: string;
}

/** Index of the bracket that closes the one at `open` (strings, templates and comments skipped). */
function closing(src: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">" };
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i === -1) return -1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i) + 1;
      continue;
    }
    if (c === "=" && src[i + 1] === ">") {
      i++;
      continue;
    }
    if (c in pairs && (c !== "<" || stack.at(-1) === ">" || i === open))
      stack.push(pairs[c] as string);
    else if (c === stack.at(-1)) {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

function skipString(src: string, start: number): number {
  const q = src[start];
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") i++;
    else if (q === "`" && c === "$" && src[i + 1] === "{") i = closing(src, i + 1);
    else if (c === q) return i;
  }
  return src.length;
}

/** Splits a call's argument list on its top-level commas. */
function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      const end = skipString(inner, i);
      cur += inner.slice(i, end + 1);
      i = end;
      continue;
    }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface RawCall {
  key: string;
  generic: string | undefined;
  initial: string;
  opts: string | undefined;
}

/** The `useToolState` calls of a view's source. */
export function findCalls(src: string): RawCall[] {
  const calls: RawCall[] = [];
  const re = /\buseToolState\b/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let i = m.index + m[0].length;
    let generic: string | undefined;
    if (src[i] === "<") {
      const end = closing(src, i);
      generic = src.slice(i + 1, end).trim();
      i = end + 1;
    }
    if (src[i] !== "(") continue; // the import, or the type
    const end = closing(src, i);
    const [key, initial, opts] = splitArgs(src.slice(i + 1, end));
    const lit = key?.match(/^"([^"]+)"$/);
    if (!lit?.[1] || initial === undefined) continue;
    calls.push({ key: lit[1], generic, initial, opts });
    re.lastIndex = end;
  }
  return calls;
}

/** The names a view imports from relative TypeScript modules: local name → [module, export]. */
function relativeImports(src: string): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"(\.[^"]+)"/g)) {
    for (const part of (m[1] as string).split(",")) {
      const p = part.trim().replace(/^type\s+/, "");
      if (!p) continue;
      const [name, alias] = p.split(/\s+as\s+/).map((s) => s.trim());
      if (name) out.set(alias ?? name, [m[2] as string, name]);
    }
  }
  return out;
}

const literal = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

function typeOfValue(v: unknown): StateType {
  if (Array.isArray(v)) return "array";
  if (v === null) return "json";
  const t = typeof v;
  return t === "string" || t === "number" || t === "boolean"
    ? t
    : t === "object"
      ? "object"
      : "json";
}

function typeFromGeneric(g: string | undefined): StateType | undefined {
  if (!g) return undefined;
  if (/^(string|number|boolean)$/.test(g)) return g as StateType;
  if (/\[\]$|^Array</.test(g)) return "array";
  if (/^("[^"]*"\s*\|?\s*)+$/.test(g)) return "string";
  if (/^Record</.test(g)) return "object";
  return undefined;
}

/** Type and default of one call; `load` imports a view's relative module to evaluate constants. */
export async function describeKey(
  call: RawCall,
  imports: Map<string, [string, string]>,
  load: (spec: string) => Promise<Record<string, unknown>>,
): Promise<StateKey> {
  const init = call.initial.replace(/\s+/g, " ").trim();
  const out: StateKey = { key: call.key, type: typeFromGeneric(call.generic) ?? "json" };
  const known = (v: unknown) => {
    if (out.type === "json") out.type = typeOfValue(v);
    out.default = v;
    return out;
  };
  if (/^"(?:[^"\\]|\\.)*"$/.test(init)) return known(literal(init));
  if (/^-?\d[\d_]*(\.\d+)?$/.test(init)) return known(Number(init.replace(/_/g, "")));
  if (/^0o[0-7]+$/.test(init)) return known(Number.parseInt(init.slice(2), 8));
  if (init === "true" || init === "false") return known(init === "true");
  const json = literal(init.replace(/,\s*([\]}])/g, "$1"));
  if (json !== undefined) return known(json);
  // A constant imported from the tool's own modules (`DEFAULT`, `DEFAULTS.trim`, `PRESETS.x.y`).
  const path = init.match(/^([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)$/);
  const from = path ? imports.get(path[1] as string) : undefined;
  if (path && from) {
    try {
      let v: unknown = (await load(from[0]))[from[1]];
      for (const k of (path[2] as string).split(".").filter(Boolean))
        v = (v as Record<string, unknown>)[k];
      if (v !== undefined && typeof v !== "function") return known(structuredClone(v));
    } catch {}
  }
  if (out.type === "json") {
    if (/^(String\(|tr\(|`|lang\.value|localZone\(|now\b|here\b)/.test(init)) out.type = "string";
    else if (/^\[/.test(init)) out.type = "array";
    else if (/^\{/.test(init)) out.type = "object";
    else if (/^pick(<[^>]*>)?\(\{\s*en:\s*(true|false)/.test(init)) out.type = "boolean";
    else if (/^pick(<[^>]*>)?\(\{\s*en:\s*"/.test(init)) out.type = "string";
  }
  out.expr = init.length > 60 ? `${init.slice(0, 57)}...` : init;
  return out;
}

function isShared(opts: string | undefined): boolean {
  return !opts || !/share:\s*false/.test(opts);
}

/** Every tool's shareable state keys, by tool id, in the views' order. */
export async function stateKeyMap(
  root = resolve(import.meta.dir, ".."),
): Promise<Record<string, StateKey[]>> {
  const tools = join(root, "src/tools");
  const out: Record<string, StateKey[]> = {};
  const cats = (await readdir(tools, { withFileTypes: true })).filter((d) => d.isDirectory());
  const entries: [string, string][] = [];
  for (const c of cats)
    for (const d of await readdir(join(tools, c.name), { withFileTypes: true }))
      if (d.isDirectory() && !d.name.startsWith("_"))
        entries.push([d.name, join(tools, c.name, d.name)]);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [id, dir] of entries) {
    let src: string;
    try {
      src = await readFile(join(dir, "View.tsx"), "utf8");
    } catch {
      continue;
    }
    const imports = relativeImports(src);
    const load = (spec: string) => import(join(dir, spec)) as Promise<Record<string, unknown>>;
    const keys: StateKey[] = [];
    for (const call of findCalls(src)) {
      if (!isShared(call.opts) || keys.some((k) => k.key === call.key)) continue;
      keys.push(await describeKey(call, imports, load));
    }
    out[id] = keys;
  }
  return out;
}
