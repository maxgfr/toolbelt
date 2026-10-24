/**
 * Conventional Commits 1.0.0: build the message (header, body, footers), check it, and write
 * the matching `git commit` command with every paragraph shell-quoted.
 */
import { shellQuote } from "../_shared";

export const TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

export interface CommitInput {
  type: string;
  scope: string;
  description: string;
  body: string;
  breaking: boolean;
  /** What breaks and how to migrate; goes in a BREAKING CHANGE: footer. */
  breakingNote: string;
  /** Issue numbers or references: "12, #34, org/repo#5". */
  closes: string;
  /** Free footers, one per line ("Reviewed-by: Ana", "Refs: #7"). */
  footers: string;
}

export const MAX_HEADER = 72;
export const SOFT_HEADER = 50;
export const BODY_WIDTH = 72;

export function header(c: CommitInput): string {
  const scope = c.scope.trim() ? `(${c.scope.trim()})` : "";
  return `${c.type.trim()}${scope}${c.breaking ? "!" : ""}: ${c.description.trim()}`;
}

/** Wraps prose at `width` columns; keeps blank lines, list items and indented lines as they are. */
export function wrap(text: string, width = BODY_WIDTH): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.length <= width || /^\s/.test(line)) return line;
      const bullet = /^([-*+]|\d+[.)])\s+/.exec(line)?.[0] ?? "";
      const pad = " ".repeat(bullet.length);
      const out: string[] = [];
      let cur = "";
      for (const word of line.slice(bullet.length).split(/\s+/)) {
        const prefix = out.length ? pad : bullet;
        if (cur && prefix.length + cur.length + 1 + word.length > width) {
          out.push(prefix + cur);
          cur = word;
        } else cur = cur ? `${cur} ${word}` : word;
      }
      if (cur) out.push((out.length ? pad : bullet) + cur);
      return out.join("\n");
    })
    .join("\n");
}

/** "12, #34 org/repo#5" → ["#12", "#34", "org/repo#5"]. */
export function issueRefs(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? `#${s}` : s));
}

export function footerLines(c: CommitInput): string[] {
  const lines: string[] = [];
  if (c.breaking && c.breakingNote.trim())
    lines.push(`BREAKING CHANGE: ${c.breakingNote.trim().replace(/\s*\n\s*/g, " ")}`);
  for (const ref of issueRefs(c.closes)) lines.push(`Closes ${ref}`);
  for (const f of c.footers.split("\n")) if (f.trim()) lines.push(f.trim());
  return lines;
}

/** The whole message: header, blank line, body, blank line, footers. */
export function buildMessage(c: CommitInput, wrapBody = true): string {
  const parts = [header(c)];
  const body = c.body.replace(/\r\n?/g, "\n").trim();
  if (body) parts.push(wrapBody ? wrap(body) : body);
  const footers = footerLines(c);
  if (footers.length) parts.push(footers.join("\n"));
  return parts.join("\n\n");
}

/** `git commit -m '…' -m '…'`: one -m per paragraph, which git joins with blank lines. */
export function gitCommand(message: string): string {
  const paragraphs = message
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return ["git commit", ...paragraphs.map((p) => `-m ${shellQuote(p)}`)].join(" ");
}

export type IssueCode =
  | "noType"
  | "badType"
  | "badScope"
  | "noDescription"
  | "headerTooLong"
  | "headerLong"
  | "capitalized"
  | "period"
  | "notImperative"
  | "breakingNoNote"
  | "badFooter";

export interface Issue {
  level: "error" | "warning";
  code: IssueCode;
  /** For notImperative: the suggested verb. For badFooter: the line. */
  detail?: string;
}

/** Common commit verbs, in the imperative. */
const VERBS = new Set(
  "add allow adjust align apply avoid build bump change check clarify clean cleanup close configure convert copy correct create debounce default delete deprecate disable document downgrade drop enable ensure expose extract fix format generate guard handle hide implement import improve include increase inline install introduce keep limit lint load log make mark merge migrate move normalize optimize pin polish prevent print redesign reduce refactor reformat release remove rename reorder replace require reset resolve restore restrict retry return revert rewrite rework run sanitize save set show simplify skip sort speed split stop store support switch sync test tidy track translate trim tweak unify update upgrade use validate wrap write".split(
    " ",
  ),
);

/** "added" → "add", "fixes" → "fix", "updating" → "update"; null when already fine or unknown. */
export function imperativeOf(word: string): string | null {
  const w = word.toLowerCase();
  if (VERBS.has(w)) return null;
  const candidates = [
    w.replace(/ied$/, "y"),
    w.replace(/ies$/, "y"),
    w.replace(/ed$/, ""),
    w.replace(/d$/, ""),
    w.replace(/(.)\1ed$/, "$1"),
    w.replace(/es$/, ""),
    w.replace(/s$/, ""),
    w.replace(/ing$/, ""),
    w.replace(/ing$/, "e"),
    w.replace(/(.)\1ing$/, "$1"),
  ];
  return candidates.find((c) => c !== w && VERBS.has(c)) ?? null;
}

export function validate(c: CommitInput): Issue[] {
  const out: Issue[] = [];
  const type = c.type.trim();
  const desc = c.description.trim();
  if (!type) out.push({ level: "error", code: "noType" });
  else if (!/^[a-z][a-z0-9-]*$/i.test(type)) out.push({ level: "error", code: "badType" });
  if (c.scope.trim() && !/^[\w./$@*-]+(?:\s*,\s*[\w./$@*-]+)*$/.test(c.scope.trim()))
    out.push({ level: "error", code: "badScope" });
  if (!desc) out.push({ level: "error", code: "noDescription" });
  const len = header(c).length;
  if (len > MAX_HEADER) out.push({ level: "error", code: "headerTooLong" });
  else if (len > SOFT_HEADER) out.push({ level: "warning", code: "headerLong" });
  if (desc) {
    if (/^[A-Z][a-z]/.test(desc)) out.push({ level: "warning", code: "capitalized" });
    if (/[.。]$/.test(desc)) out.push({ level: "warning", code: "period" });
    const first = /^[A-Za-z]+/.exec(desc)?.[0] ?? "";
    const verb = first ? imperativeOf(first) : null;
    if (verb) out.push({ level: "warning", code: "notImperative", detail: verb });
  }
  if (c.breaking && !c.breakingNote.trim()) out.push({ level: "warning", code: "breakingNoNote" });
  for (const f of c.footers.split("\n").map((s) => s.trim()))
    if (f && !/^(?:[\w-]+|BREAKING CHANGE)(?::\s|\s#)\S/.test(f))
      out.push({ level: "error", code: "badFooter", detail: f });
  return out;
}
