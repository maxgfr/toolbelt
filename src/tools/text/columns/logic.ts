/**
 * Column extraction from delimited text (CSV, TSV, logs…): parse with a known
 * or detected delimiter, honoring CSV quotes (fields with delimiters, doubled
 * quotes and newlines inside), pick columns with a spec like "1,3-4", and write
 * them back with any delimiter, quoting only where needed.
 */

export type Delimiter = "comma" | "tab" | "semicolon" | "pipe" | "spaces" | "custom";

const CHARS: Record<Exclude<Delimiter, "spaces" | "custom">, string> = {
  comma: ",",
  tab: "\t",
  semicolon: ";",
  pipe: "|",
};

/** The separator string of a delimiter ("spaces" splits on runs of spaces and tabs). */
export function delimiterString(d: Delimiter, custom: string): string | "spaces" {
  if (d === "spaces") return "spaces";
  if (d === "custom") return custom;
  return CHARS[d];
}

/** Rows of fields. With `quotes`, a field that starts with " runs to the matching quote ("" is a quote). */
export function parse(text: string, sep: string | "spaces", quotes: boolean): string[][] {
  const rows: string[][] = [];
  if (text === "" || sep === "") return text === "" ? [] : text.split(/\r\n|\r|\n/).map((l) => [l]);
  const spaces = sep === "spaces";
  let row: string[] = [];
  let field = "";
  let i = 0;
  let atFieldStart = true;
  const sepAt = (k: number): number => {
    if (spaces) {
      let n = 0;
      while (text[k + n] === " " || text[k + n] === "\t") n++;
      return n;
    }
    return text.startsWith(sep, k) ? sep.length : 0;
  };
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
    atFieldStart = true;
  };
  if (spaces) i = sepAt(0);
  while (i < text.length) {
    const c = text[i] ?? "";
    if (quotes && atFieldStart && c === '"') {
      // A quoted field: read up to the closing quote.
      i++;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        field += text[i];
        i++;
      }
      atFieldStart = false;
      continue;
    }
    if (c === "\r" || c === "\n") {
      endRow();
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      if (spaces) i += sepAt(i);
      continue;
    }
    const n = sepAt(i);
    if (n > 0) {
      // In space mode, spaces at the end of a line are not an empty last field.
      if (spaces && /^[\r\n]?$/.test(text[i + n] ?? "")) {
        i += n;
        continue;
      }
      row.push(field);
      field = "";
      atFieldStart = true;
      i += n;
      continue;
    }
    field += c;
    atFieldStart = false;
    i++;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** The delimiter that splits the first lines most consistently into several fields. */
export function detectDelimiter(text: string): Exclude<Delimiter, "custom"> {
  const sample = text
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim())
    .slice(0, 20)
    .join("\n");
  let best: Exclude<Delimiter, "custom"> = "comma";
  let bestScore = 0;
  for (const d of ["tab", "comma", "semicolon", "pipe"] as const) {
    const rows = parse(sample, CHARS[d], true);
    const counts = rows.map((r) => r.length);
    const max = Math.max(0, ...counts);
    if (max < 2) continue;
    const consistent = counts.every((c) => c === counts[0]);
    const score = (consistent ? 1000 : 0) + counts.filter((c) => c > 1).length * 10 + max;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  if (bestScore === 0 && /\S[ \t]+\S/.test(sample)) return "spaces";
  return best;
}

export type SpecItem = { from: number; to: number | null };

/**
 * A column selection: "2", "1,3", "2-4", "4-2" (reversed), "3-" (to the last),
 * "-2" (first to second). Columns are 1-based. Empty means every column.
 */
export function parseSpec(
  spec: string,
): { ok: true; items: SpecItem[] } | { ok: false; token: string } {
  const items: SpecItem[] = [];
  for (const raw of spec.split(/[,;\s]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(token);
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n < 1) return { ok: false, token };
      items.push({ from: n, to: n });
    } else if (m && (m[1] || m[2])) {
      const from = m[1] ? Number(m[1]) : 1;
      const to = m[2] ? Number(m[2]) : null;
      if (from < 1 || to === 0) return { ok: false, token };
      items.push({ from, to });
    } else return { ok: false, token };
  }
  return { ok: true, items };
}

/** 0-based column indexes for a spec and a table width. */
export function resolveSpec(items: SpecItem[], width: number): number[] {
  if (!items.length) return Array.from({ length: width }, (_, i) => i);
  const out: number[] = [];
  for (const it of items) {
    const to = it.to ?? Math.max(width, it.from);
    const step = to >= it.from ? 1 : -1;
    for (let c = it.from; step > 0 ? c <= to : c >= to; c += step) out.push(c - 1);
  }
  return out;
}

/** Compresses 0-based indexes back into a spec: [0,2,3,4] → "1,3-5". */
export function toSpec(indexes: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < indexes.length) {
    let j = i;
    while (j + 1 < indexes.length && (indexes[j + 1] ?? 0) === (indexes[j] ?? 0) + 1) j++;
    const a = (indexes[i] ?? 0) + 1;
    const b = (indexes[j] ?? 0) + 1;
    parts.push(j - i >= 2 ? `${a}-${b}` : j > i ? `${a},${b}` : `${a}`);
    i = j + 1;
  }
  return parts.join(",");
}

export function quoteField(f: string, sep: string): string {
  return (sep && f.includes(sep)) || /["\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f;
}

export interface ExtractOptions {
  trim: boolean;
  /** Quote output fields that contain the delimiter, a quote or a newline. */
  quote: boolean;
}

export function extract(
  rows: string[][],
  cols: number[],
  outSep: string,
  o: ExtractOptions,
): string {
  return rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? "";
          const t = o.trim ? v.trim() : v;
          return o.quote ? quoteField(t, outSep) : t;
        })
        .join(outSep),
    )
    .join("\n");
}
