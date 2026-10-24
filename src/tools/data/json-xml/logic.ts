/**
 * JSON ↔ XML. JSON → XML follows the usual convention: keys starting with "@" become
 * attributes, "#text" the element's text ("#cdata" a CDATA section), arrays repeated elements.
 * XML → JSON reuses the parser of the xml tool, with optional typed values.
 */
import { inferScalar, isPlainObject, setKey } from "../_shared";
import { parseXml, type XmlDoc, xmlToJson } from "../xml/logic";

export interface ToXmlOptions {
  /** Root element name; "" = the single top-level key when there is one, "root" otherwise. */
  root: string;
  /** Indentation unit; "" writes everything on one line. */
  indent: string;
  /** Start with <?xml version="1.0" encoding="UTF-8"?>. */
  declaration: boolean;
}

export interface ToXmlResult {
  xml: string;
  /** Keys that were not valid XML names, with the name used instead. */
  renamed: [string, string][];
}

const NAME_START = /[A-Za-z_À-ÖØ-öø-˿Ͱ-ͽͿ-῿]/;
const NAME_CHAR = /[\w.\-·À-ÖØ-öø-ͽͿ-῿‿⁀]/;

/** A valid XML element or attribute name close to `s` (":" is kept for namespaces). */
export function xmlName(s: string): string {
  let out = "";
  for (const ch of s) out += NAME_CHAR.test(ch) || ch === ":" ? ch : "_";
  if (!out || !NAME_START.test(out[0] ?? "")) out = `_${out}`;
  return out;
}

export function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;").replace(/\n/g, "&#10;").replace(/\t/g, "&#9;");
}

function scalar(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** JSON → XML text. */
export function jsonToXml(value: unknown, o: ToXmlOptions): ToXmlResult {
  const renamed = new Map<string, string>();
  const name = (k: string) => {
    const n = xmlName(k);
    if (n !== k) renamed.set(k, n);
    return n;
  };
  const pretty = o.indent !== "";
  const out: string[] = [];
  const line = (depth: number, s: string) => out.push(pretty ? o.indent.repeat(depth) + s : s);

  const element = (tag: string, v: unknown, depth: number): void => {
    if (Array.isArray(v)) {
      // Arrays repeat the element; an array inside an array gets <item> children.
      for (const item of v)
        if (Array.isArray(item)) element(tag, { item }, depth);
        else element(tag, item, depth);
      return;
    }
    if (!isPlainObject(v)) {
      const t = scalar(v);
      line(depth, t === "" ? `<${tag}/>` : `<${tag}>${escapeText(t)}</${tag}>`);
      return;
    }
    let attrs = "";
    let text = "";
    let cdata: string | null = null;
    const kids: [string, unknown][] = [];
    for (const [k, child] of Object.entries(v)) {
      if (k.startsWith("@") && k.length > 1)
        attrs += ` ${name(k.slice(1))}="${escapeAttr(scalar(child))}"`;
      else if (k === "#text") text += scalar(child);
      else if (k === "#cdata") cdata = (cdata ?? "") + scalar(child);
      else kids.push([k, child]);
    }
    const content =
      escapeText(text) +
      (cdata === null ? "" : `<![CDATA[${cdata.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`);
    if (!kids.length) {
      line(depth, content ? `<${tag}${attrs}>${content}</${tag}>` : `<${tag}${attrs}/>`);
      return;
    }
    line(depth, `<${tag}${attrs}>`);
    if (content) line(depth + 1, content);
    for (const [k, child] of kids) element(name(k), child, depth + 1);
    line(depth, `</${tag}>`);
  };

  let rootTag = o.root.trim();
  let body: unknown = value;
  if (!rootTag) {
    const keys = isPlainObject(value) ? Object.keys(value) : [];
    const only = keys[0];
    if (keys.length === 1 && only !== undefined && !only.startsWith("@") && !only.startsWith("#")) {
      const inner = (value as Record<string, unknown>)[only];
      if (!Array.isArray(inner)) {
        rootTag = only;
        body = inner;
      }
    }
  }
  if (!rootTag) rootTag = "root";
  const tag = name(rootTag);
  // A root array becomes <item> children of the root element.
  element(tag, Array.isArray(body) ? { item: body } : body, 0);
  const xml = (o.declaration ? ['<?xml version="1.0" encoding="UTF-8"?>'] : [])
    .concat(pretty ? out : [out.join("")])
    .join(pretty ? "\n" : "");
  return { xml: `${xml}${pretty ? "\n" : ""}`, renamed: [...renamed] };
}

/** Numbers, booleans and null in text become JSON values ("007" stays text). */
export function typeValues(v: unknown): unknown {
  if (typeof v === "string") return inferScalar(v, false);
  if (Array.isArray(v)) return v.map(typeValues);
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) setKey(out, k, typeValues(x));
    return out;
  }
  return v;
}

export type FromXmlResult =
  | { ok: true; value: unknown }
  | { ok: false; error: Extract<XmlDoc, { ok: false }>["error"] };

/** XML text → JSON value ("@attr", "#text", arrays for repeated elements). */
export function xmlToJsonValue(xml: string, typed: boolean): FromXmlResult {
  const doc = parseXml(xml);
  if (!doc.ok) return { ok: false, error: doc.error };
  const value = xmlToJson(doc.root);
  return { ok: true, value: typed ? typeValues(value) : value };
}

/** "json" when the text looks like JSON, "xml" when it starts with "<", null otherwise. */
export function detect(text: string): "json" | "xml" | null {
  const t = text.trimStart();
  if (t.startsWith("<")) return "xml";
  if (/^[{["\d-]|^(true|false|null)\b/.test(t)) return "json";
  return null;
}
