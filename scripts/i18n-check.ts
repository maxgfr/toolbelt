/**
 * Lists strings that are missing their German: `l(en, fr)` calls with two arguments, and object
 * literals with an `fr:` key but no `de:` key; also `lang.value === "fr"`-style tests that
 * should use `locale()` or `pick()`. Usage: bun scripts/i18n-check.ts [dir…] (default: src).
 * Exits with 1 when anything is found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Index just after the string/template/regex-free token starting at `i`, or i + 1. */
function skipString(src: string, i: number): number {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return i + 1;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") j += 2;
    else if (c === q) return j + 1;
    else if (q === "`" && c === "$" && src[j + 1] === "{") {
      j = matchClose(src, j + 1) + 1;
    } else j++;
  }
  return j;
}

/** Index of the bracket closing the one at `open`. */
function matchClose(src: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const stack = [pairs[src[open] ?? ""] ?? ")"];
  let i = open + 1;
  while (i < src.length && stack.length) {
    const c = src[i] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) return src.length;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i) + 2;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c] ?? "");
    else if (c === stack[stack.length - 1]) stack.pop();
    if (!stack.length) return i;
    i++;
  }
  return i;
}

/** Number of top-level arguments between the parentheses at `open` and its match. */
function countArgs(src: string, open: number, close: number): number {
  let n = 0;
  let any = false;
  let i = open + 1;
  while (i < close) {
    const c = src[i] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      any = true;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") {
      i = matchClose(src, i) + 1;
      any = true;
      continue;
    }
    if (c === ",") {
      if (any) n++;
      any = false;
    } else if (!/\s/.test(c)) any = true;
    i++;
  }
  return n + (any ? 1 : 0);
}

function lineOf(src: string, i: number): number {
  return src.slice(0, i).split("\n").length;
}

export interface Finding {
  file: string;
  line: number;
  kind: "l-call" | "object" | "lang-test";
  text: string;
}

export function checkSource(file: string, src: string): Finding[] {
  const out: Finding[] = [];
  for (const m of src.matchAll(/(?<![\w.$])l\(/g)) {
    const open = (m.index ?? 0) + 1;
    const close = matchClose(src, open);
    if (countArgs(src, open, close) === 2)
      out.push({
        file,
        line: lineOf(src, open),
        kind: "l-call",
        text: src.slice(open - 1, Math.min(close + 1, open + 80)).replace(/\s+/g, " "),
      });
  }
  for (const m of src.matchAll(/[{,]\s*fr:\s*/g)) {
    // Find the object literal around this key.
    let depth = 0;
    let start = m.index ?? 0;
    for (let i = start; i >= 0; i--) {
      const c = src[i];
      if (c === "}" || c === ")" || c === "]") depth++;
      else if (c === "{" || c === "(" || c === "[") {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }
    if (src[start] !== "{") continue;
    const end = matchClose(src, start);
    const body = src.slice(start, end + 1);
    if (!/\ben\s*:/.test(body)) continue;
    // Only keys at the object's own level count.
    let flat = "";
    let i = 1;
    while (i < body.length - 1) {
      const c = body[i] ?? "";
      if (c === '"' || c === "'" || c === "`") {
        const j = skipString(body, i);
        flat += '""';
        i = j;
      } else if (c === "{" || c === "(" || c === "[") {
        i = matchClose(body, i) + 1;
        flat += "_";
      } else {
        flat += c;
        i++;
      }
    }
    if (!/(^|[\s,{])de\s*:/.test(flat))
      out.push({
        file,
        line: lineOf(src, start),
        kind: "object",
        text: body.slice(0, 80).replace(/\s+/g, " "),
      });
  }
  for (const m of src.matchAll(
    /lang\.(?:value|peek\(\))\s*[!=]==\s*"(?:fr|en)"|"(?:fr|en)"\s*[!=]==\s*lang\.(?:value|peek\(\))/g,
  ))
    out.push({ file, line: lineOf(src, m.index ?? 0), kind: "lang-test", text: m[0] });
  // Dedupe objects reported once per `fr:` key.
  const seen = new Set<string>();
  return out.filter((f) => {
    const k = `${f.kind}:${f.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function walk(dir: string, files: string[] = []): string[] {
  if (!statSync(dir).isDirectory()) return [...files, dir];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
  }
  return files;
}

if (import.meta.main) {
  const dirs = process.argv.slice(2);
  const findings = (dirs.length ? dirs : ["src"]).flatMap((d) =>
    walk(d).flatMap((f) => checkSource(f, readFileSync(f, "utf8"))),
  );
  for (const f of findings) console.log(`${f.file}:${f.line}  [${f.kind}]  ${f.text}`);
  console.log(findings.length ? `\n${findings.length} to fix` : "all strings have German");
  process.exit(findings.length ? 1 : 0);
}
