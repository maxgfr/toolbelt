/**
 * .env ↔ JSON, following dotenv: `KEY=value`, optional `export`, comments,
 * single quotes (literal), double quotes (escapes, may span lines), backticks;
 * duplicate keys are reported (the last one wins, as in dotenv).
 */
import { isPlainObject, setKey } from "../_shared";

export interface EnvIssue {
  code: "no-equals" | "bad-key" | "unterminated";
  line: number;
  key?: string;
}

export interface Duplicate {
  key: string;
  lines: number[];
}

export interface EnvParsed {
  values: Record<string, string>;
  issues: EnvIssue[];
  duplicates: Duplicate[];
}

const KEY = /^[A-Za-z_][\w.-]*$/;
const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" };

function unescapeValue(s: string): string {
  return s.replace(/\\(.)/g, (all, c: string) => ESCAPES[c] ?? all);
}

export function parseEnv(text: string): EnvParsed {
  const lines = text.split(/\r?\n/);
  const values: Record<string, string> = {};
  const issues: EnvIssue[] = [];
  const seen = new Map<string, number[]>();
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    // Only the left side is trimmed: trailing spaces may open a multiline quoted value.
    const t = (lines[i] ?? "").trimStart();
    if (!t.trim() || t.startsWith("#")) continue;
    const body = t.replace(/^export\s+/, "");
    const eq = body.indexOf("=");
    if (eq < 0) {
      issues.push({ code: "no-equals", line: lineNo });
      continue;
    }
    const key = body.slice(0, eq).trim();
    if (!KEY.test(key)) {
      issues.push({ code: "bad-key", line: lineNo, key });
      continue;
    }
    let rest = body.slice(eq + 1).trimStart();
    let value: string;
    const q = rest[0];
    if (q === '"' || q === "'" || q === "`") {
      // Find the closing quote, possibly on a later line.
      let buf = rest;
      let j = i;
      let k = 1;
      let end = -1;
      for (;;) {
        for (; k < buf.length; k++) {
          if (q === '"' && buf[k] === "\\") k++;
          else if (buf[k] === q) {
            end = k;
            break;
          }
        }
        if (end >= 0 || j + 1 >= lines.length) break;
        j++;
        buf += `\n${lines[j] ?? ""}`;
      }
      if (end < 0) {
        issues.push({ code: "unterminated", line: lineNo, key });
        value = rest.slice(1);
      } else {
        const inner = buf.slice(1, end);
        value = q === '"' ? unescapeValue(inner) : inner;
        i = j;
      }
    } else {
      rest = rest.replace(/(^|\s+)#.*$/, "");
      value = rest.trim();
    }
    seen.set(key, [...(seen.get(key) ?? []), lineNo]);
    setKey(values, key, value);
  }
  const duplicates = [...seen]
    .filter(([, ls]) => ls.length > 1)
    .map(([key, ls]) => ({ key, lines: ls }));
  return { values, issues, duplicates };
}

const SAFE = /^[\w.\-/:@%+,]*$/;

/** A value as it should be written after `=`: bare when safe, else double-quoted and escaped. */
export function quoteValue(v: string): string {
  if (SAFE.test(v)) return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
}

export interface EnvWriteOptions {
  exportPrefix: boolean;
  sort: boolean;
}

export type EnvWritten =
  | { ok: true; text: string; badKeys: string[]; nested: string[] }
  | { ok: false };

/** A flat JSON object as .env lines. Nested values are written as JSON text. */
export function toEnv(value: unknown, o: EnvWriteOptions): EnvWritten {
  if (!isPlainObject(value)) return { ok: false };
  const keys = Object.keys(value);
  if (o.sort) keys.sort();
  const badKeys: string[] = [];
  const nested: string[] = [];
  const lines = keys.map((k) => {
    const v = value[k];
    if (!KEY.test(k)) badKeys.push(k);
    let out: string;
    if (v === null || v === undefined) out = "";
    else if (typeof v === "string") out = quoteValue(v);
    else if (typeof v === "number" || typeof v === "boolean") out = String(v);
    else {
      // Objects and arrays as JSON, single-quoted (literal) when possible.
      nested.push(k);
      const json = JSON.stringify(v);
      out = json.includes("'") ? quoteValue(json) : `'${json}'`;
    }
    return `${o.exportPrefix ? "export " : ""}${k}=${out}`;
  });
  return { ok: true, text: lines.length ? `${lines.join("\n")}\n` : "", badKeys, nested };
}
