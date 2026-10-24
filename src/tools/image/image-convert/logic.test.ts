import { describe, expect, it } from "bun:test";
import { l } from "../../../i18n";
import {
  attempt,
  crc32,
  dosDateTime,
  errorL10n,
  fitWithin,
  formatSize,
  imageDims,
  outName,
  readZipStore,
  sizeChange,
  sniffImage,
  stem,
  uniqueNames,
  zipStore,
} from "../_shared";
import { batchNames, encoderQuality, outputSize, totals } from "./logic";

const enc = new TextEncoder();

describe("image-convert", () => {
  it("scales down to fit, keeping the aspect ratio, never upscaling", () => {
    expect(outputSize(4000, 3000, { maxW: 1600, maxH: 0 })).toEqual({ w: 1600, h: 1200 });
    expect(outputSize(4000, 3000, { maxW: 0, maxH: 600 })).toEqual({ w: 800, h: 600 });
    expect(outputSize(4000, 3000, { maxW: 1000, maxH: 1000 })).toEqual({ w: 1000, h: 750 });
    expect(outputSize(300, 200, { maxW: 1000, maxH: 1000 })).toEqual({ w: 300, h: 200 });
    expect(outputSize(300, 200, { maxW: 0, maxH: 0 })).toEqual({ w: 300, h: 200 });
    expect(fitWithin(10000, 1, 100, 100)).toEqual({ w: 100, h: 1 });
  });

  it("maps quality to the 0–1 encoder range", () => {
    expect(encoderQuality(85)).toBe(0.85);
    expect(encoderQuality(0)).toBe(0.01);
    expect(encoderQuality(250)).toBe(1);
  });

  it("totals only converted files", () => {
    const t = totals([
      { before: 1000, after: 400 },
      { before: 500, after: null },
      { before: 1000, after: 600 },
    ]);
    expect(t).toEqual({ count: 2, before: 2000, after: 1000, change: -0.5 });
    expect(totals([]).change).toBe(0);
    expect(sizeChange(100, 150)).toBe(0.5);
  });

  it("names outputs and keeps them unique", () => {
    expect(stem("dir/photo.final.JPEG")).toBe("photo.final");
    expect(stem(".png")).toBe(".png");
    expect(outName("cat.png", "jpeg")).toBe("cat.jpg");
    expect(batchNames(["a.png", "a.jpg", "A.webp", "b"], "webp")).toEqual([
      "a.webp",
      "a-2.webp",
      "A-3.webp",
      "b.webp",
    ]);
    expect(uniqueNames(["x", "x"])).toEqual(["x", "x-2"]);
  });

  it("formats sizes", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(3 * 1024 * 1024, "fr-FR")).toBe("3 MB");
    expect(formatSize(1536, "de-DE")).toBe("1,5 KB");
  });
});

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    // Continuation gives the same as one pass.
    const all = enc.encode("hello world");
    expect(crc32(all.subarray(6), crc32(all.subarray(0, 6)))).toBe(crc32(all));
  });
});

describe("zip", () => {
  it("writes a STORE archive that reads back", () => {
    const files = [
      { name: "a.txt", data: enc.encode("hello") },
      { name: "dossier/é.bin", data: new Uint8Array([0, 1, 2, 255]) },
      { name: "empty", data: new Uint8Array() },
    ];
    const zip = zipStore(files, new Date(2024, 0, 2, 3, 4, 6));
    const dv = new DataView(zip.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint16(8, true)).toBe(0); // stored
    expect(dv.getUint16(6, true) & 0x800).toBe(0x800); // UTF-8 names
    expect(dv.getUint32(14, true)).toBe(crc32(enc.encode("hello")));
    expect(dv.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(dv.getUint16(zip.length - 12, true)).toBe(3);
    const back = readZipStore(zip);
    expect([...back.keys()]).toEqual(["a.txt", "dossier/é.bin", "empty"]);
    expect(new TextDecoder().decode(back.get("a.txt"))).toBe("hello");
    expect([...(back.get("dossier/é.bin") ?? [])]).toEqual([0, 1, 2, 255]);
    // Exact size: headers + names + data + end record.
    const nameLen = 5 + enc.encode("dossier/é.bin").length + 5;
    expect(zip.length).toBe(3 * (30 + 46) + 2 * nameLen + 5 + 4 + 22);
  });

  it("writes an empty archive", () => {
    const zip = zipStore([]);
    expect(zip.length).toBe(22);
    expect(readZipStore(zip).size).toBe(0);
  });

  it("encodes DOS dates", () => {
    const { time, date } = dosDateTime(new Date(2024, 0, 2, 3, 4, 6));
    expect(date).toBe(((2024 - 1980) << 9) | (1 << 5) | 2);
    expect(time).toBe((3 << 11) | (4 << 5) | 3);
    expect(dosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0);
  });

  it("detects corruption", () => {
    const zip = zipStore([{ name: "a", data: enc.encode("abc") }]);
    zip[31] = 0x7a; // flip a data byte
    expect(() => readZipStore(zip)).toThrow(/CRC/);
    expect(() => readZipStore(new Uint8Array(10))).toThrow(/ZIP/);
  });

  it("reports errors in every language", () => {
    const r = attempt(() => readZipStore(new Uint8Array(10)));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.error).toEqual(
        l("Not a ZIP file.", "Ce n'est pas un fichier ZIP.", "Keine ZIP-Datei."),
      );
    expect(errorL10n(new Error("boom"))).toEqual({ en: "boom", fr: "boom", de: "boom" });
  });
});

describe("sniffing", () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
    0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
  ]);
  it("recognizes formats by their magic bytes", () => {
    expect(sniffImage(png)).toBe("image/png");
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(enc.encode("GIF89a"))).toBe("image/gif");
    expect(sniffImage(enc.encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(enc.encode("\0\0\0\x1cftypavif"))).toBe("image/avif");
    expect(sniffImage(enc.encode("\0\0\0\x18ftypheic"))).toBe("image/heic");
    expect(sniffImage(enc.encode('<?xml version="1.0"?>\n<svg xmlns="x">'))).toBe("image/svg+xml");
    expect(sniffImage(enc.encode("<!-- c --><svg>"))).toBe("image/svg+xml");
    expect(sniffImage(enc.encode("hello"))).toBe("");
    expect(sniffImage(new Uint8Array())).toBe("");
  });

  it("reads dimensions from headers", () => {
    expect(imageDims(png)).toEqual({ w: 300, h: 200 });
    const gif = new Uint8Array([...enc.encode("GIF89a"), 0x0a, 0, 0x14, 0]);
    expect(imageDims(gif)).toEqual({ w: 10, h: 20 });
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 0x30, 0, 0x40, 3, 0, 0, 0,
    ]);
    expect(imageDims(jpeg)).toEqual({ w: 64, h: 48 });
    const vp8l = new Uint8Array(30);
    vp8l.set(enc.encode("RIFF"), 0);
    vp8l.set(enc.encode("WEBPVP8L"), 8);
    vp8l[20] = 0x2f;
    new DataView(vp8l.buffer).setUint32(21, (99 & 0x3fff) | ((49 & 0x3fff) << 14), true);
    expect(imageDims(vp8l)).toEqual({ w: 100, h: 50 });
    expect(imageDims(enc.encode("nope"))).toBeNull();
  });
});
