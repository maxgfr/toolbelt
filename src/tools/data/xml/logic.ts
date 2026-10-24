/**
 * XML without a DOM: a small parser that checks well-formedness (matching
 * tags, quoted attributes, entities, a single root) and reports the line and
 * column of the first problem; then pretty-print, minify, or convert to JSON.
 * Comments, CDATA sections, processing instructions and the doctype are kept.
 */

import { setKey } from "../_shared";
import { position } from "../json/logic";

export type XNode =
  | { t: "element"; name: string; attrs: Attr[]; children: XNode[]; selfClosing: boolean }
  | { t: "text"; v: string }
  | { t: "cdata"; v: string }
  | { t: "comment"; v: string }
  | { t: "pi"; v: string }
  | { t: "doctype"; v: string };

export interface Attr {
  name: string;
  value: string;
  quote: '"' | "'";
}

export type XmlErrorCode =
  | "unterminated"
  | "mismatch"
  | "unexpected-close"
  | "unclosed"
  | "text-outside"
  | "multiple-roots"
  | "no-root"
  | "bad-tag"
  | "bad-attr"
  | "dup-attr"
  | "missing-space"
  | "lt-in-attr"
  | "bad-entity"
  | "cdata-outside"
  | "decl-position";

export interface XmlError {
  code: XmlErrorCode;
  line: number;
  column: number;
  /** The tag, attribute or entity concerned. */
  name?: string;
  /** For "mismatch": the tag that should have been closed. */
  expected?: string;
}

export type XmlDoc =
  | { ok: true; nodes: XNode[]; root: XNode & { t: "element" } }
  | {
      ok: false;
      error: XmlError;
    };

const NAME = /^(?:[A-Za-z_:]|\P{ASCII})(?:[\w.:-]|\P{ASCII})*/u;
const ENTITY = /^&(?:([A-Za-z_:][\w.:-]*)|#\d+|#x[0-9A-Fa-f]+);/;
const BUILTIN = new Set(["amp", "lt", "gt", "quot", "apos"]);

class Fail extends Error {
  constructor(
    readonly info: Omit<XmlError, "line" | "column">,
    readonly at: number,
  ) {
    super(info.code);
  }
}

export function parseXml(src: string): XmlDoc {
  const text = src.replace(/^\uFEFF/, "");
  try {
    return parse(text);
  } catch (err) {
    if (!(err instanceof Fail)) throw err;
    return { ok: false, error: { ...err.info, ...position(text, err.at) } };
  }
}

function parse(s: string): XmlDoc {
  const top: XNode[] = [];
  const stack: (XNode & { t: "element" })[] = [];
  const opened: number[] = [];
  let root: (XNode & { t: "element" }) | null = null;
  let hasDoctype = false;
  let i = 0;
  const add = (n: XNode) => {
    const parent = stack[stack.length - 1];
    (parent ? parent.children : top).push(n);
  };
  const until = (end: string, from: number, what: string): number => {
    const j = s.indexOf(end, from);
    if (j < 0) throw new Fail({ code: "unterminated", name: what }, i);
    return j;
  };
  const checkEntities = (v: string, at: number) => {
    for (let k = v.indexOf("&"); k >= 0; k = v.indexOf("&", k + 1)) {
      const m = ENTITY.exec(v.slice(k, k + 64));
      if (!m || (m[1] && !BUILTIN.has(m[1]) && !hasDoctype))
        throw new Fail(
          { code: "bad-entity", name: m?.[0] ?? /^&[^\s<&;]*;?/.exec(v.slice(k))?.[0] ?? "&" },
          at + k,
        );
    }
  };

  while (i < s.length) {
    if (s[i] !== "<") {
      const j = s.indexOf("<", i);
      const end = j < 0 ? s.length : j;
      const v = s.slice(i, end);
      if (!stack.length) {
        if (v.trim())
          throw new Fail({ code: "text-outside" }, i + (v.length - v.trimStart().length));
      } else {
        checkEntities(v, i);
        add({ t: "text", v });
      }
      i = end;
      continue;
    }
    if (s.startsWith("<!--", i)) {
      const j = until("-->", i + 4, "comment");
      add({ t: "comment", v: s.slice(i + 4, j) });
      i = j + 3;
    } else if (s.startsWith("<![CDATA[", i)) {
      if (!stack.length) throw new Fail({ code: "cdata-outside" }, i);
      const j = until("]]>", i + 9, "cdata");
      add({ t: "cdata", v: s.slice(i + 9, j) });
      i = j + 3;
    } else if (s.startsWith("<!DOCTYPE", i) || s.startsWith("<!doctype", i)) {
      if (root || stack.length) throw new Fail({ code: "bad-tag", name: "!DOCTYPE" }, i);
      let j = i + 9;
      let depth = 0;
      let quote = "";
      for (; j < s.length; j++) {
        const c = s[j];
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      if (j >= s.length) throw new Fail({ code: "unterminated", name: "doctype" }, i);
      hasDoctype = true;
      add({ t: "doctype", v: s.slice(i, j + 1) });
      i = j + 1;
    } else if (s.startsWith("<?", i)) {
      const j = until("?>", i + 2, "pi");
      const v = s.slice(i, j + 2);
      if (/^<\?xml[\s?]/i.test(v) && i !== 0) throw new Fail({ code: "decl-position" }, i);
      add({ t: "pi", v });
      i = j + 2;
    } else if (s.startsWith("</", i)) {
      const m = NAME.exec(s.slice(i + 2));
      if (!m) throw new Fail({ code: "bad-tag" }, i);
      const name = m[0];
      let j = i + 2 + name.length;
      while (/\s/.test(s[j] ?? "")) j++;
      if (s[j] !== ">")
        throw new Fail({ code: s[j] === undefined ? "unterminated" : "bad-tag", name }, j);
      const open = stack[stack.length - 1];
      if (!open) throw new Fail({ code: "unexpected-close", name }, i);
      if (open.name !== name) throw new Fail({ code: "mismatch", name, expected: open.name }, i);
      stack.pop();
      opened.pop();
      i = j + 1;
    } else {
      const m = NAME.exec(s.slice(i + 1));
      if (!m) throw new Fail({ code: "bad-tag" }, i);
      const name = m[0];
      if (!stack.length && root) throw new Fail({ code: "multiple-roots", name }, i);
      const el: XNode & { t: "element" } = {
        t: "element",
        name,
        attrs: [],
        children: [],
        selfClosing: false,
      };
      let j = i + 1 + name.length;
      let selfClosing = false;
      for (;;) {
        const before = j;
        while (/\s/.test(s[j] ?? "")) j++;
        if (j >= s.length) throw new Fail({ code: "unterminated", name }, i);
        if (s.startsWith("/>", j)) {
          selfClosing = true;
          j += 2;
          break;
        }
        if (s[j] === ">") {
          j++;
          break;
        }
        if (j === before) throw new Fail({ code: "missing-space", name }, j);
        const an = NAME.exec(s.slice(j));
        if (!an) throw new Fail({ code: "bad-attr", name }, j);
        const attrName = an[0];
        const at = j;
        j += attrName.length;
        while (/\s/.test(s[j] ?? "")) j++;
        if (s[j] !== "=") throw new Fail({ code: "bad-attr", name: attrName }, j);
        j++;
        while (/\s/.test(s[j] ?? "")) j++;
        const q = s[j];
        if (q !== '"' && q !== "'") throw new Fail({ code: "bad-attr", name: attrName }, j);
        const close = s.indexOf(q, j + 1);
        if (close < 0) throw new Fail({ code: "unterminated", name: attrName }, j);
        const value = s.slice(j + 1, close);
        const lt = value.indexOf("<");
        if (lt >= 0) throw new Fail({ code: "lt-in-attr", name: attrName }, j + 1 + lt);
        checkEntities(value, j + 1);
        if (el.attrs.some((a) => a.name === attrName))
          throw new Fail({ code: "dup-attr", name: attrName }, at);
        el.attrs.push({ name: attrName, value, quote: q });
        j = close + 1;
      }
      el.selfClosing = selfClosing;
      add(el);
      if (!stack.length) root = el;
      if (!selfClosing) {
        stack.push(el);
        opened.push(i);
      }
      i = j;
    }
  }
  const open = stack[stack.length - 1];
  if (open) throw new Fail({ code: "unclosed", name: open.name }, opened[opened.length - 1] ?? 0);
  if (!root) throw new Fail({ code: "no-root" }, s.length);
  return { ok: true, nodes: top, root };
}

export interface WriteOptions {
  /** Indentation unit; "" writes everything on one line (minify). */
  indent: string;
  removeComments: boolean;
  /** Write empty elements as <a/>. */
  collapseEmpty: boolean;
}

function openTag(el: XNode & { t: "element" }): string {
  return `<${el.name}${el.attrs.map((a) => ` ${a.name}=${a.quote}${a.value}${a.quote}`).join("")}`;
}

function leaf(n: XNode): string {
  switch (n.t) {
    case "text":
      return n.v;
    case "cdata":
      return `<![CDATA[${n.v}]]>`;
    case "comment":
      return `<!--${n.v}-->`;
    default:
      return n.t === "element" ? "" : n.v;
  }
}

/** Pretty-prints (or minifies, with an empty indent) a parsed document. */
export function writeXml(nodes: XNode[], o: WriteOptions): string {
  const pretty = o.indent !== "";
  const keep = (n: XNode) =>
    !(n.t === "comment" && o.removeComments) && !(n.t === "text" && !n.v.trim());
  const lines: string[] = [];
  let flat = "";
  const emit = (depth: number, s: string) => {
    if (pretty) lines.push(o.indent.repeat(depth) + s);
    else flat += s;
  };
  const el = (n: XNode & { t: "element" }, depth: number) => {
    const kids = n.children.filter(keep);
    const head = openTag(n);
    if (!kids.length) {
      const self = o.collapseEmpty || (n.selfClosing && !n.children.length);
      emit(depth, self ? `${head}/>` : `${head}></${n.name}>`);
      return;
    }
    if (kids.every((k) => k.t === "text" || k.t === "cdata")) {
      // Text-only content is written as is: its spaces may matter.
      const content = n.children.filter((k) => k.t === "text" || k.t === "cdata").map(leaf);
      emit(depth, `${head}>${content.join("")}</${n.name}>`);
      return;
    }
    emit(depth, `${head}>`);
    for (const k of kids) node(k, depth + 1);
    emit(depth, `</${n.name}>`);
  };
  const node = (n: XNode, depth: number) => {
    if (n.t === "element") el(n, depth);
    else if (n.t === "text") emit(depth, pretty ? n.v.trim() : n.v);
    else emit(depth, leaf(n));
  };
  for (const n of nodes.filter(keep)) node(n, 0);
  return pretty ? lines.join("\n") : flat;
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9A-Fa-f]+|#\d+|[A-Za-z]+);/g, (all, e: string) => {
    if (!e.startsWith("#")) return NAMED[e] ?? all;
    const cp = e.startsWith("#x") ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : all;
  });
}

/**
 * XML as JSON: attributes as "@name", text as "#text" (or the value itself when an
 * element has only text), repeated child elements as arrays.
 */
export function xmlToJson(root: XNode & { t: "element" }): Record<string, unknown> {
  const conv = (n: XNode & { t: "element" }): unknown => {
    const out: Record<string, unknown> = {};
    for (const a of n.attrs) setKey(out, `@${a.name}`, decodeEntities(a.value));
    let text = "";
    let hasChild = false;
    for (const c of n.children) {
      if (c.t === "text") text += decodeEntities(c.v);
      else if (c.t === "cdata") text += c.v;
      else if (c.t === "element") {
        hasChild = true;
        const v = conv(c);
        // conv() never returns an array, so an array here is one we built.
        const prev = Object.hasOwn(out, c.name) ? out[c.name] : undefined;
        if (prev === undefined) setKey(out, c.name, v);
        else if (Array.isArray(prev)) prev.push(v);
        else setKey(out, c.name, [prev, v]);
      }
    }
    const t = hasChild ? text.trim() : text.trim() ? text : "";
    if (!n.attrs.length && !hasChild) return t;
    if (t) setKey(out, "#text", t);
    return out;
  };
  const out: Record<string, unknown> = {};
  setKey(out, root.name, conv(root));
  return out;
}

export interface XmlStats {
  elements: number;
  attributes: number;
  depth: number;
}

export function xmlStats(root: XNode & { t: "element" }): XmlStats {
  const st = { elements: 0, attributes: 0, depth: 0 };
  const walk = (n: XNode, d: number) => {
    if (n.t !== "element") return;
    st.elements++;
    st.attributes += n.attrs.length;
    st.depth = Math.max(st.depth, d);
    for (const c of n.children) walk(c, d + 1);
  };
  walk(root, 1);
  return st;
}
