import { describe, expect, it } from "bun:test";
import { EncodeError, fromHex, toHex, utf8 } from "../_shared";
import {
  asText,
  bytesToText,
  compress,
  compressedName,
  decompress,
  decompressAuto,
  decompressedName,
  detectFormat,
  FORMATS,
  gzipHeader,
  ratio,
  textToBytes,
} from "./logic";

// "hello" compressed by `gzip -n`, zlib and raw deflate (the deflate body is identical).
const GZIP_HELLO = fromHex("1f8b0800000000000003cb48cdc9c9070086a6103605000000");
const ZLIB_HELLO = fromHex("789ccb48cdc9c90700062c0215");
const RAW_HELLO = fromHex("cb48cdc9c90700");
// Same, with FNAME "hello.txt" and an mtime of 2020-09-13T12:26:40Z (1600000000).
const GZIP_NAMED = fromHex(
  "1f8b0808" +
    "00105e5f" +
    "0003" +
    toHex(utf8("hello.txt")) +
    "00" +
    "cb48cdc9c90700" +
    "86a61036" +
    "05000000",
);

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("decompress known streams", () => {
  it("reads gzip, zlib and raw deflate", async () => {
    expect(text(await decompress(GZIP_HELLO, "gzip"))).toBe("hello");
    expect(text(await decompress(ZLIB_HELLO, "deflate"))).toBe("hello");
    expect(text(await decompress(RAW_HELLO, "deflate-raw"))).toBe("hello");
    expect(text(await decompress(GZIP_NAMED, "gzip"))).toBe("hello");
  });

  it("detects the format from the magic bytes", async () => {
    expect(detectFormat(GZIP_HELLO)).toBe("gzip");
    expect(detectFormat(ZLIB_HELLO)).toBe("deflate");
    expect(detectFormat(fromHex("78010000"))).toBe("deflate");
    expect(detectFormat(fromHex("78da"))).toBe("deflate");
    expect(detectFormat(RAW_HELLO)).toBe("deflate-raw");
    expect(detectFormat(new Uint8Array())).toBe("deflate-raw");
    for (const [data, format] of [
      [GZIP_HELLO, "gzip"],
      [ZLIB_HELLO, "deflate"],
      [RAW_HELLO, "deflate-raw"],
    ] as const) {
      const r = await decompressAuto(data);
      expect(r.format).toBe(format);
      expect(text(r.bytes)).toBe("hello");
    }
  });

  it("rejects corrupted, truncated and mismatched data", async () => {
    const msg = async (p: Promise<unknown>) => {
      try {
        await p;
      } catch (err) {
        expect(err).toBeInstanceOf(EncodeError);
        return (err as EncodeError).text.en;
      }
      throw new Error("expected a failure");
    };
    expect(await msg(decompress(utf8("plain text"), "gzip"))).toContain("not valid gzip");
    expect(await msg(decompress(GZIP_HELLO.slice(0, 15), "gzip"))).toContain("truncated");
    expect(await msg(decompress(GZIP_HELLO, "deflate"))).toContain("zlib");
    expect(await msg(decompress(new Uint8Array(), "gzip"))).toContain("Nothing");
  });
});

describe("round trips", () => {
  it("compresses and decompresses Unicode and binary data in every format", async () => {
    const samples = [
      utf8("Le cœur a ses raisons… 日本語 🎉 ".repeat(50)),
      new Uint8Array(100_000).map((_, i) => (i * 7919) % 251),
      new Uint8Array(),
    ];
    for (const format of FORMATS)
      for (const s of samples) {
        const c = await compress(s, format);
        expect(toHex(await decompress(c, format))).toBe(toHex(s));
      }
  });

  it("produces the right headers and shrinks repetitive text", async () => {
    const input = utf8("a".repeat(10_000));
    const gz = await compress(input, "gzip");
    expect(toHex(gz.subarray(0, 3))).toBe("1f8b08");
    const z = await compress(input, "deflate");
    expect(detectFormat(z)).toBe("deflate");
    expect(gz.length).toBeLessThan(100);
    expect(ratio(input.length, gz.length)).toBeLessThan(0.01);
    expect(ratio(0, 20)).toBeNull();
  });
});

describe("gzip header", () => {
  it("reads the stored name, time and OS", () => {
    const h = gzipHeader(GZIP_NAMED);
    expect(h?.name).toBe("hello.txt");
    expect(h?.mtime?.toISOString()).toBe("2020-09-13T12:26:40.000Z");
    expect(h?.os).toBe("Unix");
    expect(gzipHeader(GZIP_HELLO)).toEqual({ mtime: null, name: null, os: "Unix" });
    expect(gzipHeader(ZLIB_HELLO)).toBeNull();
  });

  it("names files", () => {
    expect(compressedName("a.txt", "gzip")).toBe("a.txt.gz");
    expect(compressedName("a.txt", "deflate")).toBe("a.txt.zz");
    expect(decompressedName("x.gz", gzipHeader(GZIP_NAMED))).toBe("hello.txt");
    expect(decompressedName("report.csv.gz", null)).toBe("report.csv");
    expect(decompressedName("site.tgz", null)).toBe("site.tar");
    expect(decompressedName("blob", null)).toBe("blob.out");
  });
});

describe("text forms", () => {
  it("writes and reads Base64 and hex", () => {
    expect(bytesToText(GZIP_HELLO, "base64")).toBe("H4sIAAAAAAAAA8tIzcnJBwCGphA2BQAAAA==");
    expect(bytesToText(RAW_HELLO, "hex")).toBe("cb48cdc9c90700");
    expect(toHex(textToBytes("H4sIAAAAAAAAA8tIzcnJBwCGphA2BQAAAA==", "auto"))).toBe(
      toHex(GZIP_HELLO),
    );
    expect(toHex(textToBytes(" cb48 cdc9 c907 00\n", "auto"))).toBe("cb48cdc9c90700");
    expect(toHex(textToBytes("cb48cdc9c90700", "hex"))).toBe("cb48cdc9c90700");
    expect(() => textToBytes("  ", "auto")).toThrow("Paste");
    expect(() => textToBytes("zz", "hex")).toThrow("Hex");
  });

  it("only shows valid UTF-8 as text", () => {
    expect(asText(utf8("héllo"))).toBe("héllo");
    expect(asText(fromHex("ff00fe"))).toBeNull();
  });
});
