import { describe, expect, it } from "bun:test";
import { belowAbsoluteZero, CATEGORIES, convert, convertAll } from "./logic";

describe("units", () => {
  it("converts lengths, metric and imperial", () => {
    expect(convert(1, "length", "in", "cm")).toBeCloseTo(2.54, 12);
    expect(convert(1, "length", "mi", "km")).toBeCloseTo(1.609344, 12);
    expect(convert(6, "length", "ft", "m")).toBeCloseTo(1.8288, 12);
    expect(convert(1, "length", "nmi", "m")).toBe(1852);
  });

  it("converts temperatures with offsets", () => {
    expect(convert(100, "temperature", "c", "f")).toBeCloseTo(212, 10);
    expect(convert(32, "temperature", "f", "c")).toBeCloseTo(0, 10);
    expect(convert(-40, "temperature", "c", "f")).toBeCloseTo(-40, 10);
    expect(convert(0, "temperature", "k", "c")).toBeCloseTo(-273.15, 10);
    expect(convert(0, "temperature", "c", "r")).toBeCloseTo(491.67, 10);
    expect(belowAbsoluteZero(-300, "temperature", "c")).toBe(true);
    expect(belowAbsoluteZero(-459.67, "temperature", "f")).toBe(false);
    expect(belowAbsoluteZero(-300, "length", "m")).toBe(false);
  });

  it("converts mass, volume, area, speed and time", () => {
    expect(convert(1, "mass", "lb", "kg")).toBeCloseTo(0.45359237, 12);
    expect(convert(1, "mass", "kg", "oz")).toBeCloseTo(35.27396195, 6);
    expect(convert(1, "volume", "gal", "l")).toBeCloseTo(3.785411784, 12);
    expect(convert(1, "volume", "cup", "ml")).toBeCloseTo(236.5882365, 6);
    expect(convert(1, "area", "ha", "ac")).toBeCloseTo(2.4710538, 6);
    expect(convert(100, "speed", "kmh", "mph")).toBeCloseTo(62.1371192, 6);
    expect(convert(1, "speed", "kn", "kmh")).toBeCloseTo(1.852, 12);
    expect(convert(1, "time", "d", "min")).toBe(1440);
  });

  it("converts energy, pressure and data rates", () => {
    expect(convert(1, "energy", "kwh", "mj")).toBeCloseTo(3.6, 12);
    expect(convert(1, "energy", "kcal", "kj")).toBeCloseTo(4.184, 12);
    expect(convert(1, "pressure", "atm", "hpa")).toBeCloseTo(1013.25, 10);
    expect(convert(1, "pressure", "bar", "psi")).toBeCloseTo(14.5037738, 6);
    expect(convert(100, "datarate", "mbps", "MBps")).toBe(12.5);
  });

  it("lists every unit of a category", () => {
    const all = convertAll(1, "length", "m");
    expect(all).toHaveLength(CATEGORIES[0]?.units.length ?? 0);
    expect(all.find((r) => r.unit.id === "cm")?.value).toBe(100);
  });

  it("returns null or nothing for unknown units", () => {
    expect(convert(1, "length", "m", "kg")).toBeNull();
    expect(convertAll(1, "length", "parsec")).toEqual([]);
  });

  it("has unique unit ids and names in every language", () => {
    for (const c of CATEGORIES) {
      const ids = c.units.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(c.name.de).toBeTruthy();
      for (const x of c.units)
        expect(x.name.en && x.name.fr && x.name.de && x.factor > 0).toBeTruthy();
    }
  });
});
