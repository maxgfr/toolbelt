import { describe, expect, it } from "bun:test";
import { DEFAULTS, htmlToMarkdown } from "./logic";

describe("html-to-markdown", () => {
  it("converts headings, emphasis, links and lists", () => {
    const md = htmlToMarkdown(
      '<h1>Title</h1><p>Some <em>em</em>, <strong>bold</strong> and <a href="https://x.dev">a link</a>.</p><ul><li>one</li><li>two</li></ul>',
      DEFAULTS,
    );
    expect(md).toContain("# Title");
    expect(md).toContain("_em_");
    expect(md).toContain("**bold**");
    expect(md).toContain("[a link](https://x.dev)");
    expect(md).toContain("- one\n- two");
  });

  it("indents nested and ordered lists", () => {
    expect(htmlToMarkdown("<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>", DEFAULTS)).toBe(
      "- a\n  - b\n- c",
    );
    expect(htmlToMarkdown('<ol start="3"><li>x</li><li>y</li></ol>', DEFAULTS)).toBe("3. x\n4. y");
  });

  it("follows the heading, bullet and code block options", () => {
    const html = "<h2>Sub</h2><ul><li>x</li></ul><pre><code>let a = 1;</code></pre>";
    const md = htmlToMarkdown(html, {
      ...DEFAULTS,
      headingStyle: "setext",
      bullet: "*",
      codeBlockStyle: "indented",
    });
    expect(md).toContain("Sub\n---");
    expect(md).toMatch(/^\*\s+x$/m);
    expect(md).toContain("    let a = 1;");
    expect(htmlToMarkdown(html, { ...DEFAULTS, fence: "~~~" })).toContain("~~~\nlet a = 1;\n~~~");
  });

  it("converts tables, strikethrough and task lists with GitHub extras", () => {
    const html =
      "<table><thead><tr><th>Name</th><th>Qty</th></tr></thead><tbody><tr><td>A|B</td><td>2</td></tr></tbody></table>" +
      '<p><del>old</del></p><ul><li><input type="checkbox" checked> done</li><li><input type="checkbox"> todo</li></ul>';
    const md = htmlToMarkdown(html, DEFAULTS);
    expect(md).toContain("| Name | Qty |\n| --- | --- |\n| A\\|B | 2 |");
    expect(md).toContain("~~old~~");
    expect(md).toContain("[x] done");
    expect(md).toContain("[ ] todo");
  });

  it("drops scripts and styles and handles empty input", () => {
    expect(htmlToMarkdown("<script>alert(1)</script><style>p{}</style><p>hi</p>", DEFAULTS)).toBe(
      "hi",
    );
    expect(htmlToMarkdown("   ", DEFAULTS)).toBe("");
  });

  it("keeps Unicode text", () => {
    expect(htmlToMarkdown("<p>Café — 日本語 👍</p>", DEFAULTS)).toBe("Café — 日本語 👍");
  });
});
