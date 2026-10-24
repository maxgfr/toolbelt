/**
 * Password-based encryption: AES-256-GCM with a key derived from the password by PBKDF2-SHA256
 * (WebCrypto) or Argon2id (hash-wasm). Pure: no DOM, no Preact.
 *
 * Container format, version 1 (all integers big-endian). Everything before the ciphertext is
 * the header, and the whole header is authenticated as AES-GCM additional data, so changing a
 * parameter (or the salt, or the IV) makes decryption fail like a wrong password would.
 *
 *   offset  size  field
 *   0       4     magic "TBEN" (0x54 0x42 0x45 0x4E)
 *   4       1     format version = 1
 *   5       1     KDF id: 1 = PBKDF2-HMAC-SHA256, 2 = Argon2id (v1.3)
 *   6       …     KDF parameters
 *                   PBKDF2:   iterations u32                                   (4 bytes)
 *                   Argon2id: memory in KiB u32, iterations u32, parallelism u8 (9 bytes)
 *   …       1     salt length S (16), then S bytes of random salt
 *   …       1     IV length N (12), then N bytes of random IV
 *   …       rest  AES-256-GCM ciphertext followed by its 16-byte tag
 *
 * The plaintext inside the ciphertext is itself typed, so a file comes back with its name:
 *
 *   0       1     kind: 0 = UTF-8 text, 1 = file
 *   1       2     file name length L in bytes (0 for text), then L bytes of UTF-8 name
 *   …       rest  the content (UTF-8 text, or the file's bytes)
 *
 * As text, the container is written in standard Base64 (it starts with "VEJFTg", the magic).
 */
import { argon2id } from "hash-wasm";
import type { Lang } from "../../../i18n";
import { fail, fromBase64, fromUtf8, randomBytes, utf8 } from "../_shared";

export const MAGIC = new Uint8Array([0x54, 0x42, 0x45, 0x4e]);
export const VERSION = 1;
const KDF_PBKDF2 = 1;
const KDF_ARGON2ID = 2;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type Kdf =
  | { kind: "pbkdf2"; iterations: number }
  | { kind: "argon2id"; memory: number; iterations: number; parallelism: number };

/** OWASP's 2023 recommendation for PBKDF2-HMAC-SHA256. */
export const PBKDF2_DEFAULT: Kdf = { kind: "pbkdf2", iterations: 600_000 };
/** RFC 9106's second recommended setting (64 MiB, 3 passes), on one lane. */
export const ARGON2_DEFAULT: Kdf = {
  kind: "argon2id",
  memory: 65536,
  iterations: 3,
  parallelism: 1,
};

/* Limits checked before deriving, so a crafted file cannot freeze the tab. */
const MAX_PBKDF2 = 50_000_000;
const MAX_ARGON2_MEMORY = 1_048_576; // 1 GiB
const MAX_ARGON2_ITERATIONS = 100;

export type Payload =
  | { kind: "text"; text: string }
  | { kind: "file"; name: string; data: Uint8Array };

export interface Header {
  version: number;
  kdf: Kdf;
  salt: Uint8Array;
  iv: Uint8Array;
  /** Length of the header in bytes (where the ciphertext starts). */
  length: number;
}

function checkKdf(kdf: Kdf): void {
  if (kdf.kind === "pbkdf2") {
    if (!Number.isInteger(kdf.iterations) || kdf.iterations < 1 || kdf.iterations > MAX_PBKDF2)
      fail(
        `PBKDF2 iterations must be between 1 and ${MAX_PBKDF2}.`,
        `Les itérations PBKDF2 vont de 1 à ${MAX_PBKDF2}.`,
        `Die PBKDF2-Iterationen müssen zwischen 1 und ${MAX_PBKDF2} liegen.`,
      );
    return;
  }
  const { memory, iterations, parallelism } = kdf;
  if (
    !Number.isInteger(memory) ||
    !Number.isInteger(iterations) ||
    !Number.isInteger(parallelism) ||
    parallelism < 1 ||
    parallelism > 255 ||
    iterations < 1 ||
    iterations > MAX_ARGON2_ITERATIONS ||
    memory < 8 * parallelism ||
    memory > MAX_ARGON2_MEMORY
  )
    fail(
      "Argon2id parameters out of range (memory 8 KiB to 1 GiB, 1–100 passes, 1–255 lanes).",
      "Paramètres Argon2id hors limites (mémoire de 8 Kio à 1 Gio, 1 à 100 passes, 1 à 255 voies).",
      "Argon2id-Parameter außerhalb des Bereichs (Speicher 8 KiB bis 1 GiB, 1–100 Durchläufe, 1–255 Lanes).",
    );
}

/** Derives the raw 32-byte AES key. */
export async function deriveKeyBytes(
  password: string,
  salt: Uint8Array,
  kdf: Kdf,
): Promise<Uint8Array> {
  checkKdf(kdf);
  const pw = utf8(password.normalize("NFC"));
  if (kdf.kind === "pbkdf2") {
    const base = await crypto.subtle.importKey("raw", new Uint8Array(pw), "PBKDF2", false, [
      "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations: kdf.iterations },
      base,
      256,
    );
    return new Uint8Array(bits);
  }
  return argon2id({
    password: pw,
    salt,
    memorySize: kdf.memory,
    iterations: kdf.iterations,
    parallelism: kdf.parallelism,
    hashLength: 32,
    outputType: "binary",
  });
}

function aesKey(raw: Uint8Array, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new Uint8Array(raw), "AES-GCM", false, [usage]);
}

export function writeHeader(kdf: Kdf, salt: Uint8Array, iv: Uint8Array): Uint8Array {
  const params = kdf.kind === "pbkdf2" ? 4 : 9;
  const out = new Uint8Array(4 + 1 + 1 + params + 1 + salt.length + 1 + iv.length);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  out[4] = VERSION;
  let p = 6;
  if (kdf.kind === "pbkdf2") {
    out[5] = KDF_PBKDF2;
    view.setUint32(p, kdf.iterations);
    p += 4;
  } else {
    out[5] = KDF_ARGON2ID;
    view.setUint32(p, kdf.memory);
    view.setUint32(p + 4, kdf.iterations);
    out[p + 8] = kdf.parallelism;
    p += 9;
  }
  out[p++] = salt.length;
  out.set(salt, p);
  p += salt.length;
  out[p++] = iv.length;
  out.set(iv, p);
  return out;
}

function corrupted(): never {
  fail(
    "The data is truncated or corrupted (the header cannot be read).",
    "Les données sont tronquées ou corrompues (l'en-tête est illisible).",
    "Die Daten sind abgeschnitten oder beschädigt (der Header ist nicht lesbar).",
  );
}

/** True when the bytes start with the container's magic. */
export function isContainer(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && MAGIC.every((b, i) => bytes[i] === b);
}

/** Reads and checks the header. Throws a bilingual error on anything unexpected. */
export function readHeader(bytes: Uint8Array): Header {
  if (!isContainer(bytes))
    fail(
      "This is not data encrypted by this tool (the TBEN signature is missing).",
      "Ce ne sont pas des données chiffrées par cet outil (la signature TBEN manque).",
      "Das sind keine mit diesem Werkzeug verschlüsselten Daten (die TBEN-Signatur fehlt).",
    );
  if (bytes.length < 6) corrupted();
  const version = bytes[4] as number;
  if (version !== VERSION)
    fail(
      `Unsupported format version ${version} (this tool reads version ${VERSION}).`,
      `Version de format ${version} non prise en charge (cet outil lit la version ${VERSION}).`,
      `Nicht unterstützte Formatversion ${version} (dieses Werkzeug liest Version ${VERSION}).`,
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const id = bytes[5];
  let p = 6;
  let kdf: Kdf;
  if (id === KDF_PBKDF2) {
    if (bytes.length < p + 4) corrupted();
    kdf = { kind: "pbkdf2", iterations: view.getUint32(p) };
    p += 4;
  } else if (id === KDF_ARGON2ID) {
    if (bytes.length < p + 9) corrupted();
    kdf = {
      kind: "argon2id",
      memory: view.getUint32(p),
      iterations: view.getUint32(p + 4),
      parallelism: bytes[p + 8] as number,
    };
    p += 9;
  } else {
    fail(
      `Unknown key derivation (id ${id}).`,
      `Dérivation de clé inconnue (id ${id}).`,
      `Unbekannte Schlüsselableitung (ID ${id}).`,
    );
  }
  checkKdf(kdf);
  const saltLen = bytes[p++];
  if (saltLen === undefined || saltLen < 8 || bytes.length < p + saltLen) corrupted();
  const salt = bytes.slice(p, p + saltLen);
  p += saltLen;
  const ivLen = bytes[p++];
  if (ivLen === undefined || ivLen < 12 || bytes.length < p + ivLen) corrupted();
  const iv = bytes.slice(p, p + ivLen);
  p += ivLen;
  if (bytes.length < p + TAG_BYTES) corrupted();
  return { version, kdf, salt, iv, length: p };
}

export function packPayload(payload: Payload): Uint8Array {
  const name = payload.kind === "file" ? utf8(payload.name).slice(0, 0xffff) : new Uint8Array();
  const data = payload.kind === "file" ? payload.data : utf8(payload.text);
  const out = new Uint8Array(3 + name.length + data.length);
  out[0] = payload.kind === "file" ? 1 : 0;
  out[1] = name.length >> 8;
  out[2] = name.length & 0xff;
  out.set(name, 3);
  out.set(data, 3 + name.length);
  return out;
}

export function unpackPayload(bytes: Uint8Array): Payload {
  if (bytes.length < 3) corrupted();
  const nameLen = ((bytes[1] as number) << 8) | (bytes[2] as number);
  if (bytes.length < 3 + nameLen) corrupted();
  const rest = bytes.subarray(3 + nameLen);
  if (bytes[0] === 1)
    return {
      kind: "file",
      name: fromUtf8(bytes.subarray(3, 3 + nameLen)) || "decrypted",
      data: rest.slice(),
    };
  if (bytes[0] === 0) return { kind: "text", text: fromUtf8(rest, true) };
  return corrupted();
}

export interface EncryptOptions {
  /** Fixed salt / IV, for tests only: real use must leave them random. */
  salt?: Uint8Array;
  iv?: Uint8Array;
}

/** Encrypts a text or a file into the container described above. */
export async function encrypt(
  payload: Payload,
  password: string,
  kdf: Kdf,
  opts: EncryptOptions = {},
): Promise<Uint8Array> {
  if (!password) fail("Enter a password.", "Saisis un mot de passe.", "Gib ein Passwort ein.");
  const salt = opts.salt ?? randomBytes(SALT_BYTES);
  const iv = opts.iv ?? randomBytes(IV_BYTES);
  const header = writeHeader(kdf, salt, iv);
  const key = await aesKey(await deriveKeyBytes(password, salt, kdf), "encrypt");
  const ct = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
      additionalData: new Uint8Array(header),
      tagLength: 128,
    },
    key,
    new Uint8Array(packPayload(payload)),
  );
  const out = new Uint8Array(header.length + ct.byteLength);
  out.set(header, 0);
  out.set(new Uint8Array(ct), header.length);
  return out;
}

/** Decrypts a container. A wrong password and tampered data give the same error (GCM cannot tell). */
export async function decrypt(
  bytes: Uint8Array,
  password: string,
): Promise<{ payload: Payload; header: Header }> {
  const header = readHeader(bytes);
  if (!password) fail("Enter the password.", "Saisis le mot de passe.", "Gib das Passwort ein.");
  const key = await aesKey(await deriveKeyBytes(password, header.salt, header.kdf), "decrypt");
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(header.iv),
        additionalData: new Uint8Array(bytes.subarray(0, header.length)),
        tagLength: 128,
      },
      key,
      new Uint8Array(bytes.subarray(header.length)),
    );
  } catch {
    fail(
      "Wrong password, or the data was modified or corrupted.",
      "Mauvais mot de passe, ou les données ont été modifiées ou corrompues.",
      "Falsches Passwort, oder die Daten wurden verändert oder beschädigt.",
    );
  }
  return { payload: unpackPayload(new Uint8Array(plain)), header };
}

/** The container as Base64 text, wrapped at 76 characters per line when asked. */
export function armor(bytes: Uint8Array, wrap = false): string {
  let b64 = "";
  for (let i = 0; i < bytes.length; i += 0x6000)
    b64 += btoa(String.fromCharCode(...bytes.subarray(i, i + 0x6000)));
  return wrap ? (b64.match(/.{1,76}/g) ?? []).join("\n") : b64;
}

/** Base64 text (whitespace allowed) back to the container's bytes. */
export function dearmor(text: string): Uint8Array {
  const t = text.trim();
  if (!t)
    fail(
      "Paste the encrypted text.",
      "Colle le texte chiffré.",
      "Füge den verschlüsselten Text ein.",
    );
  return fromBase64(t);
}

/** The words of `kdfLabel` in each language. */
const KDF_WORDS: Record<
  Lang,
  { iterations: string; mib: string; kib: string; passes: string; lanes: string }
> = {
  en: { iterations: "iterations", mib: "MiB", kib: "KiB", passes: "passes", lanes: "lane(s)" },
  fr: { iterations: "itérations", mib: "Mio", kib: "Kio", passes: "passes", lanes: "voie(s)" },
  de: { iterations: "Iterationen", mib: "MiB", kib: "KiB", passes: "Durchläufe", lanes: "Lane(s)" },
};

/** A short description of the key derivation, e.g. "PBKDF2-SHA256, 600,000 iterations". */
export function kdfLabel(kdf: Kdf, fmt: (n: number) => string, lang: Lang = "en"): string {
  const w = KDF_WORDS[lang];
  if (kdf.kind === "pbkdf2") return `PBKDF2-HMAC-SHA256, ${fmt(kdf.iterations)} ${w.iterations}`;
  const mib = kdf.memory / 1024;
  const mem = Number.isInteger(mib) ? `${fmt(mib)} ${w.mib}` : `${fmt(kdf.memory)} ${w.kib}`;
  return `Argon2id, ${mem}, ${fmt(kdf.iterations)} ${w.passes}, ${fmt(kdf.parallelism)} ${w.lanes}`;
}

/** Name of the encrypted file: "photo.jpg" → "photo.jpg.enc". */
export function encName(name: string): string {
  return `${name || "data"}.enc`;
}
