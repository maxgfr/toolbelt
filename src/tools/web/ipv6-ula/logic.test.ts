import { describe, expect, it } from "bun:test";
import { exampleHost, parseUla, randomGlobalId, subnet64, subnets, ulaInfo } from "./logic";

describe("ipv6-ula", () => {
  it("makes a 40-bit Global ID from random bytes", () => {
    expect(randomGlobalId((a) => a.fill(0xab))).toBe("abababab" + "ab");
    for (let i = 0; i < 20; i++)
      expect(randomGlobalId((a) => crypto.getRandomValues(a))).toMatch(/^[0-9a-f]{10}$/);
  });

  it("builds the /48 prefix and its range", () => {
    expect(ulaInfo("123456789a")).toEqual({
      prefix: "fd12:3456:789a::/48",
      globalId: "12:3456:789a",
      first: "fd12:3456:789a::",
      last: "fd12:3456:789a:ffff:ffff:ffff:ffff:ffff",
    });
    expect(ulaInfo("0000000000").prefix).toBe("fd00::/48");
    expect(ulaInfo("00000a0000").prefix).toBe("fd00:a::/48");
  });

  it("lists /64 subnets", () => {
    expect(subnet64("123456789a", 0)).toBe("fd12:3456:789a::/64");
    expect(subnet64("123456789a", 1)).toBe("fd12:3456:789a:1::/64");
    expect(subnet64("123456789a", 0xffff)).toBe("fd12:3456:789a:ffff::/64");
    expect(subnet64("123456789a", 99999)).toBe("fd12:3456:789a:ffff::/64");
    expect(subnets("123456789a", 0xfffe, 5)).toEqual([
      "fd12:3456:789a:fffe::/64",
      "fd12:3456:789a:ffff::/64",
    ]);
    expect(subnets("123456789a", 16, 2)).toEqual([
      "fd12:3456:789a:10::/64",
      "fd12:3456:789a:11::/64",
    ]);
    expect(exampleHost("123456789a", 1)).toBe("fd12:3456:789a:1::1");
  });

  it("reads a Global ID or an existing ULA", () => {
    expect(parseUla("12:3456:789a")).toEqual({
      ok: true,
      id: "123456789a",
      subnet: null,
      warning: null,
    });
    expect(parseUla("123456789A")).toMatchObject({ ok: true, id: "123456789a" });
    expect(parseUla("fd12:3456:789a::/48")).toEqual({
      ok: true,
      id: "123456789a",
      subnet: null,
      warning: null,
    });
    expect(parseUla("fd12:3456:789a:2a::5")).toMatchObject({ id: "123456789a", subnet: 0x2a });
    expect(parseUla("fc00:1::/48")).toMatchObject({ ok: true, warning: "fc" });
  });

  it("rejects what is not a ULA", () => {
    expect(parseUla("")).toEqual({ ok: false, error: "empty" });
    expect(parseUla("2001:db8::/32")).toEqual({ ok: false, error: "not-ula" });
    expect(parseUla("fd12:zz::")).toEqual({ ok: false, error: "syntax" });
    expect(parseUla("fd00::/48/2")).toEqual({ ok: false, error: "syntax" });
    expect(parseUla("123")).toEqual({ ok: false, error: "syntax" });
  });
});
