/**
 * TOTP (RFC 6238) on top of HOTP (RFC 4226) with WebCrypto's HMAC, Base32 secrets (RFC 4648),
 * and otpauth:// links as read and written by authenticator apps.
 */
import { fail, randomBytes } from "../_shared";

export type Algorithm = "SHA1" | "SHA256" | "SHA512";
export const ALGORITHMS: Algorithm[] = ["SHA1", "SHA256", "SHA512"];

export interface TotpParams {
  algorithm: Algorithm;
  digits: number;
  period: number;
}

export const DEFAULTS: TotpParams = { algorithm: "SHA1", digits: 6, period: 30 };

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Base32 to bytes. Case-insensitive; ignores spaces, dashes and `=` padding. */
export function base32Decode(text: string): Uint8Array<ArrayBuffer> {
  const s = text.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (!s) fail("The secret is empty.", "Le secret est vide.");
  const bad = [...s].find((c) => !B32.includes(c));
  if (bad)
    fail(
      `"${bad}" is not a Base32 character (A–Z, 2–7).`,
      `« ${bad} » n'est pas un caractère Base32 (A–Z, 2–7).`,
    );
  const out = new Uint8Array(Math.floor((s.length * 5) / 8));
  let bits = 0;
  let value = 0;
  let i = 0;
  for (const c of s) {
    value = ((value << 5) | B32.indexOf(c)) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out[i++] = (value >> bits) & 0xff;
    }
  }
  return out;
}

/** Bytes to Base32, without padding (how authenticator apps show secrets). */
export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = ((value << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32[(value >> bits) & 31];
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** A new random secret: 20 bytes (160 bits, the RFC 4226 recommendation) in Base32. */
export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** HOTP: HMAC of the 8-byte big-endian counter, dynamically truncated to `digits` digits. */
export async function hotp(
  key: Uint8Array,
  counter: number,
  digits = 6,
  algorithm: Algorithm = "SHA1",
): Promise<string> {
  const msg = new Uint8Array(8);
  const view = new DataView(msg.buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter % 2 ** 32);
  const hash = { SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" }[algorithm];
  const k = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
  const offset = (mac[mac.length - 1] as number) & 0x0f;
  const bin =
    (((mac[offset] as number) & 0x7f) << 24) |
    ((mac[offset + 1] as number) << 16) |
    ((mac[offset + 2] as number) << 8) |
    (mac[offset + 3] as number);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** The time step for a Unix time in seconds. */
export function counterAt(unixSeconds: number, period = 30): number {
  return Math.floor(unixSeconds / period);
}

/** Seconds left before the code changes. */
export function secondsLeft(unixSeconds: number, period = 30): number {
  return period - (Math.floor(unixSeconds) % period);
}

export function totp(key: Uint8Array, unixSeconds: number, p: TotpParams = DEFAULTS) {
  return hotp(key, counterAt(unixSeconds, p.period), p.digits, p.algorithm);
}

/* --- otpauth:// links ---------------------------------------------------------- */

export interface OtpAuth extends TotpParams {
  secret: string;
  issuer: string;
  account: string;
}

function checkParams(p: TotpParams): void {
  if (p.digits < 6 || p.digits > 10)
    fail("Codes have 6 to 10 digits.", "Les codes ont de 6 à 10 chiffres.");
  if (!Number.isInteger(p.period) || p.period < 1 || p.period > 3600)
    fail("The period must be 1 to 3600 seconds.", "La période doit être de 1 à 3600 secondes.");
}

/** Reads `otpauth://totp/Issuer:account?secret=…&issuer=…&algorithm=…&digits=…&period=…`. */
export function parseOtpauth(uri: string): OtpAuth {
  let url: URL;
  try {
    url = new URL(uri.trim());
  } catch {
    fail("This otpauth link is not a valid URL.", "Ce lien otpauth n'est pas une URL valide.");
  }
  if (url.protocol !== "otpauth:")
    fail("The link must start with otpauth://.", "Le lien doit commencer par otpauth://.");
  const type = (
    url.hostname ||
    url.pathname.replace(/^\/\//, "").split("/")[0] ||
    ""
  ).toLowerCase();
  if (type === "hotp")
    fail(
      "HOTP (counter-based) links are not supported, only TOTP.",
      "Les liens HOTP (à compteur) ne sont pas gérés, seulement TOTP.",
    );
  if (type !== "totp") fail("Unknown OTP type: expected totp.", "Type OTP inconnu : totp attendu.");
  const q = url.searchParams;
  const secret = (q.get("secret") ?? "").replace(/\s/g, "").toUpperCase();
  if (!secret) fail("The link has no secret= parameter.", "Le lien n'a pas de paramètre secret=.");
  base32Decode(secret);
  const rawLabel = url.hostname ? url.pathname.slice(1) : url.pathname.replace(/^\/\/[^/]*\/?/, "");
  let label = rawLabel;
  try {
    label = decodeURIComponent(rawLabel);
  } catch {}
  const colon = label.indexOf(":");
  const labelIssuer = colon >= 0 ? label.slice(0, colon).trim() : "";
  const account = (colon >= 0 ? label.slice(colon + 1) : label).trim();
  const algo = (q.get("algorithm") ?? "SHA1").toUpperCase().replace("-", "") as Algorithm;
  if (!ALGORITHMS.includes(algo))
    fail(`Unsupported algorithm: ${algo}.`, `Algorithme non géré : ${algo}.`);
  const params: TotpParams = {
    algorithm: algo,
    digits: Number(q.get("digits") ?? 6),
    period: Number(q.get("period") ?? 30),
  };
  checkParams(params);
  return { ...params, secret, issuer: q.get("issuer") ?? labelIssuer, account };
}

/** Writes an otpauth:// link (issuer both in the label and as a parameter, as apps expect). */
export function buildOtpauth(o: OtpAuth): string {
  const label = o.issuer
    ? `${encodeURIComponent(o.issuer)}:${encodeURIComponent(o.account)}`
    : encodeURIComponent(o.account);
  const q = new URLSearchParams({ secret: o.secret });
  if (o.issuer) q.set("issuer", o.issuer);
  if (o.algorithm !== "SHA1") q.set("algorithm", o.algorithm);
  if (o.digits !== 6) q.set("digits", String(o.digits));
  if (o.period !== 30) q.set("period", String(o.period));
  return `otpauth://totp/${label}?${q.toString().replace(/\+/g, "%20")}`;
}

export interface Source {
  key: Uint8Array<ArrayBuffer>;
  params: TotpParams;
  /** Set when the input was an otpauth link. */
  link: OtpAuth | null;
}

/**
 * The key and parameters from what the user pasted: an otpauth:// link (its own parameters
 * win) or a bare Base32 secret (uses `fallback`). Null when empty; throws when invalid.
 */
export function readSource(input: string, fallback: TotpParams): Source | null {
  const t = input.trim();
  if (!t) return null;
  if (/^otpauth:/i.test(t)) {
    const link = parseOtpauth(t);
    return { key: base32Decode(link.secret), params: link, link };
  }
  checkParams(fallback);
  return { key: base32Decode(t), params: fallback, link: null };
}
