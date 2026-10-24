import { describe, expect, it } from "bun:test";
import { EncodeError, utf8 } from "../_shared";
import {
  type Algorithm,
  base32Decode,
  base32Encode,
  buildOtpauth,
  DEFAULTS,
  generateSecret,
  hotp,
  parseOtpauth,
  readSource,
  secondsLeft,
  totp,
} from "./logic";

// RFC 6238 appendix B: seeds are ASCII "1234567890" repeated to 20, 32 and 64 bytes.
const SEEDS: Record<Algorithm, Uint8Array> = {
  SHA1: utf8("12345678901234567890"),
  SHA256: utf8("12345678901234567890123456789012"),
  SHA512: utf8("1234567890123456789012345678901234567890123456789012345678901234"),
};
const VECTORS: [number, string, string, string][] = [
  [59, "94287082", "46119246", "90693936"],
  [1111111109, "07081804", "68084774", "25091201"],
  [1111111111, "14050471", "67062674", "99943326"],
  [1234567890, "89005924", "91819424", "93441116"],
  [2000000000, "69279037", "90698825", "38618901"],
  [20000000000, "65353130", "77737706", "47863826"],
];

describe("TOTP (RFC 6238)", () => {
  for (const [time, sha1, sha256, sha512] of VECTORS)
    it(`matches the test vectors at T = ${time}`, async () => {
      const p = { digits: 8, period: 30 };
      expect(await totp(SEEDS.SHA1, time, { ...p, algorithm: "SHA1" })).toBe(sha1);
      expect(await totp(SEEDS.SHA256, time, { ...p, algorithm: "SHA256" })).toBe(sha256);
      expect(await totp(SEEDS.SHA512, time, { ...p, algorithm: "SHA512" })).toBe(sha512);
    });

  it("counts the seconds left in the period", () => {
    expect(secondsLeft(59)).toBe(1);
    expect(secondsLeft(60)).toBe(30);
    expect(secondsLeft(61.7, 60)).toBe(59);
  });
});

describe("HOTP (RFC 4226)", () => {
  it("matches the appendix D values", async () => {
    const want = ["755224", "287082", "359152", "969429", "338314"];
    for (let c = 0; c < want.length; c++) expect(await hotp(SEEDS.SHA1, c)).toBe(want[c] as string);
  });
});

describe("Base32", () => {
  it("decodes RFC 4648 vectors, ignoring case, spaces and padding", () => {
    expect(new TextDecoder().decode(base32Decode("MZXW6YTBOI======"))).toBe("foobar");
    expect(new TextDecoder().decode(base32Decode("mzxw 6ytb oi"))).toBe("foobar");
    expect(base32Encode(utf8("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Encode(utf8("f"))).toBe("MY");
  });

  it("round-trips generated secrets", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(s)).toHaveLength(20);
  });

  it("rejects invalid characters and empty secrets", () => {
    expect(() => base32Decode("ABC1")).toThrow(EncodeError);
    expect(() => base32Decode("  ")).toThrow(EncodeError);
  });
});

describe("otpauth links", () => {
  it("parses a full link", () => {
    const o = parseOtpauth(
      "otpauth://totp/ACME%20Co:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ACME%20Co&algorithm=SHA256&digits=8&period=60",
    );
    expect(o).toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      issuer: "ACME Co",
      account: "alice@example.com",
      algorithm: "SHA256",
      digits: 8,
      period: 60,
    });
  });

  it("uses defaults and the label's issuer", () => {
    const o = parseOtpauth("otpauth://totp/GitHub:bob?secret=jbswy3dpehpk3pxp");
    expect(o).toMatchObject({ ...DEFAULTS, issuer: "GitHub", account: "bob" });
  });

  it("round-trips through buildOtpauth", () => {
    const o = { ...DEFAULTS, secret: "JBSWY3DPEHPK3PXP", issuer: "My App", account: "me@x.org" };
    const uri = buildOtpauth(o);
    expect(uri).toBe("otpauth://totp/My%20App:me%40x.org?secret=JBSWY3DPEHPK3PXP&issuer=My%20App");
    expect(parseOtpauth(uri)).toEqual(o);
    const long = { ...o, algorithm: "SHA512" as const, digits: 8, period: 60 };
    expect(parseOtpauth(buildOtpauth(long))).toEqual(long);
  });

  it("rejects HOTP, missing secrets and bad parameters", () => {
    expect(() => parseOtpauth("otpauth://hotp/x?secret=JBSWY3DP&counter=1")).toThrow(EncodeError);
    expect(() => parseOtpauth("otpauth://totp/x")).toThrow(EncodeError);
    expect(() => parseOtpauth("otpauth://totp/x?secret=JBSWY3DP&digits=4")).toThrow(EncodeError);
    expect(() => parseOtpauth("otpauth://totp/x?secret=JBSWY3DP&algorithm=MD5")).toThrow(
      EncodeError,
    );
    expect(() => parseOtpauth("https://example.com")).toThrow(EncodeError);
  });
});

describe("readSource", () => {
  it("takes a bare secret with the given parameters, or a link with its own", () => {
    expect(readSource("", DEFAULTS)).toBeNull();
    expect(readSource("JBSWY3DPEHPK3PXP", DEFAULTS)?.link).toBeNull();
    const s = readSource("otpauth://totp/a?secret=JBSWY3DPEHPK3PXP&digits=8", DEFAULTS);
    expect(s?.params.digits).toBe(8);
    expect(s?.key).toHaveLength(10);
  });
});
