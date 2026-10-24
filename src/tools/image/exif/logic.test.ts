import { describe, expect, it } from "bun:test";
import { crc32 } from "../_shared";
import {
  decimalToDms,
  dmsToDecimal,
  exifDate,
  findTag,
  formatTag,
  gpsOf,
  jpegSegments,
  orientationApp1,
  orientationOf,
  parseTiff,
  pngChunk,
  pngChunks,
  readMeta,
  stripJpeg,
  stripMeta,
  stripPng,
  stripWebp,
  summarize,
  webpChunks,
} from "./logic";

/* --- Fixture builders ------------------------------------------------------------ */

type Val =
  | { ascii: string }
  | { short: number[] }
  | { long: number[] }
  | { rational: [number, number][] }
  | { bytes: number[] };
interface E {
  id: number;
  v: Val;
}

const enc = new TextEncoder();

function encodeVal(v: Val, le: boolean): { type: number; count: number; bytes: Uint8Array } {
  if ("ascii" in v) {
    const b = enc.encode(`${v.ascii}\0`);
    return { type: 2, count: b.length, bytes: b };
  }
  if ("bytes" in v) return { type: 7, count: v.bytes.length, bytes: new Uint8Array(v.bytes) };
  if ("short" in v) {
    const b = new Uint8Array(v.short.length * 2);
    const dv = new DataView(b.buffer);
    v.short.forEach((x, i) => {
      dv.setUint16(i * 2, x, le);
    });
    return { type: 3, count: v.short.length, bytes: b };
  }
  if ("long" in v) {
    const b = new Uint8Array(v.long.length * 4);
    const dv = new DataView(b.buffer);
    v.long.forEach((x, i) => {
      dv.setUint32(i * 4, x, le);
    });
    return { type: 4, count: v.long.length, bytes: b };
  }
  const b = new Uint8Array(v.rational.length * 8);
  const dv = new DataView(b.buffer);
  v.rational.forEach(([n, d], i) => {
    dv.setUint32(i * 8, n, le);
    dv.setUint32(i * 8 + 4, d, le);
  });
  return { type: 5, count: v.rational.length, bytes: b };
}

/** A TIFF block with IFD0, and optional Exif and GPS sub-IFDs linked from IFD0. */
function tiff(le: boolean, ifd0: E[], exif: E[] = [], gps: E[] = []): Uint8Array {
  const ifds: E[][] = [[...ifd0], exif, gps].filter((x, i) => i === 0 || x.length);
  const sizeOf = (n: number) => 2 + 12 * n + 4;
  const extra = (exif.length ? 1 : 0) + (gps.length ? 1 : 0);
  const offs: number[] = [];
  let p = 8;
  ifds.forEach((x, i) => {
    offs.push(p);
    p += sizeOf(x.length + (i === 0 ? extra : 0));
  });
  let k = 1;
  const first = ifds[0] as E[];
  if (exif.length) first.push({ id: 0x8769, v: { long: [offs[k++] as number] } });
  if (gps.length) first.push({ id: 0x8825, v: { long: [offs[k++] as number] } });
  const head = new Uint8Array(p);
  const dv = new DataView(head.buffer);
  head.set(le ? [0x49, 0x49] : [0x4d, 0x4d]);
  dv.setUint16(2, 42, le);
  dv.setUint32(4, 8, le);
  const data: Uint8Array[] = [];
  let dataAt = p;
  ifds.forEach((entries, i) => {
    const o = offs[i] as number;
    const sorted = [...entries].sort((a, b) => a.id - b.id);
    dv.setUint16(o, sorted.length, le);
    sorted.forEach((e, j) => {
      const at = o + 2 + j * 12;
      const { type, count, bytes } = encodeVal(e.v, le);
      dv.setUint16(at, e.id, le);
      dv.setUint16(at + 2, type, le);
      dv.setUint32(at + 4, count, le);
      if (bytes.length <= 4) head.set(bytes, at + 8);
      else {
        dv.setUint32(at + 8, dataAt, le);
        data.push(bytes);
        dataAt += bytes.length;
      }
    });
    dv.setUint32(o + 2 + sorted.length * 12, 0, le);
  });
  return concat([head, ...data]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, x) => a + x.length, 0));
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

function segment(marker: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (payload.length + 2) >> 8;
  out[3] = (payload.length + 2) & 255;
  out.set(payload, 4);
  return out;
}

const camera = (le: boolean) =>
  tiff(
    le,
    [
      { id: 0x010f, v: { ascii: "Canon" } },
      { id: 0x0110, v: { ascii: "Canon EOS R6" } },
      { id: 0x0112, v: { short: [6] } },
      { id: 0x0131, v: { ascii: "GIMP 2.10" } },
    ],
    [
      { id: 0x829a, v: { rational: [[1, 250]] } },
      { id: 0x829d, v: { rational: [[28, 10]] } },
      { id: 0x8827, v: { short: [400] } },
      { id: 0x9003, v: { ascii: "2024:05:01 12:30:45" } },
      { id: 0x9000, v: { bytes: [0x30, 0x32, 0x33, 0x32] } },
      { id: 0x920a, v: { rational: [[50, 1]] } },
      { id: 0x9209, v: { short: [0x19] } },
    ],
    [
      { id: 0x01, v: { ascii: "N" } },
      {
        id: 0x02,
        v: {
          rational: [
            [48, 1],
            [51, 1],
            [2950, 100],
          ],
        },
      },
      { id: 0x03, v: { ascii: "W" } },
      {
        id: 0x04,
        v: {
          rational: [
            [2, 1],
            [17, 1],
            [40, 1],
          ],
        },
      },
      { id: 0x05, v: { bytes: [1] } },
      { id: 0x06, v: { rational: [[35, 1]] } },
    ],
  );

const exifApp1 = (t: Uint8Array) => segment(0xe1, concat([enc.encode("Exif\0\0"), t]));
const jfif = segment(0xe0, enc.encode("JFIF\0\x01\x01\0\0\x01\0\x01\0\0"));
const xmp = segment(
  0xe1,
  enc.encode('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"/>'),
);
const iptc = segment(0xed, enc.encode("Photoshop 3.0\0 8BIM data"));
const icc = segment(0xe2, enc.encode("ICC_PROFILE\0\x01\x01 profile"));
const com = segment(0xfe, enc.encode("hello comment"));
const dqt = segment(0xdb, new Uint8Array(65));
const sos = segment(0xda, new Uint8Array([1, 1, 0, 0, 0x3f, 0]));
const scanData = new Uint8Array([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd9]);

function jpeg(...segs: Uint8Array[]): Uint8Array {
  return concat([new Uint8Array([0xff, 0xd8]), ...segs, sos, scanData]);
}

/* --- Tests ------------------------------------------------------------------------- */

describe("parseTiff", () => {
  for (const le of [true, false]) {
    it(`reads IFD0, Exif and GPS tags (${le ? "little" : "big"}-endian)`, () => {
      const tags = parseTiff(camera(le));
      expect(findTag(tags, "Make")?.value).toBe("Canon");
      expect(findTag(tags, "Orientation")?.value).toEqual([6]);
      expect(findTag(tags, "ExposureTime")?.rationals).toEqual([[1, 250]]);
      expect(findTag(tags, "ISOSpeedRatings")?.ifd).toBe("Exif");
      expect(findTag(tags, "GPSLatitude")?.ifd).toBe("GPS");
      // Pointer tags are followed, not listed.
      expect(findTag(tags, "ExifIFDPointer")).toBeUndefined();
    });
  }

  it("rejects bad headers and survives broken offsets", () => {
    expect(() => parseTiff(new Uint8Array([1, 2, 3]))).toThrow(/truncated/);
    expect(() => parseTiff(enc.encode("XX\0*\0\0\0\x08"))).toThrow(/byte order/);
    expect(() => parseTiff(enc.encode("MM\0\x2b\0\0\0\x08"))).toThrow(/TIFF/);
    const t = camera(true);
    // Point the Make value outside the block: the entry is skipped, the rest still reads.
    const dv = new DataView(t.buffer);
    const n = dv.getUint16(8, true);
    for (let i = 0; i < n; i++)
      if (dv.getUint16(10 + i * 12, true) === 0x010f) dv.setUint32(10 + i * 12 + 8, 999999, true);
    const tags = parseTiff(t);
    expect(findTag(tags, "Make")).toBeUndefined();
    expect(findTag(tags, "Model")?.value).toBe("Canon EOS R6");
  });

  it("does not loop on circular IFD links", () => {
    const t = tiff(true, [{ id: 0x0112, v: { short: [1] } }]);
    new DataView(t.buffer).setUint32(8 + 2 + 12, 8, true); // next IFD → IFD0 again
    expect(parseTiff(t)).toHaveLength(1);
  });
});

describe("values", () => {
  const tags = parseTiff(camera(false));
  const text = (name: string) => {
    const t = findTag(tags, name);
    return t ? formatTag(t).en : "";
  };

  it("formats exposure, aperture, focal length, flash, versions", () => {
    expect(text("ExposureTime")).toBe("1/250 s");
    expect(text("FNumber")).toBe("f/2.8");
    expect(text("FocalLength")).toBe("50 mm");
    expect(text("Orientation")).toBe("Rotated 90° clockwise");
    expect(formatTag(findTag(tags, "Orientation") as never).fr).toBe("Pivotée de 90° horaire");
    expect(formatTag(findTag(tags, "Orientation") as never).de).toBe(
      "Um 90° im Uhrzeigersinn gedreht",
    );
    expect(text("Flash")).toBe("Fired (auto)");
    expect(formatTag(findTag(tags, "Flash") as never).de).toBe("Ausgelöst (Auto)");
    expect(text("ExifVersion")).toBe("2.32");
  });

  it("decodes GPS coordinates", () => {
    const g = gpsOf(tags);
    expect(g?.lat).toBeCloseTo(48.858194, 5);
    expect(g?.lon).toBeCloseTo(-2.294444, 5);
    expect(g?.alt).toBe(-35);
    expect(dmsToDecimal([10, 30, 0], "S")).toBe(-10.5);
    expect(decimalToDms(48.858194, "lat")).toBe("48° 51′ 29.5″ N");
    expect(decimalToDms(-2.294444, "lon")).toBe("2° 17′ 40″ W");
    expect(decimalToDms(1.9999999, "lat")).toBe("2° 0′ 0″ N");
  });

  it("summarizes the photo", () => {
    const s = summarize(tags);
    expect(s.camera).toBe("Canon EOS R6");
    expect(s.date).toBe("2024-05-01 12:30:45");
    expect(s.exposure).toBe("1/250 s");
    expect(s.aperture).toBe("f/2.8");
    expect(s.iso).toBe("ISO 400");
    expect(s.orientation).toBe(6);
    expect(s.software).toBe("GIMP 2.10");
    expect(summarize([])).toEqual({});
    expect(exifDate("2020:01:02 03:04:05")).toBe("2020-01-02 03:04:05");
  });
});

describe("JPEG", () => {
  const file = jpeg(jfif, exifApp1(camera(true)), xmp, icc, iptc, com, dqt);

  it("lists segments up to the scan", () => {
    const { segments, scan } = jpegSegments(file);
    expect(segments.map((s) => s.marker)).toEqual([0xe0, 0xe1, 0xe1, 0xe2, 0xed, 0xfe, 0xdb, 0xda]);
    expect(file[scan + 1]).toBe(0xda);
    expect(() => jpegSegments(enc.encode("nope"))).toThrow(/JPEG/);
    const truncated = concat([
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x10, 0x00]),
      new Uint8Array(4),
    ]);
    expect(() => jpegSegments(truncated)).toThrow(/overruns/);
  });

  it("reads EXIF, XMP, IPTC, ICC and comments", () => {
    const m = readMeta(file);
    expect(m.format).toBe("jpeg");
    expect(m.blocks.map((b) => b.kind)).toEqual(["jfif", "exif", "xmp", "icc", "iptc", "comment"]);
    expect(m.blocks.find((b) => b.kind === "comment")?.text).toBe("hello comment");
    expect(m.blocks.find((b) => b.kind === "xmp")?.text).toContain("xmpmeta");
    expect(orientationOf(m.tags)).toBe(6);
    expect(m.metaBytes).toBe(
      file.length - 2 - jfif.length - icc.length - dqt.length - sos.length - scanData.length,
    );
  });

  it("strips APP1, APP13 and COM losslessly, keeping the orientation", () => {
    const { bytes, removed } = stripJpeg(file);
    expect(removed).toEqual(["APP1", "APP1", "APP13", "COM"]);
    const after = jpegSegments(bytes).segments.map((s) => s.marker);
    expect(after).toEqual([0xe0, 0xe1, 0xe2, 0xdb, 0xda]);
    // Image data is byte-identical.
    expect([...bytes.subarray(bytes.length - scanData.length)]).toEqual([...scanData]);
    const m = readMeta(bytes);
    expect(m.tags.map((t) => t.name)).toEqual(["Orientation"]);
    expect(orientationOf(m.tags)).toBe(6);
    expect(bytes.length).toBe(
      jfif.length + 36 + icc.length + dqt.length + sos.length + scanData.length + 2,
    );
  });

  it("can drop the orientation too, and leaves clean files alone", () => {
    const { bytes } = stripJpeg(file, false);
    expect(readMeta(bytes).tags).toEqual([]);
    const clean = jpeg(jfif, dqt);
    expect([...stripJpeg(clean).bytes]).toEqual([...clean]);
    // Orientation 1 is not written back.
    const upright = jpeg(exifApp1(tiff(true, [{ id: 0x0112, v: { short: [1] } }])), dqt);
    expect(jpegSegments(stripJpeg(upright).bytes).segments.map((s) => s.marker)).toEqual([
      0xdb, 0xda,
    ]);
  });

  it("writes a valid minimal orientation block", () => {
    const seg = orientationApp1(8);
    expect(seg.length).toBe(36);
    expect(orientationOf(parseTiff(seg.subarray(10)))).toBe(8);
  });
});

describe("PNG", () => {
  const ihdr = pngChunk("IHDR", new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]));
  const text = pngChunk("tEXt", enc.encode("Author\0Jane Doe"));
  const itxt = pngChunk("iTXt", enc.encode("XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta/>"));
  const exif = pngChunk("eXIf", camera(false));
  const time = pngChunk("tIME", new Uint8Array([0x07, 0xe8, 5, 1, 12, 30, 45]));
  const srgb = pngChunk("sRGB", new Uint8Array([0]));
  const idat = pngChunk("IDAT", new Uint8Array([1, 2, 3]));
  const iend = pngChunk("IEND", new Uint8Array());
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const file = concat([sig, ihdr, text, itxt, exif, time, srgb, idat, iend]);

  it("writes chunks with a correct CRC", () => {
    const dv = new DataView(iend.buffer);
    expect(dv.getUint32(8)).toBe(0xae426082);
    expect(crc32(enc.encode("IEND"))).toBe(0xae426082);
  });

  it("reads text, XMP, EXIF and time chunks", () => {
    expect(pngChunks(file).map((c) => c.type)).toEqual([
      "IHDR",
      "tEXt",
      "iTXt",
      "eXIf",
      "tIME",
      "sRGB",
      "IDAT",
      "IEND",
    ]);
    const m = readMeta(file);
    expect(m.format).toBe("png");
    expect(m.blocks.find((b) => b.label === "tEXt · Author")?.text).toBe("Jane Doe");
    expect(m.blocks.find((b) => b.kind === "xmp")?.text).toBe("<x:xmpmeta/>");
    expect(m.blocks.find((b) => b.kind === "time")?.text).toBe("2024-05-01 12:30:45 UTC");
    expect(findTag(m.tags, "Make")?.value).toBe("Canon");
  });

  it("strips metadata chunks and keeps the rest", () => {
    const { bytes, removed } = stripPng(file);
    expect(removed).toEqual(["tEXt", "iTXt", "eXIf", "tIME"]);
    expect([...bytes]).toEqual([...concat([sig, ihdr, srgb, idat, iend])]);
    expect(() => pngChunks(enc.encode("not a png"))).toThrow(/PNG/);
  });
});

describe("WebP", () => {
  function chunk(type: string, data: Uint8Array): Uint8Array {
    const pad = data.length & 1;
    const out = new Uint8Array(8 + data.length + pad);
    out.set(enc.encode(type));
    new DataView(out.buffer).setUint32(4, data.length, true);
    out.set(data, 8);
    return out;
  }
  function riff(...chunks: Uint8Array[]): Uint8Array {
    const body = concat(chunks);
    const out = concat([enc.encode("RIFF"), new Uint8Array(4), enc.encode("WEBP"), body]);
    new DataView(out.buffer).setUint32(4, out.length - 8, true);
    return out;
  }
  const vp8x = chunk("VP8X", new Uint8Array([0x0c | 0x10, 0, 0, 0, 9, 0, 0, 9, 0, 0]));
  const vp8l = chunk("VP8L", new Uint8Array([0x2f, 1, 2, 3, 4]));
  const exif = chunk("EXIF", concat([enc.encode("Exif\0\0"), camera(true)]));
  const xmpC = chunk("XMP ", enc.encode("<x:xmpmeta/>"));
  const file = riff(vp8x, vp8l, exif, xmpC);

  it("reads EXIF and XMP chunks (odd sizes padded)", () => {
    expect(webpChunks(file).map((c) => c.type)).toEqual(["VP8X", "VP8L", "EXIF", "XMP "]);
    const m = readMeta(file);
    expect(m.format).toBe("webp");
    expect(findTag(m.tags, "Model")?.value).toBe("Canon EOS R6");
    expect(m.blocks.map((b) => b.kind)).toEqual(["exif", "xmp"]);
  });

  it("strips them and fixes the header", () => {
    const { bytes, removed } = stripWebp(file);
    expect(removed).toEqual(["EXIF", "XMP"]);
    expect(webpChunks(bytes).map((c) => c.type)).toEqual(["VP8X", "VP8L"]);
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint32(4, true)).toBe(bytes.length - 8);
    expect(bytes[20]).toBe(0x10); // alpha kept, EXIF and XMP flags cleared
    expect(readMeta(bytes).blocks).toEqual([]);
  });

  it("dispatches by format", () => {
    expect(stripMeta(file)?.removed).toEqual(["EXIF", "XMP"]);
    expect(stripMeta(enc.encode("GIF89a"))).toBeNull();
    expect(readMeta(enc.encode("GIF89a")).format).toBe("other");
  });
});
