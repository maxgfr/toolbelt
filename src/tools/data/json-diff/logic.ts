/**
 * Structural JSON diff: the paths added, removed or changed between two
 * documents. Key order never matters; arrays compare by index, or as
 * multisets when their order should be ignored.
 */
import { formatPath, isPlainObject, type Path, preview, setKey } from "../_shared";

export interface Change {
  kind: "added" | "removed" | "changed";
  path: Path;
  old?: unknown;
  new?: unknown;
}

export interface DiffOptions {
  ignoreArrayOrder: boolean;
}

/** JSON text with sorted keys: equal values give equal text. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isPlainObject(v))
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

export function diffJson(a: unknown, b: unknown, o: DiffOptions): Change[] {
  const out: Change[] = [];
  const walk = (x: unknown, y: unknown, path: Path) => {
    if (isPlainObject(x) && isPlainObject(y)) {
      for (const k of Object.keys(x)) {
        if (Object.hasOwn(y, k)) walk(x[k], y[k], [...path, k]);
        else out.push({ kind: "removed", path: [...path, k], old: x[k] });
      }
      for (const k of Object.keys(y))
        if (!Object.hasOwn(x, k)) out.push({ kind: "added", path: [...path, k], new: y[k] });
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      if (o.ignoreArrayOrder) return unordered(x, y, path);
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) walk(x[i], y[i], [...path, i]);
      for (let i = n; i < x.length; i++)
        out.push({ kind: "removed", path: [...path, i], old: x[i] });
      for (let i = n; i < y.length; i++) out.push({ kind: "added", path: [...path, i], new: y[i] });
      return;
    }
    if (canonical(x) !== canonical(y)) out.push({ kind: "changed", path, old: x, new: y });
  };
  // Order-free arrays: items are matched by value (as multisets); what is left over is
  // reported at its own index on each side.
  const unordered = (x: unknown[], y: unknown[], path: Path) => {
    const key = (v: unknown) => canonical(sortDeep(v));
    const pool = new Map<string, number[]>();
    y.forEach((v, j) => {
      const k = key(v);
      pool.set(k, [...(pool.get(k) ?? []), j]);
    });
    const matched = new Set<number>();
    x.forEach((v, i) => {
      const js = pool.get(key(v));
      const j = js?.shift();
      if (j === undefined) out.push({ kind: "removed", path: [...path, i], old: v });
      else matched.add(j);
    });
    y.forEach((v, j) => {
      if (!matched.has(j)) out.push({ kind: "added", path: [...path, j], new: v });
    });
  };
  walk(a, b, []);
  return out;
}

/** Arrays sorted by their canonical text, at every depth (for order-free comparison). */
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v))
    return v
      .map(sortDeep)
      .map((x) => ({ x, k: canonical(x) }))
      .sort((p, q) => (p.k < q.k ? -1 : p.k > q.k ? 1 : 0))
      .map((p) => p.x);
  if (isPlainObject(v)) {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v)) setKey(o, k, sortDeep(v[k]));
    return o;
  }
  return v;
}

export interface Counts {
  added: number;
  removed: number;
  changed: number;
}

export function count(changes: Change[]): Counts {
  const c = { added: 0, removed: 0, changed: 0 };
  for (const ch of changes) c[ch.kind]++;
  return c;
}

/** A plain-text report, one change per line: `+ $.a: 1`, `- $.b: 2`, `~ $.c: 1 → 2`. */
export function report(changes: Change[]): string {
  return changes
    .map((c) => {
      const p = formatPath(c.path);
      if (c.kind === "added") return `+ ${p}: ${preview(c.new, 500)}`;
      if (c.kind === "removed") return `- ${p}: ${preview(c.old, 500)}`;
      return `~ ${p}: ${preview(c.old, 500)} → ${preview(c.new, 500)}`;
    })
    .join("\n");
}
