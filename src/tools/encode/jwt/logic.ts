/** JSON Web Tokens: decode the three parts, read the time claims, verify an HMAC signature. */
import type { L10n, Lang } from "../../../i18n";
import { fail, fromBase64, fromUtf8, utf8 } from "../_shared";

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: unknown;
  /** The payload as text when it is not JSON (a JWS can sign anything). */
  payloadText: string;
  signature: string;
  /** `header.payload`, the bytes the signature covers. */
  signingInput: string;
  alg: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function part(segment: string, en: string, fr: string, de: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(segment))
    fail(
      `The ${en} is not Base64URL.`,
      `${fr} n'est pas du Base64URL.`,
      `${de} ist kein Base64URL.`,
    );
  return fromBase64(segment);
}

/** Splits and decodes a compact JWS (`xxx.yyy.zzz`). Tolerates a `Bearer ` prefix and spaces. */
export function decodeJwt(token: string): DecodedJwt {
  const t = token
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/\s/g, "");
  const parts = t.split(".");
  if (parts.length === 5)
    fail(
      "This is an encrypted token (JWE): its content cannot be read without the key.",
      "C'est un jeton chiffré (JWE) : son contenu ne se lit pas sans la clé.",
      "Das ist ein verschlüsseltes Token (JWE): Sein Inhalt ist ohne den Schlüssel nicht lesbar.",
    );
  if (parts.length !== 3)
    fail(
      "A JWT has three parts separated by dots: header.payload.signature.",
      "Un JWT a trois parties séparées par des points : en-tête.contenu.signature.",
      "Ein JWT hat drei durch Punkte getrennte Teile: header.payload.signature.",
    );
  const [h, p, s] = parts as [string, string, string];
  let header: unknown;
  try {
    header = JSON.parse(fromUtf8(part(h, "header", "L'en-tête", "Der Header"), true));
  } catch {
    fail(
      "The header is not valid JSON.",
      "L'en-tête n'est pas du JSON valide.",
      "Der Header ist kein gültiges JSON.",
    );
  }
  if (!isObject(header))
    fail(
      "The header must be a JSON object.",
      "L'en-tête doit être un objet JSON.",
      "Der Header muss ein JSON-Objekt sein.",
    );
  const payloadText = fromUtf8(part(p, "payload", "Le contenu", "Die Payload"));
  let payload: unknown = null;
  try {
    payload = JSON.parse(payloadText);
  } catch {}
  if (!/^[A-Za-z0-9_-]*$/.test(s))
    fail(
      "The signature is not Base64URL.",
      "La signature n'est pas du Base64URL.",
      "Die Signatur ist kein Base64URL.",
    );
  return {
    header,
    payload,
    payloadText,
    signature: s,
    signingInput: `${h}.${p}`,
    alg: typeof header.alg === "string" ? header.alg : "",
  };
}

export type TimeClaim = "iat" | "nbf" | "exp" | "auth_time";

export interface ClaimDate {
  claim: TimeClaim;
  seconds: number;
  date: Date;
}

/** The numeric date claims of a payload, in a stable order. */
export function timeClaims(payload: unknown): ClaimDate[] {
  if (!isObject(payload)) return [];
  const out: ClaimDate[] = [];
  for (const claim of ["iat", "nbf", "exp", "auth_time"] as const) {
    const v = payload[claim];
    if (typeof v === "number" && Number.isFinite(v))
      out.push({ claim, seconds: v, date: new Date(v * 1000) });
  }
  return out;
}

export type Validity =
  | { state: "none" }
  | { state: "expired"; since: number }
  | { state: "early"; in: number }
  | { state: "valid"; left: number | null };

/** Whether the token is usable at `now` (seconds), from `nbf` and `exp`. */
export function validity(payload: unknown, now: number): Validity {
  if (!isObject(payload)) return { state: "none" };
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;
  if (exp === null && nbf === null) return { state: "none" };
  if (exp !== null && now >= exp) return { state: "expired", since: now - exp };
  if (nbf !== null && now < nbf) return { state: "early", in: nbf - now };
  return { state: "valid", left: exp === null ? null : exp - now };
}

/** Abbreviation of "day" per language (the other units are the same everywhere). */
const DAY: Record<Lang, string> = { en: "d", fr: "j", de: "T" };

/** "2 d 3 h", "5 min 10 s", "3 s" ("j" in French, "T" in German for days). Two largest units at most. */
export function humanDuration(seconds: number, lang: Lang = "en"): string {
  let s = Math.max(0, Math.round(seconds));
  const units: [number, string][] = [
    [86400, DAY[lang]],
    [3600, "h"],
    [60, "min"],
    [1, "s"],
  ];
  const out: string[] = [];
  for (const [size, name] of units) {
    if (s >= size || (size === 1 && out.length === 0)) {
      out.push(`${Math.floor(s / size)} ${name}`);
      s %= size;
    }
    if (out.length === 2) break;
  }
  return out.join(" ");
}

export type SecretEncoding = "text" | "base64";

const HMAC_HASH: Record<string, string> = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };

export function isHmacAlg(alg: string): boolean {
  return alg in HMAC_HASH;
}

/** Checks an HS256/384/512 signature with a shared secret (WebCrypto). */
export async function verifyHmac(
  jwt: DecodedJwt,
  secret: string,
  encoding: SecretEncoding = "text",
): Promise<boolean> {
  const hash = HMAC_HASH[jwt.alg];
  if (!hash)
    fail(
      `Only HS256, HS384 and HS512 can be checked with a secret (this token uses ${jwt.alg || "no algorithm"}).`,
      `Seuls HS256, HS384 et HS512 se vérifient avec un secret (ce jeton utilise ${jwt.alg || "aucun algorithme"}).`,
      `Nur HS256, HS384 und HS512 lassen sich mit einem Secret prüfen (dieses Token nutzt ${jwt.alg || "keinen Algorithmus"}).`,
    );
  const key = encoding === "base64" ? fromBase64(secret) : utf8(secret);
  if (!key.length) fail("Enter the secret.", "Saisis le secret.", "Gib das Secret ein.");
  // WebCrypto wants buffers backed by a plain ArrayBuffer: copy into one.
  const k = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "HMAC", hash },
    false,
    ["verify"],
  );
  const sig = new Uint8Array(fromBase64(jwt.signature));
  return crypto.subtle.verify("HMAC", k, sig, new Uint8Array(utf8(jwt.signingInput)));
}

/** Names of the registered claims, to label them in the payload. */
export const CLAIM_NAMES: Record<string, L10n> = {
  iss: { en: "Issuer", fr: "Émetteur", de: "Aussteller" },
  sub: { en: "Subject", fr: "Sujet", de: "Subjekt" },
  aud: { en: "Audience", fr: "Audience", de: "Empfänger" },
  exp: { en: "Expires", fr: "Expire", de: "Läuft ab" },
  nbf: { en: "Not before", fr: "Pas avant", de: "Nicht vor" },
  iat: { en: "Issued at", fr: "Émis le", de: "Ausgestellt am" },
  jti: { en: "Token ID", fr: "ID du jeton", de: "Token-ID" },
  auth_time: { en: "Authenticated at", fr: "Authentifié le", de: "Authentifiziert am" },
};

/** What a JWS `alg` stands for (an empty string when unknown). */
export function algName(alg: string): string {
  const m = /^(HS|RS|PS|ES)(256|384|512)$/.exec(alg);
  if (m) {
    const family = {
      HS: "HMAC",
      RS: "RSASSA-PKCS1-v1_5",
      PS: "RSASSA-PSS",
      ES: `ECDSA P-${m[2] === "512" ? "521" : m[2]}`,
    }[m[1] as "HS" | "RS" | "PS" | "ES"];
    return `${family} + SHA-${m[2]}`;
  }
  if (alg === "EdDSA" || alg === "Ed25519") return "EdDSA (Ed25519)";
  if (alg === "ES256K") return "ECDSA secp256k1 + SHA-256";
  return "";
}
