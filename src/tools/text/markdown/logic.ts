/**
 * Markdown to HTML with marked (GitHub-flavored by default), plus a table of
 * contents with GitHub-style anchors. Sanitizing is done by the view with
 * DOMPurify, which needs a DOM.
 */
import { Marked, type Tokens } from "marked";

export interface MarkdownOptions {
  gfm: boolean;
  breaks: boolean;
}

export function renderMarkdown(md: string, o: MarkdownOptions): string {
  return new Marked({ gfm: o.gfm, breaks: o.breaks }).parse(md, { async: false });
}

export interface Heading {
  depth: number;
  text: string;
  slug: string;
}

/** GitHub's anchor for a heading: lowercase, punctuation dropped, spaces to dashes. */
export function githubSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Plain text of inline markdown (for heading titles): drops emphasis, code ticks and link targets. */
function plain(s: string): string {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

export function headings(md: string): Heading[] {
  const seen = new Map<string, number>();
  const out: Heading[] = [];
  for (const t of new Marked().lexer(md)) {
    if (t.type !== "heading") continue;
    const h = t as Tokens.Heading;
    const text = plain(h.text);
    const base = githubSlug(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ depth: h.depth, text, slug: n ? `${base}-${n}` : base });
  }
  return out;
}

/** A nested Markdown list linking to every heading. */
export function tableOfContents(md: string): string {
  const hs = headings(md);
  if (!hs.length) return "";
  const min = Math.min(...hs.map((h) => h.depth));
  return hs.map((h) => `${"  ".repeat(h.depth - min)}- [${h.text}](#${h.slug})`).join("\n");
}
