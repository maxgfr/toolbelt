/**
 * IPv6 Unique Local Addresses (RFC 4193): fd00::/8 + a random 40-bit Global ID gives a /48
 * site prefix, with 65,536 /64 subnets. The Global ID is held as 10 lowercase hex digits.
 */
import { compressIPv6, parseIPv6 } from "../cidr/logic";

/** A fresh random Global ID (10 hex digits) from `random`, which fills a byte array. */
export function randomGlobalId(random: (a: Uint8Array) => void): string {
  const b = new Uint8Array(5);
  random(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type UlaParse =
  | { ok: true; id: string; subnet: number | null; warning: "fc" | null }
  | { ok: false; error: "empty" | "syntax" | "not-ula" };

/**
 * Reads a Global ID: 10 hex digits ("12:3456:789a" or "123456789a"), or any address/prefix
 * inside fc00::/7 ("fd12:3456:789a::/48", "fd12:3456:789a:1::5"), whose subnet ID is kept.
 */
export function parseUla(text: string): UlaParse {
  const s = text.trim().toLowerCase();
  if (!s) return { ok: false, error: "empty" };
  const bare = s.replace(/[:\s]/g, "");
  if (/^[0-9a-f]{10}$/.test(bare) && !s.includes("::"))
    return { ok: true, id: bare, subnet: null, warning: null };
  const [addr = "", pre, extra] = s.split("/");
  if (extra !== undefined || (pre !== undefined && !/^\d{1,3}$/.test(pre)))
    return { ok: false, error: "syntax" };
  const n = parseIPv6(addr);
  if (n === null) return { ok: false, error: "syntax" };
  const top = Number(n >> 120n);
  if (top !== 0xfd && top !== 0xfc) return { ok: false, error: "not-ula" };
  const id = ((n >> 80n) & 0xffffffffffn).toString(16).padStart(10, "0");
  const prefix = pre === undefined ? 128 : Number(pre);
  const subnet = prefix >= 64 ? Number((n >> 64n) & 0xffffn) : null;
  return { ok: true, id, subnet, warning: top === 0xfc ? "fc" : null };
}

function base(id: string): bigint {
  return (0xfdn << 120n) | (BigInt(`0x${id}`) << 80n);
}

export interface UlaInfo {
  /** "fd12:3456:789a::/48" */
  prefix: string;
  /** "12:3456:789a" — the Global ID split as in the prefix. */
  globalId: string;
  first: string;
  last: string;
}

export function ulaInfo(id: string): UlaInfo {
  const b = base(id);
  const host = (1n << 80n) - 1n;
  const g = id.padStart(10, "0");
  return {
    prefix: `${compressIPv6(b)}/48`,
    globalId: `${g.slice(0, 2)}:${g.slice(2, 6)}:${g.slice(6)}`,
    first: compressIPv6(b),
    last: compressIPv6(b | host),
  };
}

/** The /64 subnet `n` (0–65535) of the site. */
export function subnet64(id: string, n: number): string {
  const s = BigInt(Math.min(0xffff, Math.max(0, Math.trunc(n))));
  return `${compressIPv6(base(id) | (s << 64n))}/64`;
}

/** `count` consecutive /64 subnets from `start`, stopping at the last one (ffff). */
export function subnets(id: string, start: number, count: number): string[] {
  const out: string[] = [];
  const from = Math.min(0xffff, Math.max(0, Math.trunc(start)));
  for (let i = from; i <= 0xffff && out.length < count; i++) out.push(subnet64(id, i));
  return out;
}

/** An example host address in subnet `n`: …::1. */
export function exampleHost(id: string, n: number): string {
  const s = BigInt(Math.min(0xffff, Math.max(0, Math.trunc(n))));
  return compressIPv6(base(id) | (s << 64n) | 1n);
}
