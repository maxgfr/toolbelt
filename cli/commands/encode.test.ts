import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tb } from "../test-utils";

const ok = async (argv: string[], stdin?: string) => {
  const r = await tb(argv, stdin === undefined ? {} : { stdin });
  if (r.code !== 0) throw new Error(`${argv.join(" ")} → ${r.code}: ${r.stderr}`);
  return r.stdout;
};
const bad = async (argv: string[], code = 1) => {
  const r = await tb(argv);
  expect(r.code).toBe(code);
  expect(r.stderr).toStartWith("error: ");
  return r.stderr;
};
const json = async (argv: string[]) => JSON.parse(await ok([...argv, "--json"]));

async function hs256(payload: object, secret: string): Promise<string> {
  const b64u = (s: string) => Buffer.from(s).toString("base64url");
  const input = `${b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64u(JSON.stringify(payload))}`;
  return `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
}

const ED = `-----BEGIN CERTIFICATE-----
MIIBDjCBwaADAgECAgEBMAUGAytlcDAXMRUwEwYDVQQDDAxlZDI1NTE5LnRlc3Qw
HhcNMjQwMTAxMDAwMDAwWhcNNDQwMTAxMDAwMDAwWjAXMRUwEwYDVQQDDAxlZDI1
NTE5LnRlc3QwKjAFBgMrZXADIQBZ3v6Mt/UtqPhjmCCxdEr1m678IOyn5Cu/x1km
lrlDp6MyMDAwHQYDVR0OBBYEFINX+UKPBa1Dn6uQfd2tejukAYL1MA8GA1UdEwEB
/wQFMAMBAf8wBQYDK2VwA0EAndSt+5wiHTPyXW7Nw3Zd3EagFMMpWbUFX3tW4Puf
mLA7kyp+GigMhR2/NmN1osLAJqoIK2uJyQCBf2cvRQ4wDA==
-----END CERTIFICATE-----
`;

describe("base64", () => {
  it("encodes and decodes", async () => {
    expect(await ok(["base64", "hello world"])).toBe("aGVsbG8gd29ybGQ=\n");
    expect(await ok(["base64", "-d", "aGVsbG8gd29ybGQ="])).toBe("hello world\n");
    expect(await ok(["b64", "--url-safe", "ÿþ"])).toBe("w7_Dvg\n");
  });
  it("writes decoded binary as bytes", async () => {
    const r = await tb(["base64", "-d", "iVBORw0KGgo="]);
    expect(r.bytes?.[0]).toBe(0x89);
    expect((await json(["base64", "-d", "iVBORw0KGgo="])).mime).toBe("image/png");
  });
  it("rejects invalid Base64", async () => {
    expect(await bad(["base64", "-d", "@@@"])).toContain("Base64");
  });
  it("localizes the error", async () => {
    expect(await bad(["base64", "-d", "@@@", "--lang", "fr"])).toContain("Le Base64");
  });
});

describe("base-encodings", () => {
  it("encodes to one or every encoding", async () => {
    expect(await ok(["base-encodings", "Hi", "--to", "hex"])).toBe("48 69\n");
    expect(await ok(["base-encodings", "Hi", "--to", "binary", "--separator", "none"])).toBe(
      "0100100001101001\n",
    );
    const all = await json(["base-encodings", "Hi"]);
    expect(all.hex).toBe("48 69");
    expect(all.base32).toBe("JBUQ====");
  });
  it("decodes", async () => {
    expect(await ok(["base-encodings", "48 69", "--from", "hex"])).toBe("Hi\n");
  });
  it("fails on bad digits", async () => {
    await bad(["base-encodings", "102", "--from", "binary"]);
  });
});

describe("url-encode", () => {
  it("encodes and decodes", async () => {
    expect(await ok(["url-encode", "a b&c"])).toBe("a%20b%26c\n");
    expect(await ok(["url-encode", "a b", "--mode", "form"])).toBe("a+b\n");
    expect(await ok(["url-encode", "-d", "a%20b"])).toBe("a b\n");
  });
  it("explains a malformed escape", async () => {
    expect(await bad(["url-encode", "-d", "100%"])).toContain("position 4");
  });
});

describe("url-parser", () => {
  it("splits a URL", async () => {
    const out = await ok(["url-parser", "https://user@example.com:8080/a/b?q=1&q=2#top"]);
    expect(out).toContain("Host:");
    expect(out).toContain("example.com");
    expect(out).toContain("8080");
    expect((await json(["url", "https://x.dev/?a=1"])).params).toEqual([["a", "1"]]);
  });
  it("converts query strings and JSON", async () => {
    expect(await json(["url-parser", "?a=1&a=2&b[c]=x", "--query-json"])).toEqual({
      a: ["1", "2"],
      b: { c: "x" },
    });
    expect(await ok(["url-parser", '{"q":"a b","page":2}', "--from-json"])).toBe("q=a+b&page=2\n");
  });
  it("rejects a non-URL", async () => {
    await bad(["url-parser", "not a url"]);
  });
});

describe("html-entities", () => {
  it("encodes and decodes", async () => {
    expect(await ok(["html-entities", '<a href="x">'])).toBe("&lt;a href=&quot;x&quot;&gt;\n");
    expect(await ok(["html-entities", "café", "--mode", "named"])).toBe("caf&eacute;\n");
    expect(await ok(["html-entities", "-d", "&lt;p&gt; &#x1F600;"])).toBe("<p> 😀\n");
  });
  it("refuses an unknown mode", async () => {
    await bad(["html-entities", "x", "--mode", "bogus"], 2);
  });
});

describe("jwt", () => {
  it("decodes, reads the validity and verifies the signature", async () => {
    // Expires 2026-01-15T13:00:00Z, one hour after the test clock.
    const token = await hs256({ sub: "123", exp: 1768482000 }, "s3cret");
    const out = await ok(["jwt", token]);
    expect(out).toContain('"sub": "123"');
    expect(out).toContain("expires in 1 h");
    const j = await json(["jwt", token, "--secret", "s3cret"]);
    expect(j.signatureValid).toBe(true);
    const wrong = await tb(["jwt", token, "--secret", "nope"]);
    expect(wrong.code).toBe(1);
    expect(wrong.stdout).toContain("INVALID");
  });
  it("rejects a malformed token", async () => {
    expect(await bad(["jwt", "abc"])).toContain("three parts");
  });
});

describe("hash", () => {
  it("hashes with every algorithm or one", async () => {
    const out = await ok(["hash", "abc"]);
    expect(out).toContain("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(out).toContain("MD5");
    expect(await ok(["hash", "abc", "--algo", "md5"])).toBe("900150983cd24fb0d6963f7d28e17f72\n");
  });
  it("checks an expected checksum", async () => {
    const r = await tb(["hash", "abc", "--check", "900150983cd24fb0d6963f7d28e17f72"]);
    expect(r.stdout).toContain("MD5");
    expect(r.code).toBe(0);
    const miss = await tb(["hash", "abc", "--check", "00ff"]);
    expect(miss.code).toBe(1);
  });
  it("hashes a file's bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tb-hash-"));
    await writeFile(join(dir, "a.bin"), new Uint8Array([0x61, 0x62, 0x63]));
    expect(await ok(["hash", "--file", join(dir, "a.bin"), "-a", "md5"])).toBe(
      "900150983cd24fb0d6963f7d28e17f72\n",
    );
  });
  it("refuses an unknown algorithm", async () => {
    await bad(["hash", "abc", "--algo", "sha999"], 2);
  });
});

describe("hmac", () => {
  it("signs and checks", async () => {
    const want = createHmac("sha256", "secret").update("hello").digest("hex");
    expect(await ok(["hmac", "hello", "--key", "secret"])).toBe(`${want}\n`);
    const r = await tb(["hmac", "hello", "--key", "secret", "--check", `sha256=${want}`]);
    expect(r.code).toBe(0);
    expect((await tb(["hmac", "hello", "--key", "other", "--check", want])).code).toBe(1);
  });
  it("needs a key", async () => {
    expect(await bad(["hmac", "hello"], 2)).toContain("--key");
  });
});

describe("password-hash", () => {
  it("hashes with bcrypt and verifies", async () => {
    const hash = (await ok(["password-hash", "correct horse", "--cost", "4"])).trim();
    expect(hash).toMatch(/^\$2b\$04\$/);
    expect((await tb(["password-hash", "correct horse", "--verify", hash])).code).toBe(0);
    expect((await tb(["password-hash", "wrong", "--verify", hash])).code).toBe(1);
  });
  it("hashes with Argon2id and inspects", async () => {
    const hash = (
      await ok([
        "password-hash",
        "pw",
        "--algo",
        "argon2id",
        "--memory",
        "0.0625",
        "--iterations",
        "1",
      ])
    ).trim();
    expect(hash).toStartWith("$argon2id$");
    expect(await ok(["password-hash", hash, "--inspect"])).toContain("64 KiB");
  });
  it("rejects what is not a hash", async () => {
    await bad(["password-hash", "pw", "--verify", "nothash"]);
  });
});

describe("uuid", () => {
  it("generates ids", async () => {
    expect(await ok(["uuid"])).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\n$/,
    );
    const ids = await json(["uuid", "--kind", "v7", "-n", "3"]);
    expect(ids).toHaveLength(3);
    expect(await ok(["nanoid", "--kind", "nanoid", "--size", "8", "--alphabet", "hex"])).toMatch(
      /^[0-9a-f]{8}\n$/,
    );
  });
  it("inspects an id", async () => {
    const id = (await ok(["uuid", "--kind", "v7"])).trim();
    const info = await json(["uuid", id]);
    expect(info.version).toBe(7);
    expect(info.timestamp).toBe(Date.parse("2026-01-15T12:00:00Z"));
  });
  it("rejects garbage", async () => {
    expect(await bad(["uuid", "zzz"])).toContain("UUID");
  });
});

describe("password", () => {
  it("generates passwords and passphrases", async () => {
    expect(await ok(["password", "--length", "12"])).toMatch(/^.{12}\n$/);
    const j = await json(["password", "-n", "2", "--no-symbols"]);
    expect(j.passwords).toHaveLength(2);
    expect(j.passwords[0]).toMatch(/^[A-Za-z0-9]{20}$/);
    expect((await ok(["password", "--passphrase", "--words", "4"])).trim().split("-")).toHaveLength(
      4,
    );
  });
  it("rates a password", async () => {
    expect(await ok(["password", "--check", "password1"])).toContain("very weak");
  });
  it("rejects a bad length", async () => {
    expect(await bad(["password", "--length", "2"])).toContain("length");
  });
});

describe("totp", () => {
  // RFC 6238 test vector: the ASCII secret "12345678901234567890" at T = 59 s.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it("computes the code", async () => {
    expect(await ok(["totp", secret, "--at", "59", "--digits", "8"])).toContain("94287082");
    const j = await json([
      "totp",
      `otpauth://totp/ACME:me?secret=${secret}&digits=8`,
      "--at",
      "59",
    ]);
    expect(j.code).toBe("94287082");
    expect(j.issuer).toBe("ACME");
  });
  it("generates a secret", async () => {
    const j = await json(["totp", "--generate", "--issuer", "ACME", "--account", "me"]);
    expect(j.link).toStartWith("otpauth://totp/ACME:me?secret=");
  });
  it("rejects a bad secret", async () => {
    expect(await bad(["totp", "1!"])).toContain("Base32");
  });
});

describe("keypair", () => {
  it("generates EC and Ed25519 keys", async () => {
    const out = await ok(["keypair"]);
    expect(out).toContain("-----BEGIN PRIVATE KEY-----");
    expect(out).toContain("-----BEGIN PUBLIC KEY-----");
    expect((await json(["keypair", "--algo", "ed25519", "--format", "jwk"])).publicKey.crv).toBe(
      "Ed25519",
    );
  });
  it("refuses an unsupported size", async () => {
    await bad(["keypair", "--algo", "rsa-pss", "--bits", "1024"], 2);
  });
});

describe("qr", () => {
  it("renders text and SVG", async () => {
    expect(await ok(["qr", "hello"])).toContain("█");
    expect(await ok(["qr", "hello", "--format", "svg"])).toStartWith("<svg");
    const j = await json(["qr", "--wifi-ssid", "Home", "--wifi-password", "pw"]);
    expect(j.payload).toBe("WIFI:T:WPA;S:Home;P:pw;;");
  });
  it("fails on too much data", async () => {
    await bad(["qr", "x".repeat(4000), "--ecc", "H"]);
  });
});

describe("data-uri", () => {
  it("builds and decodes", async () => {
    expect(await ok(["data-uri", "hi"])).toBe("data:text/plain;base64,aGk=\n");
    expect(await ok(["data-uri", "a b", "--encoding", "percent"])).toBe(
      "data:text/plain;charset=utf-8,a%20b\n",
    );
    expect(await ok(["data-uri", "-d", "data:text/plain;base64,aGk="])).toBe("hi\n");
  });
  it("rejects a non data URI", async () => {
    await bad(["data-uri", "-d", "nope"]);
  });
});

describe("encrypt", () => {
  it("round-trips text", async () => {
    const enc = (await ok(["encrypt", "meet at noon", "-p", "pw", "--iterations", "1000"])).trim();
    expect(enc).toStartWith("VEJFTg");
    expect(await ok(["encrypt", "-d", enc, "-p", "pw"])).toBe("meet at noon\n");
    expect(await bad(["encrypt", "-d", enc, "-p", "wrong"])).toContain("Wrong password");
  });
  it("needs a password", async () => {
    await bad(["encrypt", "x"], 2);
  });
  it("reads the password from TOOLBELT_PASSWORD", async () => {
    const r = await tb(["encrypt", "x", "--iterations", "1000"], {
      env: { TOOLBELT_PASSWORD: "pw" },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toStartWith("VEJFTg");
  });
});

describe("compress", () => {
  it("round-trips gzip and raw deflate", async () => {
    const gz = (await ok(["compress", "hello hello hello"])).trim();
    expect(await ok(["compress", "-d", gz])).toBe("hello hello hello\n");
    const raw = (await ok(["gzip", "abc", "--format", "deflate-raw", "--encoding", "hex"])).trim();
    expect((await json(["compress", "-d", raw])).format).toBe("deflate-raw");
  });
  it("rejects corrupted data", async () => {
    await bad(["compress", "-d", "H4sIAAAA", "--format", "gzip"]);
  });
});

describe("certificate", () => {
  it("decodes a PEM certificate", async () => {
    const out = await ok(["certificate"], ED);
    expect(out).toContain("CN=ed25519.test");
    expect(out).toContain("Ed25519");
    expect(out).toContain("days left");
    const j = JSON.parse(await ok(["cert", "--json"], ED));
    expect(j[0].publicKey.algorithm).toBe("Ed25519");
  });
  it("fails without a certificate", async () => {
    expect(await bad(["certificate", "hello"])).toContain("No certificate");
  });
});

describe("basic-auth", () => {
  it("encodes and decodes", async () => {
    expect(await ok(["basic-auth", "--user", "alice", "--password", "s3cret"])).toContain(
      "Authorization: Basic YWxpY2U6czNjcmV0",
    );
    const j = await json(["basic-auth", "Authorization: Basic YWxpY2U6czNjcmV0"]);
    expect(j).toMatchObject({ user: "alice", password: "s3cret", source: "header" });
  });
  it("rejects what holds no credentials", async () => {
    await bad(["basic-auth", "hello world!"]);
  });
});

describe("bip39", () => {
  const zero = `${"abandon ".repeat(11)}about`;
  it("converts entropy and validates", async () => {
    expect((await json(["bip39", "--entropy", "00".repeat(16)])).mnemonic).toBe(zero);
    const j = await json(["bip39", zero, "--seed", "--passphrase", "TREZOR"]);
    expect(j.seed).toStartWith("c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e5349553");
  });
  it("generates mnemonics", async () => {
    expect((await json(["bip39", "--words", "24"])).words).toBe(24);
  });
  it("points at a mistyped word", async () => {
    expect(await bad(["bip39", zero.replace("about", "abuot")])).toContain("Word 12");
  });
});

describe("safelink", () => {
  it("strips tracking parameters", async () => {
    expect(await ok(["safelink", "see https://example.com/?utm_source=x&id=3."])).toBe(
      "see https://example.com/?id=3.\n",
    );
  });
  it("fails without a URL", async () => {
    await bad(["safelink", "no link here"]);
  });
});
