/**
 * Identifiers: UUID v4 and v7 (RFC 9562), ULID, nanoid, generated in bulk; and an inspector
 * that reads the version, variant and embedded timestamp of an existing UUID or ULID.
 */
import { fail, randomBytes, randomString, toHex } from "../_shared";

export type IdKind = "v4" | "v7" | "ulid" | "nanoid";

/** Crockford's Base32, the ULID alphabet (no I, L, O, U). */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** nanoid's default URL-safe alphabet (64 symbols). */
export const NANOID_URL = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

export const NANOID_ALPHABETS = {
  url: NANOID_URL,
  alnum: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  lower: "0123456789abcdefghijklmnopqrstuvwxyz",
  hex: "0123456789abcdef",
  digits: "0123456789",
  // nanoid-dictionary's "nolookalikes": no 1/l/I, 0/O/o, u/v, 5/S, 2/Z…
  nolookalikes: "6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz",
} as const;

/** Random bits carried by each kind (nanoid: depends on size and alphabet). */
export const RANDOM_BITS = { v4: 122, v7: 74, ulid: 80 } as const;

export function formatUuid(bytes: Uint8Array): string {
  const h = toHex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function at(b: Uint8Array, i: number): number {
  return b[i] as number;
}

function setVersion(b: Uint8Array, version: number): void {
  b[6] = (at(b, 6) & 0x0f) | (version << 4);
  b[8] = (at(b, 8) & 0x3f) | 0x80; // RFC 9562 variant: 10xx
}

/** Writes `ms` as a 48-bit big-endian integer at the start of `b`. */
function writeMs(b: Uint8Array, ms: number): void {
  if (!Number.isInteger(ms) || ms < 0 || ms >= 2 ** 48) throw new RangeError("timestamp");
  for (let i = 0; i < 6; i++) b[i] = Math.floor(ms / 2 ** (8 * (5 - i))) % 256;
}

/** UUID version 4: 122 random bits. */
export function uuidV4(random: Uint8Array = randomBytes(16)): string {
  const b = Uint8Array.from(random.subarray(0, 16));
  setVersion(b, 4);
  return formatUuid(b);
}

/** UUID version 7: a 48-bit Unix time in milliseconds, then 74 random bits. Sortable. */
export function uuidV7(ms = Date.now(), random: Uint8Array = randomBytes(10)): string {
  const b = new Uint8Array(16);
  writeMs(b, ms);
  b.set(random.subarray(0, 10), 6);
  setVersion(b, 7);
  return formatUuid(b);
}

/** 16 bytes as 26 Crockford Base32 characters (the top 2 of the 130 bits are zero). */
export function bytesToUlid(bytes: Uint8Array): string {
  let n = BigInt(`0x${toHex(bytes) || "0"}`);
  let out = "";
  for (let i = 0; i < 26; i++) {
    out = CROCKFORD[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return out;
}

/** ULID: a 48-bit millisecond time and 80 random bits, in Crockford Base32. Sortable. */
export function ulid(ms = Date.now(), random: Uint8Array = randomBytes(10)): string {
  const b = new Uint8Array(16);
  writeMs(b, ms);
  b.set(random.subarray(0, 10), 6);
  return bytesToUlid(b);
}

/** Checks a nanoid alphabet: 2 to 256 distinct characters. */
export function checkAlphabet(alphabet: string): void {
  const chars = [...alphabet];
  if (chars.length < 2)
    fail(
      "The alphabet needs at least 2 characters.",
      "L'alphabet doit avoir au moins 2 caractères.",
    );
  if (chars.length > 256)
    fail("The alphabet is limited to 256 characters.", "L'alphabet est limité à 256 caractères.");
  if (new Set(chars).size !== chars.length)
    fail(
      "The alphabet has repeated characters, which would bias the result.",
      "L'alphabet contient des caractères répétés, ce qui fausserait le tirage.",
    );
}

export function nanoid(size = 21, alphabet: string = NANOID_URL): string {
  checkAlphabet(alphabet);
  if (!Number.isInteger(size) || size < 1 || size > 1024)
    fail("The size must be between 1 and 1024.", "La taille doit être entre 1 et 1024.");
  return randomString(size, alphabet);
}

/** Random bits of one nanoid. */
export function nanoidBits(size: number, alphabet: string): number {
  return size * Math.log2(new Set(alphabet).size);
}

export interface GenerateOptions {
  uppercase: boolean;
  /** UUIDs only: keep the dashes. */
  dashes: boolean;
  size: number;
  alphabet: string;
}

/**
 * `count` identifiers of one kind. v7 and ULID batches share the same millisecond, so they are
 * sorted to keep the creation order that those formats promise.
 */
export function generateIds(
  kind: IdKind,
  count: number,
  opts: GenerateOptions,
  now = Date.now(),
): string[] {
  const n = Math.min(1000, Math.max(1, Math.floor(count) || 1));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (kind === "v4") out.push(uuidV4());
    else if (kind === "v7") out.push(uuidV7(now));
    else if (kind === "ulid") out.push(ulid(now));
    else out.push(nanoid(opts.size, opts.alphabet));
  }
  if (kind === "v7" || kind === "ulid") out.sort();
  if (kind === "v4" || kind === "v7")
    return out.map((id) => {
      const s = opts.dashes ? id : id.replace(/-/g, "");
      return opts.uppercase ? s.toUpperCase() : s;
    });
  return kind === "ulid" && !opts.uppercase ? out.map((id) => id.toLowerCase()) : out;
}

/* --- Inspector --------------------------------------------------------------- */

export type Variant = "ncs" | "rfc" | "microsoft" | "future";

export interface IdInfo {
  kind: "uuid" | "ulid";
  /** Lowercase 8-4-4-4-12 for UUIDs, uppercase for ULIDs. */
  canonical: string;
  hex: string;
  /** The same 128 bits written the other way (ULID ↔ UUID). */
  other: string;
  version?: number;
  variant?: Variant;
  special?: "nil" | "max";
  /** Milliseconds since the Unix epoch, when the identifier embeds a time. */
  timestamp?: number;
  /** v1 / v6: the node (often a MAC address). */
  node?: string;
  /** v1 / v6: the clock sequence. */
  clockSeq?: number;
}

// Offset between the Gregorian epoch (1582-10-15) and the Unix epoch, in 100 ns units.
const GREGORIAN_OFFSET = 122192928000000000n;

function variantOf(byte: number): Variant {
  if ((byte & 0x80) === 0) return "ncs";
  if ((byte & 0xc0) === 0x80) return "rfc";
  if ((byte & 0xe0) === 0xc0) return "microsoft";
  return "future";
}

function ms48(b: Uint8Array): number {
  let ms = 0;
  for (let i = 0; i < 6; i++) ms = ms * 256 + at(b, i);
  return ms;
}

function hexBytes(hex: string): Uint8Array {
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

function inspectUuid(hex: string): IdInfo {
  const b = hexBytes(hex);
  const info: IdInfo = {
    kind: "uuid",
    canonical: formatUuid(b),
    hex,
    other: bytesToUlid(b),
  };
  if (/^0+$/.test(hex)) return { ...info, special: "nil" };
  if (/^f+$/.test(hex)) return { ...info, special: "max" };
  info.variant = variantOf(at(b, 8));
  if (info.variant !== "rfc") return info;
  const version = at(b, 6) >> 4;
  info.version = version;
  if (version === 7) info.timestamp = ms48(b);
  if (version === 1 || version === 6) {
    const big = (i: number, n: number) => BigInt(`0x${hex.slice(i * 2, (i + n) * 2)}`);
    const ticks =
      version === 1
        ? ((big(6, 2) & 0x0fffn) << 48n) | (big(4, 2) << 32n) | big(0, 4)
        : (big(0, 4) << 28n) | (big(4, 2) << 12n) | (big(6, 2) & 0x0fffn);
    info.timestamp = Number((ticks - GREGORIAN_OFFSET) / 10000n);
    info.clockSeq = ((at(b, 8) & 0x3f) << 8) | at(b, 9);
    info.node = hex.slice(20).replace(/(..)(?!$)/g, "$1:");
  }
  return info;
}

function inspectUlid(text: string): IdInfo {
  const s = text.toUpperCase();
  if (CROCKFORD.indexOf(s[0] ?? "0") > 7)
    fail(
      "This ULID is out of range: it must start with 0 to 7.",
      "Ce ULID dépasse la limite : il doit commencer par 0 à 7.",
    );
  let n = 0n;
  for (const c of s) n = (n << 5n) | BigInt(CROCKFORD.indexOf(c));
  const hex = n.toString(16).padStart(32, "0");
  const b = hexBytes(hex);
  return {
    kind: "ulid",
    canonical: s,
    hex,
    other: formatUuid(b),
    timestamp: ms48(b),
  };
}

/**
 * Reads a UUID (with or without dashes, braces, `urn:uuid:`) or a ULID. Null when empty;
 * throws an `EncodeError` when it is neither.
 */
export function inspectId(text: string): IdInfo | null {
  const t = text.trim();
  if (!t) return null;
  const u = t
    .replace(/^urn:uuid:/i, "")
    .replace(/^\{(.*)\}$/, "$1")
    .trim();
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(u))
    return inspectUuid(u.replace(/-/g, "").toLowerCase());
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(t)) return inspectUlid(t);
  fail(
    "Not a UUID (32 hex digits, 8-4-4-4-12) or a ULID (26 Crockford Base32 characters).",
    "Ni un UUID (32 chiffres hexa, 8-4-4-4-12) ni un ULID (26 caractères Base32 de Crockford).",
  );
}
