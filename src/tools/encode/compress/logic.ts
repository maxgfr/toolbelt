/**
 * gzip / zlib (deflate) / raw deflate with the browser's CompressionStream and
 * DecompressionStream, plus format detection from the magic bytes. Pure: no DOM, no Preact.
 */
import { fail, fromBase64, fromHex, fromUtf8 } from "../_shared";

export type Format = "gzip" | "deflate" | "deflate-raw";
export const FORMATS: readonly Format[] = ["gzip", "deflate", "deflate-raw"];

async function pipe(data: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export function compress(data: Uint8Array, format: Format): Promise<Uint8Array> {
  return pipe(data, new CompressionStream(format));
}

/** Decompresses; a bad header, a corrupted stream or a truncated one gives a bilingual error. */
export async function decompress(data: Uint8Array, format: Format): Promise<Uint8Array> {
  if (!data.length) fail("Nothing to decompress.", "Rien à décompresser.");
  try {
    return await pipe(data, new DecompressionStream(format));
  } catch {
    const name = formatName(format);
    return fail(
      `This is not valid ${name} data (or it is truncated or corrupted).`,
      `Ce ne sont pas des données ${name} valides (ou elles sont tronquées ou corrompues).`,
    );
  }
}

export function formatName(format: Format): string {
  return format === "gzip" ? "gzip" : format === "deflate" ? "zlib (deflate)" : "raw deflate";
}

/** The usual file extension for each format. */
export function extension(format: Format): string {
  return format === "gzip" ? ".gz" : format === "deflate" ? ".zz" : ".deflate";
}

/**
 * Guesses the format from the first bytes: gzip starts with 1F 8B 08, zlib with a CMF byte of
 * method 8 whose 16-bit header is a multiple of 31. Anything else may be raw deflate (which has
 * no header), so it is the fallback.
 */
export function detectFormat(data: Uint8Array): Format {
  const [a, b, c] = data;
  if (a === 0x1f && b === 0x8b && c === 0x08) return "gzip";
  if (
    a !== undefined &&
    b !== undefined &&
    (a & 0x0f) === 8 &&
    a >> 4 <= 7 &&
    (a * 256 + b) % 31 === 0
  )
    return "deflate";
  return "deflate-raw";
}

/**
 * Decompresses with the detected format. A raw deflate stream can look like a zlib header by
 * chance, so a failed zlib attempt falls back to raw deflate before giving up.
 */
export async function decompressAuto(
  data: Uint8Array,
): Promise<{ format: Format; bytes: Uint8Array }> {
  const format = detectFormat(data);
  try {
    return { format, bytes: await decompress(data, format) };
  } catch (err) {
    if (format !== "deflate") throw err;
    try {
      return { format: "deflate-raw", bytes: await decompress(data, "deflate-raw") };
    } catch {
      throw err;
    }
  }
}

export interface GzipHeader {
  /** Modification time stored by the compressor, if any. */
  mtime: Date | null;
  /** Original file name (FNAME), if stored. */
  name: string | null;
  os: string;
}

const OS = [
  "FAT",
  "Amiga",
  "VMS",
  "Unix",
  "VM/CMS",
  "Atari",
  "HPFS",
  "Macintosh",
  "Z-System",
  "CP/M",
  "TOPS-20",
  "NTFS",
  "QDOS",
  "Acorn RISCOS",
];

/** Reads the optional fields of a gzip header (RFC 1952). Null when it is not gzip. */
export function gzipHeader(data: Uint8Array): GzipHeader | null {
  if (data.length < 10 || data[0] !== 0x1f || data[1] !== 0x8b) return null;
  const flags = data[3] as number;
  const t = new DataView(data.buffer, data.byteOffset + 4, 4).getUint32(0, true);
  const osByte = data[9] as number;
  let p = 10;
  if (flags & 4) {
    if (data.length < p + 2) return null;
    p += 2 + ((data[p] as number) | ((data[p + 1] as number) << 8));
  }
  let name: string | null = null;
  if (flags & 8) {
    const end = data.indexOf(0, p);
    if (end < 0) return null;
    // FNAME is ISO 8859-1.
    name = String.fromCharCode(...data.subarray(p, Math.min(end, p + 1024)));
  }
  return {
    mtime: t ? new Date(t * 1000) : null,
    name,
    os: OS[osByte] ?? (osByte === 255 ? "unknown" : String(osByte)),
  };
}

export type TextEncoding = "base64" | "hex";

/** Compressed bytes written as text. */
export function bytesToText(bytes: Uint8Array, enc: TextEncoding): string {
  if (enc === "hex") {
    let s = "";
    for (const b of bytes) s += b.toString(16).padStart(2, "0");
    return s;
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Compressed data pasted as text. "auto" picks hex when only hex digits are present. */
export function textToBytes(text: string, enc: TextEncoding | "auto"): Uint8Array {
  const t = text.trim();
  if (!t) fail("Paste the compressed data.", "Colle les données compressées.");
  const isHex = /^(0x)?[0-9a-f\s:]+$/i.test(t) && t.replace(/[\s:]|^0x/gi, "").length % 2 === 0;
  return (enc === "auto" ? isHex : enc === "hex") ? fromHex(t) : fromBase64(t);
}

/** Decoded bytes as text when they are valid UTF-8, else null. */
export function asText(bytes: Uint8Array): string | null {
  try {
    return fromUtf8(bytes, true);
  } catch {
    return null;
  }
}

/** Size change: output / input (0.25 = a quarter of the size). Null for an empty input. */
export function ratio(inSize: number, outSize: number): number | null {
  return inSize ? outSize / inSize : null;
}

/** File name after compression, and the name to give back after decompression. */
export function compressedName(name: string, format: Format): string {
  return `${name || "data"}${extension(format)}`;
}

export function decompressedName(name: string, header: GzipHeader | null): string {
  if (header?.name) return header.name.replace(/^.*[\\/]/, "") || "data";
  const stripped = name.replace(/\.(gz|gzip|tgz|zz|z|deflate|zlib)$/i, "");
  if (/\.tgz$/i.test(name)) return `${stripped}.tar`;
  return stripped && stripped !== name ? stripped : `${name || "data"}.out`;
}
