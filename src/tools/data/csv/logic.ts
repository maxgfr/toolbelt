/**
 * CSV ↔ JSON. CSV is read with Papa Parse (quotes, embedded line breaks,
 * delimiter detection); cells can be typed (numbers, booleans, null). JSON is
 * written back as CSV with nested objects flattened to dotted column names.
 */
import Papa from "papaparse";
import { inferScalar, isPlainObject, setKey } from "../_shared";
import { position } from "../json/logic";

export type Delimiter = "auto" | "," | ";" | "\t" | "|";
export type Shape = "objects" | "arrays";

export interface CsvIssue {
  kind: "quotes" | "fields";
  /** 1-based source line (quotes) or record number (fields, header included). */
  at: number;
  expected?: number;
  found?: number;
}

export interface CsvTable {
  header: string[];
  rows: string[][];
  delimiter: string;
  issues: CsvIssue[];
}

/** Header names made unique and non-empty: "", "id", "id" → "column1", "id", "id_2". */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw, i) => {
    let name = raw.trim() || `column${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n) {
      name = `${name}_${n + 1}`;
      seen.set(name, 1);
    }
    return name;
  });
}

export function parseCsv(text: string, delimiter: Delimiter, hasHeader: boolean): CsvTable {
  const res = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    delimiter: delimiter === "auto" ? "" : delimiter,
    skipEmptyLines: "greedy",
  });
  const data = res.data;
  const issues: CsvIssue[] = [];
  for (const e of res.errors)
    if (e.code === "MissingQuotes" || e.code === "InvalidQuotes")
      issues.push({ kind: "quotes", at: position(text, e.index ?? 0).line });
  const first = hasHeader ? (data[0] ?? []) : [];
  const rows = hasHeader ? data.slice(1) : data;
  const width = rows.reduce((w, r) => Math.max(w, r.length), first.length);
  const expected = hasHeader ? first.length : (data[0]?.length ?? 0);
  data.forEach((r, i) => {
    if (r.length !== expected)
      issues.push({ kind: "fields", at: i + 1, expected, found: r.length });
  });
  const header = uniqueNames(Array.from({ length: width }, (_, i) => first[i] ?? ""));
  return { header, rows, delimiter: res.meta.delimiter, issues };
}

/** Rows as JSON: objects keyed by the header, or arrays (header first when there is one). */
export function tableToJson(
  t: CsvTable,
  shape: Shape,
  infer: boolean,
  hasHeader: boolean,
): unknown[] {
  const cell = (s: string | undefined) => (infer ? inferScalar(s ?? "") : (s ?? ""));
  if (shape === "arrays") {
    const rows = t.rows.map((r) => r.map((c) => cell(c)));
    return hasHeader ? [t.header, ...rows] : rows;
  }
  return t.rows.map((r) => {
    const o: Record<string, unknown> = {};
    t.header.forEach((h, i) => {
      setKey(o, h, cell(r[i]));
    });
    return o;
  });
}

/** Nested objects become dotted keys: {a: {b: 1}} → {"a.b": 1}. Arrays stay values. */
export function flatten(
  obj: Record<string, unknown>,
  prefix = "",
  out = new Map<string, unknown>(),
) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) && Object.keys(v).length) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export type JsonTable = { ok: true; header: string[]; rows: string[][] } | { ok: false };

/** An array of objects, of arrays or of values (or one object) as a table. */
export function jsonToTable(value: unknown): JsonTable {
  const items = Array.isArray(value) ? value : isPlainObject(value) ? [value] : null;
  if (!items) return { ok: false };
  if (items.length && items.every(Array.isArray)) {
    const rows = (items as unknown[][]).map((r) => r.map(cellText));
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
    return { ok: true, header: Array.from({ length: width }, (_, i) => `column${i + 1}`), rows };
  }
  if (items.length && !items.some(isPlainObject))
    return { ok: true, header: ["value"], rows: items.map((v) => [cellText(v)]) };
  const flat = items.map((it) => (isPlainObject(it) ? flatten(it) : new Map([["value", it]])));
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const m of flat)
    for (const k of m.keys())
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
  return { ok: true, header: cols, rows: flat.map((m) => cols.map((c) => cellText(m.get(c)))) };
}

export function tableToCsv(
  header: string[],
  rows: string[][],
  delimiter: Delimiter,
  withHeader: boolean,
): string {
  return Papa.unparse(withHeader ? [header, ...rows] : rows, {
    delimiter: delimiter === "auto" ? "," : delimiter,
    newline: "\n",
  });
}
