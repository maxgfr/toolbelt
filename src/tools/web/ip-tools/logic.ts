/**
 * IPv4 address tools: one address in every notation (dotted, integer, hex, binary, octal,
 * IPv4-mapped IPv6), a range ↔ smallest CIDR list, the addresses of a block, and whether an
 * address (IPv4 or IPv6) falls in a list of CIDR blocks.
 */
import { compressIPv6, expandIPv6, formatIPv4, maskOf, parseIPv4, parseIPv6 } from "../cidr/logic";

export type InputKind = "dotted" | "decimal" | "hex" | "binary" | "octal" | "mapped";

/**
 * Reads an IPv4 address written in any common notation: dotted decimal, a 32-bit integer,
 * hex (0xC0A80101, C0.A8.01.01), binary (32 bits, dots and spaces allowed), dotted octal
 * (0300.0250.0.01) or an IPv4-mapped IPv6 address (::ffff:192.168.1.1).
 */
export function parseAnyIPv4(text: string): { ip: number; kind: InputKind } | null {
  const s = text.trim();
  if (!s) return null;
  const dotted = parseIPv4(s);
  if (dotted !== null && !/(^|\.)0\d/.test(s)) return { ip: dotted, kind: "dotted" };
  // Dotted octal: each part with a leading 0 is octal.
  // 32 binary digits (with dots, spaces or 0b): too long to be a decimal or dotted address.
  const bits = s.replace(/^0b/i, "").replace(/[\s.]/g, "");
  if (/^[01]{32}$/.test(bits)) return { ip: Number.parseInt(bits, 2), kind: "binary" };
  if (/^(\d+\.){3}\d+$/.test(s)) {
    const parts = s.split(".");
    let n = 0;
    for (const p of parts) {
      const v = /^0[0-7]+$/.test(p) ? Number.parseInt(p, 8) : /^\d+$/.test(p) ? Number(p) : NaN;
      if (!(v >= 0 && v <= 255)) return null;
      n = n * 256 + v;
    }
    return { ip: n, kind: "octal" };
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n <= 0xffffffff ? { ip: n, kind: "decimal" } : null;
  }
  const hex = /^0x([0-9a-f]{1,8})$/i.exec(s);
  if (hex?.[1]) return { ip: Number.parseInt(hex[1], 16), kind: "hex" };
  if (/^(0x)?[0-9a-f]{1,2}(\.(0x)?[0-9a-f]{1,2}){3}$/i.test(s)) {
    const n = s
      .split(".")
      .reduce((acc, p) => acc * 256 + Number.parseInt(p.replace(/^0x/i, ""), 16), 0);
    return { ip: n, kind: "hex" };
  }
  if (s.includes(":")) {
    const v6 = parseIPv6(s);
    // ::ffff:a.b.c.d (mapped) or ::a.b.c.d (the deprecated "compatible" form).
    if (v6 !== null && (v6 >> 32n === 0xffffn || v6 >> 32n === 0n))
      return { ip: Number(v6 & 0xffffffffn), kind: "mapped" };
  }
  return null;
}

export interface Notations {
  dotted: string;
  decimal: string;
  hex: string;
  hexDotted: string;
  binary: string;
  octal: string;
  octalDotted: string;
  mapped: string;
  mappedHex: string;
  mappedFull: string;
  sixToFour: string;
  reverse: string;
}

/** Every notation of an address (a uint32). */
export function notations(ip: number): Notations {
  const n = ip >>> 0;
  const bytes = [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const mapped = (0xffffn << 32n) | BigInt(n);
  const hi = (n >>> 16).toString(16);
  const lo = (n & 0xffff).toString(16);
  return {
    dotted: formatIPv4(n),
    decimal: String(n),
    hex: `0x${n.toString(16).toUpperCase().padStart(8, "0")}`,
    hexDotted: bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join("."),
    binary: bytes.map((b) => b.toString(2).padStart(8, "0")).join("."),
    octal: `0${n.toString(8)}`,
    octalDotted: bytes.map((b) => `0${b.toString(8)}`.padStart(4, "0")).join("."),
    mapped: compressIPv6(mapped),
    mappedHex: `::ffff:${hi}:${lo}`,
    mappedFull: expandIPv6(mapped),
    sixToFour: `2002:${hi}:${lo}::/48`,
    reverse: `${[...bytes].reverse().join(".")}.in-addr.arpa`,
  };
}

/* --- Ranges ----------------------------------------------------------------- */

export type RangeProblem = "empty" | "start" | "end" | "order" | "syntax";

/**
 * "10.0.0.5 - 10.0.0.20", "10.0.0.5-10.0.0.20", "10.0.0.0/24" or a single address.
 * Returns the first and last address (inclusive).
 */
export function parseRange(
  text: string,
): { ok: true; start: number; end: number } | { ok: false; error: RangeProblem } {
  const s = text.trim();
  if (!s) return { ok: false, error: "empty" };
  if (s.includes("/")) {
    const [addr = "", pre = "", extra] = s.split("/");
    if (extra !== undefined || !/^\d{1,2}$/.test(pre.trim()) || Number(pre) > 32)
      return { ok: false, error: "syntax" };
    const ip = parseIPv4(addr);
    if (ip === null) return { ok: false, error: "start" };
    const mask = maskOf(Number(pre));
    const start = (ip & mask) >>> 0;
    return { ok: true, start, end: (start | ~mask) >>> 0 };
  }
  const parts = s.split(/\s*(?:-|–|\bto\b|\bà\b)\s*|\s+/).filter(Boolean);
  if (parts.length > 2) return { ok: false, error: "syntax" };
  const start = parseIPv4(parts[0] ?? "");
  if (start === null) return { ok: false, error: "start" };
  if (parts.length === 1) return { ok: true, start, end: start };
  const end = parseIPv4(parts[1] ?? "");
  if (end === null) return { ok: false, error: "end" };
  if (end < start) return { ok: false, error: "order" };
  return { ok: true, start, end };
}

/** The smallest list of CIDR blocks covering exactly [start, end]. */
export function rangeToCidrs(start: number, end: number): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    // Largest block aligned on `cur`…
    let size = cur === 0 ? 2 ** 32 : 2 ** Math.min(32, ctz(cur));
    // …that does not go past `end`.
    while (size > end - cur + 1) size /= 2;
    out.push(`${formatIPv4(cur)}/${32 - Math.log2(size)}`);
    cur += size;
  }
  return out;
}

/** Number of trailing zero bits of a uint32 (> 0). */
function ctz(n: number): number {
  let c = 0;
  while (c < 32 && n % 2 ** (c + 1) === 0) c++;
  return c;
}

/** The addresses from start to end, at most `cap` of them. */
export function listAddresses(
  start: number,
  end: number,
  cap: number,
): { addresses: string[]; total: number; truncated: boolean } {
  const total = end - start + 1;
  const n = Math.max(0, Math.min(total, cap));
  const addresses = Array.from({ length: n }, (_, i) => formatIPv4(start + i));
  return { addresses, total, truncated: total > n };
}

/* --- Membership --------------------------------------------------------------- */

export interface Block {
  v: 4 | 6;
  net: bigint;
  prefix: number;
}

/** Parses an IPv4 or IPv6 address, as a bigint with its version. */
export function parseAddress(text: string): { v: 4 | 6; n: bigint } | null {
  const s = text.trim();
  const v4 = parseIPv4(s);
  if (v4 !== null) return { v: 4, n: BigInt(v4) };
  const v6 = s.includes(":") ? parseIPv6(s) : null;
  return v6 === null ? null : { v: 6, n: v6 };
}

/** "10.0.0.0/8", "2001:db8::/32", or a bare address (a /32 or /128). */
export function parseBlock(text: string): Block | null {
  const [addr = "", pre, extra] = text.trim().split("/");
  if (extra !== undefined) return null;
  const a = parseAddress(addr);
  if (!a) return null;
  const bits = a.v === 4 ? 32 : 128;
  if (pre !== undefined && !/^\d{1,3}$/.test(pre.trim())) return null;
  const prefix = pre === undefined ? bits : Number(pre);
  if (prefix > bits) return null;
  const host = (1n << BigInt(bits - prefix)) - 1n;
  return { v: a.v, net: a.n & ~host, prefix };
}

export type Membership =
  | { line: string; status: "in" | "out" | "other-version" | "pending"; block: string }
  | { line: string; status: "invalid" };

/**
 * Checks `address` against each line of `blocks` (blank lines and # comments skipped, text
 * after # ignored). Without a valid address, valid blocks are "pending". Mapped IPv6
 * addresses (::ffff:a.b.c.d) are also matched against IPv4 blocks.
 */
export function checkMembership(address: string, blocks: string): Membership[] {
  const a = parseAddress(address);
  const out: Membership[] = [];
  for (const raw of blocks.split(/\r?\n/)) {
    const line = (raw.split("#")[0] ?? "").trim();
    if (!line) continue;
    const b = parseBlock(line);
    if (!b) {
      out.push({ line, status: "invalid" });
      continue;
    }
    const block = `${b.v === 4 ? formatIPv4(Number(b.net)) : compressIPv6(b.net)}/${b.prefix}`;
    if (!a) {
      out.push({ line, status: "pending", block });
      continue;
    }
    let n = a.n;
    let v = a.v;
    if (v === 6 && b.v === 4 && n >> 32n === 0xffffn) {
      n &= 0xffffffffn;
      v = 4;
    }
    if (v !== b.v) {
      out.push({ line, status: "other-version", block });
      continue;
    }
    const bits = b.v === 4 ? 32 : 128;
    const inside = n >> BigInt(bits - b.prefix) === b.net >> BigInt(bits - b.prefix);
    out.push({ line, status: inside ? "in" : "out", block });
  }
  return out;
}
