import { describe, expect, it } from "bun:test";
import { toHex, utf8 } from "../_shared";
import { formatMac, type HmacAlgo, hmac, parseInput, sameMac } from "./logic";

const KEY_0B = new Uint8Array(20).fill(0x0b);
const KEY_AA = new Uint8Array(131).fill(0xaa);

async function mac(algo: HmacAlgo, key: Uint8Array, msg: string) {
  return toHex(await hmac(algo, key, utf8(msg)));
}

describe("hmac", () => {
  it("matches RFC 4231 test case 1", async () => {
    expect(await mac("SHA-256", KEY_0B, "Hi There")).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    );
    expect(await mac("SHA-384", KEY_0B, "Hi There")).toBe(
      "afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6",
    );
    expect(await mac("SHA-512", KEY_0B, "Hi There")).toBe(
      "87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854",
    );
  });

  it("matches RFC 4231 test case 2 (short text key)", async () => {
    const key = parseInput("Jefe", "text");
    const msg = "what do ya want for nothing?";
    expect(await mac("SHA-256", key, msg)).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
    expect(await mac("SHA-384", key, msg)).toBe(
      "af45d2e376484031617f78d2b58a6b1b9c7ef464f5a01b47e42ec3736322445e8e2240ca5e69e2c78b3239ecfab21649",
    );
    expect(await mac("SHA-512", key, msg)).toBe(
      "164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737",
    );
  });

  it("matches RFC 4231 test case 6 (key longer than a block)", async () => {
    const msg = "Test Using Larger Than Block-Size Key - Hash Key First";
    expect(await mac("SHA-256", KEY_AA, msg)).toBe(
      "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54",
    );
    expect(await mac("SHA-384", KEY_AA, msg)).toBe(
      "4ece084485813e9088d2c63a041bc5b44f9ef1012a2b588f3cd11f05033ac4c60c2ef6ab4030fe8296248df163f44952",
    );
    expect(await mac("SHA-512", KEY_AA, msg)).toBe(
      "80b24263c7c1a3ebb71493c1dd7be8b49b46d1f41b4aeec1121b013783f8f3526b56d037e05f2598bd0fd2215d6a1e5295e64f73f63f0aec8b915a985d786598",
    );
  });

  it("matches RFC 2202 for HMAC-SHA1", async () => {
    expect(await mac("SHA-1", KEY_0B, "Hi There")).toBe("b617318655057264e28bc0b6fb378c8ef146be00");
    expect(await mac("SHA-1", utf8("Jefe"), "what do ya want for nothing?")).toBe(
      "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79",
    );
  });

  it("reads keys as hex and Base64", async () => {
    expect(toHex(parseInput("0b0b 0b0b", "hex"))).toBe("0b0b0b0b");
    expect(toHex(parseInput("SmVmZQ==", "base64"))).toBe(toHex(utf8("Jefe")));
    expect(() => parseInput("xyz", "hex")).toThrow();
    expect(() => parseInput("a", "base64")).toThrow();
  });

  it("signs an empty or Unicode message and refuses an empty key", async () => {
    expect(await mac("SHA-256", utf8("k"), "")).toHaveLength(64);
    expect(await mac("SHA-256", utf8("clé"), "héllo 👋")).toHaveLength(64);
    await expect(hmac("SHA-256", new Uint8Array(), utf8("x"))).rejects.toThrow(/key/);
  });

  it("formats and compares MACs", async () => {
    const m = await hmac("SHA-256", utf8("Jefe"), utf8("what do ya want for nothing?"));
    expect(formatMac(m, "hex", true)).toBe(
      "5BDCC146BF60754E6A042426089575C75A003F089D2739839DEC58B964EC3843",
    );
    expect(formatMac(m, "base64")).toBe("W9zBRr9gdU5qBCQmCJV1x1oAPwidJzmDnexYuWTsOEM=");
    expect(formatMac(m, "base64url")).toBe("W9zBRr9gdU5qBCQmCJV1x1oAPwidJzmDnexYuWTsOEM");
    expect(sameMac(`sha256=${formatMac(m, "hex")}`, m)).toBe(true);
    expect(sameMac(formatMac(m, "base64url"), m)).toBe(true);
    expect(sameMac("00", m)).toBe(false);
    expect(sameMac("", m)).toBe(false);
  });
});
