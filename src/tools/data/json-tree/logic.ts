/**
 * JSON tree viewer helpers: node types and sizes, children, search (matches and the ancestors
 * to open), a bounded "expand all", and the JSONPath / JSON Pointer of a node.
 */
import { isPlainObject, type Path } from "../_shared";

export type NodeType = "object" | "array" | "string" | "number" | "boolean" | "null";

export function typeOf(v: unknown): NodeType {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  if (isPlainObject(v)) return "object";
  const t = typeof v;
  return t === "string" || t === "number" || t === "boolean" ? t : "null";
}

export function isContainer(v: unknown): v is unknown[] | Record<string, unknown> {
  return Array.isArray(v) || isPlainObject(v);
}

/** The children of an object or array, as [key, value] pairs (index keys are numbers). */
export function entries(v: unknown): [string | number, unknown][] {
  if (Array.isArray(v)) return v.map((x, i) => [i, x]);
  if (isPlainObject(v)) return Object.entries(v);
  return [];
}

/** Number of direct children (0 for scalars). */
export function size(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (isPlainObject(v)) return Object.keys(v).length;
  return 0;
}

/** A stable key for a path, usable in sets. */
export function pathKey(path: Path): string {
  return JSON.stringify(path);
}

/** RFC 6901 pointer: "/store/book/0/title". */
export function jsonPointer(path: Path): string {
  return path.map((p) => `/${String(p).replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");
}

/** The value at a path, or undefined. */
export function getAt(root: unknown, path: Path): unknown {
  let cur = root;
  for (const p of path) {
    if (Array.isArray(cur) && typeof p === "number") cur = cur[p];
    else if (isPlainObject(cur) && typeof p === "string" && Object.hasOwn(cur, p)) cur = cur[p];
    else return undefined;
  }
  return cur;
}

/** How a scalar is shown in the tree: strings quoted and cut at `max` characters. */
export function scalarText(v: unknown, max = 300): string {
  const s = typeof v === "string" ? JSON.stringify(v) : String(v ?? null);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface SearchResult {
  /** Paths (pathKey) whose key or scalar value contains the query. */
  hits: Set<string>;
  /** Paths (pathKey) of every container holding a hit: open them to show the hits. */
  ancestors: Set<string>;
  count: number;
  /** Stopped at the limit. */
  capped: boolean;
}

/** Case-insensitive search in keys and scalar values. */
export function search(root: unknown, query: string, limit = 5000): SearchResult {
  const out: SearchResult = { hits: new Set(), ancestors: new Set(), count: 0, capped: false };
  const q = query.trim().toLowerCase();
  if (!q) return out;
  const path: Path = [];
  const walk = (v: unknown, key: string | number | null): boolean => {
    if (out.capped) return false;
    let found = false;
    const keyHit = key !== null && String(key).toLowerCase().includes(q);
    const valueHit =
      !isContainer(v) &&
      String(v ?? "null")
        .toLowerCase()
        .includes(q);
    if (keyHit || valueHit) {
      out.hits.add(pathKey(path));
      out.count++;
      if (out.count >= limit) out.capped = true;
      found = true;
    }
    if (isContainer(v)) {
      let inside = false;
      for (const [k, child] of entries(v)) {
        path.push(k);
        if (walk(child, k)) inside = true;
        path.pop();
        if (out.capped) break;
      }
      if (inside) {
        out.ancestors.add(pathKey(path));
        found = true;
      }
    }
    return found;
  };
  walk(root, null);
  return out;
}

/**
 * The containers to open for "expand all", breadth first, stopping once about `budget` rows
 * would be shown (huge documents stay usable).
 */
export function expandAll(root: unknown, budget = 3000): Set<string> {
  const open = new Set<string>();
  if (!isContainer(root)) return open;
  let shown = 1;
  let level: [Path, unknown][] = [[[], root]];
  while (level.length) {
    const next: [Path, unknown][] = [];
    for (const [path, v] of level) {
      const n = size(v);
      // Too big for what is left: stays closed, smaller siblings may still open.
      if (shown + n > budget && open.size) continue;
      open.add(pathKey(path));
      shown += n;
      for (const [k, child] of entries(v)) if (isContainer(child)) next.push([[...path, k], child]);
    }
    level = next;
  }
  return open;
}

/** Splits text around case-insensitive occurrences of `q`: odd indexes are the matches. */
export function splitMatches(text: string, q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [text];
  const lower = text.toLowerCase();
  // Lower-casing can change the length ("İ"): offsets would not line up, so no highlight.
  if (lower.length !== text.length) return [text];
  const out: string[] = [];
  let i = 0;
  for (let j = lower.indexOf(needle); j >= 0; j = lower.indexOf(needle, i)) {
    out.push(text.slice(i, j), text.slice(j, j + needle.length));
    i = j + needle.length;
  }
  out.push(text.slice(i));
  return out;
}

export interface TreeStats {
  nodes: number;
  depth: number;
}

export function treeStats(root: unknown): TreeStats {
  const st = { nodes: 0, depth: 0 };
  const walk = (v: unknown, d: number) => {
    st.nodes++;
    st.depth = Math.max(st.depth, d);
    if (Array.isArray(v)) for (const x of v) walk(x, d + 1);
    else if (isPlainObject(v)) for (const x of Object.values(v)) walk(x, d + 1);
  };
  walk(root, 0);
  return st;
}
