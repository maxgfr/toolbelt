import { describe, expect, it } from "bun:test";
import { githubSlug, headings, renderMarkdown, tableOfContents } from "./logic";

const GFM = { gfm: true, breaks: false };

describe("markdown", () => {
  it("renders headings, emphasis and lists", () => {
    const html = renderMarkdown("# Title\n\nSome *em* and **strong**.\n\n- a\n- b", GFM);
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain("<li>a</li>");
  });

  it("renders GitHub tables and strikethrough only with GFM", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~";
    expect(renderMarkdown(md, GFM)).toContain("<table>");
    expect(renderMarkdown(md, GFM)).toContain("<del>gone</del>");
    expect(renderMarkdown(md, { gfm: false, breaks: false })).not.toContain("<table>");
  });

  it("turns single newlines into <br> on request", () => {
    expect(renderMarkdown("a\nb", { gfm: true, breaks: true })).toContain("<br>");
    expect(renderMarkdown("a\nb", GFM)).not.toContain("<br>");
  });

  it("renders empty input as nothing", () => {
    expect(renderMarkdown("", GFM)).toBe("");
    expect(tableOfContents("")).toBe("");
  });

  it("builds a table of contents with GitHub anchors", () => {
    const md = "# Intro\n\n## Getting *started*\n\n## Getting started\n\n### Café & co.";
    expect(headings(md).map((h) => h.slug)).toEqual([
      "intro",
      "getting-started",
      "getting-started-1",
      "café--co",
    ]);
    expect(tableOfContents(md)).toBe(
      "- [Intro](#intro)\n  - [Getting started](#getting-started)\n  - [Getting started](#getting-started-1)\n    - [Café & co.](#café--co)",
    );
    expect(githubSlug("Hello, World!")).toBe("hello-world");
  });
});
