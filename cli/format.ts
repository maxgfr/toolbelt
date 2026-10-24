/** Plain-text output helpers, so every command prints the same way. */

/** A number without locale grouping, rounded to `digits` decimals (trailing zeros dropped). */
export function num(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return String(n);
  const r = Number(n.toFixed(digits));
  return String(Object.is(r, -0) ? 0 : r);
}

/** A fixed-decimals amount (money): 2 decimals by default, no grouping. */
export function money(n: number, digits = 2): string {
  return (Object.is(n, -0) ? 0 : n).toFixed(digits);
}

/** Visible width of a string (counts code points, not UTF-16 units). */
function width(s: string): number {
  return [...s].length;
}

function padEnd(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - width(s)));
}

/** Aligned `label: value` lines. Undefined/null values are skipped. */
export function kv(pairs: [string, string | number | boolean | null | undefined][]): string {
  const rows = pairs.filter((p): p is [string, string | number | boolean] => p[1] != null);
  const w = Math.max(0, ...rows.map(([k]) => width(k)));
  return rows
    .map(([k, v]) => `${padEnd(`${k}:`, w + 1)} ${typeof v === "number" ? num(v) : v}`)
    .join("\n");
}

/** Space-aligned columns; the last column is not padded. An optional header row is underlined. */
export function table(rows: (string | number)[][], header?: string[]): string {
  const all = (header ? [header, ...rows] : rows).map((r) =>
    r.map((c) => (typeof c === "number" ? num(c) : c)),
  );
  if (!all.length) return "";
  const cols = Math.max(...all.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(...all.map((r) => width(r[i] ?? ""))),
  );
  const line = (r: string[]) =>
    r
      .map((c, i) => (i === r.length - 1 ? c : padEnd(c, widths[i] ?? 0)))
      .join("  ")
      .trimEnd();
  const out = all.map(line);
  if (header) out.splice(1, 0, widths.map((w) => "-".repeat(w)).join("  "));
  return out.join("\n");
}

/** JSON with bigint, Uint8Array (hex), Map, Set and Date made printable. */
export function toJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_k, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Uint8Array)
        return Array.from(v, (b) => b.toString(16).padStart(2, "0")).join("");
      if (v instanceof Map) return Object.fromEntries(v);
      if (v instanceof Set) return [...v];
      return v;
    },
    2,
  );
}
