/**
 * HTML to Markdown with turndown, plus the GitHub extras turndown leaves out:
 * tables, strikethrough and task-list checkboxes. Scripts and styles are dropped.
 */
import TurndownService from "turndown";

export interface HtmlToMdOptions {
  headingStyle: "atx" | "setext";
  bullet: "-" | "*" | "+";
  codeBlockStyle: "fenced" | "indented";
  fence: "```" | "~~~";
  emDelimiter: "_" | "*";
  linkStyle: "inlined" | "referenced";
  gfm: boolean;
}

export const DEFAULTS: HtmlToMdOptions = {
  headingStyle: "atx",
  bullet: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "_",
  linkStyle: "inlined",
  gfm: true,
};

function cell(content: string, node: HTMLElement): string {
  const first = node.parentNode?.firstChild === node || !node.previousElementSibling;
  const text = content.replace(/\n+/g, " ").replace(/\|/g, "\\|").trim();
  return `${first ? "| " : " "}${text} |`;
}

function isHeaderRow(tr: HTMLElement): boolean {
  const parent = tr.parentNode as HTMLElement | null;
  if (parent?.nodeName === "THEAD") return true;
  // A first row made only of <th>, when the table has no <thead>.
  const table = parent?.nodeName === "TABLE" ? parent : (parent?.parentNode as HTMLElement | null);
  const firstRow = table?.querySelector("tr");
  return (
    firstRow === tr &&
    !table?.querySelector("thead") &&
    Array.from(tr.children).every((c) => c.nodeName === "TH")
  );
}

function gfm(td: TurndownService): void {
  td.addRule("strikethrough", {
    filter: ["del", "s", "strike" as keyof HTMLElementTagNameMap],
    replacement: (content) => `~~${content}~~`,
  });
  td.addRule("taskListItem", {
    filter: (node) =>
      node.nodeName === "INPUT" &&
      (node as HTMLInputElement).getAttribute("type") === "checkbox" &&
      node.parentNode?.nodeName === "LI",
    replacement: (_content, node) =>
      (node as HTMLInputElement).hasAttribute("checked") ? "[x]" : "[ ]",
  });
  td.addRule("tableCell", { filter: ["th", "td"], replacement: cell });
  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content, node) => {
      let out = `\n${content}`;
      if (isHeaderRow(node)) {
        const n = Array.from(node.children).length;
        out += `\n|${" --- |".repeat(n)}`;
      }
      return out;
    },
  });
  td.addRule("tableSection", {
    filter: ["thead", "tbody", "tfoot"],
    replacement: (content) => content,
  });
  td.addRule("table", {
    filter: "table",
    replacement: (content) => `\n\n${content.replace(/^\n+/, "")}\n\n`,
  });
}

/** List items with one space after the marker ("- item", "1. item") instead of turndown's aligned "-   item". */
function compactLists(td: TurndownService): void {
  td.addRule("compactListItem", {
    filter: "li",
    replacement: (content, node, options) => {
      const parent = node.parentNode as HTMLElement | null;
      let prefix = `${options.bulletListMarker ?? "-"} `;
      if (parent?.nodeName === "OL") {
        const start = parent.getAttribute("start");
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = `${start ? Number(start) + index : index + 1}. `;
      }
      const isParagraph = /\n$/.test(content);
      const body = (content.replace(/^\n+|\n+$/g, "") + (isParagraph ? "\n" : ""))
        // A task checkbox and its label: exactly one space between them.
        .replace(/^(\[[ x]\])\s*/, "$1 ")
        .replace(/\n/g, `\n${" ".repeat(prefix.length)}`);
      return prefix + body + (node.nextSibling ? "\n" : "");
    },
  });
}

export function htmlToMarkdown(html: string, o: HtmlToMdOptions): string {
  if (!html.trim()) return "";
  const td = new TurndownService({
    headingStyle: o.headingStyle,
    bulletListMarker: o.bullet,
    codeBlockStyle: o.codeBlockStyle,
    fence: o.fence,
    emDelimiter: o.emDelimiter,
    linkStyle: o.linkStyle,
    hr: "---",
  });
  td.remove(["script", "style", "noscript", "template", "head" as keyof HTMLElementTagNameMap]);
  compactLists(td);
  if (o.gfm) gfm(td);
  return td.turndown(html);
}
