import { describe, expect, it } from "bun:test";
import { fileStem, formatFingerprint, fromPem, generateKeyPair, keyParams, toPem } from "./logic";

describe("keypair", () => {
  it("wraps DER in 64-column PEM and reads it back", () => {
    const der = new Uint8Array(100).map((_, i) => i);
    const pem = toPem(der, "PUBLIC KEY");
    const lines = pem.trim().split("\n");
    expect(lines[0]).toBe("-----BEGIN PUBLIC KEY-----");
    expect(lines.at(-1)).toBe("-----END PUBLIC KEY-----");
    expect(lines[1]?.length).toBe(64);
    expect(lines.slice(1, -1).every((x) => x.length <= 64)).toBe(true);
    const back = fromPem(pem);
    expect(back.label).toBe("PUBLIC KEY");
    expect([...back.der]).toEqual([...der]);
  });

  it("rejects text without a PEM block", () => {
    expect(() => fromPem("hello")).toThrow();
  });

  it("formats fingerprints and file names", () => {
    expect(formatFingerprint(new Uint8Array([0xab, 0x01, 0xff]))).toBe("ab:01:ff");
    expect(fileStem({ algo: "RSA-PSS", bits: "3072", curve: "P-256" })).toBe("rsa-pss-3072");
    expect(fileStem({ algo: "ECDSA", bits: "2048", curve: "P-384" })).toBe("ecdsa-p-384");
    expect(fileStem({ algo: "Ed25519", bits: "2048", curve: "P-256" })).toBe("ed25519");
  });

  it("uses encryption usages for RSA-OAEP and signing for the rest", () => {
    expect(keyParams({ algo: "RSA-OAEP", bits: "2048", curve: "P-256" }).usages).toEqual([
      "encrypt",
      "decrypt",
    ]);
    expect(keyParams({ algo: "ECDSA", bits: "2048", curve: "P-521" }).usages).toEqual([
      "sign",
      "verify",
    ]);
  });

  it("generates an ECDSA P-256 pair whose PEM imports back", async () => {
    const out = await generateKeyPair({ algo: "ECDSA", bits: "2048", curve: "P-256" });
    expect(out.publicPem).toContain("BEGIN PUBLIC KEY");
    expect(out.privatePem).toContain("BEGIN PRIVATE KEY");
    expect(JSON.parse(out.publicJwk)).toMatchObject({ kty: "EC", crv: "P-256" });
    expect(JSON.parse(out.privateJwk).d).toBeString();
    expect(out.fingerprint).toMatch(/^([0-9a-f]{2}:){31}[0-9a-f]{2}$/);
    const key = await crypto.subtle.importKey(
      "spki",
      fromPem(out.publicPem).der,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );
    expect(key.type).toBe("public");
  });

  it("generates an RSA-PSS 2048 pair", async () => {
    const out = await generateKeyPair({ algo: "RSA-PSS", bits: "2048", curve: "P-256" });
    const jwk = JSON.parse(out.publicJwk);
    expect(jwk.kty).toBe("RSA");
    expect(jwk.e).toBe("AQAB");
    expect(jwk.alg).toBe("PS256");
    // A 2048-bit modulus is 256 bytes: 342 or 343 Base64url characters.
    expect(Math.round((jwk.n.length * 6) / 8)).toBeGreaterThanOrEqual(256);
  });

  it("generates an Ed25519 pair (or reports it as unsupported)", async () => {
    try {
      const out = await generateKeyPair({ algo: "Ed25519", bits: "2048", curve: "P-256" });
      expect(JSON.parse(out.publicJwk)).toMatchObject({ kty: "OKP", crv: "Ed25519" });
    } catch (err) {
      expect(String(err)).toContain("Ed25519");
    }
  });
});
