/**
 * Data URIs (RFC 2397): `data:[<mime>][;charset=…][;base64],<data>`. Build one from bytes (Base64
 * or percent-encoded text), parse one back to bytes, and guess file extensions from MIME types.
 */
import { fail, fromBase64, isUtf8, toBase64 } from "../_shared";

export interface DataUri {
  /** The MIME type as written, `text/plain` when absent. */
  mime: string;
  charset: string | null;
  base64: boolean;
  bytes: Uint8Array;
}

/** Percent-decodes to bytes: `%XX` is one byte, any other character is its UTF-8. */
export function percentToBytes(s: string): Uint8Array {
  const out: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c === "%") {
      const hex = s.slice(i + 1, i + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex))
        fail(
          `Malformed percent sequence at character ${i + 1}.`,
          `Séquence pourcent malformée au caractère ${i + 1}.`,
        );
      out.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      const cp = s.codePointAt(i) as number;
      const ch = String.fromCodePoint(cp);
      out.push(...enc.encode(ch));
      i += ch.length - 1;
    }
  }
  return new Uint8Array(out);
}

export function parseDataUri(input: string): DataUri {
  const s = input.trim();
  if (!/^data:/i.test(s))
    fail("A data URI starts with “data:”.", "Une data URI commence par « data: ».");
  const comma = s.indexOf(",");
  if (comma < 0)
    fail(
      "Missing the comma between the header and the data.",
      "Il manque la virgule entre l'en-tête et les données.",
    );
  const params = s
    .slice(5, comma)
    .split(";")
    .map((p) => p.trim());
  const base64 = params.length > 1 && params.at(-1)?.toLowerCase() === "base64";
  if (base64) params.pop();
  const mime = (params[0] ?? "").toLowerCase() || "text/plain";
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime))
    fail(`“${params[0]}” is not a MIME type.`, `« ${params[0]} » n'est pas un type MIME.`);
  let charset: string | null = null;
  for (const p of params.slice(1)) {
    const m = /^charset=(.+)$/i.exec(p);
    if (m) charset = m[1] ?? null;
  }
  if (!params[0] && !charset) charset = "US-ASCII";
  const data = s.slice(comma + 1);
  // Base64 payloads are often wrapped or URL-escaped (e.g. %2B for +).
  const bytes = base64
    ? fromBase64(decodeURIComponentSafe(data).replace(/\s/g, ""))
    : percentToBytes(data);
  return { mime, charset, base64, bytes };
}

function decodeURIComponentSafe(s: string): string {
  if (!s.includes("%")) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Text types worth keeping readable (percent-encoded) instead of Base64. */
export function isTextMime(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    /^(image\/svg\+xml|application\/(json|xml|javascript|ld\+json|manifest\+json))$/.test(mime)
  );
}

export type DataEncoding = "base64" | "percent";

/**
 * A data URI for the bytes. Percent mode needs UTF-8 text and escapes only what would break a
 * URL or a quoted CSS `url("…")`; it is usually smaller than Base64 for SVG.
 */
export function buildDataUri(bytes: Uint8Array, mime: string, encoding: DataEncoding): string {
  const type = mime.trim() || "application/octet-stream";
  if (encoding === "percent") {
    if (!isUtf8(bytes))
      fail(
        "Percent encoding needs UTF-8 text; use Base64 for this file.",
        "L'encodage pourcent demande du texte UTF-8 ; utilise Base64 pour ce fichier.",
      );
    const text = new TextDecoder().decode(bytes);
    const body = encodeURIComponent(text).replace(/%(2F|3A|3D|3B|2C|40|21|24|2A|2B|3F|26)/g, (e) =>
      decodeURIComponent(e),
    );
    const cs = isTextMime(type) && !/charset=/i.test(type) ? ";charset=utf-8" : "";
    return `data:${type}${cs},${body}`;
  }
  return `data:${type};base64,${toBase64(bytes)}`;
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "text/plain": "txt",
  "text/html": "html",
  "text/css": "css",
  "text/csv": "csv",
  "text/markdown": "md",
  "text/javascript": "js",
  "application/javascript": "js",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/gzip": "gz",
  "application/wasm": "wasm",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** A file extension for a MIME type ("bin" when unknown). */
export function extFromMime(mime: string): string {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  return EXT[m] ?? (/^[a-z]+\/([a-z0-9]{2,5})$/.exec(m)?.[1] || "bin");
}

/** A MIME type from a file name, for files the browser gives no type. */
export function mimeFromName(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (!ext) return "application/octet-stream";
  if (ext === "jpeg") return "image/jpeg";
  for (const [mime, e] of Object.entries(EXT)) if (e === ext) return mime;
  return "application/octet-stream";
}

/** How much longer the URI is than the raw bytes, as a fraction (0.33 ≈ Base64). */
export function overhead(bytes: number, uriLength: number): number {
  return bytes ? uriLength / bytes - 1 : 0;
}

export function cssUrl(uri: string): string {
  return `url("${uri.replace(/"/g, "%22")}")`;
}

export function imgTag(uri: string, alt = ""): string {
  return `<img src="${uri.replace(/"/g, "%22")}" alt="${alt.replace(/"/g, "&quot;")}">`;
}
