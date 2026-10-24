/**
 * Byte helpers shared by the encode tools: UTF-8, hex, Base64, sizes, secure randomness, and
 * errors that carry their message in every language. Pure: no DOM, no Preact.
 */
import { type L10n, l } from "../../i18n";

/** An error whose message the views can show in the current language. */
export class EncodeError extends Error {
  readonly text: L10n;
  constructor(text: L10n) {
    super(text.en);
    this.text = text;
  }
}

/** Throws an `EncodeError` (EN + FR + DE). */
export function fail(en: string, fr: string, de: string): never {
  throw new EncodeError(l(en, fr, de));
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: L10n };

/** Runs `fn` and turns a thrown error into `{ ok: false }` (never throws). */
export function attempt<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    return { ok: false, error: errorL10n(err) };
  }
}

/** The translated message of any thrown value (other errors keep their own text in all). */
export function errorL10n(err: unknown): L10n {
  if (err instanceof EncodeError) return err.text;
  const msg = err instanceof Error ? err.message : String(err);
  return { en: msg, fr: msg, de: msg };
}

/* --- UTF-8 ------------------------------------------------------------------ */

const encoder = new TextEncoder();

export function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

/** Decodes UTF-8; with `fatal`, invalid sequences throw instead of becoming U+FFFD. */
export function fromUtf8(bytes: Uint8Array, fatal = false): string {
  try {
    return new TextDecoder("utf-8", { fatal }).decode(bytes);
  } catch {
    fail(
      "The bytes are not valid UTF-8 text.",
      "Les octets ne sont pas du texte UTF-8 valide.",
      "Die Bytes sind kein gültiger UTF-8-Text.",
    );
  }
}

/** True when the bytes decode as UTF-8 without replacement characters. */
export function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Each byte as one char code 0–255 ("binary string"), what `btoa` and some libraries expect. */
export function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
}

/* --- Hex -------------------------------------------------------------------- */

const HEX = "0123456789abcdef";

export function toHex(bytes: Uint8Array, upper = false): string {
  let out = "";
  for (const b of bytes) out += HEX.charAt(b >> 4) + HEX.charAt(b & 15);
  return upper ? out.toUpperCase() : out;
}

/** Hex to bytes. Ignores whitespace, `:` / `-` separators and a leading `0x`. */
export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/^0x/i, "").replace(/[\s:-]/g, "");
  if (/[^0-9a-f]/i.test(clean))
    fail(
      "Hex may only contain 0–9 and a–f.",
      "L'hexadécimal ne contient que 0–9 et a–f.",
      "Hex darf nur 0–9 und a–f enthalten.",
    );
  if (clean.length % 2)
    fail(
      "Hex needs an even number of digits.",
      "L'hexadécimal demande un nombre pair de chiffres.",
      "Hex braucht eine gerade Anzahl von Ziffern.",
    );
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/* --- Base64 ----------------------------------------------------------------- */

/** Standard Base64 (RFC 4648 §4), or the URL-safe alphabet without padding (§5). */
export function toBase64(bytes: Uint8Array, urlSafe = false): string {
  const b64 = btoa(bytesToLatin1(bytes));
  return urlSafe ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}

/** Base64 to bytes. Accepts both alphabets, whitespace and missing padding. */
export function fromBase64(text: string): Uint8Array {
  let s = text.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s))
    fail(
      "Base64 may only contain A–Z, a–z, 0–9, + / (or - _) and = at the end.",
      "Le Base64 ne contient que A–Z, a–z, 0–9, + / (ou - _) et = à la fin.",
      "Base64 darf nur A–Z, a–z, 0–9, + / (oder - _) und = am Ende enthalten.",
    );
  s = s.replace(/=+$/, "");
  if (s.length % 4 === 1)
    fail(
      "Truncated Base64: the length does not match whole bytes.",
      "Base64 tronqué : la longueur ne correspond pas à des octets entiers.",
      "Abgeschnittenes Base64: Die Länge ergibt keine ganzen Bytes.",
    );
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* --- Sizes ------------------------------------------------------------------ */

/** "512 B", "1.4 KB", "3.2 MB" (powers of 1024), in the given locale. */
export function formatSize(bytes: number, locale = "en-US"): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(v);
  return `${n} ${units[i]}`;
}

/* --- Randomness --------------------------------------------------------------- */

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // getRandomValues fills at most 65,536 bytes per call.
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, i + 65536));
  return out;
}

/** A uniform integer in [0, max), by rejection sampling (no modulo bias). */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RangeError("max");
  const limit = 2 ** 32 - (2 ** 32 % max);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const x = buf[0] as number;
    if (x < limit) return x % max;
  }
}

/** `n` characters drawn uniformly from `alphabet` (by code point). */
export function randomString(n: number, alphabet: string): string {
  const chars = [...alphabet];
  let out = "";
  for (let i = 0; i < n; i++) out += chars[randomInt(chars.length)];
  return out;
}
