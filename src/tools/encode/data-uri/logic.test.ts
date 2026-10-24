import { describe, expect, it } from "bun:test";
import {
  buildDataUri,
  cssUrl,
  extFromMime,
  imgTag,
  isTextMime,
  mimeFromName,
  overhead,
  parseDataUri,
  percentToBytes,
} from "./logic";

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("data-uri", () => {
  it("parses the RFC 2397 examples", () => {
    const a = parseDataUri("data:,A%20brief%20note");
    expect(a.mime).toBe("text/plain");
    expect(a.charset).toBe("US-ASCII");
    expect(a.base64).toBe(false);
    expect(text(a.bytes)).toBe("A brief note");

    const b = parseDataUri("data:text/plain;charset=iso-8859-7,%be%fg%be".replace("fg", "e1"));
    expect(b.charset).toBe("iso-8859-7");
    expect([...b.bytes]).toEqual([0xbe, 0xe1, 0xbe]);
  });

  it("parses Base64 payloads, wrapped or URL-escaped", () => {
    const p = parseDataUri("data:image/png;base64,iVBO\nRw0K");
    expect(p.mime).toBe("image/png");
    expect(p.base64).toBe(true);
    expect([...p.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(text(parseDataUri("data:text/plain;base64,YQ%3D%3D").bytes)).toBe("a");
  });

  it("decodes percent sequences as bytes and raw characters as UTF-8", () => {
    expect(text(percentToBytes("caf%C3%A9 é"))).toBe("café é");
    expect(text(percentToBytes("😀"))).toBe("😀");
    expect(() => percentToBytes("50%")).toThrow(/Malformed/);
  });

  it("rejects things that are not data URIs", () => {
    expect(() => parseDataUri("https://x")).toThrow(/data:/);
    expect(() => parseDataUri("data:text/plain")).toThrow(/comma/);
    expect(() => parseDataUri("data:not a type,x")).toThrow(/MIME/);
    expect(() => parseDataUri("data:text/plain;base64,@@@")).toThrow();
  });

  it("builds Base64 URIs that parse back to the same bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const uri = buildDataUri(bytes, "application/octet-stream", "base64");
    expect(uri).toBe("data:application/octet-stream;base64,AAEC+v8=");
    expect([...parseDataUri(uri).bytes]).toEqual([...bytes]);
    expect(buildDataUri(bytes, "", "base64")).toStartWith("data:application/octet-stream;");
  });

  it("builds readable percent-encoded URIs for UTF-8 text", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>é #1</text></svg>';
    const uri = buildDataUri(new TextEncoder().encode(svg), "image/svg+xml", "percent");
    expect(uri).toStartWith("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http");
    expect(uri).toContain("http://www.w3.org/2000/svg");
    expect(uri).not.toContain("#");
    expect(text(parseDataUri(uri).bytes)).toBe(svg);
    expect(() => buildDataUri(new Uint8Array([0xff, 0xfe]), "text/plain", "percent")).toThrow(
      /UTF-8/,
    );
  });

  it("maps MIME types and file names", () => {
    expect(extFromMime("image/jpeg")).toBe("jpg");
    expect(extFromMime("image/svg+xml; charset=utf-8")).toBe("svg");
    expect(extFromMime("application/x-unknown-thing")).toBe("bin");
    expect(extFromMime("audio/flac")).toBe("flac");
    expect(mimeFromName("photo.JPEG")).toBe("image/jpeg");
    expect(mimeFromName("data.json")).toBe("application/json");
    expect(mimeFromName("README")).toBe("application/octet-stream");
    expect(isTextMime("image/svg+xml")).toBe(true);
    expect(isTextMime("image/png")).toBe(false);
  });

  it("measures overhead and formats snippets", () => {
    expect(overhead(3, 4)).toBeCloseTo(1 / 3);
    expect(overhead(0, 10)).toBe(0);
    expect(cssUrl('data:x,"a"')).toBe('url("data:x,%22a%22")');
    expect(imgTag("data:image/png;base64,AA", 'a "b"')).toBe(
      '<img src="data:image/png;base64,AA" alt="a &quot;b&quot;">',
    );
  });
});
