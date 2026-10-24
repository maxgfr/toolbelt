/**
 * Hard wrap and unwrap. Paragraphs are separated by blank lines; list items
 * ("- ", "* ", "1. ") start their own paragraph and wrap with a hanging
 * indent. Widths count visible characters (graphemes), prefix included.
 */
import { graphemes, splitLines } from "../_shared";

export interface WrapOptions {
  width: number;
  /** Added to every output line (e.g. "> " or "// "). */
  prefix: string;
  /** Join the lines of each paragraph before wrapping (otherwise each line wraps on its own). */
  reflow: boolean;
  /** Cut words longer than the width (URLs are better left whole). */
  breakLongWords: boolean;
}

interface Paragraph {
  /** First-line lead: indentation and list marker. */
  lead: string;
  text: string;
}

const LIST = /^(\s*)([-*+•]|\d+[.)])\s+/;

function len(s: string): number {
  return graphemes(s).length;
}

/** Splits text into paragraphs (null = a blank line kept as is). */
function paragraphs(lines: string[], reflow: boolean): (Paragraph | null)[] {
  const out: (Paragraph | null)[] = [];
  let current: Paragraph | null = null;
  for (const line of lines) {
    if (!line.trim()) {
      current = null;
      out.push(null);
      continue;
    }
    const list = LIST.exec(line);
    if (reflow && current && !list) {
      current.text += ` ${line.trim()}`;
      continue;
    }
    const lead = list ? list[0] : (/^\s*/.exec(line)?.[0] ?? "");
    current = { lead, text: line.slice(lead.length).trim() };
    out.push(current);
    if (!reflow) current = null;
  }
  return out;
}

function wrapParagraph(p: Paragraph, o: WrapOptions): string[] {
  const hang = " ".repeat(len(p.lead));
  const room = (first: boolean) =>
    Math.max(1, o.width - len(o.prefix) - len(first ? p.lead : hang));
  const lines: string[] = [];
  let line = "";
  let lineLen = 0;
  const push = () => {
    lines.push((lines.length ? hang : p.lead) + line);
    line = "";
    lineLen = 0;
  };
  for (const word of p.text.split(/\s+/).filter(Boolean)) {
    let w = graphemes(word);
    if (lineLen && lineLen + 1 + w.length > room(!lines.length)) push();
    while (o.breakLongWords && w.length > room(!lines.length) && !lineLen) {
      const max = room(!lines.length);
      line = w.slice(0, max).join("");
      lineLen = max;
      w = w.slice(max);
      push();
    }
    if (!w.length) continue;
    line += (lineLen ? " " : "") + w.join("");
    lineLen += (lineLen ? 1 : 0) + w.length;
  }
  if (lineLen || !lines.length) push();
  return lines;
}

export function wrapText(text: string, o: WrapOptions): string {
  const out: string[] = [];
  for (const p of paragraphs(splitLines(text), o.reflow)) {
    if (!p) out.push(o.prefix.trimEnd());
    else for (const line of wrapParagraph(p, o)) out.push(o.prefix + line);
  }
  return out.join("\n");
}

/**
 * Joins the lines of each paragraph into one line, after removing `prefix`
 * (e.g. "> ") from the start of every line. Blank lines and list items stay.
 */
export function unwrapText(text: string, prefix: string): string {
  const p = prefix.trimEnd();
  const lines = splitLines(text).map((line) => {
    if (prefix && line.startsWith(prefix)) return line.slice(prefix.length);
    if (p && line.trimEnd() === p) return "";
    return line;
  });
  return paragraphs(lines, true)
    .map((para) => (para ? para.lead + para.text : ""))
    .join("\n");
}

export function longestLine(text: string): number {
  return splitLines(text).reduce((m, line) => Math.max(m, len(line)), 0);
}
