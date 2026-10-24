import { describe, expect, it } from "bun:test";
import {
  checkMembership,
  listAddresses,
  notations,
  parseAnyIPv4,
  parseBlock,
  parseRange,
  rangeToCidrs,
} from "./logic";

const ip = (s: string) => {
  const r = parseAnyIPv4(s);
  if (!r) throw new Error(s);
  return r.ip;
};

describe("ip-tools — notations", () => {
  it("reads every notation of the same address", () => {
    const want = 3232235777; // 192.168.1.1
    for (const s of [
      "192.168.1.1",
      " 3232235777 ",
      "0xC0A80101",
      "0xc0a80101",
      "C0.A8.01.01",
      "11000000.10101000.00000001.00000001",
      "11000000101010000000000100000001",
      "0300.0250.01.01",
      "::ffff:192.168.1.1",
      "::ffff:c0a8:101",
      "0:0:0:0:0:ffff:c0a8:0101",
    ])
      expect(ip(s)).toBe(want);
  });

  it("tells which notation it read", () => {
    expect(parseAnyIPv4("10.0.0.1")?.kind).toBe("dotted");
    expect(parseAnyIPv4("010.0.0.1")?.kind).toBe("octal");
    expect(parseAnyIPv4("010.0.0.1")?.ip).toBe(ip("8.0.0.1"));
    expect(parseAnyIPv4("167772161")?.kind).toBe("decimal");
    expect(parseAnyIPv4("::ffff:10.0.0.1")?.kind).toBe("mapped");
  });

  it("rejects what is not an IPv4 address", () => {
    for (const s of [
      "",
      "  ",
      "256.1.1.1",
      "4294967296",
      "1.2.3",
      "0x1FFFFFFFF",
      "2001:db8::1",
      "abc",
      "1.2.3.4.5",
      "09.1.1.1x",
    ])
      expect(parseAnyIPv4(s)).toBeNull();
  });

  it("formats every notation", () => {
    const n = notations(ip("192.168.1.1"));
    expect(n).toMatchObject({
      dotted: "192.168.1.1",
      decimal: "3232235777",
      hex: "0xC0A80101",
      hexDotted: "C0.A8.01.01",
      binary: "11000000.10101000.00000001.00000001",
      octal: "030052000401",
      octalDotted: "0300.0250.0001.0001",
      mapped: "::ffff:192.168.1.1",
      mappedHex: "::ffff:c0a8:101",
      mappedFull: "0000:0000:0000:0000:0000:ffff:c0a8:0101",
      sixToFour: "2002:c0a8:101::/48",
      reverse: "1.1.168.192.in-addr.arpa",
    });
    expect(notations(0).hex).toBe("0x00000000");
    expect(notations(0xffffffff).dotted).toBe("255.255.255.255");
  });
});

describe("ip-tools — ranges", () => {
  it("parses ranges, blocks and single addresses", () => {
    expect(parseRange("10.0.0.5 - 10.0.0.20")).toEqual({
      ok: true,
      start: ip("10.0.0.5"),
      end: ip("10.0.0.20"),
    });
    expect(parseRange("10.0.0.5-10.0.0.20")).toMatchObject({ ok: true });
    expect(parseRange("10.0.0.5 10.0.0.20")).toMatchObject({ ok: true });
    expect(parseRange("10.1.2.3/24")).toEqual({
      ok: true,
      start: ip("10.1.2.0"),
      end: ip("10.1.2.255"),
    });
    expect(parseRange("10.0.0.1")).toEqual({
      ok: true,
      start: ip("10.0.0.1"),
      end: ip("10.0.0.1"),
    });
  });

  it("reports bad ranges", () => {
    expect(parseRange("")).toEqual({ ok: false, error: "empty" });
    expect(parseRange("x - 10.0.0.1")).toEqual({ ok: false, error: "start" });
    expect(parseRange("10.0.0.1 - y")).toEqual({ ok: false, error: "end" });
    expect(parseRange("10.0.0.9 - 10.0.0.1")).toEqual({ ok: false, error: "order" });
    expect(parseRange("10.0.0.0/33")).toEqual({ ok: false, error: "syntax" });
  });

  it("covers a range with the fewest CIDR blocks", () => {
    expect(rangeToCidrs(ip("10.0.0.0"), ip("10.0.0.255"))).toEqual(["10.0.0.0/24"]);
    expect(rangeToCidrs(ip("10.0.0.5"), ip("10.0.0.20"))).toEqual([
      "10.0.0.5/32",
      "10.0.0.6/31",
      "10.0.0.8/29",
      "10.0.0.16/30",
      "10.0.0.20/32",
    ]);
    expect(rangeToCidrs(ip("192.168.0.0"), ip("192.168.3.255"))).toEqual(["192.168.0.0/22"]);
    expect(rangeToCidrs(0, 0xffffffff)).toEqual(["0.0.0.0/0"]);
    expect(rangeToCidrs(ip("255.255.255.255"), ip("255.255.255.255"))).toEqual([
      "255.255.255.255/32",
    ]);
    expect(rangeToCidrs(ip("0.0.0.1"), 0xffffffff)).toHaveLength(32);
  });

  it("lists addresses with a cap", () => {
    const r = listAddresses(ip("10.0.0.254"), ip("10.0.1.1"), 100);
    expect(r).toEqual({
      addresses: ["10.0.0.254", "10.0.0.255", "10.0.1.0", "10.0.1.1"],
      total: 4,
      truncated: false,
    });
    const big = listAddresses(0, 0xffffffff, 3);
    expect(big.addresses).toEqual(["0.0.0.0", "0.0.0.1", "0.0.0.2"]);
    expect(big.total).toBe(4294967296);
    expect(big.truncated).toBe(true);
  });
});

describe("ip-tools — membership", () => {
  it("parses blocks of both versions", () => {
    expect(parseBlock("10.1.2.3/8")).toEqual({ v: 4, net: BigInt(ip("10.0.0.0")), prefix: 8 });
    expect(parseBlock("2001:db8::1/32")?.prefix).toBe(32);
    expect(parseBlock("10.0.0.1")?.prefix).toBe(32);
    expect(parseBlock("10.0.0.0/33")).toBeNull();
    expect(parseBlock("10.0.0.0/8/8")).toBeNull();
    expect(parseBlock("nope/8")).toBeNull();
  });

  it("checks an address against a list", () => {
    const list =
      "10.0.0.0/8\n# a comment\n\n192.168.0.0/16 # home\n2001:db8::/32\nbad/99\n10.1.2.3";
    expect(checkMembership("10.1.2.3", list)).toEqual([
      { line: "10.0.0.0/8", status: "in", block: "10.0.0.0/8" },
      { line: "192.168.0.0/16", status: "out", block: "192.168.0.0/16" },
      { line: "2001:db8::/32", status: "other-version", block: "2001:db8::/32" },
      { line: "bad/99", status: "invalid" },
      { line: "10.1.2.3", status: "in", block: "10.1.2.3/32" },
    ]);
    expect(
      checkMembership("2001:db8:1::5", "2001:db8::/32\n2001:db9::/32").map((m) => m.status),
    ).toEqual(["in", "out"]);
  });

  it("matches IPv4-mapped addresses and handles /0", () => {
    expect(checkMembership("::ffff:10.0.0.1", "10.0.0.0/8")[0]?.status).toBe("in");
    expect(checkMembership("8.8.8.8", "0.0.0.0/0")[0]?.status).toBe("in");
    expect(checkMembership("::1", "::/0")[0]?.status).toBe("in");
  });

  it("marks blocks pending without a valid address", () => {
    expect(checkMembership("", "10.0.0.0/8")).toEqual([
      { line: "10.0.0.0/8", status: "pending", block: "10.0.0.0/8" },
    ]);
    expect(checkMembership("10.0.0.1", "")).toEqual([]);
  });
});
