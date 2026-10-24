import { describe, expect, it } from "bun:test";
import { PORTS } from "./data";
import {
  COMMON_PORTS,
  candidates,
  cryptoInt,
  type PickOptions,
  portClass,
  RANGES,
  randomPorts,
  searchPorts,
} from "./logic";

const base: PickOptions = {
  min: 1024,
  max: 65535,
  skipWellKnown: true,
  skipCommon: true,
  skipEphemeral: false,
};

describe("random-port — data", () => {
  it("has about 150 unique, valid entries in every language", () => {
    expect(PORTS.length).toBeGreaterThanOrEqual(140);
    const keys = PORTS.map((p) => `${p.port}/${p.proto}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of PORTS) {
      expect(portClass(p.port)).not.toBe("invalid");
      expect(p.name && p.en && p.fr && p.de).toBeTruthy();
    }
  });
});

describe("random-port — pick", () => {
  it("skips well-known, common and ephemeral ports", () => {
    const all = candidates({ ...base, min: 0, skipCommon: false });
    expect(all[0]).toBe(1024);
    const c = candidates(base);
    for (const p of [3000, 3306, 5432, 6379, 8080, 27017]) expect(c).not.toContain(p);
    expect(c).toContain(1025);
    const e = candidates({ ...base, skipEphemeral: true });
    expect(e).not.toContain(40000);
    expect(e).toContain(61000);
  });

  it("never offers port 0 and respects odd bounds", () => {
    expect(
      candidates({ ...base, min: 0, max: 3, skipWellKnown: false, skipCommon: false }),
    ).toEqual([1, 2, 3]);
    expect(candidates({ ...base, min: 5000, max: 4000 })).toEqual([]);
    expect(candidates({ ...base, min: 65530, max: 99999, skipCommon: false })).toHaveLength(6);
    expect(candidates({ ...base, min: 2000, max: 2010, exclude: [2001, 2002] })).not.toContain(
      2001,
    );
  });

  it("picks distinct ports inside the range", () => {
    const opts = { ...base, min: RANGES.dynamic[0], max: RANGES.dynamic[1] };
    const ports = randomPorts(50, opts, cryptoInt);
    expect(ports).toHaveLength(50);
    expect(new Set(ports).size).toBe(50);
    for (const p of ports) {
      expect(p).toBeGreaterThanOrEqual(49152);
      expect(p).toBeLessThanOrEqual(65535);
      expect(COMMON_PORTS.has(p)).toBe(false);
    }
  });

  it("gives as many as the pool allows", () => {
    const small = { ...base, min: 2000, max: 2004, skipCommon: false };
    expect(randomPorts(10, small, cryptoInt).sort()).toEqual([2000, 2001, 2002, 2003, 2004]);
    expect(randomPorts(0, small, cryptoInt)).toEqual([]);
    expect(randomPorts(3, { ...base, min: 10, max: 5 }, cryptoInt)).toEqual([]);
  });

  it("is deterministic with a fixed random source", () => {
    const first = () => 0;
    expect(randomPorts(3, { ...base, min: 2000, max: 2010, skipCommon: false }, first)).toEqual([
      2000, 2001, 2002,
    ]);
  });

  it("draws uniform integers", () => {
    for (let i = 0; i < 200; i++) {
      const v = cryptoInt(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
    expect(cryptoInt(1)).toBe(0);
  });

  it("classes ports", () => {
    expect(portClass(80)).toBe("system");
    expect(portClass(8080)).toBe("registered");
    expect(portClass(50000)).toBe("dynamic");
    expect(portClass(70000)).toBe("invalid");
  });
});

describe("random-port — search", () => {
  it("finds by number prefix, name and words in both languages", () => {
    expect(searchPorts("5432").map((p) => p.name)).toEqual(["PostgreSQL"]);
    expect(searchPorts("22").map((p) => p.port)).toContain(2222);
    expect(searchPorts("postgres").map((p) => p.port)).toEqual([5432]);
    expect(searchPorts("bureau distance").map((p) => p.port)).toContain(3389);
    expect(searchPorts("remote desktop").map((p) => p.port)).toContain(3389);
    expect(searchPorts("remotedesktop").map((p) => p.port)).toContain(3389);
    expect(searchPorts("zeitsynchronisation").map((p) => p.port)).toEqual([123]);
    expect(searchPorts("zzzz")).toEqual([]);
    expect(searchPorts("")).toHaveLength(PORTS.length);
  });

  it("filters by protocol, keeping entries on both", () => {
    const udp = searchPorts("", "udp");
    expect(udp.every((p) => p.proto !== "tcp")).toBe(true);
    expect(udp.map((p) => p.port)).toContain(53);
  });
});
