/** HMAC (RFC 2104) with WebCrypto: keys and messages as text, hex or Base64. */
import { fail, fromBase64, fromHex, toBase64, toHex, utf8 } from "../_shared";

export const HMAC_ALGOS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type HmacAlgo = (typeof HMAC_ALGOS)[number];

export type InputEncoding = "text" | "hex" | "base64";
export type OutputFormat = "hex" | "base64" | "base64url";

/** The bytes of a key or message typed in the given encoding (text is UTF-8). */
export function parseInput(value: string, encoding: InputEncoding): Uint8Array {
  if (encoding === "hex") return fromHex(value);
  if (encoding === "base64") return fromBase64(value);
  return utf8(value);
}

export async function hmac(
  algo: HmacAlgo,
  key: Uint8Array,
  message: Uint8Array,
): Promise<Uint8Array> {
  // WebCrypto refuses an empty HMAC key.
  if (!key.length) fail("Enter a key.", "Saisis une clé.");
  // Copies give WebCrypto buffers backed by a plain ArrayBuffer.
  const k = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "HMAC", hash: algo },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new Uint8Array(message)));
}

export function formatMac(mac: Uint8Array, format: OutputFormat, upper = false): string {
  if (format === "hex") return toHex(mac, upper);
  return toBase64(mac, format === "base64url");
}

/**
 * Whether a pasted signature equals the MAC, whatever its format: hex (any case), Base64 or
 * Base64URL, with an optional `sha256=` prefix as in GitHub / Stripe webhook headers.
 */
export function sameMac(expected: string, mac: Uint8Array): boolean {
  const s = expected.trim().replace(/^(?:sha\d+|v\d+)=/i, "");
  if (!s) return false;
  const candidates: (() => Uint8Array)[] = [() => fromHex(s), () => fromBase64(s)];
  for (const parse of candidates) {
    try {
      const b = parse();
      if (b.length === mac.length && b.every((x, i) => x === mac[i])) return true;
    } catch {}
  }
  return false;
}
