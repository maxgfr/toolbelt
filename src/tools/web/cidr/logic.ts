/**
 * IP subnets. IPv4: everything about a CIDR block (network, broadcast, masks, host range,
 * class, special-purpose ranges) and splitting it into equal subnets. IPv6: expand and
 * compress (RFC 5952) an address and give the range of a prefix. Addresses are a uint32
 * (IPv4) or a bigint (IPv6).
 */

/* --- IPv4 ------------------------------------------------------------------- */

export function parseIPv4(text: string): number | null {
  const parts = text.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

export function formatIPv4(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/** The netmask of a prefix length, as a uint32. */
export function maskOf(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** The prefix length of a netmask, or null if its ones are not contiguous. */
export function prefixOfMask(mask: number): number | null {
  for (let p = 0; p <= 32; p++) if (maskOf(p) === mask) return p;
  return null;
}

export type ParseError = "empty" | "address" | "prefix" | "mask";

/**
 * "192.168.1.10/24", "192.168.1.10 255.255.255.0", "10.0.0.0/255.0.0.0" or a bare address
 * (taken as /32).
 */
export function parseCidr4(
  text: string,
): { ok: true; ip: number; prefix: number } | { ok: false; error: ParseError } {
  const s = text.trim();
  if (!s) return { ok: false, error: "empty" };
  const [addr = "", rest, extra] = s.split(/\s*\/\s*|\s+/);
  if (extra !== undefined) return { ok: false, error: "prefix" };
  const ip = parseIPv4(addr);
  if (ip === null) return { ok: false, error: "address" };
  if (rest === undefined) return { ok: true, ip, prefix: 32 };
  if (/^\d{1,2}$/.test(rest)) {
    const prefix = Number(rest);
    return prefix <= 32 ? { ok: true, ip, prefix } : { ok: false, error: "prefix" };
  }
  const mask = parseIPv4(rest);
  if (mask === null) return { ok: false, error: "prefix" };
  const prefix = prefixOfMask(mask);
  return prefix === null ? { ok: false, error: "mask" } : { ok: true, ip, prefix };
}

export type V4Scope =
  | "this-network"
  | "private"
  | "shared"
  | "loopback"
  | "link-local"
  | "protocol"
  | "documentation"
  | "benchmarking"
  | "multicast"
  | "reserved"
  | "broadcast"
  | "public";

/** Special-purpose IPv4 ranges (RFC 6890), most specific first. */
const V4_RANGES: [string, number, V4Scope][] = [
  ["255.255.255.255", 32, "broadcast"],
  ["192.0.2.0", 24, "documentation"],
  ["198.51.100.0", 24, "documentation"],
  ["203.0.113.0", 24, "documentation"],
  ["192.0.0.0", 24, "protocol"],
  ["198.18.0.0", 15, "benchmarking"],
  ["192.168.0.0", 16, "private"],
  ["169.254.0.0", 16, "link-local"],
  ["172.16.0.0", 12, "private"],
  ["100.64.0.0", 10, "shared"],
  ["0.0.0.0", 8, "this-network"],
  ["10.0.0.0", 8, "private"],
  ["127.0.0.0", 8, "loopback"],
  ["224.0.0.0", 4, "multicast"],
  ["240.0.0.0", 4, "reserved"],
];

export function scopeOf(ip: number): { scope: V4Scope; range: string } {
  for (const [net, p, scope] of V4_RANGES) {
    const n = parseIPv4(net) ?? 0;
    if ((ip & maskOf(p)) >>> 0 === n) return { scope, range: `${net}/${p}` };
  }
  return { scope: "public", range: "" };
}

/** The historical class (before CIDR): A, B, C, D (multicast) or E (reserved). */
export function classOf(ip: number): "A" | "B" | "C" | "D" | "E" {
  const first = ip >>> 24;
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D";
  return "E";
}

export interface Subnet4 {
  ip: string;
  prefix: number;
  cidr: string;
  network: string;
  broadcast: string;
  netmask: string;
  wildcard: string;
  first: string;
  last: string;
  /** Addresses in the block. */
  total: number;
  /** Usable host addresses: total − 2, except /31 (2, RFC 3021) and /32 (1). */
  hosts: number;
  ipClass: "A" | "B" | "C" | "D" | "E";
  scope: V4Scope;
  scopeRange: string;
  /** Dotted binary of the address, with the network bits before a "|" … only for display. */
  binary: string;
  binaryMask: string;
  hex: string;
  integer: number;
  /** True when the address typed is not the network address. */
  hostBits: boolean;
}

const bin8 = (n: number) =>
  [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
    .map((o) => o.toString(2).padStart(8, "0"))
    .join(".");

export function subnet4(ip: number, prefix: number): Subnet4 {
  const mask = maskOf(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const total = 2 ** (32 - prefix);
  const first = prefix >= 31 ? network : network + 1;
  const last = prefix >= 31 ? broadcast : broadcast - 1;
  const { scope, range } = scopeOf(ip);
  return {
    ip: formatIPv4(ip),
    prefix,
    cidr: `${formatIPv4(network)}/${prefix}`,
    network: formatIPv4(network),
    broadcast: formatIPv4(broadcast),
    netmask: formatIPv4(mask),
    wildcard: formatIPv4(~mask >>> 0),
    first: formatIPv4(first),
    last: formatIPv4(last),
    total,
    hosts: prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2,
    ipClass: classOf(ip),
    scope,
    scopeRange: range,
    binary: bin8(ip),
    binaryMask: bin8(mask),
    hex: `0x${ip.toString(16).padStart(8, "0")}`,
    integer: ip,
    hostBits: ip !== network,
  };
}

/** Splits a block into at least `count` equal subnets (a power of two). */
export function split4(
  ip: number,
  prefix: number,
  count: number,
  limit = 256,
): { ok: true; prefix: number; count: number; subnets: Subnet4[] } | { ok: false } {
  if (!Number.isInteger(count) || count < 1) return { ok: false };
  const bits = Math.ceil(Math.log2(count));
  const p = prefix + bits;
  if (p > 32) return { ok: false };
  const network = (ip & maskOf(prefix)) >>> 0;
  const n = 2 ** bits;
  const size = 2 ** (32 - p);
  const subnets: Subnet4[] = [];
  for (let i = 0; i < Math.min(n, limit); i++) subnets.push(subnet4(network + i * size, p));
  return { ok: true, prefix: p, count: n, subnets };
}

/* --- IPv6 ------------------------------------------------------------------- */

const MAX6 = (1n << 128n) - 1n;

/** Parses an IPv6 address (with "::" and an optional trailing dotted IPv4). */
export function parseIPv6(text: string): bigint | null {
  let s = text.trim().toLowerCase();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  if (!s || /[^0-9a-f:.]/.test(s)) return null;
  // A trailing dotted IPv4 (::ffff:192.0.2.1) stands for the last two groups.
  const v4 = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (v4?.[1]) {
    const n = parseIPv4(v4[1]);
    if (n === null) return null;
    s = `${s.slice(0, s.length - v4[1].length)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const split = (h: string) => (h ? h.split(":") : []);
  const front = split(halves[0] ?? "");
  const back = split(halves[1] ?? "");
  let groups = front;
  if (halves.length === 2) {
    if (front.length + back.length > 7) return null;
    groups = [...front, ...Array<string>(8 - front.length - back.length).fill("0"), ...back];
  }
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(Number.parseInt(g, 16));
  }
  return n;
}

function groups6(n: bigint): number[] {
  const out: number[] = [];
  for (let i = 7; i >= 0; i--) out.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  return out;
}

/** All eight groups, four digits each. */
export function expandIPv6(n: bigint): string {
  return groups6(n)
    .map((g) => g.toString(16).padStart(4, "0"))
    .join(":");
}

/** RFC 5952: lowercase, no leading zeros, "::" for the longest run of two or more zero groups. */
export function compressIPv6(n: bigint): string {
  const g = groups6(n);
  // IPv4-mapped addresses are written with the IPv4 part dotted.
  if (n >> 32n === 0xffffn) return `::ffff:${formatIPv4(Number(n & 0xffffffffn))}`;
  let best = -1;
  let bestLen = 1;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen) {
      best = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (best < 0) return hex.join(":");
  return `${hex.slice(0, best).join(":")}::${hex.slice(best + bestLen).join(":")}`;
}

export type V6Scope =
  | "unspecified"
  | "loopback"
  | "ipv4-mapped"
  | "documentation"
  | "6to4"
  | "teredo"
  | "link-local"
  | "unique-local"
  | "multicast"
  | "global"
  | "reserved";

const V6_RANGES: [string, number, V6Scope][] = [
  ["::", 128, "unspecified"],
  ["::1", 128, "loopback"],
  ["::ffff:0:0", 96, "ipv4-mapped"],
  ["2001:db8::", 32, "documentation"],
  ["2001::", 32, "teredo"],
  ["2002::", 16, "6to4"],
  ["fe80::", 10, "link-local"],
  ["fc00::", 7, "unique-local"],
  ["ff00::", 8, "multicast"],
  ["2000::", 3, "global"],
];

const mask6 = (p: number) => (p === 0 ? 0n : (MAX6 >> BigInt(128 - p)) << BigInt(128 - p));

export function scopeOf6(n: bigint): V6Scope {
  for (const [net, p, scope] of V6_RANGES) if ((n & mask6(p)) === parseIPv6(net)) return scope;
  return "reserved";
}

/** Address part and prefix of "2001:db8::1/64" (no prefix: /128). */
export function parseCidr6(
  text: string,
): { ok: true; ip: bigint; prefix: number } | { ok: false; error: ParseError } {
  const s = text.trim();
  if (!s) return { ok: false, error: "empty" };
  const [addr = "", p, extra] = s.split("/");
  if (extra !== undefined) return { ok: false, error: "prefix" };
  const ip = parseIPv6(addr);
  if (ip === null) return { ok: false, error: "address" };
  if (p === undefined) return { ok: true, ip, prefix: 128 };
  if (!/^\d{1,3}$/.test(p.trim()) || Number(p) > 128) return { ok: false, error: "prefix" };
  return { ok: true, ip, prefix: Number(p) };
}

export interface Subnet6 {
  compressed: string;
  expanded: string;
  prefix: number;
  network: string;
  first: string;
  last: string;
  /** 2^(128 − prefix), exact. */
  total: bigint;
  scope: V6Scope;
  /** Reverse DNS name of the address (ip6.arpa). */
  reverse: string;
}

export function subnet6(ip: bigint, prefix: number): Subnet6 {
  const m = mask6(prefix);
  const network = ip & m;
  const last = network | (MAX6 ^ m);
  return {
    compressed: compressIPv6(ip),
    expanded: expandIPv6(ip),
    prefix,
    network: `${compressIPv6(network)}/${prefix}`,
    first: compressIPv6(network),
    last: compressIPv6(last),
    total: 1n << BigInt(128 - prefix),
    scope: scopeOf6(ip),
    reverse: `${[...expandIPv6(ip).replace(/:/g, "")].reverse().join(".")}.ip6.arpa`,
  };
}

/** 2^n written with thousands separators when exact and short, else as a power of two. */
export function powerLabel(total: bigint): string {
  const bits = total.toString(2).length - 1;
  return bits <= 64 ? total.toLocaleString("en-US") : `2^${bits}`;
}
