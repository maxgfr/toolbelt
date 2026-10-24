/**
 * Checksums of a text or a file with hash-wasm's incremental hashers: every algorithm is fed the
 * same chunks, so a large file is read once, in pieces, with progress and cancellation.
 */
import {
  createBLAKE3,
  createCRC32,
  createMD5,
  createSHA1,
  createSHA3,
  createSHA256,
  createSHA384,
  createSHA512,
  type IHasher,
} from "hash-wasm";
import { fromBase64, fromHex, toBase64, toHex } from "../_shared";

export const ALGOS = [
  { id: "md5", label: "MD5", create: () => createMD5() },
  { id: "sha1", label: "SHA-1", create: () => createSHA1() },
  { id: "sha256", label: "SHA-256", create: () => createSHA256() },
  { id: "sha384", label: "SHA-384", create: () => createSHA384() },
  { id: "sha512", label: "SHA-512", create: () => createSHA512() },
  { id: "sha3-256", label: "SHA3-256", create: () => createSHA3(256) },
  { id: "sha3-512", label: "SHA3-512", create: () => createSHA3(512) },
  { id: "blake3", label: "BLAKE3", create: () => createBLAKE3() },
  { id: "crc32", label: "CRC32", create: () => createCRC32() },
] as const;

export type AlgoId = (typeof ALGOS)[number]["id"];
export type Digests = Record<AlgoId, Uint8Array>;

/** Algorithms too weak against collisions to trust for anything but corruption checks. */
export const WEAK: ReadonlySet<AlgoId> = new Set(["md5", "sha1", "crc32"]);

async function hashers(): Promise<[AlgoId, IHasher][]> {
  return Promise.all(
    ALGOS.map(async (a) => [a.id, (await a.create()).init()] as [AlgoId, IHasher]),
  );
}

function finish(hs: [AlgoId, IHasher][]): Digests {
  const out = {} as Digests;
  for (const [id, h] of hs) out[id] = h.digest("binary");
  return out;
}

/** Every digest of some bytes (or of a string, as UTF-8). */
export async function hashAll(data: Uint8Array | string): Promise<Digests> {
  const hs = await hashers();
  for (const [, h] of hs) h.update(data);
  return finish(hs);
}

export const CHUNK = 4 * 1024 * 1024;

export class Cancelled extends Error {
  constructor() {
    super("Cancelled");
  }
}

/**
 * Every digest of a Blob (a File), read `chunk` bytes at a time. `onProgress` gets the bytes
 * done so far; aborting `signal` rejects with `Cancelled`.
 */
export async function hashBlob(
  blob: Blob,
  opts: { chunk?: number; onProgress?: (done: number) => void; signal?: AbortSignal } = {},
): Promise<Digests> {
  const size = opts.chunk ?? CHUNK;
  const hs = await hashers();
  for (let pos = 0; pos < blob.size; pos += size) {
    if (opts.signal?.aborted) throw new Cancelled();
    const buf = new Uint8Array(await blob.slice(pos, pos + size).arrayBuffer());
    for (const [, h] of hs) h.update(buf);
    opts.onProgress?.(Math.min(blob.size, pos + size));
    // Let the page breathe (repaint the progress, take a Cancel click) between chunks.
    await new Promise((r) => setTimeout(r, 0));
  }
  if (opts.signal?.aborted) throw new Cancelled();
  return finish(hs);
}

export type DigestFormat = "hex" | "base64";

export function formatDigest(bytes: Uint8Array, format: DigestFormat, upper = false): string {
  return format === "base64" ? toBase64(bytes) : toHex(bytes, upper);
}

/**
 * The bytes of a checksum as people paste it: hex (any case, with separators), Base64, an
 * `sha256:` / `sha256-` prefix (SRI), or a `sha256sum` line ("<hash>  file.zip").
 * Null when it is neither hex nor Base64.
 */
export function parseChecksum(text: string): Uint8Array | null {
  let s = text.trim();
  if (!s) return null;
  s = s.split(/\s+/)[0] ?? "";
  s = s.replace(/^(?:md5|sha-?\d+|sha3-\d+|blake3|crc32)[:-]/i, "");
  const hex = s.replace(/^0x/i, "").replace(/[:-]/g, "");
  if (/^[0-9a-f]+$/i.test(hex) && hex.length % 2 === 0) return fromHex(hex);
  try {
    const b = fromBase64(s);
    return b.length ? b : null;
  } catch {
    return null;
  }
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** The algorithm whose digest equals the expected checksum, if any. */
export function findMatch(expected: string, digests: Digests): AlgoId | null {
  const want = parseChecksum(expected);
  if (!want) return null;
  for (const a of ALGOS) if (equal(digests[a.id], want)) return a.id;
  return null;
}
