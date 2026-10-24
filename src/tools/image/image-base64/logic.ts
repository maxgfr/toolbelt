/**
 * Image ↔ Base64 / data URI: encoding, decoding (data URI or raw Base64, format sniffed from
 * the bytes), and ready-to-paste CSS / HTML / Markdown snippets. Pure.
 */
import { fail, sniffImage } from "../_shared";

export function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(text: string): Uint8Array {
  let s = text.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s))
    fail(
      "This is not valid Base64 (only A–Z, a–z, 0–9, + / and = at the end).",
      "Ce n'est pas du Base64 valide (seulement A–Z, a–z, 0–9, + / et = à la fin).",
    );
  s = s.replace(/=+$/, "");
  if (s.length % 4 === 1) fail("Truncated Base64.", "Base64 tronqué.");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toDataUri(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export interface DecodedImage {
  mime: string;
  bytes: Uint8Array;
}

/**
 * Reads a data URI (Base64 or percent-encoded) or bare Base64 and checks that it is an image.
 * The type comes from the bytes when it can be recognized (a wrong declared type is fixed).
 */
export function parseImageInput(input: string): DecodedImage {
  const text = input.trim();
  if (!text) fail("Paste a data URI or Base64 text.", "Colle une data URI ou du texte Base64.");
  let declared = "";
  let bytes: Uint8Array;
  const m = /^data:([^,]*?),([\s\S]*)$/i.exec(text);
  if (m) {
    const meta = (m[1] ?? "").split(";").map((x) => x.trim());
    declared = (meta[0] ?? "").toLowerCase();
    const payload = m[2] ?? "";
    if (meta.some((x) => x.toLowerCase() === "base64"))
      bytes = base64ToBytes(decodeURIComponentSafe(payload));
    else bytes = new TextEncoder().encode(decodeURIComponentSafe(payload));
  } else {
    // Also accept `url("data:…")` copied from CSS.
    const css = /^url\(\s*["']?(data:[\s\S]*?)["']?\s*\)\s*;?$/i.exec(text);
    if (css) return parseImageInput(css[1] as string);
    bytes = base64ToBytes(text);
  }
  if (!bytes.length) fail("The data is empty.", "Les données sont vides.");
  const sniffed = sniffImage(bytes);
  const mime = sniffed || (declared.startsWith("image/") ? declared : "");
  if (!mime)
    fail(
      "These bytes are not a recognized image (PNG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO).",
      "Ces octets ne sont pas une image reconnue (PNG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO).",
    );
  return { mime, bytes };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    fail(
      "Malformed percent-encoding in the data URI.",
      "Encodage pourcent invalide dans la data URI.",
    );
  }
}

/** File extension for an image MIME type. */
export function extFor(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  return map[mime] ?? (mime.replace(/^image\//, "").replace(/[^a-z0-9]/g, "") || "img");
}

/** Short format name: "PNG", "JPEG", "SVG". */
export function formatName(mime: string): string {
  const e = extFor(mime);
  return e === "jpg" ? "JPEG" : e.toUpperCase();
}

/** Base64 size growth: 0.3333 = +33 %. */
export function overhead(bytes: number, chars: number): number {
  return bytes > 0 ? chars / bytes - 1 : 0;
}

function attrEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function cssSnippet(uri: string): string {
  return `background-image: url("${uri}");`;
}

export function imgSnippet(uri: string, w: number | null, h: number | null, alt: string): string {
  const size = w && h ? ` width="${w}" height="${h}"` : "";
  return `<img src="${uri}"${size} alt="${attrEscape(alt)}">`;
}

export function markdownSnippet(uri: string, alt: string): string {
  return `![${alt.replace(/[[\]]/g, "")}](${uri})`;
}
