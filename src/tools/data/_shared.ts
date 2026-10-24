/** Small helpers shared by the data tools: safe keys, scalar inference, JSON paths, previews. */

export type Path = (string | number)[];

/** A located error, as every parser of this category reports it (1-based line and column). */
export interface Located {
  message: string;
  line: number;
  column: number;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/** Sets a key as an own property, even `__proto__` (no prototype pollution from user input). */
export function setKey(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (key === "__proto__")
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  else obj[key] = value;
}

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/**
 * Reads a text cell as a number, boolean or null when it clearly is one. Leading zeros
 * ("007", zip codes) and integers too large to be exact stay text.
 */
export function inferScalar(s: string, emptyAsNull = true): string | number | boolean | null {
  const t = s.trim();
  if (t === "") return emptyAsNull ? null : s;
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (NUMBER.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n;
  }
  return s;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** `$.store.book[0]['first name']`. */
export function formatPath(path: Path): string {
  let out = "$";
  for (const p of path) {
    if (typeof p === "number") out += `[${p}]`;
    else if (IDENT.test(p)) out += `.${p}`;
    else out += `['${p.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
  }
  return out;
}

/** A one-line JSON preview of a value, cut at `max` characters. */
export function preview(value: unknown, max = 120): string {
  if (value === undefined) return "";
  const s = JSON.stringify(value) ?? String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Compares table cells: numbers as numbers, text naturally ("item 2" before "item 10"), empty last. */
export function compareCells(a: string, b: string): number {
  if (a === b) return 0;
  if (a.trim() === "") return 1;
  if (b.trim() === "") return -1;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return collator.compare(a, b);
}

/** Row indices in sorted order by one column (stable; empty cells stay last either way). */
export function sortOrder(rows: string[][], col: number, dir: "asc" | "desc"): number[] {
  const idx = rows.map((_, i) => i);
  idx.sort((x, y) => {
    const a = rows[x]?.[col] ?? "";
    const b = rows[y]?.[col] ?? "";
    const ea = a.trim() === "";
    const eb = b.trim() === "";
    if (ea !== eb) return ea ? 1 : -1;
    const c = compareCells(a, b);
    return (dir === "asc" ? c : -c) || x - y;
  });
  return idx;
}

/** Recursively replaces Date objects (TOML dates) with their ISO text. */
export function plain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) setKey(out, k, plain(v));
    return out;
  }
  return value;
}
