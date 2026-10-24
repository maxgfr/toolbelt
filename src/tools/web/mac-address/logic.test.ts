import { describe, expect, it } from "bun:test";
import {
  formatMac,
  macInfo,
  parseMac,
  parseMacList,
  parsePrefix,
  randomMac,
  randomMacs,
} from "./logic";

const SAMPLE = [0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e];

/** A deterministic "random" source: a counter. */
function counter(start = 0) {
  let n = start;
  return (a: Uint8Array) => {
    for (let i = 0; i < a.length; i++) a[i] = n++ & 255;
  };
}
const fill = (v: number) => (a: Uint8Array) => a.fill(v);

describe("mac-address — format and parse", () => {
  it("formats in every notation", () => {
    expect(formatMac(SAMPLE, "colon")).toBe("00:1a:2b:3c:4d:5e");
    expect(formatMac(SAMPLE, "dash", true)).toBe("00-1A-2B-3C-4D-5E");
    expect(formatMac(SAMPLE, "dot")).toBe("001a.2b3c.4d5e");
    expect(formatMac(SAMPLE, "none", true)).toBe("001A2B3C4D5E");
  });

  it("parses every notation back", () => {
    for (const s of [
      "00:1a:2b:3c:4d:5e",
      "00-1A-2B-3C-4D-5E",
      "001a.2b3c.4d5e",
      "001A2B3C4D5E",
      "  0:1a:2b:3c:4d:5e ",
      "00 1a 2b 3c 4d 5e",
    ])
      expect(parseMac(s)).toEqual(SAMPLE);
  });

  it("rejects malformed addresses", () => {
    for (const s of [
      "",
      "00:1a:2b:3c:4d",
      "00:1a:2b:3c:4d:5e:6f",
      "00:1a-2b:3c:4d:5e",
      "001a2b3c4d5g",
      "001a.2b3c",
      "000:1a:2b:3c:4d:5e",
      "zz:zz:zz:zz:zz:zz",
    ])
      expect(parseMac(s)).toBeNull();
  });

  it("parses prefixes", () => {
    expect(parsePrefix("")).toEqual([]);
    expect(parsePrefix("00:1A:2B")).toEqual([0, 0x1a, 0x2b]);
    expect(parsePrefix("02")).toEqual([2]);
    expect(parsePrefix("abc")).toBeNull();
    expect(parsePrefix("00:11:22:33:44:55")).toBeNull();
    expect(parsePrefix("xx")).toBeNull();
  });
});

describe("mac-address — generate", () => {
  it("sets the U/L and I/G bits as asked", () => {
    const local = randomMac({ prefix: [], local: true, unicast: true }, fill(0xff));
    expect(local[0]).toBe(0xfe);
    const universal = randomMac({ prefix: [], local: false, unicast: true }, fill(0xff));
    expect(universal[0]).toBe(0xfc);
    const multicast = randomMac({ prefix: [], local: true, unicast: false }, fill(0));
    expect(multicast[0]).toBe(0x03);
    for (let i = 0; i < 50; i++) {
      const m = randomMac({ prefix: [], local: true, unicast: true }, (a) =>
        crypto.getRandomValues(a),
      );
      expect(m).toHaveLength(6);
      expect((m[0] ?? 0) & 3).toBe(2);
    }
  });

  it("keeps a prefix as given", () => {
    const m = randomMac({ prefix: [0x01, 0x80, 0xc2], local: true, unicast: true }, fill(0x77));
    expect(m).toEqual([0x01, 0x80, 0xc2, 0x77, 0x77, 0x77]);
  });

  it("makes distinct addresses, limited by the room left", () => {
    const list = randomMacs(20, { prefix: [], local: true, unicast: true }, counter());
    expect(list).toHaveLength(20);
    expect(new Set(list.map((m) => formatMac(m, "none"))).size).toBe(20);
    // A 5-byte prefix leaves 256 addresses.
    const tight = randomMacs(1000, { prefix: [1, 2, 3, 4, 5], local: true, unicast: true }, (a) =>
      crypto.getRandomValues(a),
    );
    expect(tight.length).toBeLessThanOrEqual(256);
    expect(randomMacs(0, { prefix: [], local: true, unicast: true }, counter())).toEqual([]);
  });
});

describe("mac-address — info", () => {
  it("reads the flag bits", () => {
    expect(macInfo(SAMPLE)).toMatchObject({ group: false, local: false, broadcast: false });
    expect(macInfo([0x02, 0, 0, 0, 0, 1])).toMatchObject({ group: false, local: true });
    expect(macInfo([0x01, 0x00, 0x5e, 0, 0, 1])).toMatchObject({ group: true, local: false });
    expect(macInfo([255, 255, 255, 255, 255, 255])).toMatchObject({ broadcast: true, group: true });
    expect(macInfo([0, 0, 0, 0, 0, 0]).zero).toBe(true);
  });

  it("gives the OUI, the modified EUI-64 and the link-local address", () => {
    const i = macInfo(SAMPLE);
    expect(i.oui).toBe("00:1A:2B");
    expect(i.nic).toBe("3C:4D:5E");
    expect(i.firstByte).toBe("00000000");
    expect(i.eui64).toBe("021a:2bff:fe3c:4d5e");
    expect(i.linkLocal).toBe("fe80::21a:2bff:fe3c:4d5e");
    expect(macInfo([0x02, 0, 0, 0, 0, 1]).linkLocal).toBe("fe80::ff:fe00:1");
  });

  it("parses a list line by line", () => {
    expect(parseMacList("00:1a:2b:3c:4d:5e\n\n  nope \n")).toEqual([
      { line: "00:1a:2b:3c:4d:5e", bytes: SAMPLE },
      { line: "nope", bytes: null },
    ]);
  });
});
