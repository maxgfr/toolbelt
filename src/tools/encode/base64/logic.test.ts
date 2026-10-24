import { describe, expect, it } from "bun:test";
import { EncodeError } from "../_shared";
import { decode, encodeBytes, encodeText, fileNameFor, sniffMime, wrapLines } from "./logic";

const plain = { urlSafe: false, wrap: false };

describe("base64", () => {
  it("encodes UTF-8 text", () => {
    expect(encodeText("", plain)).toBe("");
    expect(encodeText("Hello, world!", plain)).toBe("SGVsbG8sIHdvcmxkIQ==");
    expect(encodeText("héllo 👋", plain)).toBe("aMOpbGxvIPCfkYs=");
  });

  it("decodes back to the same text", () => {
    const d = decode("aMOpbGxvIPCfkYs=");
    expect(d.text).toBe("héllo 👋");
    expect(d.bytes.length).toBe(11);
  });

  it("uses the URL-safe alphabet without padding", () => {
    expect(encodeText("ü?>", plain)).toBe("w7w/Pg==");
    expect(encodeText("ü?>", { urlSafe: true, wrap: false })).toBe("w7w_Pg");
    expect(decode("w7w_Pg").text).toBe("ü?>");
  });

  it("wraps at 76 characters", () => {
    const out = encodeText("a".repeat(100), { urlSafe: false, wrap: true });
    const lines = out.split("\n");
    expect(lines[0]?.length).toBe(76);
    expect(lines.length).toBe(2);
    expect(decode(out).text).toBe("a".repeat(100));
    expect(wrapLines("abc", 76)).toBe("abc");
    // URL-safe output is never wrapped.
    expect(encodeText("a".repeat(100), { urlSafe: true, wrap: true })).not.toContain("\n");
  });

  it("rejects invalid input", () => {
    expect(() => decode("not base64!")).toThrow(EncodeError);
    expect(() => decode("abcde")).toThrow(EncodeError);
    expect(() => decode("data:text/plain,hello")).toThrow(EncodeError);
  });

  it("recognizes binary data and data URIs", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const b64 = encodeBytes(png, plain);
    const d = decode(b64);
    expect(d.text).toBeNull();
    expect(d.mime).toBe("image/png");
    expect(fileNameFor(d.mime)).toBe("decoded.png");
    const uri = decode(`data:application/json;base64,${encodeText('{"a":1}', plain)}`);
    expect(uri.mime).toBe("application/json");
    expect(uri.text).toBe('{"a":1}');
  });

  it("sniffs common formats", () => {
    expect(sniffMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
    expect(sniffMime(new TextEncoder().encode('<svg xmlns="x"/>'))).toBe("image/svg+xml");
    expect(sniffMime(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(fileNameFor(null)).toBe("decoded.bin");
  });
});
