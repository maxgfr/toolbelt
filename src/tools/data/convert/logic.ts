/**
 * JSON ↔ YAML ↔ TOML. Input format can be detected; every parser reports the
 * line and column of its first error. TOML dates become ISO text elsewhere.
 */
import { parse as parseToml, stringify as stringifyToml, TomlError } from "smol-toml";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { isPlainObject, type Located, plain } from "../_shared";
import { parseJson } from "../json/logic";

export type Format = "json" | "yaml" | "toml";
export type Indent = "2" | "4";

export type Parsed = { ok: true; value: unknown; format: Format } | ({ ok: false } & Located);

/** A best guess at the format of a text: valid JSON, then TOML-looking first line, else YAML. */
export function detect(text: string): Format {
  const t = text.trimStart();
  if (t.startsWith("{") || parseJson(t).ok) return "json";
  const first = t
    .split(/\r?\n/)
    .map((x) => x.trim())
    .find((x) => x && !x.startsWith("#"));
  if (first && /^(\[\[?[\w."' -]+\]\]?|[\w."'-]+\s*=)/.test(first) && !/^[\w"'-]+\s*:/.test(first))
    return "toml";
  return "yaml";
}

function firstLine(msg: string): string {
  return (msg.split("\n")[0] ?? msg).trim();
}

export function parseAs(text: string, format: Format): Parsed {
  if (format === "json") {
    const r = parseJson(text);
    return r.ok ? { ok: true, value: r.value, format } : r;
  }
  if (format === "toml") {
    try {
      return { ok: true, value: parseToml(text), format };
    } catch (err) {
      if (err instanceof TomlError)
        return {
          ok: false,
          message: firstLine(err.message).replace(/^Invalid TOML document:\s*/, ""),
          line: err.line,
          column: err.column,
        };
      return { ok: false, message: String(err), line: 1, column: 1 };
    }
  }
  try {
    const docs = parseAllDocuments(text);
    const list = Array.isArray(docs) ? docs : [];
    for (const d of list) {
      const e = d.errors[0];
      if (e) {
        const pos = e.linePos?.[0];
        return {
          ok: false,
          message: firstLine(e.message).replace(/ at line \d+, column \d+:?$/, ""),
          line: pos?.line ?? 1,
          column: pos?.col ?? 1,
        };
      }
    }
    // Several documents (---) become an array.
    const values = list.map((d) => d.toJS({ maxAliasCount: 1000 }) as unknown);
    const value = values.length === 1 ? values[0] : values.length ? values : null;
    return { ok: true, value, format };
  } catch (err) {
    // e.g. too many aliases (a "billion laughs" document).
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      line: 1,
      column: 1,
    };
  }
}

/** Parses with the given format, or detects it ("auto"). */
export function parseInput(text: string, format: Format | "auto"): Parsed {
  return parseAs(text, format === "auto" ? detect(text) : format);
}

export type Written = { ok: true; text: string; warning?: "nulls" } | { ok: false; error: string };

function hasNull(v: unknown): boolean {
  if (v === null) return true;
  if (Array.isArray(v)) return v.some(hasNull);
  if (isPlainObject(v)) return Object.values(v).some(hasNull);
  return false;
}

/** Writes a value in a format. TOML needs a table at the root and has no null. */
export function write(value: unknown, format: Format, indent: Indent = "2"): Written {
  const n = Number(indent);
  try {
    if (format === "json") return { ok: true, text: JSON.stringify(plain(value), null, n) ?? "" };
    if (format === "yaml")
      return { ok: true, text: stringifyYaml(plain(value), { indent: n, lineWidth: 0 }) };
    if (!isPlainObject(value)) return { ok: false, error: "root" };
    const text = stringifyToml(value);
    return hasNull(value) ? { ok: true, text, warning: "nulls" } : { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const EXTENSIONS: Record<Format, string> = { json: "json", yaml: "yaml", toml: "toml" };
