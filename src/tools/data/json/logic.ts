/** JSON: validate (with the error's line and column), format, minify, sort keys. */

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line: number; column: number };

/** Line and column (1-based) of a character offset. */
export function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  return { line, column: offset - before.lastIndexOf("\n") };
}

export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const message = raw
      .replace(/\s*(?:in JSON )?at position \d+.*$/, "")
      .replace(/\s*\(line \d+ column \d+\)$/, "");
    const lc = /line (\d+) column (\d+)/.exec(raw);
    if (lc) return { ok: false, message, line: Number(lc[1]), column: Number(lc[2]) };
    const pos = /position (\d+)/.exec(raw);
    const offset = pos ? Number(pos[1]) : text.length;
    return { ok: false, message, ...position(text, offset) };
  }
}

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort((a, b) => a.localeCompare(b)))
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

export type Indent = "2" | "4" | "tab" | "min";

export function formatJson(value: unknown, indent: Indent, sort = false): string {
  const v = sort ? sortKeys(value) : value;
  if (indent === "min") return JSON.stringify(v);
  return JSON.stringify(v, null, indent === "tab" ? "\t" : Number(indent));
}

export interface JsonInfo {
  keys: number;
  depth: number;
  arrays: number;
  objects: number;
}

export function jsonInfo(value: unknown): JsonInfo {
  const info = { keys: 0, depth: 0, arrays: 0, objects: 0 };
  const walk = (v: unknown, d: number) => {
    info.depth = Math.max(info.depth, d);
    if (Array.isArray(v)) {
      info.arrays++;
      for (const x of v) walk(x, d + 1);
    } else if (v && typeof v === "object") {
      info.objects++;
      for (const x of Object.values(v)) {
        info.keys++;
        walk(x, d + 1);
      }
    }
  };
  walk(value, 0);
  return info;
}
