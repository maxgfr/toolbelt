/**
 * SVG helpers: intrinsic size (width / height / viewBox), forcing a render size, and a
 * conservative text-level cleanup (comments, metadata, editor namespaces, number rounding,
 * whitespace). Pure: works on the markup as text, no DOM.
 */
import { fail } from "../_shared";

const ROOT = /<svg\b[^>]*>/i;
const ATTR = /\s([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

export function rootTag(markup: string): string | null {
  return ROOT.exec(markup)?.[0] ?? null;
}

/** Attributes of a start tag. */
export function attrs(tag: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of tag.matchAll(ATTR)) out.set(m[1] as string, m[3] ?? m[4] ?? "");
  return out;
}

const UNITS: Record<string, number> = {
  "": 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  em: 16,
  rem: 16,
  ex: 8,
};

/** A CSS length in px ("12", "12px", "3mm", "1in"); null for %, auto or garbage. */
export function parseLength(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(s);
  if (!m) return null;
  const k = UNITS[(m[2] ?? "").toLowerCase()];
  const v = Number(m[1]) * (k ?? Number.NaN);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function parseViewBox(s: string | undefined): [number, number, number, number] | null {
  if (!s) return null;
  const n = s
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    n.length !== 4 ||
    n.some((x) => !Number.isFinite(x)) ||
    (n[2] as number) <= 0 ||
    (n[3] as number) <= 0
  )
    return null;
  return n as [number, number, number, number];
}

export interface SvgInfo {
  width: number;
  height: number;
  /** True when the size came from width/height or viewBox (not the 300×150 default). */
  known: boolean;
  viewBox: [number, number, number, number] | null;
}

/** The size the SVG renders at by default. Throws when there is no <svg> element. */
export function svgInfo(markup: string): SvgInfo {
  const tag = rootTag(markup);
  if (!tag)
    fail("No <svg> element found.", "Aucun élément <svg> trouvé.", "Kein <svg>-Element gefunden.");
  const a = attrs(tag);
  const vb = parseViewBox(a.get("viewBox"));
  const w = parseLength(a.get("width"));
  const h = parseLength(a.get("height"));
  if (w && h) return { width: w, height: h, known: true, viewBox: vb };
  if (vb) {
    const ratio = vb[2] / vb[3];
    if (w) return { width: w, height: w / ratio, known: true, viewBox: vb };
    if (h) return { width: h * ratio, height: h, known: true, viewBox: vb };
    return { width: vb[2], height: vb[3], known: true, viewBox: vb };
  }
  return { width: w ?? 300, height: h ?? 150, known: !!(w || h), viewBox: null };
}

function setAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name.replace(/[.:-]/g, "\\$&")}\\s*=\\s*)("[^"]*"|'[^']*')`, "i");
  if (re.test(tag)) return tag.replace(re, `$1"${value}"`);
  return tag.replace(/^<svg\b/i, `<svg ${name}="${value}"`);
}

/**
 * The markup with the root sized to w × h for rendering: sets width and height, adds a viewBox
 * from the original size when missing (so the drawing scales), and the SVG namespace (an <img>
 * refuses an SVG without it).
 */
export function withSize(markup: string, w: number, h: number): string {
  const tag = rootTag(markup);
  if (!tag)
    fail("No <svg> element found.", "Aucun élément <svg> trouvé.", "Kein <svg>-Element gefunden.");
  const info = svgInfo(markup);
  let t = tag;
  if (!info.viewBox)
    t = setAttr(t, "viewBox", `0 0 ${fmtNum(info.width, 3)} ${fmtNum(info.height, 3)}`);
  t = setAttr(t, "width", fmtNum(w, 3));
  t = setAttr(t, "height", fmtNum(h, 3));
  if (!/\sxmlns\s*=/.test(t)) t = setAttr(t, "xmlns", "http://www.w3.org/2000/svg");
  if (/\sxlink:href\s*=/.test(markup) && !/\sxmlns:xlink\s*=/.test(t))
    t = setAttr(t, "xmlns:xlink", "http://www.w3.org/1999/xlink");
  return markup.replace(tag, t);
}

/** Output pixel size from a scale factor or a target width (height follows the ratio). */
export function renderSize(
  info: SvgInfo,
  mode: "scale" | "width",
  scale: number,
  width: number,
): { w: number; h: number } {
  const ratio = info.height / info.width;
  let w = mode === "scale" ? info.width * scale : width;
  w = Math.max(1, Math.min(16384, Math.round(w)));
  const h = Math.max(1, Math.min(16384, Math.round(w * ratio)));
  return { w, h };
}

/* --- Cleanup --------------------------------------------------------------------------- */

/** Rounds to `d` decimals and prints without trailing zeros ("-0" → "0"). */
export function fmtNum(v: number, d: number): string {
  const s = Number(v.toFixed(Math.max(0, Math.min(10, d)))).toString();
  return s === "-0" ? "0" : s;
}

const NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

/** Rounds every number in a list or path, keeping the numbers apart where they touched. */
export function roundNumbers(s: string, d: number): string {
  return s.replace(NUM, (m, offset: number) => {
    const r = fmtNum(Number(m), d);
    const prev = s[offset - 1] ?? "";
    // "1.5.5" or "2-3": the original relied on the number boundary; keep one.
    return /[\d.]/.test(prev) && !r.startsWith("-") ? ` ${r}` : r;
  });
}

const GEOMETRY = new Set([
  "d",
  "points",
  "viewBox",
  "transform",
  "gradientTransform",
  "patternTransform",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "fx",
  "fy",
  "width",
  "height",
  "stroke-width",
  "font-size",
]);

const EDITORS = "inkscape|sodipodi|sketch|serif|figma|illustrator";
const EDITOR_NS = new RegExp(
  `\\sxmlns:(?:${EDITORS}|dc|cc|rdf|i|x|graph)\\s*=\\s*("[^"]*"|'[^']*')`,
  "g",
);
const EDITOR_ATTR = new RegExp(`\\s(?:${EDITORS}):[\\w.-]+\\s*=\\s*("[^"]*"|'[^']*')`, "g");
const EDITOR_EL = new RegExp(
  `<((?:${EDITORS}):[\\w.-]+)\\b[^>]*?(?:/>|>[\\s\\S]*?</\\1\\s*>)`,
  "g",
);

/** Blocks whose whitespace matters or that are not markup. */
const PROTECTED =
  /<(text|style|script|pre|textarea|title|desc|foreignObject)\b[\s\S]*?<\/\1\s*>|<!\[CDATA\[[\s\S]*?\]\]>/gi;

export interface CleanOptions {
  /** Decimals kept in geometry attributes; -1 to keep numbers as they are. */
  decimals: number;
}

/**
 * A light, safe SVG cleanup: removes the XML declaration, comments, a DOCTYPE without an
 * internal subset, <metadata>, editor elements/attributes/namespaces (Inkscape, Sodipodi,
 * Sketch, Illustrator, Serif, Figma), empty groups and defs; rounds geometry numbers; collapses
 * whitespace between tags. Text, styles and scripts are left as they are. Path data with arcs
 * keeps its numbers (their flags may be packed together).
 */
export function cleanSvg(markup: string, o: CleanOptions): string {
  if (!rootTag(markup))
    fail("No <svg> element found.", "Aucun élément <svg> trouvé.", "Kein <svg>-Element gefunden.");
  // Keep protected blocks aside.
  const kept: string[] = [];
  let s = markup.replace(PROTECTED, (m) => {
    kept.push(m);
    return `\uE000${kept.length - 1}\uE001`;
  });
  s = s
    .replace(/^﻿/, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^[>]*>/gi, "")
    .replace(/<metadata\b[^>]*?(?:\/>|>[\s\S]*?<\/metadata\s*>)/gi, "")
    .replace(EDITOR_EL, "")
    .replace(EDITOR_NS, "")
    .replace(EDITOR_ATTR, "");

  // Inside start tags: round numbers and tidy spaces.
  s = s.replace(
    /<([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g,
    (_m, name: string, list: string, self: string) => {
      const parts: string[] = [];
      for (const a of list.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        const key = a[1] as string;
        let v = (a[2] ?? a[3] ?? "").trim();
        if (o.decimals >= 0 && GEOMETRY.has(key) && !(key === "d" && /[aA]/.test(v)))
          v = roundNumbers(v, o.decimals);
        if (GEOMETRY.has(key)) v = v.replace(/\s+/g, " ");
        parts.push(`${key}="${v.replace(/"/g, "&quot;")}"`);
      }
      return `<${name}${parts.length ? ` ${parts.join(" ")}` : ""}${self ? "/" : ""}>`;
    },
  );

  // Empty containers, repeated until stable (nested empty groups).
  for (let i = 0; i < 5; i++) {
    const before = s;
    s = s.replace(/<(g|defs)>\s*<\/\1>|<(g|defs)\/>/g, "");
    if (s === before) break;
  }
  // Whitespace between tags (protected blocks count as tags here).
  s = s.replace(/([>\uE001])\s+(?=[<\uE000])/g, "$1").trim();
  return s.replace(/\uE000(\d+)\uE001/g, (_m, i: string) => kept[Number(i)] ?? "");
}

/** Bytes of a string in UTF-8. */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
