/** Base64 of text (UTF-8) and files: encode, decode, wrap at 76, and guess a decoded file's type. */
import { fail, fromBase64, isUtf8, toBase64, utf8 } from "../_shared";

export interface EncodeOptions {
  urlSafe: boolean;
  /** Break lines every 76 characters (MIME, RFC 2045). Ignored for URL-safe output. */
  wrap: boolean;
}

/** Splits a string into lines of `width` characters. */
export function wrapLines(s: string, width = 76): string {
  if (width <= 0 || s.length <= width) return s;
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += width) lines.push(s.slice(i, i + width));
  return lines.join("\n");
}

export function encodeBytes(bytes: Uint8Array, opts: EncodeOptions): string {
  const b64 = toBase64(bytes, opts.urlSafe);
  return opts.wrap && !opts.urlSafe ? wrapLines(b64) : b64;
}

export function encodeText(text: string, opts: EncodeOptions): string {
  return encodeBytes(utf8(text), opts);
}

export interface Decoded {
  bytes: Uint8Array;
  /** The UTF-8 text, or null when the bytes are not text. */
  text: string | null;
  /** MIME type from a `data:` prefix, or guessed from the first bytes. */
  mime: string | null;
}

/** Decodes Base64 (either alphabet, with or without a `data:…;base64,` prefix). */
export function decode(input: string): Decoded {
  let body = input.trim();
  let mime: string | null = null;
  const m = /^data:([^;,]*)(?:;[^;,]*)*;base64,/i.exec(body);
  if (m) {
    mime = m[1] || null;
    body = body.slice(m[0].length);
  } else if (/^data:/i.test(body)) {
    fail(
      "This data URI is not Base64 (no ;base64, marker).",
      "Cette data URI n'est pas en Base64 (pas de marqueur ;base64,).",
    );
  }
  const bytes = fromBase64(body);
  const text = isUtf8(bytes) && !hasBinaryControls(bytes) ? new TextDecoder().decode(bytes) : null;
  return { bytes, text, mime: mime ?? sniffMime(bytes) };
}

/** Control bytes other than tab, newline, carriage return and form feed suggest binary data. */
function hasBinaryControls(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b < 0x20 && b !== 9 && b !== 10 && b !== 13 && b !== 12) return true;
  return false;
}

const MAGIC: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { mime: "image/bmp", bytes: [0x42, 0x4d] },
  { mime: "image/x-icon", bytes: [0x00, 0x00, 0x01, 0x00] },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: "application/gzip", bytes: [0x1f, 0x8b] },
  { mime: "audio/mpeg", bytes: [0x49, 0x44, 0x33] },
  { mime: "audio/ogg", bytes: [0x4f, 0x67, 0x67, 0x53] },
  { mime: "audio/wav", bytes: [0x57, 0x41, 0x56, 0x45], offset: 8 },
  { mime: "video/mp4", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: "font/woff2", bytes: [0x77, 0x4f, 0x46, 0x32] },
  { mime: "font/woff", bytes: [0x77, 0x4f, 0x46, 0x46] },
  { mime: "application/wasm", bytes: [0x00, 0x61, 0x73, 0x6d] },
];

/** The MIME type of common binary formats, from their magic number. */
export function sniffMime(bytes: Uint8Array): string | null {
  for (const m of MAGIC) {
    const at = m.offset ?? 0;
    if (bytes.length >= at + m.bytes.length && m.bytes.every((b, i) => bytes[at + i] === b))
      return m.mime;
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart();
  if (/^<svg[\s>]|^<\?xml[^>]*>\s*<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/gzip": "gz",
  "application/json": "json",
  "application/wasm": "wasm",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "text/plain": "txt",
  "text/html": "html",
  "text/css": "css",
};

/** A file name for decoded bytes, with an extension matching the type when known. */
export function fileNameFor(mime: string | null, base = "decoded"): string {
  return `${base}.${(mime && EXT[mime.toLowerCase()]) || "bin"}`;
}
