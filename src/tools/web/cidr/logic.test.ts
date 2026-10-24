import { describe, expect, it } from "bun:test";
import {
  compressIPv6,
  expandIPv6,
  formatIPv4,
  parseCidr4,
  parseCidr6,
  parseIPv4,
  parseIPv6,
  powerLabel,
  prefixOfMask,
  split4,
  subnet4,
  subnet6,
} from "./logic";

const v4 = (s: string) => {
  const r = parseCidr4(s);
  if (!r.ok) throw new Error(r.error);
  return subnet4(r.ip, r.prefix);
};
const v6 = (s: string) => {
  const n = parseIPv6(s);
  if (n === null) throw new Error(s);
  return n;
};

describe("cidr — IPv4", () => {
  it("parses and formats addresses", () => {
    expect(parseIPv4("192.168.1.10")).toBe(3232235786);
    expect(formatIPv4(3232235786)).toBe("192.168.1.10");
    expect(formatIPv4(0xffffffff)).toBe("255.255.255.255");
    expect(parseIPv4("256.1.1.1")).toBeNull();
    expect(parseIPv4("1.2.3")).toBeNull();
    expect(parseIPv4("1.2.3.x")).toBeNull();
    expect(parseIPv4("")).toBeNull();
  });

  it("accepts a prefix, a netmask or nothing", () => {
    expect(parseCidr4("10.0.0.1/8")).toEqual({ ok: true, ip: 167772161, prefix: 8 });
    expect(parseCidr4("10.0.0.1 255.255.0.0")).toMatchObject({ ok: true, prefix: 16 });
    expect(parseCidr4("10.0.0.1/255.255.255.0")).toMatchObject({ ok: true, prefix: 24 });
    expect(parseCidr4("10.0.0.1")).toMatchObject({ ok: true, prefix: 32 });
    expect(parseCidr4("")).toEqual({ ok: false, error: "empty" });
    expect(parseCidr4("10.0.0/8")).toEqual({ ok: false, error: "address" });
    expect(parseCidr4("10.0.0.1/33")).toEqual({ ok: false, error: "prefix" });
    expect(parseCidr4("10.0.0.1/255.0.255.0")).toEqual({ ok: false, error: "mask" });
    expect(prefixOfMask(0xffffff00)).toBe(24);
  });

  it("describes a /24", () => {
    const s = v4("192.168.1.130/24");
    expect(s.network).toBe("192.168.1.0");
    expect(s.broadcast).toBe("192.168.1.255");
    expect(s.netmask).toBe("255.255.255.0");
    expect(s.wildcard).toBe("0.0.0.255");
    expect(s.first).toBe("192.168.1.1");
    expect(s.last).toBe("192.168.1.254");
    expect(s.total).toBe(256);
    expect(s.hosts).toBe(254);
    expect(s.ipClass).toBe("C");
    expect(s.scope).toBe("private");
    expect(s.hostBits).toBe(true);
    expect(s.cidr).toBe("192.168.1.0/24");
  });

  it("handles the edge prefixes", () => {
    const all = v4("8.8.8.8/0");
    expect(all.network).toBe("0.0.0.0");
    expect(all.broadcast).toBe("255.255.255.255");
    expect(all.total).toBe(2 ** 32);
    const p2p = v4("10.0.0.0/31");
    expect([p2p.first, p2p.last, p2p.hosts]).toEqual(["10.0.0.0", "10.0.0.1", 2]);
    const one = v4("10.0.0.7/32");
    expect([one.first, one.last, one.hosts]).toEqual(["10.0.0.7", "10.0.0.7", 1]);
  });

  it("knows special-purpose ranges and classes", () => {
    expect(v4("172.20.1.1").scope).toBe("private");
    expect(v4("172.32.0.1").scope).toBe("public");
    expect(v4("100.64.1.1").scope).toBe("shared");
    expect(v4("127.0.0.1").scope).toBe("loopback");
    expect(v4("169.254.10.10").scope).toBe("link-local");
    expect(v4("203.0.113.9").scope).toBe("documentation");
    expect(v4("239.1.1.1").scope).toBe("multicast");
    expect(v4("239.1.1.1").ipClass).toBe("D");
    expect(v4("250.0.0.1").scope).toBe("reserved");
    expect(v4("255.255.255.255").scope).toBe("broadcast");
    expect(v4("8.8.8.8").scope).toBe("public");
    expect(v4("8.8.8.8").ipClass).toBe("A");
  });

  it("splits a network into equal subnets", () => {
    const r = parseCidr4("10.0.0.0/24");
    if (!r.ok) throw new Error();
    const s = split4(r.ip, r.prefix, 3);
    if (!s.ok) throw new Error();
    expect(s.prefix).toBe(26);
    expect(s.count).toBe(4);
    expect(s.subnets.map((x) => x.cidr)).toEqual([
      "10.0.0.0/26",
      "10.0.0.64/26",
      "10.0.0.128/26",
      "10.0.0.192/26",
    ]);
    expect(split4(r.ip, 30, 8).ok).toBe(false);
    expect(split4(r.ip, 24, 0).ok).toBe(false);
    const big = split4(0, 8, 65536, 10);
    expect(big.ok && big.subnets.length).toBe(10);
  });
});

describe("cidr — IPv6", () => {
  it("parses the usual spellings", () => {
    expect(parseIPv6("::")).toBe(0n);
    expect(parseIPv6("::1")).toBe(1n);
    expect(expandIPv6(v6("2001:db8::1"))).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(expandIPv6(v6("fe80::"))).toBe("fe80:0000:0000:0000:0000:0000:0000:0000");
    expect(expandIPv6(v6("[2001:DB8:0:0:1:0:0:1]"))).toBe(
      "2001:0db8:0000:0000:0001:0000:0000:0001",
    );
    expect(expandIPv6(v6("::ffff:192.0.2.1"))).toBe("0000:0000:0000:0000:0000:ffff:c000:0201");
    expect(expandIPv6(v6("64:ff9b::192.0.2.33"))).toBe("0064:ff9b:0000:0000:0000:0000:c000:0221");
  });

  it("rejects malformed addresses", () => {
    for (const s of [
      "",
      "1::2::3",
      "12345::",
      "1:2:3:4:5:6:7:8:9",
      "1:2:3",
      "g::1",
      ":::",
      "::1.2.3",
    ])
      expect(parseIPv6(s)).toBeNull();
  });

  it("compresses per RFC 5952", () => {
    expect(compressIPv6(v6("2001:0db8:0000:0000:0000:0000:0000:0001"))).toBe("2001:db8::1");
    expect(compressIPv6(v6("2001:db8:0:0:1:0:0:1"))).toBe("2001:db8::1:0:0:1");
    expect(compressIPv6(v6("2001:db8:0:1:1:1:1:1"))).toBe("2001:db8:0:1:1:1:1:1");
    expect(compressIPv6(v6("2001:db8:0:0:0:1:0:0"))).toBe("2001:db8::1:0:0");
    expect(compressIPv6(0n)).toBe("::");
    expect(compressIPv6(1n)).toBe("::1");
    expect(compressIPv6(v6("::ffff:c000:201"))).toBe("::ffff:192.0.2.1");
  });

  it("gives the range of a prefix", () => {
    const r = parseCidr6("2001:db8:abcd:12::7/48");
    if (!r.ok) throw new Error();
    const s = subnet6(r.ip, r.prefix);
    expect(s.network).toBe("2001:db8:abcd::/48");
    expect(s.first).toBe("2001:db8:abcd::");
    expect(s.last).toBe("2001:db8:abcd:ffff:ffff:ffff:ffff:ffff");
    expect(s.total).toBe(1n << 80n);
    expect(s.scope).toBe("documentation");
    expect(s.reverse.endsWith(".8.b.d.0.1.0.0.2.ip6.arpa")).toBe(true);
    expect(parseCidr6("::1/129")).toEqual({ ok: false, error: "prefix" });
    expect(parseCidr6("nope/64")).toEqual({ ok: false, error: "address" });
  });

  it("classifies addresses", () => {
    expect(subnet6(v6("fe80::1"), 64).scope).toBe("link-local");
    expect(subnet6(v6("fd12::1"), 64).scope).toBe("unique-local");
    expect(subnet6(v6("ff02::1"), 128).scope).toBe("multicast");
    expect(subnet6(v6("2a00:1450::1"), 128).scope).toBe("global");
    expect(subnet6(v6("::1"), 128).scope).toBe("loopback");
  });

  it("labels huge counts", () => {
    expect(powerLabel(256n)).toBe("256");
    expect(powerLabel(1n << 80n)).toBe("2^80");
  });
});
