/**
 * Text diff: line by line (side by side or unified, with the changed words
 * highlighted inside changed lines), or word by word / character by character
 * inline. Built on jsdiff.
 */
import { createTwoFilesPatch, diffArrays, diffChars, diffWordsWithSpace } from "diff";

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

/** A piece of a line: unchanged, or changed (removed on the left, added on the right). */
export interface Piece {
  text: string;
  changed: boolean;
}

export interface Side {
  num: number;
  pieces: Piece[];
}

export interface Row {
  kind: "same" | "change" | "del" | "add";
  left?: Side;
  right?: Side;
}

export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function normalizer(o: DiffOptions): (s: string) => string {
  return (s) => {
    let v = o.ignoreWhitespace ? s.trim().replace(/\s+/g, " ") : s;
    if (o.ignoreCase) v = v.toLowerCase();
    return v;
  };
}

/** The changed words between two versions of a line. */
export function intraline(a: string, b: string, o: DiffOptions): { left: Piece[]; right: Piece[] } {
  const parts = diffWordsWithSpace(a, b, { ignoreCase: o.ignoreCase });
  const left: Piece[] = [];
  const right: Piece[] = [];
  for (const p of parts) {
    if (!p.added) left.push({ text: p.value, changed: p.removed });
    if (!p.removed) right.push({ text: p.value, changed: p.added });
  }
  return { left, right };
}

/** Line diff as rows for a side-by-side view; removed and added runs are paired line by line. */
export function lineRows(a: string, b: string, o: DiffOptions): Row[] {
  const la = splitLines(a);
  const lb = splitLines(b);
  const norm = normalizer(o);
  const parts = diffArrays(la, lb, { comparator: (x, y) => norm(x) === norm(y) });
  const rows: Row[] = [];
  let i = 0;
  let j = 0;
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (!p) continue;
    if (!p.added && !p.removed) {
      for (let n = 0; n < p.count; n++, i++, j++)
        rows.push({
          kind: "same",
          left: { num: i + 1, pieces: [{ text: la[i] ?? "", changed: false }] },
          right: { num: j + 1, pieces: [{ text: lb[j] ?? "", changed: false }] },
        });
      continue;
    }
    // A removal followed by an addition: pair them.
    const del = p.removed ? p.count : 0;
    const next = parts[k + 1];
    const add = p.added ? p.count : next?.added ? next.count : 0;
    if (p.removed && next?.added) k++;
    for (let n = 0; n < Math.max(del, add); n++) {
      const l = n < del ? la[i + n] : undefined;
      const r = n < add ? lb[j + n] : undefined;
      if (l !== undefined && r !== undefined) {
        const { left, right } = intraline(l, r, o);
        rows.push({
          kind: "change",
          left: { num: i + n + 1, pieces: left },
          right: { num: j + n + 1, pieces: right },
        });
      } else if (l !== undefined) {
        rows.push({ kind: "del", left: { num: i + n + 1, pieces: [{ text: l, changed: true }] } });
      } else if (r !== undefined) {
        rows.push({ kind: "add", right: { num: j + n + 1, pieces: [{ text: r, changed: true }] } });
      }
    }
    i += del;
    j += add;
  }
  return rows;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  same: number;
}

export function summarize(rows: Row[]): DiffSummary {
  const s = { added: 0, removed: 0, changed: 0, same: 0 };
  for (const r of rows) {
    if (r.kind === "add") s.added++;
    else if (r.kind === "del") s.removed++;
    else if (r.kind === "change") s.changed++;
    else s.same++;
  }
  return s;
}

/** Keeps `context` unchanged rows around each change; the rest collapse into a count. */
export function foldRows(rows: Row[], context: number): (Row | { kind: "fold"; count: number })[] {
  const keep = rows.map(() => false);
  rows.forEach((r, idx) => {
    if (r.kind === "same") return;
    for (let n = Math.max(0, idx - context); n <= Math.min(rows.length - 1, idx + context); n++)
      keep[n] = true;
  });
  const out: (Row | { kind: "fold"; count: number })[] = [];
  let hidden = 0;
  rows.forEach((r, idx) => {
    if (keep[idx]) {
      if (hidden) out.push({ kind: "fold", count: hidden });
      hidden = 0;
      out.push(r);
    } else hidden++;
  });
  if (hidden) out.push({ kind: "fold", count: hidden });
  return out;
}

export interface InlinePart {
  text: string;
  kind: "same" | "add" | "del";
}

/** Word or character diff, for prose or short strings. */
export function inlineDiff(
  a: string,
  b: string,
  mode: "word" | "char",
  o: DiffOptions,
): InlinePart[] {
  const parts =
    mode === "word"
      ? diffWordsWithSpace(a, b, { ignoreCase: o.ignoreCase })
      : diffChars(a, b, { ignoreCase: o.ignoreCase });
  return parts.map((p) => ({
    text: p.value,
    kind: p.added ? "add" : p.removed ? "del" : "same",
  }));
}

/** A unified patch (`git apply` / `patch -p0` compatible). */
export function unifiedPatch(
  a: string,
  b: string,
  nameA: string,
  nameB: string,
  context = 3,
): string {
  return createTwoFilesPatch(nameA, nameB, a, b, undefined, undefined, { context });
}
