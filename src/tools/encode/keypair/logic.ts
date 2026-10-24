/**
 * Key pairs with WebCrypto: RSA-OAEP / RSA-PSS, ECDSA and Ed25519, exported as PEM (SPKI for the
 * public key, PKCS #8 for the private key) and JWK, with a SHA-256 fingerprint of the SPKI.
 */
import { fail, toBase64, toHex } from "../_shared";

export type Algo = "RSA-OAEP" | "RSA-PSS" | "ECDSA" | "Ed25519";
export type RsaBits = "2048" | "3072" | "4096";
export type Curve = "P-256" | "P-384" | "P-521";

export interface KeySpec {
  algo: Algo;
  bits: RsaBits;
  curve: Curve;
}

export interface KeyPairOut {
  publicPem: string;
  privatePem: string;
  publicJwk: string;
  privateJwk: string;
  /** SHA-256 of the SPKI bytes, as colon-separated hex. */
  fingerprint: string;
  /** SHA-256 of the SPKI bytes, as unpadded Base64. */
  fingerprintB64: string;
  label: string;
}

/** Wraps DER bytes in PEM armor, 64 characters per line. */
export function toPem(der: Uint8Array, label: string): string {
  const b64 = toBase64(der);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** The DER bytes inside a PEM block (the first one found). */
export function fromPem(pem: string): { label: string; der: Uint8Array<ArrayBuffer> } {
  const m = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(pem);
  if (!m) fail("No PEM block found.", "Aucun bloc PEM trouvé.", "Kein PEM-Block gefunden.");
  const body = (m[2] ?? "").replace(/\s/g, "");
  const bin = atob(body);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return { label: m[1] ?? "", der };
}

/** WebCrypto parameters and key usages of a spec. */
export function keyParams(spec: KeySpec): {
  params: RsaHashedKeyGenParams | EcKeyGenParams | Algorithm;
  usages: KeyUsage[];
  label: string;
} {
  switch (spec.algo) {
    case "RSA-OAEP":
    case "RSA-PSS":
      return {
        params: {
          name: spec.algo,
          modulusLength: Number(spec.bits),
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        usages: spec.algo === "RSA-OAEP" ? ["encrypt", "decrypt"] : ["sign", "verify"],
        label: `${spec.algo} ${spec.bits} · SHA-256`,
      };
    case "ECDSA":
      return {
        params: { name: "ECDSA", namedCurve: spec.curve },
        usages: ["sign", "verify"],
        label: `ECDSA ${spec.curve}`,
      };
    case "Ed25519":
      return { params: { name: "Ed25519" }, usages: ["sign", "verify"], label: "Ed25519" };
  }
}

/** Generates a key pair and exports it every way the tool shows. */
export async function generateKeyPair(spec: KeySpec): Promise<KeyPairOut> {
  const { params, usages, label } = keyParams(spec);
  let pair: CryptoKeyPair;
  try {
    pair = (await crypto.subtle.generateKey(params, true, usages)) as CryptoKeyPair;
  } catch {
    fail(
      `This browser cannot generate ${label} keys.`,
      `Ce navigateur ne sait pas générer de clés ${label}.`,
      `Dieser Browser kann keine ${label}-Schlüssel erzeugen.`,
    );
  }
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pubJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", spki));
  return {
    publicPem: toPem(spki, "PUBLIC KEY"),
    privatePem: toPem(pkcs8, "PRIVATE KEY"),
    publicJwk: JSON.stringify(pubJwk, null, 2),
    privateJwk: JSON.stringify(privJwk, null, 2),
    fingerprint: formatFingerprint(digest),
    fingerprintB64: toBase64(digest).replace(/=+$/, ""),
    label,
  };
}

/** "ab:cd:ef:…" */
export function formatFingerprint(digest: Uint8Array): string {
  return (toHex(digest).match(/../g) ?? []).join(":");
}

/** A file name stem for downloads: "rsa-pss-3072", "ecdsa-p-256", "ed25519". */
export function fileStem(spec: KeySpec): string {
  const tail =
    spec.algo === "ECDSA" ? `-${spec.curve}` : spec.algo.startsWith("RSA") ? `-${spec.bits}` : "";
  return `${spec.algo}${tail}`.toLowerCase();
}
