/** Placeholder images as SVG: a colored box with centered text, as markup or a data URI. */
import { asRecord, clampNum, cssColor, num, oneOf } from "../_shared";

export const FONTS = {
  sans: "system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "ui-monospace, monospace",
} as const;
export type Font = keyof typeof FONTS;
const FONT_IDS = Object.keys(FONTS) as Font[];

export const MAX_SIDE = 4000;

export type Placeholder = {
  w: number;
  h: number;
  bg: string;
  fg: string;
  /** Empty = "W×H". */
  text: string;
  /** Font size in px; 0 = fit automatically. */
  size: number;
  font: Font;
  bold: boolean;
};

export const DEFAULT: Placeholder = {
  w: 640,
  h: 360,
  bg: "#e2e8f0",
  fg: "#64748b",
  text: "",
  size: 0,
  font: "sans",
  bold: true,
};

export function cleanPlaceholder(raw: unknown): Placeholder {
  const r = asRecord(raw);
  return {
    w: Math.round(clampNum(r.w, 1, MAX_SIDE, DEFAULT.w)),
    h: Math.round(clampNum(r.h, 1, MAX_SIDE, DEFAULT.h)),
    bg: typeof r.bg === "string" ? r.bg : DEFAULT.bg,
    fg: typeof r.fg === "string" ? r.fg : DEFAULT.fg,
    text: typeof r.text === "string" ? r.text.slice(0, 200) : "",
    size: clampNum(r.size, 0, 1000, 0),
    font: oneOf(r.font, FONT_IDS, "sans"),
    bold: r.bold !== false,
  };
}

/** The text shown: the user's, or the dimensions. */
export function label(p: Placeholder): string {
  return p.text.trim() || `${p.w}×${p.h}`;
}

/** A font size that fits the text on one line with some margin (≈0.6 em per character). */
export function autoSize(w: number, h: number, text: string): number {
  const chars = Math.max(1, [...text].length);
  const byWidth = (w * 0.8) / (chars * 0.6);
  const byHeight = h * 0.5;
  return Math.max(1, Math.round(Math.min(byWidth, byHeight)));
}

export function fontSize(p: Placeholder): number {
  return p.size > 0 ? p.size : autoSize(p.w, p.h, label(p));
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  );
}

export function placeholderSvg(p: Placeholder): string {
  const t = label(p);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}">` +
    `<rect width="100%" height="100%" fill="${cssColor(p.bg)}"/>` +
    `<text x="50%" y="50%" fill="${cssColor(p.fg)}" font-family="${FONTS[p.font]}" font-size="${num(fontSize(p), 2)}"${p.bold ? ' font-weight="600"' : ""} text-anchor="middle" dominant-baseline="central">${escapeXml(t)}</text>` +
    "</svg>"
  );
}

/**
 * A compact, readable data URI: double quotes become single quotes, then only the characters
 * that need it are percent-encoded. Safe inside `url("…")` and HTML attributes.
 */
export function svgDataUri(svg: string): string {
  const body = encodeURIComponent(svg.replace(/"/g, "'"))
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/%2C/g, ",")
    .replace(/%3B/g, ";")
    .replace(/%27/g, "'");
  return `data:image/svg+xml,${body}`;
}

export function svgBase64Uri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

/** The canvas font for the PNG export (same look as the SVG). */
export function canvasFont(p: Placeholder): string {
  return `${p.bold ? "600 " : ""}${num(fontSize(p), 2)}px ${FONTS[p.font]}`;
}

export function fileName(p: Placeholder, ext: string): string {
  return `placeholder-${p.w}x${p.h}.${ext}`;
}

export const SIZES: { name: { en: string; fr: string; de: string }; w: number; h: number }[] = [
  { name: { en: "Square 400", fr: "Carré 400", de: "Quadrat 400" }, w: 400, h: 400 },
  { name: { en: "4:3 · 800×600", fr: "4:3 · 800×600", de: "4:3 · 800×600" }, w: 800, h: 600 },
  {
    name: { en: "16:9 · 1280×720", fr: "16:9 · 1280×720", de: "16:9 · 1280×720" },
    w: 1280,
    h: 720,
  },
  {
    name: { en: "Open Graph 1200×630", fr: "Open Graph 1200×630", de: "Open Graph 1200×630" },
    w: 1200,
    h: 630,
  },
  {
    name: { en: "Banner 1500×500", fr: "Bannière 1500×500", de: "Banner 1500×500" },
    w: 1500,
    h: 500,
  },
  { name: { en: "Avatar 128", fr: "Avatar 128", de: "Avatar 128" }, w: 128, h: 128 },
];
