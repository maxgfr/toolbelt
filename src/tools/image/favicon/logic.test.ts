import { describe, expect, it } from "bun:test";
import {
  containRect,
  fitFontSize,
  ICO_SIZES,
  ICON_FILES,
  iconLayout,
  linkTags,
  manifest,
  readIco,
  writeIco,
} from "./logic";

const fakePng = (n: number, fill: number) => new Uint8Array(n).fill(fill);

describe("ICO", () => {
  it("writes a directory of PNG entries", () => {
    const ico = writeIco([
      { size: 16, png: fakePng(10, 1) },
      { size: 32, png: fakePng(20, 2) },
      { size: 256, png: fakePng(5, 3) },
    ]);
    const dv = new DataView(ico.buffer);
    expect(ico.length).toBe(6 + 3 * 16 + 35);
    expect([dv.getUint16(0, true), dv.getUint16(2, true), dv.getUint16(4, true)]).toEqual([
      0, 1, 3,
    ]);
    // First entry: 16×16, 1 plane, 32 bpp, 10 bytes at offset 54.
    expect([ico[6], ico[7], ico[8], ico[9]]).toEqual([16, 16, 0, 0]);
    expect(dv.getUint16(10, true)).toBe(1);
    expect(dv.getUint16(12, true)).toBe(32);
    expect(dv.getUint32(14, true)).toBe(10);
    expect(dv.getUint32(18, true)).toBe(54);
    // 256 px is stored as 0.
    expect(ico[6 + 32]).toBe(0);
    const back = readIco(ico);
    expect(back.map((e) => [e.width, e.height, e.bpp, e.data.length, e.data[0]])).toEqual([
      [16, 16, 32, 10, 1],
      [32, 32, 32, 20, 2],
      [256, 256, 32, 5, 3],
    ]);
  });

  it("rejects bad input", () => {
    expect(() => writeIco([])).toThrow(/at least one/);
    expect(() => writeIco([{ size: 300, png: fakePng(1, 0) }])).toThrow(/256/);
    expect(() => readIco(new Uint8Array([0, 0, 2, 0, 0, 0]))).toThrow(/ICO/);
    const ico = writeIco([{ size: 16, png: fakePng(10, 1) }]);
    expect(() => readIco(ico.subarray(0, 30))).toThrow(/Truncated/);
  });
});

describe("files and snippets", () => {
  it("covers the usual sizes", () => {
    expect(ICON_FILES.map((f) => f.size)).toEqual([16, 32, 48, 180, 192, 512]);
    expect(ICO_SIZES.every((s) => ICON_FILES.some((f) => f.size === s))).toBe(true);
  });

  it("writes a manifest that parses", () => {
    const m = JSON.parse(
      manifest({
        name: "Toolbelt",
        shortName: "",
        themeColor: "#0f766e",
        backgroundColor: "#ffffff",
      }),
    );
    expect(m.short_name).toBe("Toolbelt");
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512"]);
    expect(m.theme_color).toBe("#0f766e");
    expect(
      JSON.parse(manifest({ name: "", shortName: "", themeColor: "#000", backgroundColor: "#fff" }))
        .name,
    ).toBe("My site");
  });

  it("lists the link tags", () => {
    const t = linkTags("#123456");
    expect(t).toContain('href="/favicon.ico"');
    expect(t).toContain('rel="apple-touch-icon"');
    expect(t).toContain('content="#123456"');
    expect(t.split("\n")).toHaveLength(6);
  });
});

describe("layout", () => {
  it("applies padding and radius in percent, clamped", () => {
    expect(iconLayout(100, 10, 20)).toEqual({ radius: 20, x: 10, y: 10, box: 80 });
    expect(iconLayout(100, 90, 90)).toEqual({ radius: 50, x: 45, y: 45, box: 10 });
    expect(iconLayout(32, -5, 0)).toEqual({ radius: 0, x: 0, y: 0, box: 32 });
  });

  it("fits images and text into the box", () => {
    expect(containRect(200, 100, 0, 0, 100)).toEqual({ x: 0, y: 25, w: 100, h: 50 });
    expect(containRect(50, 100, 10, 10, 80)).toEqual({ x: 30, y: 10, w: 40, h: 80 });
    expect(fitFontSize(200, 100, 50)).toBe(25);
    expect(fitFontSize(50, 120, 60)).toBe(50);
    expect(fitFontSize(0, 0, 60)).toBe(60);
  });
});
