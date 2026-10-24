/**
 * Markdown tables (GitHub flavour): build one from CSV, TSV or a JSON array,
 * aligned and padded so the source reads as a table too; or read one back.
 */

import { type Located, setKey } from "../_shared";
import { jsonToTable, parseCsv, tableToCsv } from "../csv/logic";
import { parseJson } from "../json/logic";

export type Align = "none" | "left" | "center" | "right";

export interface Grid {
  header: string[];
  rows: string[][];
}

export type Tabular =
  | { ok: true; grid: Grid; source: "json" | "csv" }
  | { ok: false; error: Located | "shape" };

/** CSV/TSV (delimiter detected, first row as header) or a JSON array, as a grid. */
export function readTabular(text: string): Tabular {
  const t = text.trim();
  if (t.startsWith("[") || t.startsWith("{")) {
    const p = parseJson(t);
    if (!p.ok) return { ok: false, error: p };
    const g = jsonToTable(p.value);
    return g.ok
      ? { ok: true, grid: { header: g.header, rows: g.rows }, source: "json" }
      : { ok: false, error: "shape" };
  }
  const c = parseCsv(text, "auto", true);
  return { ok: true, grid: { header: c.header, rows: c.rows }, source: "csv" };
}

const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]|\p{Extended_Pictographic}/u;

/** Columns a string takes in a monospace font: CJK and emoji count 2, combining marks 0. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (/\p{M}|\p{Emoji_Modifier}|\u200D|\uFE0F/u.test(ch)) continue;
    w += WIDE.test(ch) ? 2 : 1;
  }
  return w;
}

/** A cell as Markdown: pipes escaped, line breaks as <br>. */
export function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
}

function pad(s: string, width: number, align: Align): string {
  const gap = Math.max(0, width - displayWidth(s));
  if (align === "right") return " ".repeat(gap) + s;
  if (align === "center") {
    const left = Math.floor(gap / 2);
    return " ".repeat(left) + s + " ".repeat(gap - left);
  }
  return s + " ".repeat(gap);
}

function rule(width: number, align: Align): string {
  const w = Math.max(3, width);
  if (align === "left") return `:${"-".repeat(w - 1)}`;
  if (align === "right") return `${"-".repeat(w - 1)}:`;
  if (align === "center") return `:${"-".repeat(w - 2)}:`;
  return "-".repeat(w);
}

export function toMarkdown(grid: Grid, aligns: Align[], pretty: boolean): string {
  const n = grid.header.length;
  if (!n) return "";
  const cells = [grid.header, ...grid.rows].map((r) =>
    Array.from({ length: n }, (_, i) => escapeCell(r[i] ?? "")),
  );
  const al = (i: number): Align => aligns[i] ?? "none";
  const widths = Array.from({ length: n }, (_, i) =>
    pretty ? cells.reduce((w, r) => Math.max(w, displayWidth(r[i] ?? "")), 3) : 3,
  );
  const line = (r: string[]) =>
    `| ${r.map((c, i) => (pretty ? pad(c, widths[i] ?? 3, al(i)) : c)).join(" | ")} |`;
  const [head = [], ...body] = cells;
  const sep = `| ${widths.map((w, i) => rule(w, al(i))).join(" | ")} |`;
  return [line(head), sep, ...body.map(line)].join("\n");
}

const SEP_CELL = /^\s*:?-+:?\s*$/;

/** Splits a table line on unescaped pipes, dropping the outer ones. */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (ch === "|") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/<br\s*\/?>/gi, "\n"));
}

function isSeparator(line: string): boolean {
  if (!line.includes("-")) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => SEP_CELL.test(c));
}

function alignOf(cell: string): Align {
  const c = cell.trim();
  const l = c.startsWith(":");
  const r = c.endsWith(":");
  return l && r ? "center" : l ? "left" : r ? "right" : "none";
}

export type MdTable = { ok: true; grid: Grid; aligns: Align[] } | { ok: false };

/** The first Markdown table in a text (header line, then a `---|:-:` line, then rows). */
export function parseMarkdownTable(text: string): MdTable {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i++) {
    const head = lines[i] ?? "";
    const sep = lines[i + 1] ?? "";
    if (!head.includes("|") || !isSeparator(sep)) continue;
    const header = splitRow(head);
    const aligns = splitRow(sep).map(alignOf);
    if (aligns.length !== header.length) continue;
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length; j++) {
      const ln = lines[j] ?? "";
      if (!ln.trim() || !ln.includes("|")) break;
      const r = splitRow(ln);
      rows.push(Array.from({ length: header.length }, (_, k) => r[k] ?? ""));
    }
    return { ok: true, grid: { header, rows }, aligns };
  }
  return { ok: false };
}

export type Export = "csv" | "tsv" | "json";

/** A grid as CSV, TSV or a JSON array of objects keyed by the header. */
export function exportGrid(grid: Grid, as: Export): string {
  if (as !== "json") return tableToCsv(grid.header, grid.rows, as === "csv" ? "," : "\t", true);
  const items = grid.rows.map((r) => {
    const o: Record<string, string> = {};
    grid.header.forEach((h, i) => {
      setKey(o, h, r[i] ?? "");
    });
    return o;
  });
  return JSON.stringify(items, null, 2);
}
