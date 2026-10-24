import { describe, expect, it } from "bun:test";
import {
  base64ToBytes,
  bytesToBase64,
  cssSnippet,
  extFor,
  formatName,
  imgSnippet,
  markdownSnippet,
  overhead,
  parseImageInput,
  toDataUri,
} from "./logic";

// The smallest valid PNG: 1×1 transparent pixel.
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("base64", () => {
  it("round-trips bytes, including large ones", () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    expect([...base64ToBytes(bytesToBase64(big))]).toEqual([...big]);
    expect(bytesToBase64(new Uint8Array([0xff, 0xfe]))).toBe("//4=");
    expect([...base64ToBytes("_-4")]).toEqual([0xff, 0xee]);
    expect(() => base64ToBytes("abc$")).toThrow(/Base64/);
    expect(() => base64ToBytes("abcde")).toThrow(/Truncated/);
  });
});

describe("parseImageInput", () => {
  it("reads raw Base64 and data URIs, wrapped or not", () => {
    const raw = parseImageInput(PNG_B64);
    expect(raw.mime).toBe("image/png");
    expect(raw.bytes.length).toBe(70);
    const uri = parseImageInput(
      `data:image/png;base64,${PNG_B64.slice(0, 20)}\n${PNG_B64.slice(20)}`,
    );
    expect(uri.bytes).toEqual(raw.bytes);
    expect(parseImageInput(`url("data:image/png;base64,${PNG_B64}");`).mime).toBe("image/png");
  });

  it("fixes a wrong declared type from the bytes", () => {
    expect(parseImageInput(`data:image/jpeg;base64,${PNG_B64}`).mime).toBe("image/png");
  });

  it("reads percent-encoded SVG", () => {
    const svg = parseImageInput(
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E",
    );
    expect(svg.mime).toBe("image/svg+xml");
    expect(new TextDecoder().decode(svg.bytes)).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(parseImageInput("data:image/svg+xml;utf8,<svg>☕</svg>").bytes.length).toBe(14);
  });

  it("rejects what is not an image", () => {
    expect(() => parseImageInput("")).toThrow(/Paste/);
    expect(() => parseImageInput(btoa("hello world"))).toThrow(/not a recognized image/);
    expect(() => parseImageInput("data:text/plain;base64,aGVsbG8=")).toThrow(
      /not a recognized image/,
    );
    expect(() => parseImageInput("data:image/png;base64,")).toThrow(/empty/);
    expect(() => parseImageInput("data:image/svg+xml,%E0%A4%A")).toThrow(/percent/);
  });
});

describe("snippets", () => {
  const uri = toDataUri(new Uint8Array([1, 2, 3]), "image/png");
  it("builds a data URI and snippets", () => {
    expect(uri).toBe("data:image/png;base64,AQID");
    expect(cssSnippet(uri)).toBe('background-image: url("data:image/png;base64,AQID");');
    expect(imgSnippet(uri, 10, 20, 'a "logo"')).toBe(
      '<img src="data:image/png;base64,AQID" width="10" height="20" alt="a &quot;logo&quot;">',
    );
    expect(imgSnippet(uri, null, null, "")).toBe('<img src="data:image/png;base64,AQID" alt="">');
    expect(markdownSnippet(uri, "x [y]")).toBe("![x y](data:image/png;base64,AQID)");
  });

  it("names formats and computes the overhead", () => {
    expect(extFor("image/jpeg")).toBe("jpg");
    expect(extFor("image/svg+xml")).toBe("svg");
    expect(extFor("image/webp")).toBe("webp");
    expect(formatName("image/jpeg")).toBe("JPEG");
    expect(overhead(3, 4)).toBeCloseTo(1 / 3);
    expect(overhead(0, 0)).toBe(0);
  });
});
