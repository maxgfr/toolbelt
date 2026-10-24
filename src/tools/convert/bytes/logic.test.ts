import { describe, expect, it } from "bun:test";
import { convertSize, humanSize, transferSeconds } from "./logic";

const get = (rows: { id: string; value: number }[], id: string) =>
  rows.find((r) => r.id === id)?.value;

describe("data sizes", () => {
  it("converts between SI, IEC and bits", () => {
    const r = convertSize(1, "GiB");
    expect(get(r, "MiB")).toBe(1024);
    expect(get(r, "B")).toBe(1073741824);
    expect(get(r, "GB")).toBeCloseTo(1.073741824, 12);
    expect(get(r, "bit")).toBe(8589934592);
    expect(get(convertSize(100, "Mbit"), "MB")).toBe(12.5);
    expect(get(convertSize(1, "TB"), "TiB")).toBeCloseTo(0.9094947, 6);
  });

  it("gives nothing for an unknown unit", () => {
    expect(convertSize(1, "XB")).toEqual([]);
  });

  it("picks a readable unit", () => {
    expect(humanSize(1536, "iec")).toEqual({ value: 1.5, id: "KiB" });
    expect(humanSize(1536, "si")).toEqual({ value: 1.536, id: "kB" });
    expect(humanSize(500, "si")).toEqual({ value: 500, id: "B" });
    expect(humanSize(0, "iec")).toEqual({ value: 0, id: "B" });
    expect(humanSize(5e12, "si")).toEqual({ value: 5, id: "TB" });
  });
});

describe("transfer time", () => {
  it("divides size by bandwidth", () => {
    // 1 GB at 100 Mbit/s: 8e9 / 1e8 = 80 s.
    expect(transferSeconds(1, "GB", 100, "Mbit/s")).toBe(80);
    expect(transferSeconds(1, "MiB", 1, "MiB/s")).toBe(1);
    expect(transferSeconds(0, "GB", 10, "Mbit/s")).toBe(0);
  });

  it("refuses a zero or negative rate", () => {
    expect(transferSeconds(1, "GB", 0, "Mbit/s")).toBeNull();
    expect(transferSeconds(1, "GB", -5, "Mbit/s")).toBeNull();
    expect(transferSeconds(-1, "GB", 5, "Mbit/s")).toBeNull();
  });
});
