/**
 * Regex tester: every match with its position and capture groups (numbered
 * and named), the pattern as a JavaScript literal, and a few ready patterns.
 */
import { collectMatches, compileRegex, type RegexHint, regexHint } from "../_shared";

export interface Group {
  /** 1-based group number. */
  n: number;
  name: string | null;
  value: string | undefined;
}

export interface MatchRow {
  index: number;
  end: number;
  text: string;
  groups: Group[];
}

export type TestResult =
  | { ok: true; matches: MatchRow[]; truncated: boolean; groupNames: (string | null)[] }
  | { ok: false; message: string; hint: RegexHint };

/**
 * The capturing groups of a pattern, in order: a name for (?<name>…), null for
 * a plain (…). Escapes, character classes and non-capturing groups are skipped.
 */
export function captureGroups(pattern: string): (string | null)[] {
  const out: (string | null)[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "(") {
      if (pattern[i + 1] !== "?") out.push(null);
      else if (pattern[i + 2] === "<" && pattern[i + 3] !== "=" && pattern[i + 3] !== "!") {
        const end = pattern.indexOf(">", i + 3);
        out.push(end > 0 ? pattern.slice(i + 3, end) : null);
      }
    }
  }
  return out;
}

export function testRegex(pattern: string, flags: string, text: string, limit = 1000): TestResult {
  const c = compileRegex(pattern, flags);
  if (!c.ok) return { ok: false, message: c.message, hint: regexHint(c.message) };
  if (pattern === "") return { ok: true, matches: [], truncated: false, groupNames: [] };
  const names = captureGroups(pattern);
  const found = collectMatches(c.re, text, limit + 1);
  const matches = found.slice(0, limit).map((m) => ({
    index: m.index,
    end: m.index + m[0].length,
    text: m[0],
    groups: m.slice(1).map((value, k) => ({ n: k + 1, name: names[k] ?? null, value })),
  }));
  return { ok: true, matches, truncated: found.length > limit, groupNames: names };
}

/** The pattern as a JavaScript regex literal: /…/flags, with bare slashes escaped. */
export function toLiteral(pattern: string, flags: string): string {
  let body = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i] ?? "";
    if (c === "\\") {
      body += c + (pattern[i + 1] ?? "");
      i++;
    } else if (c === "/") body += "\\/";
    else if (c === "\n") body += "\\n";
    else if (c === "\r") body += "\\r";
    else body += c;
  }
  return `/${body || "(?:)"}/${flags}`;
}

export type PresetId = "email" | "url" | "ipv4" | "date" | "uuid" | "hex" | "time";

export const PRESETS: { id: PresetId; pattern: string; flags: string; sample: string }[] = [
  {
    id: "email",
    pattern: "[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]{2,}",
    flags: "g",
    sample: "Write to alice@example.com or bob.smith+news@mail.co.uk (not to @nobody).",
  },
  {
    id: "url",
    pattern: "https?:\\/\\/[^\\s/$.?#][^\\s]*?(?=[.,;:!?)]*(?:\\s|$))",
    flags: "gi",
    sample: "See https://example.com/docs?page=2#intro, or http://localhost:8080/api.",
  },
  {
    id: "ipv4",
    pattern:
      "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b",
    flags: "g",
    sample: "Gateway 192.168.1.1, DNS 8.8.8.8, invalid 256.1.1.1 and 10.0.0.300.",
  },
  {
    id: "date",
    pattern: "\\b(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])\\b",
    flags: "g",
    sample: "Released 2024-03-15, patched 2024-12-01; 2024-13-01 is not a date.",
  },
  {
    id: "uuid",
    pattern: "\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b",
    flags: "gi",
    sample: "id=3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0c3a ref=not-a-uuid-1234",
  },
  {
    id: "hex",
    pattern: "#(?:[0-9a-f]{3,4}){1,2}\\b",
    flags: "gi",
    sample: "color: #0f766e; background: #FFF; border: #12345; shadow: #00000080;",
  },
  {
    id: "time",
    pattern: "\\b(?<h>[01]?\\d|2[0-3]):(?<m>[0-5]\\d)(?::(?<s>[0-5]\\d))?\\b",
    flags: "g",
    sample: "Meet at 9:30 or 14:05:59 — not at 24:00 or 12:60.",
  },
];
