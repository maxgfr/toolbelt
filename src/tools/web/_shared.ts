/** Pure helpers shared by several web tools: search folding, shell quoting, number output. */

/** Lowercase without accents, for search. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** True when every word of `query` appears in one of `fields` (accent- and case-insensitive). */
export function matchesQuery(query: string, ...fields: (string | number | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(fields.filter((f) => f !== undefined).join(" "));
  return words.every((w) => hay.includes(w));
}

/** Quotes a word for a POSIX shell: left bare when safe, else in single quotes. */
export function shellQuote(s: string): string {
  if (s !== "" && /^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** A number for code (CSS, colors): dot decimal, at most `digits` decimals, no trailing zeros. */
export function num(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "0";
  const r = Number(n.toFixed(digits));
  return String(Object.is(r, -0) ? 0 : r);
}
