import { describe, expect, it } from "bun:test";
import { toBase64, utf8 } from "../_shared";
import {
  algName,
  decodeJwt,
  humanDuration,
  isHmacAlg,
  timeClaims,
  validity,
  verifyHmac,
} from "./logic";

// The example token of jwt.io, signed with HS256 and the secret "your-256-bit-secret".
const JWT_IO =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const b64url = (s: string) => toBase64(utf8(s), true);

async function sign(alg: "HS256" | "HS384" | "HS512", payload: object, secret: string) {
  const input = `${b64url(JSON.stringify({ alg, typ: "JWT" }))}.${b64url(JSON.stringify(payload))}`;
  const hash = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" }[alg];
  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(utf8(secret)),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new Uint8Array(utf8(input))));
  return `${input}.${toBase64(sig, true)}`;
}

describe("jwt", () => {
  it("decodes the jwt.io example", () => {
    const d = decodeJwt(JWT_IO);
    expect(d.alg).toBe("HS256");
    expect(d.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(d.payload).toEqual({ sub: "1234567890", name: "John Doe", iat: 1516239022 });
    expect(d.signature).toBe("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("accepts a Bearer prefix and line breaks", () => {
    expect(decodeJwt(`Bearer ${JWT_IO.replace(".", ".\n")}`).alg).toBe("HS256");
  });

  it("decodes UTF-8 claims", () => {
    const t = `${b64url('{"alg":"none"}')}.${b64url('{"name":"Zoë 👋"}')}.`;
    expect(decodeJwt(t).payload).toEqual({ name: "Zoë 👋" });
  });

  it("rejects malformed tokens with a message", () => {
    expect(() => decodeJwt("")).toThrow(/three parts/);
    expect(() => decodeJwt("a.b")).toThrow(/three parts/);
    expect(() => decodeJwt("a.b.c.d.e")).toThrow(/JWE/);
    expect(() => decodeJwt(`${b64url("not json")}.e30.`)).toThrow(/header is not valid JSON/);
    expect(() => decodeJwt(`${b64url("[1]")}.e30.`)).toThrow(/JSON object/);
    expect(() => decodeJwt("e30.e30.a+b")).toThrow(/signature/);
  });

  it("keeps a non-JSON payload as text", () => {
    const d = decodeJwt(`e30.${b64url("hello")}.`);
    expect(d.payload).toBeNull();
    expect(d.payloadText).toBe("hello");
  });

  it("reads the time claims", () => {
    const c = timeClaims({ iat: 1516239022, exp: 1516242622, sub: "x" });
    expect(c.map((x) => x.claim)).toEqual(["iat", "exp"]);
    expect(c[0]?.date.toISOString()).toBe("2018-01-18T01:30:22.000Z");
    expect(timeClaims("text")).toEqual([]);
  });

  it("tells expired, not yet valid and valid apart", () => {
    expect(validity({ exp: 100 }, 150)).toEqual({ state: "expired", since: 50 });
    expect(validity({ exp: 100 }, 100).state).toBe("expired");
    expect(validity({ nbf: 200, exp: 300 }, 150)).toEqual({ state: "early", in: 50 });
    expect(validity({ nbf: 100, exp: 300 }, 150)).toEqual({ state: "valid", left: 150 });
    expect(validity({ nbf: 100 }, 150)).toEqual({ state: "valid", left: null });
    expect(validity({ sub: "x" }, 150)).toEqual({ state: "none" });
  });

  it("formats durations with two units", () => {
    expect(humanDuration(0)).toBe("0 s");
    expect(humanDuration(42)).toBe("42 s");
    expect(humanDuration(3725)).toBe("1 h 2 min");
    expect(humanDuration(90061)).toBe("1 d 1 h");
    expect(humanDuration(90061, "fr")).toBe("1 j 1 h");
    expect(humanDuration(90061, "de")).toBe("1 T 1 h");
    expect(humanDuration(3600)).toBe("1 h");
  });

  it("verifies the jwt.io signature", async () => {
    const d = decodeJwt(JWT_IO);
    expect(await verifyHmac(d, "your-256-bit-secret")).toBe(true);
    expect(await verifyHmac(d, "wrong")).toBe(false);
    expect(await verifyHmac(d, toBase64(utf8("your-256-bit-secret")), "base64")).toBe(true);
  });

  it("verifies HS384 and HS512", async () => {
    for (const alg of ["HS384", "HS512"] as const) {
      const d = decodeJwt(await sign(alg, { a: 1 }, "s3cret"));
      expect(await verifyHmac(d, "s3cret")).toBe(true);
      expect(await verifyHmac(d, "s3cret!")).toBe(false);
    }
  });

  it("refuses to verify other algorithms or an empty secret", async () => {
    expect(isHmacAlg("RS256")).toBe(false);
    const rs = decodeJwt(`${b64url('{"alg":"RS256"}')}.e30.abc`);
    await expect(verifyHmac(rs, "x")).rejects.toThrow(/HS256/);
    await expect(verifyHmac(decodeJwt(JWT_IO), "")).rejects.toThrow(/secret/);
  });
});

describe("algName", () => {
  it("names the usual algorithms", () => {
    expect(algName("HS256")).toBe("HMAC + SHA-256");
    expect(algName("ES512")).toBe("ECDSA P-521 + SHA-512");
    expect(algName("PS384")).toBe("RSASSA-PSS + SHA-384");
    expect(algName("none")).toBe("");
  });
});
