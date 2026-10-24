/**
 * A small DER (ASN.1 Distinguished Encoding Rules) reader: tag-length-value nodes, OIDs,
 * integers, strings and times, plus a table of the object identifiers found in X.509
 * certificates. Pure: no DOM, no Preact.
 */
import { fail } from "../_shared";

export interface Node {
  /** Tag class: 0 universal, 1 application, 2 context-specific, 3 private. */
  cls: number;
  constructed: boolean;
  /** Tag number within its class. */
  tag: number;
  /** The whole encoding (header + content). */
  raw: Uint8Array;
  /** The content octets. */
  content: Uint8Array;
  /** Parsed children of a constructed node. */
  children: Node[];
}

export const TAG = {
  BOOLEAN: 1,
  INTEGER: 2,
  BIT_STRING: 3,
  OCTET_STRING: 4,
  NULL: 5,
  OID: 6,
  UTF8: 12,
  SEQUENCE: 16,
  SET: 17,
  NUMERIC: 18,
  PRINTABLE: 19,
  T61: 20,
  IA5: 22,
  UTC_TIME: 23,
  GENERALIZED_TIME: 24,
  VISIBLE: 26,
  UNIVERSAL: 28,
  BMP: 30,
} as const;

function bad(): never {
  fail(
    "Invalid DER: the ASN.1 structure is truncated or malformed.",
    "DER invalide : la structure ASN.1 est tronquée ou mal formée.",
    "Ungültiges DER: Die ASN.1-Struktur ist abgeschnitten oder fehlerhaft.",
  );
}

const MAX_DEPTH = 64;

/** Reads one TLV at `start`; returns the node and the offset just after it. */
function readNode(buf: Uint8Array, start: number, depth: number): [Node, number] {
  if (depth > MAX_DEPTH) bad();
  let p = start;
  const first = buf[p++];
  if (first === undefined) bad();
  const cls = first >> 6;
  const constructed = (first & 0x20) !== 0;
  let tag = first & 0x1f;
  if (tag === 0x1f) {
    tag = 0;
    for (;;) {
      const b = buf[p++];
      if (b === undefined || tag > 0xffffff) bad();
      tag = tag * 128 + (b & 0x7f);
      if (!(b & 0x80)) break;
    }
  }
  const lb = buf[p++];
  if (lb === undefined) bad();
  let len = lb;
  if (lb & 0x80) {
    const n = lb & 0x7f;
    // 0x80 is BER's indefinite length, not allowed in DER; more than 4 bytes is absurd here.
    if (n === 0 || n > 4) bad();
    len = 0;
    for (let i = 0; i < n; i++) {
      const b = buf[p++];
      if (b === undefined) bad();
      len = len * 256 + b;
    }
  }
  const end = p + len;
  if (end > buf.length) bad();
  const content = buf.subarray(p, end);
  const children: Node[] = [];
  if (constructed) {
    let q = 0;
    while (q < content.length) {
      const [child, next] = readNode(content, q, depth + 1);
      children.push(child);
      q = next;
    }
  }
  return [{ cls, constructed, tag, raw: buf.subarray(start, end), content, children }, end];
}

/** Parses one DER element. Trailing bytes are ignored (`length` tells where it ended). */
export function parseDer(buf: Uint8Array): Node & { length: number } {
  const [node, end] = readNode(buf, 0, 0);
  return { ...node, length: end };
}

export function isUniversal(n: Node | undefined, tag: number): n is Node {
  return !!n && n.cls === 0 && n.tag === tag;
}

export function isContext(n: Node | undefined, tag: number): n is Node {
  return !!n && n.cls === 2 && n.tag === tag;
}

/** Child `i`, or a "malformed" error. */
export function child(n: Node | undefined, i: number): Node {
  const c = n?.children[i];
  if (!c) bad();
  return c;
}

export function expectTag(n: Node | undefined, tag: number): Node {
  if (!isUniversal(n, tag)) bad();
  return n;
}

export function readOid(n: Node): string {
  const b = expectTag(n, TAG.OID).content;
  if (!b.length) bad();
  const parts: number[] = [];
  let v = 0;
  for (const byte of b) {
    v = v * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  const first = parts.shift() ?? 0;
  const a = first < 80 ? Math.floor(first / 40) : 2;
  return [a, first - a * 40, ...parts].join(".");
}

/** An INTEGER's magnitude bytes (two's complement sign byte removed). */
export function intBytes(n: Node): Uint8Array {
  const b = expectTag(n, TAG.INTEGER).content;
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  return b.subarray(i);
}

export function readSmallInt(n: Node): number {
  const b = expectTag(n, TAG.INTEGER).content;
  let v = 0;
  for (const x of b) v = v * 256 + x;
  if ((b[0] ?? 0) & 0x80) v -= 256 ** b.length;
  return v;
}

/** Number of significant bits of an unsigned big-endian integer. */
export function bitLength(b: Uint8Array): number {
  let i = 0;
  while (i < b.length && b[i] === 0) i++;
  if (i === b.length) return 0;
  return (b.length - i - 1) * 8 + (32 - Math.clz32(b[i] as number));
}

/** A BIT STRING's bytes (after the unused-bits count) and that count. */
export function bitString(n: Node): { bytes: Uint8Array; unused: number } {
  const c = expectTag(n, TAG.BIT_STRING).content;
  if (!c.length) bad();
  return { bytes: c.subarray(1), unused: c[0] as number };
}

function latin1(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return s;
}

/** Any ASN.1 string type as text (unknown types as hex). */
export function readString(n: Node): string {
  const b = n.content;
  if (n.cls !== 0) return latin1(b);
  switch (n.tag) {
    case TAG.UTF8:
      return new TextDecoder().decode(b);
    case TAG.BMP: {
      let s = "";
      for (let i = 0; i + 1 < b.length; i += 2)
        s += String.fromCharCode(((b[i] as number) << 8) | (b[i + 1] as number));
      return s;
    }
    case TAG.UNIVERSAL: {
      let s = "";
      for (let i = 0; i + 3 < b.length; i += 4) {
        const cp =
          (((b[i] as number) << 24) |
            ((b[i + 1] as number) << 16) |
            ((b[i + 2] as number) << 8) |
            (b[i + 3] as number)) >>>
          0;
        s += cp <= 0x10ffff ? String.fromCodePoint(cp) : "�";
      }
      return s;
    }
    case TAG.PRINTABLE:
    case TAG.IA5:
    case TAG.VISIBLE:
    case TAG.NUMERIC:
    case TAG.T61:
      return latin1(b);
    default:
      return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
}

/** UTCTime (YYMMDDHHMM[SS]Z, years 1950–2049) or GeneralizedTime (YYYYMMDDHHMMSS[.f]Z). */
export function readTime(n: Node): Date {
  const s = latin1(n.content);
  const m =
    n.tag === TAG.UTC_TIME
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s)
      : n.tag === TAG.GENERALIZED_TIME
        ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?Z$/.exec(s)
        : null;
  if (!m) bad();
  let year = Number(m[1]);
  if (n.tag === TAG.UTC_TIME) year += year < 50 ? 2000 : 1900;
  return new Date(
    Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)),
  );
}

/* --- Object identifiers ------------------------------------------------------------------ */

/** Name attributes: short name and long name. */
export const NAME_ATTRS: Record<string, [string, string]> = {
  "2.5.4.3": ["CN", "Common name"],
  "2.5.4.4": ["SN", "Surname"],
  "2.5.4.5": ["serialNumber", "Serial number"],
  "2.5.4.6": ["C", "Country"],
  "2.5.4.7": ["L", "Locality"],
  "2.5.4.8": ["ST", "State or province"],
  "2.5.4.9": ["street", "Street"],
  "2.5.4.10": ["O", "Organization"],
  "2.5.4.11": ["OU", "Organizational unit"],
  "2.5.4.12": ["title", "Title"],
  "2.5.4.13": ["description", "Description"],
  "2.5.4.15": ["businessCategory", "Business category"],
  "2.5.4.17": ["postalCode", "Postal code"],
  "2.5.4.42": ["GN", "Given name"],
  "2.5.4.43": ["initials", "Initials"],
  "2.5.4.46": ["dnQualifier", "DN qualifier"],
  "2.5.4.65": ["pseudonym", "Pseudonym"],
  "2.5.4.97": ["organizationIdentifier", "Organization identifier"],
  "1.2.840.113549.1.9.1": ["emailAddress", "Email address"],
  "0.9.2342.19200300.100.1.1": ["UID", "User ID"],
  "0.9.2342.19200300.100.1.25": ["DC", "Domain component"],
  "1.3.6.1.4.1.311.60.2.1.1": ["jurisdictionL", "Jurisdiction locality"],
  "1.3.6.1.4.1.311.60.2.1.2": ["jurisdictionST", "Jurisdiction state"],
  "1.3.6.1.4.1.311.60.2.1.3": ["jurisdictionC", "Jurisdiction country"],
};

/** Algorithms (signature, public key), curves, and other identifiers, by OID. */
export const OIDS: Record<string, string> = {
  // RSA
  "1.2.840.113549.1.1.1": "RSA",
  "1.2.840.113549.1.1.2": "md2WithRSAEncryption",
  "1.2.840.113549.1.1.4": "md5WithRSAEncryption",
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.113549.1.1.10": "RSASSA-PSS",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.113549.1.1.14": "sha224WithRSAEncryption",
  // EC
  "1.2.840.10045.2.1": "EC",
  "1.2.840.10045.4.1": "ecdsa-with-SHA1",
  "1.2.840.10045.4.3.1": "ecdsa-with-SHA224",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  // EdDSA, X25519
  "1.3.101.110": "X25519",
  "1.3.101.111": "X448",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",
  // DSA
  "1.2.840.10040.4.1": "DSA",
  "1.2.840.10040.4.3": "dsa-with-SHA1",
  "2.16.840.1.101.3.4.3.2": "dsa-with-SHA256",
  // ML-DSA (FIPS 204)
  "2.16.840.1.101.3.4.3.17": "ML-DSA-44",
  "2.16.840.1.101.3.4.3.18": "ML-DSA-65",
  "2.16.840.1.101.3.4.3.19": "ML-DSA-87",
  // GOST / SM2
  "1.2.156.10197.1.501": "SM2-with-SM3",
  // Hashes
  "1.3.14.3.2.26": "SHA-1",
  "2.16.840.1.101.3.4.2.1": "SHA-256",
  "2.16.840.1.101.3.4.2.2": "SHA-384",
  "2.16.840.1.101.3.4.2.3": "SHA-512",
  "2.16.840.1.101.3.4.2.4": "SHA-224",
  "1.2.840.113549.1.1.8": "MGF1",
  // PKCS#9 attributes
  "1.2.840.113549.1.9.7": "challengePassword",
  "1.2.840.113549.1.9.14": "extensionRequest",
  // Access methods
  "1.3.6.1.5.5.7.48.1": "OCSP",
  "1.3.6.1.5.5.7.48.2": "CA Issuers",
  // Policies
  "2.5.29.32.0": "anyPolicy",
  "2.23.140.1.1": "EV",
  "2.23.140.1.2.1": "DV",
  "2.23.140.1.2.2": "OV",
  "2.23.140.1.2.3": "IV",
  "1.3.6.1.5.5.7.2.1": "CPS",
};

/** Named curves: name and field size in bits. */
export const CURVES: Record<string, [string, number]> = {
  "1.2.840.10045.3.1.7": ["P-256", 256],
  "1.3.132.0.34": ["P-384", 384],
  "1.3.132.0.35": ["P-521", 521],
  "1.3.132.0.10": ["secp256k1", 256],
  "1.2.840.10045.3.1.1": ["P-192", 192],
  "1.3.132.0.33": ["P-224", 224],
  "1.3.36.3.3.2.8.1.1.7": ["brainpoolP256r1", 256],
  "1.3.36.3.3.2.8.1.1.11": ["brainpoolP384r1", 384],
  "1.3.36.3.3.2.8.1.1.13": ["brainpoolP512r1", 512],
  "1.2.156.10197.1.301": ["SM2", 256],
};

export function oidName(oid: string): string {
  return OIDS[oid] ?? CURVES[oid]?.[0] ?? NAME_ATTRS[oid]?.[0] ?? oid;
}
