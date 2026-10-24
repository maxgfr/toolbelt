/**
 * Random port picking: distinct ports in a range, avoiding well-known ports (< 1024), the
 * bundled list of commonly used ones and, if asked, the Linux ephemeral range. Plus a search
 * of that list.
 */
import { matchesQuery } from "../_shared";
import { PORTS, type PortEntry, type Proto } from "./data";

export type RangeId = "registered" | "dynamic" | "unprivileged" | "custom";

export const RANGES: Record<Exclude<RangeId, "custom">, [number, number]> = {
  registered: [1024, 49151],
  dynamic: [49152, 65535],
  unprivileged: [1024, 65535],
};

/** Linux's default net.ipv4.ip_local_port_range (outgoing connections). */
export const LINUX_EPHEMERAL: [number, number] = [32768, 60999];

export const COMMON_PORTS: ReadonlySet<number> = new Set(PORTS.map((p) => p.port));

export interface PickOptions {
  min: number;
  max: number;
  /** Skip 0–1023. */
  skipWellKnown: boolean;
  /** Skip the ports of the bundled reference. */
  skipCommon: boolean;
  /** Skip 32768–60999. */
  skipEphemeral: boolean;
  /** Extra ports to skip. */
  exclude?: Iterable<number>;
}

/** The ports allowed by `opts`, in order (empty when the range is invalid). */
export function candidates(opts: PickOptions): number[] {
  const min = Math.max(0, Math.ceil(opts.min));
  const max = Math.min(65535, Math.floor(opts.max));
  const extra = new Set(opts.exclude ?? []);
  const out: number[] = [];
  for (let p = Math.max(min, 1); p <= max; p++) {
    if (opts.skipWellKnown && p < 1024) continue;
    if (opts.skipCommon && COMMON_PORTS.has(p)) continue;
    if (opts.skipEphemeral && p >= LINUX_EPHEMERAL[0] && p <= LINUX_EPHEMERAL[1]) continue;
    if (extra.has(p)) continue;
    out.push(p);
  }
  return out;
}

/**
 * Up to `count` distinct random ports among the candidates. `randomInt(n)` returns a uniform
 * integer in [0, n).
 */
export function randomPorts(
  count: number,
  opts: PickOptions,
  randomInt: (n: number) => number,
): number[] {
  const pool = candidates(opts);
  const n = Math.max(0, Math.min(Math.floor(count), pool.length));
  // Partial Fisher–Yates shuffle.
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(pool.length - i);
    const a = pool[i] as number;
    pool[i] = pool[j] as number;
    pool[j] = a;
  }
  return pool.slice(0, n);
}

/** A uniform integer in [0, n) from the platform's cryptographic generator (no modulo bias). */
export function cryptoInt(n: number): number {
  if (n <= 1) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0] as number;
    if (v < limit) return v % n;
  }
}

/** IANA's name for the range a port is in. */
export function portClass(port: number): "system" | "registered" | "dynamic" | "invalid" {
  if (!Number.isInteger(port) || port < 0 || port > 65535) return "invalid";
  return port < 1024 ? "system" : port < 49152 ? "registered" : "dynamic";
}

/**
 * Entries matching `query`: a number gives the ports starting with it, words are searched in
 * names and both languages' descriptions.
 */
export function searchPorts(query: string, proto: Proto | "all" = "all"): PortEntry[] {
  const q = query.trim();
  const list = PORTS.filter((p) => proto === "all" || p.proto === proto || p.proto === "both");
  if (!q) return list;
  if (/^\d{1,5}$/.test(q)) return list.filter((p) => String(p.port).startsWith(q));
  return list.filter((p) => matchesQuery(q, p.port, p.name, p.en, p.fr, p.proto));
}
