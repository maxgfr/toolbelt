/**
 * Pure helpers shared by the image tools: localized errors, sizes, output formats, file names,
 * fitting dimensions, image format sniffing, CRC-32 and a minimal STORE-only ZIP writer.
 * No DOM, no Preact: everything here runs in bun tests.
 */
import { type L10n, l } from "../../i18n";

/* --- Errors ----------------------------------------------------------------- */

/** An error whose message the views can show in the current language. */
export class ImageError extends Error {
  readonly text: L10n;
  constructor(text: L10n) {
    super(text.en);
    this.text = text;
  }
}

export function fail(en: string, fr: string, de: string): never {
  throw new ImageError(l(en, fr, de));
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: L10n };

/** Runs `fn` and turns a thrown error into `{ ok: false }` (never throws). */
export function attempt<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    return { ok: false, error: errorL10n(err) };
  }
}

export function errorL10n(err: unknown): L10n {
  if (err instanceof ImageError) return err.text;
  const msg = err instanceof Error ? err.message : String(err);
  return { en: msg, fr: msg, de: msg };
}

/* --- Sizes ------------------------------------------------------------------ */

/** "512 B", "1.4 KB", "3.2 MB" (powers of 1024), in the given locale. */
export function formatSize(bytes: number, locale = "en-US"): string {
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(v);
  return `${n} ${units[i]}`;
}

/** Relative change from `before` to `after`: -0.4 means 40 % smaller. 0 when `before` is 0. */
export function sizeChange(before: number, after: number): number {
  return before > 0 ? (after - before) / before : 0;
}

/* --- Output formats --------------------------------------------------------- */

export type OutFormat = "jpeg" | "png" | "webp" | "avif";

export const FORMATS: OutFormat[] = ["jpeg", "png", "webp", "avif"];

export function mimeOf(f: OutFormat): string {
  return `image/${f}`;
}

export function extOf(f: OutFormat): string {
  return f === "jpeg" ? "jpg" : f;
}

export function formatLabel(f: OutFormat): string {
  return { jpeg: "JPEG", png: "PNG", webp: "WebP", avif: "AVIF" }[f];
}

/** True when the format takes a quality setting (PNG is lossless). */
export function hasQuality(f: OutFormat): boolean {
  return f !== "png";
}

/** True when the format cannot store transparency (it is flattened on a background). */
export function isOpaque(f: OutFormat): boolean {
  return f === "jpeg";
}

/** "photo.jpeg" → "photo"; ".hidden" stays; "" → "image". */
export function stem(name: string): string {
  const s = name.replace(/^.*[\\/]/, "");
  const dot = s.lastIndexOf(".");
  return (dot > 0 ? s.slice(0, dot) : s) || "image";
}

/** The output name for a file converted to `f`, with an optional suffix ("-800w"). */
export function outName(name: string, f: OutFormat, suffix = ""): string {
  return `${stem(name)}${suffix}.${extOf(f)}`;
}

/** Makes names unique for a ZIP: "a.jpg", "a.jpg" → "a.jpg", "a-2.jpg". */
export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((n) => {
    let candidate = n;
    let i = 2;
    while (seen.has(candidate.toLowerCase())) {
      const dot = n.lastIndexOf(".");
      candidate = dot > 0 ? `${n.slice(0, dot)}-${i}${n.slice(dot)}` : `${n}-${i}`;
      i++;
    }
    seen.add(candidate.toLowerCase());
    return candidate;
  });
}

/* --- Dimensions ------------------------------------------------------------- */

export interface Size {
  w: number;
  h: number;
}

/**
 * Scales (w, h) down to fit within maxW × maxH, keeping the aspect ratio; never upscales.
 * A limit of 0 (or less) means "no limit" on that side. Results are at least 1 px.
 */
export function fitWithin(w: number, h: number, maxW: number, maxH: number): Size {
  if (w <= 0 || h <= 0) return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  let s = 1;
  if (maxW > 0) s = Math.min(s, maxW / w);
  if (maxH > 0) s = Math.min(s, maxH / h);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/* --- Format sniffing -------------------------------------------------------- */

function ascii(b: Uint8Array, at: number, len: number): string {
  let s = "";
  for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i] as number);
  return s;
}

/** The image MIME type from the first bytes, or "" when unknown. */
export function sniffImage(b: Uint8Array): string {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(b, 0, 4) === "GIF8") return "image/gif";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (ascii(b, 0, 2) === "BM") return "image/bmp";
  if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "image/x-icon";
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (/^(heic|heix|hevc|mif1|msf1)$/.test(brand)) return "image/heic";
  }
  if (ascii(b, 0, 4) === "II*\0" || ascii(b, 0, 4) === "MM\0*") return "image/tiff";
  const head = ascii(b, 0, 512).replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head))
    return "image/svg+xml";
  return "";
}

/** Width and height read from the header bytes of PNG, GIF, JPEG, WebP and BMP files. */
export function imageDims(b: Uint8Array): Size | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const mime = sniffImage(b);
  try {
    switch (mime) {
      case "image/png":
        return ascii(b, 12, 4) === "IHDR" ? { w: dv.getUint32(16), h: dv.getUint32(20) } : null;
      case "image/gif":
        return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
      case "image/bmp":
        return { w: dv.getInt32(18, true), h: Math.abs(dv.getInt32(22, true)) };
      case "image/webp": {
        const kind = ascii(b, 12, 4);
        if (kind === "VP8X")
          return {
            w: 1 + (dv.getUint32(24, true) & 0xffffff),
            h: 1 + (dv.getUint32(27, true) & 0xffffff),
          };
        if (kind === "VP8L") {
          const bits = dv.getUint32(21, true);
          return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff) };
        }
        if (kind === "VP8 ")
          return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
        return null;
      }
      case "image/jpeg": {
        let p = 2;
        while (p + 9 < b.length) {
          if (b[p] !== 0xff) return null;
          const m = b[p + 1] as number;
          if (m === 0xff) {
            p++;
            continue;
          }
          if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) {
            p += 2;
            continue;
          }
          const len = dv.getUint16(p + 2);
          // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC).
          if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
            return { w: dv.getUint16(p + 7), h: dv.getUint16(p + 5) };
          p += 2 + len;
        }
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/* --- CRC-32 ----------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (IEEE 802.3, as used by ZIP and PNG). Pass a previous value to continue. */
export function crc32(bytes: Uint8Array, prev = 0): number {
  let c = (prev ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++)
    c = (CRC_TABLE[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* --- ZIP (STORE only) ------------------------------------------------------- */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** MS-DOS time and date words of a Date (local time, 2-second resolution, from 1980). */
export function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** A ZIP archive with the files stored uncompressed (images are already compressed). */
export function zipStore(entries: ZipEntry[], when = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(when);
  const names = entries.map((e) => enc.encode(e.name));
  let size = 22;
  for (const [i, e] of entries.entries()) {
    const n = (names[i] as Uint8Array).length;
    size += 30 + n + e.data.length + 46 + n;
  }
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  const offsets: number[] = [];
  const crcs: number[] = [];
  let p = 0;
  for (const [i, e] of entries.entries()) {
    const name = names[i] as Uint8Array;
    const crc = crc32(e.data);
    offsets.push(p);
    crcs.push(crc);
    dv.setUint32(p, 0x04034b50, true);
    dv.setUint16(p + 4, 20, true); // version needed
    dv.setUint16(p + 6, 0x0800, true); // UTF-8 names
    dv.setUint16(p + 8, 0, true); // STORE
    dv.setUint16(p + 10, time, true);
    dv.setUint16(p + 12, date, true);
    dv.setUint32(p + 14, crc, true);
    dv.setUint32(p + 18, e.data.length, true);
    dv.setUint32(p + 22, e.data.length, true);
    dv.setUint16(p + 26, name.length, true);
    dv.setUint16(p + 28, 0, true);
    out.set(name, p + 30);
    out.set(e.data, p + 30 + name.length);
    p += 30 + name.length + e.data.length;
  }
  const cdStart = p;
  for (const [i, e] of entries.entries()) {
    const name = names[i] as Uint8Array;
    dv.setUint32(p, 0x02014b50, true);
    dv.setUint16(p + 4, 20, true); // made by
    dv.setUint16(p + 6, 20, true);
    dv.setUint16(p + 8, 0x0800, true);
    dv.setUint16(p + 10, 0, true);
    dv.setUint16(p + 12, time, true);
    dv.setUint16(p + 14, date, true);
    dv.setUint32(p + 16, crcs[i] as number, true);
    dv.setUint32(p + 20, e.data.length, true);
    dv.setUint32(p + 24, e.data.length, true);
    dv.setUint16(p + 28, name.length, true);
    // extra, comment, disk, internal attrs: 0
    dv.setUint32(p + 38, 0, true); // external attrs
    dv.setUint32(p + 42, offsets[i] as number, true);
    out.set(name, p + 46);
    p += 46 + name.length;
  }
  dv.setUint32(p, 0x06054b50, true);
  dv.setUint16(p + 8, entries.length, true);
  dv.setUint16(p + 10, entries.length, true);
  dv.setUint32(p + 12, p - cdStart, true);
  dv.setUint32(p + 16, cdStart, true);
  return out;
}

/** Reads back a STORE-only ZIP (for tests and sanity checks): name → bytes. */
export function readZipStore(zip: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  let eocd = zip.length - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) fail("Not a ZIP file.", "Ce n'est pas un fichier ZIP.", "Keine ZIP-Datei.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50)
      fail("Broken ZIP directory.", "Répertoire ZIP cassé.", "Beschädigtes ZIP-Verzeichnis.");
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(off + 26, true);
    const lelen = dv.getUint16(off + 28, true);
    const data = zip.subarray(off + 30 + lnlen + lelen, off + 30 + lnlen + lelen + size);
    if (crc32(data) !== crc)
      fail("ZIP CRC mismatch.", "CRC ZIP incorrect.", "ZIP-CRC stimmt nicht überein.");
    out.set(name, data);
    p += 46 + nlen + elen + clen;
  }
  return out;
}

/* --- Colors ----------------------------------------------------------------- */

export type Rgb = [number, number, number];

export function toHex([r, g, b]: Rgb): string {
  const h = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** "#abc" or "#aabbcc" → [r, g, b]; null when invalid. */
export function parseHex(s: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  let x = m[1] as string;
  if (x.length === 3) x = [...x].map((c) => c + c).join("");
  const n = Number.parseInt(x, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
