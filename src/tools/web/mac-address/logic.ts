/**
 * MAC addresses (EUI-48): random generation with the right I/G (multicast) and U/L (locally
 * administered) bits, formatting in the usual notations, and parsing any of them back with
 * what the first byte says.
 */
import { compressIPv6 } from "../cidr/logic";

export type MacFormat = "colon" | "dash" | "dot" | "none";

/** Formats 6 bytes: 00:1a:2b:3c:4d:5e, 00-1a-…, 001a.2b3c.4d5e (Cisco) or 001a2b3c4d5e. */
export function formatMac(bytes: ArrayLike<number>, format: MacFormat, upper = false): string {
  const hex = Array.from(bytes, (b) => (b & 255).toString(16).padStart(2, "0"));
  let out: string;
  if (format === "colon") out = hex.join(":");
  else if (format === "dash") out = hex.join("-");
  else if (format === "dot")
    out = [0, 2, 4].map((i) => `${hex[i] ?? ""}${hex[i + 1] ?? ""}`).join(".");
  else out = hex.join("");
  return upper ? out.toUpperCase() : out;
}

/**
 * Reads a MAC address in any common notation (colons, dashes, Cisco dots, bare hex, spaces),
 * or null. Single-digit groups (as printed by some systems: 0:1a:2b:…) are accepted.
 */
export function parseMac(text: string): number[] | null {
  const s = text.trim();
  if (!s) return null;
  let groups: string[];
  if (/^[0-9a-f]{1,2}([:\- ])[0-9a-f]{1,2}(\1[0-9a-f]{1,2}){4}$/i.test(s))
    groups = s.split(/[:\- ]/).map((g) => g.padStart(2, "0"));
  else if (/^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(s))
    groups = s.replace(/\./g, "").match(/../g) ?? [];
  else if (/^[0-9a-f]{12}$/i.test(s)) groups = s.match(/../g) ?? [];
  else return null;
  return groups.map((g) => Number.parseInt(g, 16));
}

/** Parses a prefix of 1 to 5 bytes ("00:1A:2B", "001a2b", "02-00"), or null. */
export function parsePrefix(text: string): number[] | null {
  const s = text.trim();
  if (!s) return [];
  const hex = s.replace(/[:\-. ]/g, "");
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 || hex.length > 10) return null;
  return (hex.match(/../g) ?? []).map((g) => Number.parseInt(g, 16));
}

export interface GenOptions {
  /** Bytes forced at the start (an OUI or any prefix of 1–5 bytes). */
  prefix: number[];
  /** Set the U/L bit (locally administered) — only when there is no prefix. */
  local: boolean;
  /** Clear the I/G bit (unicast) — only when there is no prefix. */
  unicast: boolean;
}

/**
 * One random MAC address. Without a prefix, the first byte's two low bits follow `local` and
 * `unicast`; with a prefix, the prefix is kept as given. `random` fills a byte array.
 */
export function randomMac(opts: GenOptions, random: (a: Uint8Array) => void): number[] {
  const bytes = new Uint8Array(6);
  random(bytes);
  const prefix = opts.prefix.slice(0, 5);
  prefix.forEach((b, i) => {
    bytes[i] = b & 255;
  });
  if (!prefix.length) {
    let first = bytes[0] ?? 0;
    first = opts.local ? first | 0x02 : first & ~0x02;
    first = opts.unicast ? first & ~0x01 : first | 0x01;
    bytes[0] = first;
  }
  return [...bytes];
}

/** `count` distinct random addresses (as many as the prefix leaves room for). */
export function randomMacs(
  count: number,
  opts: GenOptions,
  random: (a: Uint8Array) => void,
): number[][] {
  const room = 2 ** (8 * (6 - Math.min(5, opts.prefix.length)) - (opts.prefix.length ? 0 : 2));
  const n = Math.max(0, Math.min(count, room));
  const seen = new Set<string>();
  const out: number[][] = [];
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    const m = randomMac(opts, random);
    const key = formatMac(m, "none");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export interface MacInfo {
  /** I/G bit: group (multicast) when set. */
  group: boolean;
  /** U/L bit: locally administered when set. */
  local: boolean;
  broadcast: boolean;
  zero: boolean;
  /** First three bytes (the OUI when universally administered). */
  oui: string;
  /** Last three bytes. */
  nic: string;
  /** Modified EUI-64 interface identifier (IPv6 SLAAC), e.g. 021a:2bff:fe3c:4d5e. */
  eui64: string;
  /** The IPv6 link-local address derived from it. */
  linkLocal: string;
  /** Binary of the first byte, with the two flag bits last. */
  firstByte: string;
}

export function macInfo(bytes: number[]): MacInfo {
  const b = bytes.map((x) => x & 255);
  const first = b[0] ?? 0;
  const e = [first ^ 0x02, b[1] ?? 0, b[2] ?? 0, 0xff, 0xfe, b[3] ?? 0, b[4] ?? 0, b[5] ?? 0];
  const groups = [0, 2, 4, 6].map((i) => ((e[i] ?? 0) << 8) | (e[i + 1] ?? 0));
  const eui64 = groups.map((g) => g.toString(16).padStart(4, "0")).join(":");
  return {
    group: (first & 1) === 1,
    local: (first & 2) === 2,
    broadcast: b.every((x) => x === 255),
    zero: b.every((x) => x === 0),
    oui: formatMac(b.slice(0, 3), "colon", true),
    nic: formatMac(b.slice(3), "colon", true),
    eui64,
    linkLocal: compressIPv6(groups.reduce((acc, g) => (acc << 16n) | BigInt(g), 0xfe80n << 48n)),
    firstByte: first.toString(2).padStart(8, "0"),
  };
}

export type ParsedLine = { line: string; bytes: number[] | null };

/** One result per non-empty line. */
export function parseMacList(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ line, bytes: parseMac(line) }));
}
