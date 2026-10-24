import { describe, expect, it } from "bun:test";
import { EncodeError, fromHex, toHex, utf8 } from "../_shared";
import {
  armor,
  dearmor,
  decrypt,
  deriveKeyBytes,
  encName,
  encrypt,
  isContainer,
  type Kdf,
  kdfLabel,
  readHeader,
  writeHeader,
} from "./logic";

const FAST: Kdf = { kind: "pbkdf2", iterations: 1000 };
const SALT = fromHex("000102030405060708090a0b0c0d0e0f");
const IV = fromHex("a0a1a2a3a4a5a6a7a8a9aaab");

async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(EncodeError);
    return (err as EncodeError).text.en;
  }
  throw new Error("expected a failure");
}

describe("key derivation", () => {
  it("matches the PBKDF2-HMAC-SHA256 test vectors", async () => {
    const salt = utf8("salt");
    expect(toHex(await deriveKeyBytes("password", salt, { kind: "pbkdf2", iterations: 1 }))).toBe(
      "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
    );
    expect(
      toHex(await deriveKeyBytes("password", salt, { kind: "pbkdf2", iterations: 4096 })),
    ).toBe("c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a");
  });

  it("derives a 32-byte Argon2id key that depends on the salt", async () => {
    const kdf: Kdf = { kind: "argon2id", memory: 64, iterations: 1, parallelism: 1 };
    const a = await deriveKeyBytes("pw", SALT, kdf);
    const b = await deriveKeyBytes("pw", SALT, kdf);
    const c = await deriveKeyBytes("pw", IV.slice(0, 12), kdf);
    expect(a.length).toBe(32);
    expect(toHex(a)).toBe(toHex(b));
    expect(toHex(a)).not.toBe(toHex(c));
  });

  it("refuses absurd parameters before deriving", async () => {
    expect(await failure(deriveKeyBytes("pw", SALT, { kind: "pbkdf2", iterations: 0 }))).toContain(
      "PBKDF2",
    );
    expect(
      await failure(
        deriveKeyBytes("pw", SALT, {
          kind: "argon2id",
          memory: 4_000_000,
          iterations: 1,
          parallelism: 1,
        }),
      ),
    ).toContain("Argon2id");
  });
});

describe("container", () => {
  it("writes the documented header layout", () => {
    const h = writeHeader({ kind: "pbkdf2", iterations: 600_000 }, SALT, IV);
    // "TBEN" | v1 | PBKDF2 | 600000 | 16 | salt | 12 | iv
    expect(toHex(h)).toBe(
      ["5442454e", "01", "01", "000927c0", "10", toHex(SALT), "0c", toHex(IV)].join(""),
    );
    const a = writeHeader(
      { kind: "argon2id", memory: 65536, iterations: 3, parallelism: 1 },
      SALT,
      IV,
    );
    expect(toHex(a.subarray(0, 15))).toBe("5442454e" + "0102" + "00010000" + "00000003" + "01");
  });

  it("round-trips Unicode text and reads its header back", async () => {
    const text = "Bonjour l'été — 你好 👋";
    const bytes = await encrypt({ kind: "text", text }, "correct horse", FAST);
    expect(isContainer(bytes)).toBe(true);
    const { payload, header } = await decrypt(bytes, "correct horse");
    expect(payload).toEqual({ kind: "text", text });
    expect(header.kdf).toEqual(FAST);
    expect(header.salt.length).toBe(16);
    expect(header.iv.length).toBe(12);
  });

  it("round-trips an empty text", async () => {
    const bytes = await encrypt({ kind: "text", text: "" }, "pw", FAST);
    expect((await decrypt(bytes, "pw")).payload).toEqual({ kind: "text", text: "" });
  });

  it("round-trips a binary file with its name", async () => {
    const data = new Uint8Array(70_000).map((_, i) => (i * 31) & 0xff);
    const bytes = await encrypt({ kind: "file", name: "relevé n°1.pdf", data }, "pw", FAST);
    const { payload } = await decrypt(bytes, "pw");
    expect(payload.kind).toBe("file");
    if (payload.kind !== "file") return;
    expect(payload.name).toBe("relevé n°1.pdf");
    expect(toHex(payload.data)).toBe(toHex(data));
  });

  it("round-trips with Argon2id", async () => {
    const kdf: Kdf = { kind: "argon2id", memory: 256, iterations: 2, parallelism: 1 };
    const bytes = await encrypt({ kind: "text", text: "secret" }, "pw", kdf);
    const { payload, header } = await decrypt(bytes, "pw");
    expect(payload).toEqual({ kind: "text", text: "secret" });
    expect(header.kdf).toEqual(kdf);
  });

  it("is deterministic with a fixed salt and IV, random otherwise", async () => {
    const p = { kind: "text", text: "x" } as const;
    const a = await encrypt(p, "pw", FAST, { salt: SALT, iv: IV });
    const b = await encrypt(p, "pw", FAST, { salt: SALT, iv: IV });
    expect(toHex(a)).toBe(toHex(b));
    // header (6 + 4 + 1 + 16 + 1 + 12) + type, name length, "x" + 16-byte tag
    expect(a.length).toBe(40 + 4 + 16);
    const c = await encrypt(p, "pw", FAST);
    const d = await encrypt(p, "pw", FAST);
    expect(toHex(c)).not.toBe(toHex(d));
  });

  it("normalizes the password to NFC", async () => {
    const bytes = await encrypt({ kind: "text", text: "ok" }, "été", FAST);
    expect((await decrypt(bytes, "été")).payload).toEqual({ kind: "text", text: "ok" });
  });
});

describe("errors", () => {
  it("reports a wrong password", async () => {
    const bytes = await encrypt({ kind: "text", text: "hi" }, "right", FAST);
    expect(await failure(decrypt(bytes, "wrong"))).toContain("Wrong password");
  });

  it("detects a modified ciphertext or header", async () => {
    const bytes = await encrypt({ kind: "text", text: "hello world" }, "pw", FAST);
    const body = bytes.slice();
    body[body.length - 20] = (body[body.length - 20] as number) ^ 1;
    expect(await failure(decrypt(body, "pw"))).toContain("modified or corrupted");
    const head = bytes.slice();
    head[9] = (head[9] as number) ^ 1; // iterations 1000 → 1001: authenticated, so it fails
    expect(await failure(decrypt(head, "pw"))).toContain("modified or corrupted");
  });

  it("explains foreign, truncated and future data", async () => {
    expect(await failure(decrypt(utf8("hello there, not encrypted"), "pw"))).toContain("TBEN");
    const bytes = await encrypt({ kind: "text", text: "hi" }, "pw", FAST);
    expect(() => readHeader(bytes.slice(0, 20))).toThrow("truncated");
    const v2 = bytes.slice();
    v2[4] = 2;
    expect(() => readHeader(v2)).toThrow("version 2");
    const kdf = bytes.slice();
    kdf[5] = 9;
    expect(() => readHeader(kdf)).toThrow("Unknown key derivation");
  });

  it("asks for a password", async () => {
    expect(await failure(encrypt({ kind: "text", text: "x" }, "", FAST))).toContain("password");
  });
});

describe("text form", () => {
  it("armors as Base64 starting with the magic, and back", async () => {
    const bytes = await encrypt({ kind: "text", text: "x".repeat(200) }, "pw", FAST);
    const text = armor(bytes, true);
    expect(text.startsWith("VEJFTg")).toBe(true);
    expect(text.split("\n").every((line) => line.length <= 76)).toBe(true);
    expect(toHex(dearmor(`  ${text}\n`))).toBe(toHex(bytes));
    expect(() => dearmor("   ")).toThrow("Paste");
    expect(() => dearmor("not base64!")).toThrow("Base64");
  });

  it("describes the key derivation and names files", () => {
    const f = (n: number) => n.toLocaleString("en-US");
    expect(kdfLabel({ kind: "pbkdf2", iterations: 600_000 }, f, false)).toBe(
      "PBKDF2-HMAC-SHA256, 600,000 iterations",
    );
    expect(
      kdfLabel({ kind: "argon2id", memory: 65536, iterations: 3, parallelism: 1 }, f, false),
    ).toBe("Argon2id, 64 MiB, 3 passes, 1 lane(s)");
    expect(encName("a.txt")).toBe("a.txt.enc");
  });
});
