import { describe, expect, it } from "bun:test";
import { EncodeError, fromHex, fromUtf8, utf8 } from "../_shared";
import {
  DEFAULT_OPTIONS,
  decode,
  ENCODINGS,
  encode,
  fromAscii85,
  fromBase32,
  fromBase58,
  SEPARATORS,
  toAscii85,
  toBase32,
  toBase58,
} from "./logic";

const text = (s: string) => utf8(s);

describe("base encodings", () => {
  it("encodes one number per byte", () => {
    expect(encode(text("Hi"), "hex")).toBe("48 69");
    expect(encode(text("Hi"), "hex", { ...DEFAULT_OPTIONS, separator: "", upper: true })).toBe(
      "4869",
    );
    expect(encode(text("Hi"), "binary")).toBe("01001000 01101001");
    expect(encode(text("Hi"), "octal")).toBe("110 151");
    expect(encode(text("Hi"), "decimal")).toBe("72 105");
  });

  it("decodes per-byte numbers with or without separators", () => {
    expect(fromUtf8(decode("48 69", "hex"))).toBe("Hi");
    expect(fromUtf8(decode("0x48,0x69", "hex"))).toBe("Hi");
    expect(fromUtf8(decode("0100100001101001", "binary"))).toBe("Hi");
    expect(fromUtf8(decode("1001000 1101001", "binary"))).toBe("Hi");
    expect(fromUtf8(decode("110151", "octal"))).toBe("Hi");
    expect(fromUtf8(decode("72, 105", "decimal"))).toBe("Hi");
    expect(decode("", "decimal")).toEqual(new Uint8Array());
  });

  it("rejects bad digits and values over 255", () => {
    expect(() => decode("12 2", "binary")).toThrow(EncodeError);
    expect(() => decode("010", "binary")).not.toThrow();
    expect(() => decode("010010001", "binary")).toThrow(EncodeError);
    expect(() => decode("256", "decimal")).toThrow(EncodeError);
    expect(() => decode("8", "octal")).toThrow(EncodeError);
    expect(() => decode("4g", "hex")).toThrow(EncodeError);
  });

  it("matches the RFC 4648 Base32 test vectors", () => {
    const vectors: [string, string][] = [
      ["", ""],
      ["f", "MY======"],
      ["fo", "MZXQ===="],
      ["foo", "MZXW6==="],
      ["foob", "MZXW6YQ="],
      ["fooba", "MZXW6YTB"],
      ["foobar", "MZXW6YTBOI======"],
    ];
    for (const [plain, b32] of vectors) {
      expect(toBase32(text(plain))).toBe(b32);
      expect(fromUtf8(fromBase32(b32))).toBe(plain);
    }
    expect(toBase32(text("foobar"), false)).toBe("MZXW6YTBOI");
    expect(fromUtf8(fromBase32("mzxw 6ytb oi"))).toBe("foobar");
    expect(() => fromBase32("MZXW1")).toThrow(EncodeError);
    expect(() => fromBase32("M")).toThrow(EncodeError);
  });

  it("matches known Base58 vectors, keeping leading zeros", () => {
    expect(toBase58(text("Hello World!"))).toBe("2NEpo7TZRRrLZSi2U");
    expect(toBase58(text("The quick brown fox jumps over the lazy dog."))).toBe(
      "USm3fpXnKG5EUBx2ndxBDMPVciP5hGey2Jh4NDv6gmeo1LkMeiKrLJUUBk6Z",
    );
    expect(toBase58(fromHex("0000287fb4cd"))).toBe("11233QC4");
    expect(fromBase58("11233QC4")).toEqual(fromHex("0000287fb4cd"));
    expect(fromUtf8(fromBase58("2NEpo7TZRRrLZSi2U"))).toBe("Hello World!");
    expect(toBase58(new Uint8Array())).toBe("");
    expect(() => fromBase58("0OIl")).toThrow(EncodeError);
  });

  it("matches known Ascii85 vectors", () => {
    expect(toAscii85(text("Man is distinguished"))).toBe("9jqo^BlbD-BleB1DJ+*+F(f,q");
    expect(toAscii85(text("sure."))).toBe("F*2M7/c");
    expect(toAscii85(new Uint8Array(4))).toBe("z");
    expect(fromUtf8(fromAscii85("<~9jqo^BlbD-BleB1DJ+*+F(f,q~>"))).toBe("Man is distinguished");
    expect(fromUtf8(fromAscii85("F*2M7/c"))).toBe("sure.");
    expect(fromAscii85("z")).toEqual(new Uint8Array(4));
    expect(encode(text("sure."), "ascii85", { ...DEFAULT_OPTIONS, delimiters: true })).toBe(
      "<~F*2M7/c~>",
    );
    expect(() => fromAscii85("abc{")).toThrow(EncodeError);
    expect(() => fromAscii85("F*2M7/")).toThrow(EncodeError);
  });

  it("round-trips Unicode and binary through every encoding", () => {
    const samples = [text("héllo 👋 世界"), new Uint8Array([0, 0, 255, 1, 0, 128, 0, 0, 0, 0])];
    for (const bytes of samples)
      for (const enc of ENCODINGS) expect(decode(encode(bytes, enc), enc)).toEqual(bytes);
  });
});

describe("SEPARATORS", () => {
  it("joins per-byte encodings with the named separator", () => {
    const bytes = new Uint8Array([1, 255]);
    expect(encode(bytes, "hex", { ...DEFAULT_OPTIONS, separator: SEPARATORS.none })).toBe("01ff");
    expect(encode(bytes, "hex", { ...DEFAULT_OPTIONS, separator: SEPARATORS.comma })).toBe(
      "01, ff",
    );
    expect(encode(bytes, "decimal", { ...DEFAULT_OPTIONS, separator: SEPARATORS.newline })).toBe(
      "1\n255",
    );
  });
});
