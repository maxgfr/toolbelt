/**
 * BIP39 mnemonics (English wordlist): entropy ↔ words with the SHA-256 checksum, validation
 * with helpful errors, and the PBKDF2-HMAC-SHA512 seed. Pure: no DOM, no Preact.
 */
import { fail, randomBytes, utf8 } from "../_shared";
import { WORDS } from "./words";

export const WORD_COUNTS = [12, 15, 18, 21, 24] as const;
export type WordCount = (typeof WORD_COUNTS)[number];

const INDEX = new Map(WORDS.map((w, i) => [w, i]));

/* --- SHA-256 (synchronous: the checksum is needed while typing) ------------------------------ */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const len = data.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const msg = new Uint8Array(total);
  msg.set(data);
  msg[len] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(total - 8, Math.floor((len * 8) / 2 ** 32));
  view.setUint32(total - 4, (len * 8) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] as number;
      const b = w[i - 2] as number;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e as number, 6) ^ rotr(e as number, 11) ^ rotr(e as number, 25);
      const ch = ((e as number) & (f as number)) ^ (~(e as number) & (g as number));
      const t1 = ((hh as number) + S1 + ch + (K[i] as number) + (w[i] as number)) >>> 0;
      const S0 = rotr(a as number, 2) ^ rotr(a as number, 13) ^ rotr(a as number, 22);
      const maj =
        ((a as number) & (b as number)) ^
        ((a as number) & (c as number)) ^
        ((b as number) & (c as number));
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = ((d as number) + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const out = [a, b, c, d, e, f, g, hh] as number[];
    for (let i = 0; i < 8; i++) h[i] = ((h[i] as number) + (out[i] as number)) >>> 0;
  }
  const res = new Uint8Array(32);
  const rv = new DataView(res.buffer);
  for (let i = 0; i < 8; i++) rv.setUint32(i * 4, h[i] as number);
  return res;
}

/* --- Entropy ↔ mnemonic -------------------------------------------------------------------- */

function bitsOf(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(2).padStart(8, "0");
  return s;
}

function checkEntropy(entropy: Uint8Array): void {
  if (entropy.length < 16 || entropy.length > 32 || entropy.length % 4)
    fail(
      "Entropy must be 16, 20, 24, 28 or 32 bytes (32 to 64 hex digits, a multiple of 8).",
      "L'entropie doit faire 16, 20, 24, 28 ou 32 octets (32 à 64 chiffres hexa, multiple de 8).",
    );
}

export function entropyToWords(entropy: Uint8Array): string[] {
  checkEntropy(entropy);
  const cs = entropy.length / 4; // checksum bits = ENT / 32
  const bits = bitsOf(entropy) + bitsOf(sha256(entropy)).slice(0, cs);
  const out: string[] = [];
  for (let i = 0; i < bits.length; i += 11)
    out.push(WORDS[Number.parseInt(bits.slice(i, i + 11), 2)] as string);
  return out;
}

export function entropyToMnemonic(entropy: Uint8Array): string {
  return entropyToWords(entropy).join(" ");
}

/** A fresh random mnemonic of 12 to 24 words (WebCrypto randomness). */
export function generateMnemonic(words: WordCount): string {
  return entropyToMnemonic(randomBytes((words / 3) * 4));
}

/** Lowercases, normalizes (NFKD) and splits on any whitespace. */
export function splitWords(text: string): string[] {
  return text.normalize("NFKD").toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Words of the list that share the first four letters (every BIP39 word is unique by them). */
export function suggestions(word: string): string[] {
  if (word.length < 3) return [];
  const p = word.slice(0, 4);
  return WORDS.filter((w) => w.startsWith(p)).slice(0, 4);
}

export interface Check {
  words: string[];
  /** Positions (0-based) of words not in the list. */
  unknown: number[];
  /** Null until every word is known and the count is valid. */
  checksumOk: boolean | null;
  entropy: Uint8Array | null;
}

/** Inspects a mnemonic without throwing: unknown words, length, checksum. */
export function check(text: string): Check {
  const words = splitWords(text);
  const unknown = words.flatMap((w, i) => (INDEX.has(w) ? [] : [i]));
  const countOk = (WORD_COUNTS as readonly number[]).includes(words.length);
  if (unknown.length || !countOk) return { words, unknown, checksumOk: null, entropy: null };
  const bits = words.map((w) => (INDEX.get(w) as number).toString(2).padStart(11, "0")).join("");
  const csLen = words.length / 3;
  const entBits = bits.slice(0, bits.length - csLen);
  const entropy = new Uint8Array(entBits.length / 8);
  for (let i = 0; i < entropy.length; i++)
    entropy[i] = Number.parseInt(entBits.slice(i * 8, i * 8 + 8), 2);
  const ok = bitsOf(sha256(entropy)).slice(0, csLen) === bits.slice(-csLen);
  return { words, unknown, checksumOk: ok, entropy };
}

/** The entropy of a valid mnemonic; throws a bilingual error explaining what is wrong. */
export function mnemonicToEntropy(text: string): Uint8Array {
  const c = check(text);
  if (!c.words.length) fail("Enter a mnemonic.", "Saisis une phrase mnémonique.");
  const first = c.unknown[0];
  if (first !== undefined) {
    const w = c.words[first] as string;
    const s = suggestions(w);
    const hint = s.length ? ` (${s.join(", ")}?)` : "";
    fail(
      `Word ${first + 1} "${w}" is not in the BIP39 English list${hint}.`,
      `Le mot ${first + 1} « ${w} » n'est pas dans la liste BIP39 anglaise${hint}.`,
    );
  }
  if (!c.entropy)
    fail(
      `${c.words.length} words: a mnemonic has 12, 15, 18, 21 or 24 words.`,
      `${c.words.length} mots : une phrase mnémonique a 12, 15, 18, 21 ou 24 mots.`,
    );
  if (!c.checksumOk)
    fail(
      "Wrong checksum: a word is mistyped or the order is wrong.",
      "Somme de contrôle fausse : un mot est mal saisi ou l'ordre est faux.",
    );
  return c.entropy;
}

/** The 64-byte BIP39 seed: PBKDF2-HMAC-SHA512(mnemonic, "mnemonic" + passphrase, 2048). */
export async function mnemonicToSeed(mnemonic: string, passphrase = ""): Promise<Uint8Array> {
  const m = splitWords(mnemonic).join(" ");
  const key = await crypto.subtle.importKey("raw", new Uint8Array(utf8(m)), "PBKDF2", false, [
    "deriveBits",
  ]);
  const salt = new Uint8Array(utf8(`mnemonic${passphrase}`.normalize("NFKD")));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-512", salt, iterations: 2048 },
    key,
    512,
  );
  return new Uint8Array(bits);
}

/** Entropy strength in bits for a word count (128 for 12 words … 256 for 24). */
export function entropyBits(words: number): number {
  return (words * 11 * 32) / 33;
}
