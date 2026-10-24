import { describe, expect, it } from "bun:test";
import { toHex } from "../_shared";
import { Cancelled, findMatch, formatDigest, hashAll, hashBlob, parseChecksum } from "./logic";

const hex = (d: Record<string, Uint8Array>) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, toHex(v)]));

describe("hash", () => {
  it("matches the standard vectors for the empty string", async () => {
    const d = hex(await hashAll(""));
    expect(d.md5).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(d.sha1).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(d.sha256).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(d["sha3-256"]).toBe("a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a");
    expect(d.blake3).toBe("af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262");
    expect(d.crc32).toBe("00000000");
  });

  it("matches the standard vectors for “abc” and “123456789”", async () => {
    const d = hex(await hashAll("abc"));
    expect(d.md5).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(d.sha1).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(d.sha256).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(d.sha384).toBe(
      "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
    );
    expect(d.sha512).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    );
    expect(d["sha3-512"]).toBe(
      "b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0",
    );
    expect(hex(await hashAll("123456789")).crc32).toBe("cbf43926");
  });

  it("hashes UTF-8 text as bytes", async () => {
    const a = await hashAll("é");
    const b = await hashAll(new Uint8Array([0xc3, 0xa9]));
    expect(toHex(a.sha256)).toBe(toHex(b.sha256));
  });

  it("gives the same digests for a blob read in small chunks", async () => {
    const data = new Uint8Array(10_000).map((_, i) => (i * 31) % 256);
    const whole = hex(await hashAll(data));
    const seen: number[] = [];
    const chunked = hex(
      await hashBlob(new Blob([data]), { chunk: 3000, onProgress: (n) => seen.push(n) }),
    );
    expect(chunked).toEqual(whole);
    expect(seen).toEqual([3000, 6000, 9000, 10000]);
  });

  it("hashes an empty blob and stops when cancelled", async () => {
    expect(hex(await hashBlob(new Blob([]))).md5).toBe("d41d8cd98f00b204e9800998ecf8427e");
    const ac = new AbortController();
    ac.abort();
    await expect(hashBlob(new Blob(["x"]), { signal: ac.signal })).rejects.toBeInstanceOf(
      Cancelled,
    );
  });

  it("formats digests", () => {
    const b = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    expect(formatDigest(b, "hex")).toBe("deadbeef");
    expect(formatDigest(b, "hex", true)).toBe("DEADBEEF");
    expect(formatDigest(b, "base64")).toBe("3q2+7w==");
  });

  it("parses pasted checksums", () => {
    expect(parseChecksum("")).toBeNull();
    expect(toHex(parseChecksum("DE:AD:BE:EF") ?? new Uint8Array())).toBe("deadbeef");
    expect(toHex(parseChecksum("deadbeef  file.zip") ?? new Uint8Array())).toBe("deadbeef");
    expect(toHex(parseChecksum("sha256-3q2+7w==") ?? new Uint8Array())).toBe("deadbeef");
    expect(parseChecksum("no?!")).toBeNull();
  });

  it("finds which algorithm matches an expected checksum", async () => {
    const d = await hashAll("abc");
    expect(findMatch("A9993E364706816ABA3E25717850C26C9CD0D89D", d)).toBe("sha1");
    expect(findMatch("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=", d)).toBe("sha256");
    expect(findMatch("00", d)).toBeNull();
    expect(findMatch("", d)).toBeNull();
  });
});
