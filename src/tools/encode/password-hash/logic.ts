/**
 * Password hashing with hash-wasm: bcrypt and Argon2id in their usual encoded form (the
 * `$2b$…` / `$argon2id$…` strings that store algorithm, cost and salt with the hash).
 */
import { argon2id, argon2Verify, bcrypt, bcryptVerify } from "hash-wasm";
import { fail, randomBytes, utf8 } from "../_shared";

/** bcrypt only reads the first 72 bytes of a password. */
export const BCRYPT_MAX_BYTES = 72;

/** The password bytes bcrypt actually uses (UTF-8, cut at 72 bytes like every implementation). */
export function bcryptBytes(password: string): Uint8Array {
  return utf8(password).slice(0, BCRYPT_MAX_BYTES);
}

export function bcryptTruncates(password: string): boolean {
  return utf8(password).length > BCRYPT_MAX_BYTES;
}

function needPassword(password: string): void {
  if (!password) fail("Enter a password.", "Saisis un mot de passe.");
}

export async function bcryptHash(password: string, cost: number): Promise<string> {
  needPassword(password);
  if (!Number.isInteger(cost) || cost < 4 || cost > 31)
    fail("The bcrypt cost goes from 4 to 31.", "Le coût bcrypt va de 4 à 31.");
  const h = await bcrypt({
    password: bcryptBytes(password),
    salt: randomBytes(16),
    costFactor: cost,
  });
  // hash-wasm writes $2a$; $2b$ is the current tag (same result for passwords cut at 72 bytes).
  return h.replace(/^\$2a\$/, "$2b$");
}

export interface Argon2Params {
  /** Memory in KiB. */
  memory: number;
  iterations: number;
  parallelism: number;
  hashLength?: number;
}

/** OWASP's minimum for Argon2id: 19 MiB, 2 iterations, 1 lane. */
export const ARGON2_DEFAULTS: Argon2Params = { memory: 19456, iterations: 2, parallelism: 1 };

export async function argon2Hash(password: string, p: Argon2Params): Promise<string> {
  needPassword(password);
  if (p.parallelism < 1 || p.iterations < 1 || p.memory < 8 * p.parallelism)
    fail(
      "Argon2 needs at least 1 iteration, 1 lane and 8 KiB of memory per lane.",
      "Argon2 demande au moins 1 itération, 1 voie et 8 Kio de mémoire par voie.",
    );
  return argon2id({
    password: utf8(password),
    salt: randomBytes(16),
    iterations: p.iterations,
    parallelism: p.parallelism,
    memorySize: p.memory,
    hashLength: p.hashLength ?? 32,
    outputType: "encoded",
  });
}

export type HashInfo =
  | { kind: "bcrypt"; variant: string; cost: number }
  | {
      kind: "argon2";
      variant: "argon2id" | "argon2i" | "argon2d";
      version: number;
      memory: number;
      iterations: number;
      parallelism: number;
    };

const BCRYPT_RE = /^\$(2[aby]?)\$(\d{2})\$[./A-Za-z0-9]{53}$/;
const ARGON2_RE =
  /^\$(argon2(?:id|i|d))\$(?:v=(\d+)\$)?m=(\d+),t=(\d+),p=(\d+)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

/** What an encoded hash is and the parameters it stores; null when it is neither format. */
export function describeHash(hash: string): HashInfo | null {
  const h = hash.trim();
  const b = BCRYPT_RE.exec(h);
  if (b) return { kind: "bcrypt", variant: b[1] as string, cost: Number(b[2]) };
  const a = ARGON2_RE.exec(h);
  if (a)
    return {
      kind: "argon2",
      variant: a[1] as "argon2id" | "argon2i" | "argon2d",
      version: a[2] ? Number(a[2]) : 16,
      memory: Number(a[3]),
      iterations: Number(a[4]),
      parallelism: Number(a[5]),
    };
  return null;
}

/** Checks a password against a bcrypt or Argon2 encoded hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const info = describeHash(hash);
  if (!info)
    fail(
      "Not a bcrypt ($2b$…) or Argon2 ($argon2id$…) hash.",
      "Ce n'est pas un hash bcrypt ($2b$…) ni Argon2 ($argon2id$…).",
    );
  needPassword(password);
  const h = hash.trim();
  if (info.kind === "bcrypt") {
    // hash-wasm is given $2b$; $2a$ and $2y$ compute the same for passwords cut at 72 bytes.
    const normalized = h.replace(/^\$2[ay]?\$/, "$2b$");
    return bcryptVerify({ password: bcryptBytes(password), hash: normalized });
  }
  return argon2Verify({ password: utf8(password), hash: h });
}
