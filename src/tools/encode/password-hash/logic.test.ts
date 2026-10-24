import { describe, expect, it } from "bun:test";
import {
  argon2Hash,
  bcryptBytes,
  bcryptHash,
  bcryptTruncates,
  describeHash,
  verifyPassword,
} from "./logic";

// A classic bcrypt test vector (OpenBSD / John the Ripper): "U*U" at cost 5.
const U_U = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW";
const FAST = { memory: 64, iterations: 1, parallelism: 1 };

describe("bcrypt", () => {
  it("verifies a known hash", async () => {
    expect(await verifyPassword("U*U", U_U)).toBe(true);
    expect(await verifyPassword("U*V", U_U)).toBe(false);
    expect(await verifyPassword("U*U", U_U.replace("$2a$", "$2y$"))).toBe(true);
  });

  it("hashes with a random salt, and the hash verifies", async () => {
    const a = await bcryptHash("correct horse", 4);
    const b = await bcryptHash("correct horse", 4);
    expect(a).toMatch(/^\$2b\$04\$[./A-Za-z0-9]{53}$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse", a)).toBe(true);
    expect(await verifyPassword("correct horsE", a)).toBe(false);
  });

  it("agrees with Bun's own bcrypt, Unicode included", async () => {
    const theirs = await Bun.password.hash("pässwörd 🔑", { algorithm: "bcrypt", cost: 4 });
    expect(await verifyPassword("pässwörd 🔑", theirs)).toBe(true);
    const ours = await bcryptHash("pässwörd 🔑", 4);
    expect(await Bun.password.verify("pässwörd 🔑", ours)).toBe(true);
  });

  it("only uses the first 72 bytes, like every bcrypt", async () => {
    const long = "a".repeat(80);
    expect(bcryptTruncates(long)).toBe(true);
    expect(bcryptTruncates("a".repeat(72))).toBe(false);
    expect(bcryptBytes(long)).toHaveLength(72);
    const h = await bcryptHash(long, 4);
    expect(await verifyPassword(`${"a".repeat(72)}different tail`, h)).toBe(true);
  });

  it("refuses an empty password and a bad cost", async () => {
    await expect(bcryptHash("", 4)).rejects.toThrow(/password/);
    await expect(bcryptHash("x", 3)).rejects.toThrow(/cost/);
  });
});

describe("argon2id", () => {
  it("hashes and verifies", async () => {
    const h = await argon2Hash("hunter2", FAST);
    expect(h).toMatch(/^\$argon2id\$v=19\$m=64,t=1,p=1\$/);
    expect(await verifyPassword("hunter2", h)).toBe(true);
    expect(await verifyPassword("hunter3", h)).toBe(false);
  });

  it("agrees with Bun's own Argon2id", async () => {
    const theirs = await Bun.password.hash("clé secrète", {
      algorithm: "argon2id",
      memoryCost: 64,
      timeCost: 1,
    });
    expect(await verifyPassword("clé secrète", theirs)).toBe(true);
    const ours = await argon2Hash("clé secrète", FAST);
    expect(await Bun.password.verify("clé secrète", ours)).toBe(true);
  });

  it("refuses impossible parameters", async () => {
    await expect(argon2Hash("x", { memory: 4, iterations: 1, parallelism: 1 })).rejects.toThrow(
      /8 KiB/,
    );
    await expect(argon2Hash("x", { memory: 64, iterations: 0, parallelism: 1 })).rejects.toThrow();
  });
});

describe("describeHash", () => {
  it("reads bcrypt and Argon2 parameters", () => {
    expect(describeHash(U_U)).toEqual({ kind: "bcrypt", variant: "2a", cost: 5 });
    expect(
      describeHash("$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG"),
    ).toEqual({
      kind: "argon2",
      variant: "argon2id",
      version: 19,
      memory: 65536,
      iterations: 3,
      parallelism: 4,
    });
  });

  it("rejects anything else", async () => {
    expect(describeHash("")).toBeNull();
    expect(describeHash("5f4dcc3b5aa765d61d8327deb882cf99")).toBeNull();
    expect(describeHash("$2b$10$tooShort")).toBeNull();
    await expect(verifyPassword("x", "nope")).rejects.toThrow(/bcrypt/);
  });
});
