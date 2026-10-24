/**
 * X.509 certificate (RFC 5280) and PKCS#10 certificate request (RFC 2986) decoder, on top of
 * the small DER reader in ./asn1. Pure: no DOM, no Preact.
 */
import { type L10n, l } from "../../../i18n";
import { attempt, fail, fromBase64, type Result, toHex } from "../_shared";
import {
  bitLength,
  bitString,
  CURVES,
  child,
  expectTag,
  intBytes,
  isContext,
  isUniversal,
  NAME_ATTRS,
  type Node,
  oidName,
  parseDer,
  readOid,
  readSmallInt,
  readString,
  readTime,
  TAG,
} from "./asn1";

export interface NameAttr {
  oid: string;
  /** "CN", "O", … (the OID itself when unknown). */
  short: string;
  value: string;
}

export interface GeneralName {
  type: "DNS" | "IP" | "email" | "URI" | "DirName" | "RID" | "other";
  value: string;
}

export interface PublicKeyInfo {
  /** "RSA", "EC", "Ed25519", … */
  algorithm: string;
  /** Key size in bits (RSA modulus, curve size), when known. */
  bits: number | null;
  curve: string | null;
  /** RSA public exponent. */
  exponent: number | null;
}

export interface Extension {
  oid: string;
  name: L10n | null;
  critical: boolean;
}

export interface Decoded {
  kind: "certificate" | "csr";
  /** 1, 2 or 3 for certificates; 1 for requests. */
  version: number;
  serialHex: string | null;
  serialDec: string | null;
  subject: NameAttr[];
  issuer: NameAttr[] | null;
  notBefore: Date | null;
  notAfter: Date | null;
  publicKey: PublicKeyInfo;
  signatureAlgorithm: string;
  san: GeneralName[];
  /** Key usage flag ids (see KEY_USAGES), or null when the extension is absent. */
  keyUsage: string[] | null;
  extKeyUsage: { oid: string; name: L10n | null }[] | null;
  basicConstraints: { ca: boolean; pathLen: number | null } | null;
  subjectKeyId: string | null;
  authorityKeyId: string | null;
  ocsp: string[];
  caIssuers: string[];
  crl: string[];
  policies: string[];
  extensions: Extension[];
  /** True when issuer and subject are the same name (a root or self-signed certificate). */
  selfSigned: boolean;
  /** The exact DER of the certificate or request (what fingerprints are computed on). */
  der: Uint8Array;
}

/* --- Names of things ----------------------------------------------------------------------- */

export const KEY_USAGES: { id: string; name: L10n }[] = [
  { id: "digitalSignature", name: l("Digital signature", "Signature numérique") },
  { id: "nonRepudiation", name: l("Non-repudiation", "Non-répudiation") },
  { id: "keyEncipherment", name: l("Key encipherment", "Chiffrement de clé") },
  { id: "dataEncipherment", name: l("Data encipherment", "Chiffrement de données") },
  { id: "keyAgreement", name: l("Key agreement", "Accord de clé") },
  { id: "keyCertSign", name: l("Certificate signing", "Signature de certificats") },
  { id: "cRLSign", name: l("CRL signing", "Signature de CRL") },
  { id: "encipherOnly", name: l("Encipher only", "Chiffrement seul") },
  { id: "decipherOnly", name: l("Decipher only", "Déchiffrement seul") },
];

export const EKUS: Record<string, L10n> = {
  "1.3.6.1.5.5.7.3.1": l("TLS server authentication", "Authentification de serveur TLS"),
  "1.3.6.1.5.5.7.3.2": l("TLS client authentication", "Authentification de client TLS"),
  "1.3.6.1.5.5.7.3.3": l("Code signing", "Signature de code"),
  "1.3.6.1.5.5.7.3.4": l("Email protection (S/MIME)", "Protection des e-mails (S/MIME)"),
  "1.3.6.1.5.5.7.3.5": l("IPsec end system", "Système d'extrémité IPsec"),
  "1.3.6.1.5.5.7.3.6": l("IPsec tunnel", "Tunnel IPsec"),
  "1.3.6.1.5.5.7.3.7": l("IPsec user", "Utilisateur IPsec"),
  "1.3.6.1.5.5.7.3.8": l("Time stamping", "Horodatage"),
  "1.3.6.1.5.5.7.3.9": l("OCSP signing", "Signature OCSP"),
  "1.3.6.1.5.5.7.3.17": l("IPsec IKE", "IPsec IKE"),
  "2.5.29.37.0": l("Any extended key usage", "Toute utilisation étendue"),
  "1.3.6.1.4.1.311.10.3.12": l("Microsoft document signing", "Signature de documents Microsoft"),
  "1.3.6.1.4.1.311.20.2.2": l("Smart card logon", "Connexion par carte à puce"),
  "1.3.6.1.5.2.3.5": l("Kerberos KDC", "KDC Kerberos"),
};

export const EXTENSIONS: Record<string, L10n> = {
  "2.5.29.9": l("Subject directory attributes", "Attributs d'annuaire du sujet"),
  "2.5.29.14": l("Subject key identifier", "Identifiant de clé du sujet"),
  "2.5.29.15": l("Key usage", "Utilisation de la clé"),
  "2.5.29.17": l("Subject alternative names", "Noms alternatifs du sujet"),
  "2.5.29.18": l("Issuer alternative names", "Noms alternatifs de l'émetteur"),
  "2.5.29.19": l("Basic constraints", "Contraintes de base"),
  "2.5.29.30": l("Name constraints", "Contraintes de nom"),
  "2.5.29.31": l("CRL distribution points", "Points de distribution des CRL"),
  "2.5.29.32": l("Certificate policies", "Politiques de certification"),
  "2.5.29.35": l("Authority key identifier", "Identifiant de clé de l'autorité"),
  "2.5.29.36": l("Policy constraints", "Contraintes de politique"),
  "2.5.29.37": l("Extended key usage", "Utilisation étendue de la clé"),
  "2.5.29.54": l("Inhibit any policy", "Interdiction de anyPolicy"),
  "1.3.6.1.5.5.7.1.1": l("Authority information access", "Accès aux informations de l'autorité"),
  "1.3.6.1.5.5.7.1.24": l("TLS feature (OCSP must-staple)", "Fonction TLS (OCSP must-staple)"),
  "1.3.6.1.4.1.11129.2.4.2": l(
    "Certificate Transparency timestamps (SCT)",
    "Horodatages Certificate Transparency (SCT)",
  ),
  "1.3.6.1.4.1.11129.2.4.3": l(
    "Certificate Transparency precertificate poison",
    "Marque de précertificat Certificate Transparency",
  ),
};

/* --- Pieces ---------------------------------------------------------------------------------- */

export function readName(n: Node): NameAttr[] {
  const out: NameAttr[] = [];
  for (const rdn of expectTag(n, TAG.SEQUENCE).children)
    for (const atv of expectTag(rdn, TAG.SET).children) {
      const oid = readOid(child(atv, 0));
      out.push({ oid, short: NAME_ATTRS[oid]?.[0] ?? oid, value: readString(child(atv, 1)) });
    }
  return out;
}

/** "C=FR, O=Example, CN=www.example.com", in the encoded order (like OpenSSL). */
export function formatName(attrs: NameAttr[]): string {
  return attrs.map((a) => `${a.short}=${a.value}`).join(", ");
}

/** The most telling part of a name: its CN, else O, else the whole name. */
export function shortName(attrs: NameAttr[]): string {
  const pick = (s: string) => attrs.filter((a) => a.short === s).at(-1)?.value;
  return pick("CN") ?? pick("O") ?? pick("OU") ?? (formatName(attrs) || "—");
}

function readAlgorithm(n: Node): { oid: string; params: Node | undefined } {
  const seq = expectTag(n, TAG.SEQUENCE);
  return { oid: readOid(child(seq, 0)), params: seq.children[1] };
}

/** Signature algorithm name; RSASSA-PSS shows its hash, e.g. "RSASSA-PSS (SHA-256)". */
export function signatureName(n: Node): string {
  const { oid, params } = readAlgorithm(n);
  const name = oidName(oid);
  if (oid !== "1.2.840.113549.1.1.10") return name;
  let hash = "SHA-1";
  const h = params?.children.find((c) => isContext(c, 0));
  if (h?.children[0]) hash = oidName(readAlgorithm(h.children[0]).oid);
  return `${name} (${hash})`;
}

const FIXED_BITS: Record<string, number> = { Ed25519: 256, Ed448: 456, X25519: 256, X448: 448 };

export function readPublicKey(spki: Node): PublicKeyInfo {
  const seq = expectTag(spki, TAG.SEQUENCE);
  const { oid, params } = readAlgorithm(child(seq, 0));
  const key = bitString(child(seq, 1)).bytes;
  const algorithm = oidName(oid);
  if (oid === "1.2.840.113549.1.1.1" || oid === "1.2.840.113549.1.1.10") {
    const rsa = parseDer(key);
    const modulus = intBytes(child(rsa, 0));
    const e = intBytes(child(rsa, 1));
    const exponent = e.length <= 6 ? e.reduce((v, b) => v * 256 + b, 0) : null;
    return { algorithm: "RSA", bits: bitLength(modulus), curve: null, exponent };
  }
  if (oid === "1.2.840.10045.2.1") {
    if (isUniversal(params, TAG.OID)) {
      const c = readOid(params);
      const known = CURVES[c];
      return { algorithm: "EC", bits: known?.[1] ?? null, curve: known?.[0] ?? c, exponent: null };
    }
    // Explicit curve parameters: the size is that of the uncompressed point's coordinates.
    const bits = key[0] === 4 ? ((key.length - 1) / 2) * 8 : null;
    return { algorithm: "EC", bits, curve: "explicit", exponent: null };
  }
  if (oid === "1.2.840.10040.4.1" && isUniversal(params, TAG.SEQUENCE))
    return {
      algorithm: "DSA",
      bits: bitLength(intBytes(child(params, 0))),
      curve: null,
      exponent: null,
    };
  return { algorithm, bits: FIXED_BITS[algorithm] ?? null, curve: null, exponent: null };
}

function formatIp(b: Uint8Array): string {
  if (b.length === 4) return Array.from(b).join(".");
  if (b.length === 16) {
    const groups: number[] = [];
    for (let i = 0; i < 16; i += 2) groups.push(((b[i] as number) << 8) | (b[i + 1] as number));
    // Compress the longest run of two or more zero groups (RFC 5952).
    let best = -1;
    let bestLen = 1;
    for (let i = 0; i < 8; ) {
      if (groups[i] !== 0) {
        i++;
        continue;
      }
      let j = i;
      while (j < 8 && groups[j] === 0) j++;
      if (j - i > bestLen) {
        best = i;
        bestLen = j - i;
      }
      i = j;
    }
    const hex = groups.map((g) => g.toString(16));
    if (best < 0) return hex.join(":");
    return `${hex.slice(0, best).join(":")}::${hex.slice(best + bestLen).join(":")}`;
  }
  return toHex(b);
}

export function readGeneralNames(n: Node): GeneralName[] {
  const out: GeneralName[] = [];
  for (const g of expectTag(n, TAG.SEQUENCE).children) {
    if (g.cls !== 2) continue;
    const text = () => readString({ ...g, cls: 0, tag: TAG.IA5 });
    switch (g.tag) {
      case 1:
        out.push({ type: "email", value: text() });
        break;
      case 2:
        out.push({ type: "DNS", value: text() });
        break;
      case 6:
        out.push({ type: "URI", value: text() });
        break;
      case 7:
        out.push({ type: "IP", value: formatIp(g.content) });
        break;
      case 4:
        if (g.children[0])
          out.push({ type: "DirName", value: formatName(readName(g.children[0])) });
        break;
      case 8:
        out.push({ type: "RID", value: oidName(readOid({ ...g, cls: 0, tag: TAG.OID })) });
        break;
      case 0: {
        const oid = g.children[0] ? readOid(g.children[0]) : "";
        // UPN (Microsoft): [0] { UTF8String }.
        const v = g.children[1]?.children[0];
        out.push({ type: "other", value: v ? `${oidName(oid)}: ${readString(v)}` : oidName(oid) });
        break;
      }
    }
  }
  return out;
}

/** Every URI found anywhere below a node ([6] uniformResourceIdentifier). */
function uris(n: Node, out: string[] = []): string[] {
  if (n.cls === 2 && n.tag === 6 && !n.constructed)
    out.push(readString({ ...n, cls: 0, tag: TAG.IA5 }));
  for (const c of n.children) uris(c, out);
  return out;
}

interface ExtData {
  san: GeneralName[];
  keyUsage: string[] | null;
  extKeyUsage: { oid: string; name: L10n | null }[] | null;
  basicConstraints: { ca: boolean; pathLen: number | null } | null;
  subjectKeyId: string | null;
  authorityKeyId: string | null;
  ocsp: string[];
  caIssuers: string[];
  crl: string[];
  policies: string[];
  extensions: Extension[];
}

const colonHex = (b: Uint8Array) => (toHex(b, true).match(/../g) ?? []).join(":");

export function readExtensions(list: Node | undefined): ExtData {
  const d: ExtData = {
    san: [],
    keyUsage: null,
    extKeyUsage: null,
    basicConstraints: null,
    subjectKeyId: null,
    authorityKeyId: null,
    ocsp: [],
    caIssuers: [],
    crl: [],
    policies: [],
    extensions: [],
  };
  if (!list) return d;
  for (const ext of expectTag(list, TAG.SEQUENCE).children) {
    const oid = readOid(child(ext, 0));
    const critical = isUniversal(ext.children[1], TAG.BOOLEAN)
      ? (ext.children[1].content[0] ?? 0) !== 0
      : false;
    const value = expectTag(ext.children.at(-1), TAG.OCTET_STRING).content;
    d.extensions.push({ oid, name: EXTENSIONS[oid] ?? null, critical });
    // A malformed extension is listed but does not hide the rest of the certificate.
    attempt(() => {
      const v = parseDer(value);
      switch (oid) {
        case "2.5.29.17":
          d.san = readGeneralNames(v);
          break;
        case "2.5.29.15": {
          const { bytes } = bitString(v);
          d.keyUsage = KEY_USAGES.filter((_, i) => ((bytes[i >> 3] ?? 0) >> (7 - (i & 7))) & 1).map(
            (k) => k.id,
          );
          break;
        }
        case "2.5.29.37":
          d.extKeyUsage = v.children.map((c) => {
            const o = readOid(c);
            return { oid: o, name: EKUS[o] ?? null };
          });
          break;
        case "2.5.29.19": {
          const ca =
            isUniversal(v.children[0], TAG.BOOLEAN) && (v.children[0].content[0] ?? 0) !== 0;
          const last = v.children.at(-1);
          d.basicConstraints = {
            ca,
            pathLen: isUniversal(last, TAG.INTEGER) ? readSmallInt(last) : null,
          };
          break;
        }
        case "2.5.29.14":
          d.subjectKeyId = colonHex(expectTag(v, TAG.OCTET_STRING).content);
          break;
        case "2.5.29.35": {
          const k = v.children.find((c) => isContext(c, 0));
          if (k) d.authorityKeyId = colonHex(k.content);
          break;
        }
        case "1.3.6.1.5.5.7.1.1":
          for (const ad of v.children) {
            const method = readOid(child(ad, 0));
            const found = uris(child(ad, 1));
            if (method === "1.3.6.1.5.5.7.48.1") d.ocsp.push(...found);
            else if (method === "1.3.6.1.5.5.7.48.2") d.caIssuers.push(...found);
          }
          break;
        case "2.5.29.31":
          d.crl = uris(v);
          break;
        case "2.5.29.32":
          d.policies = v.children.map((p) => {
            const o = readOid(child(p, 0));
            const n = oidName(o);
            return n === o ? o : `${n} (${o})`;
          });
          break;
      }
    });
  }
  return d;
}

function serial(n: Node): { hex: string; dec: string } {
  const b = intBytes(n);
  const hex = colonHex(b);
  let dec = "";
  try {
    dec = BigInt(`0x${toHex(b) || "0"}`).toString();
  } catch {}
  return { hex, dec };
}

function sameName(a: NameAttr[], b: NameAttr[]): boolean {
  return formatName(a) === formatName(b);
}

/* --- Whole structures ------------------------------------------------------------------------ */

function decodeCertificate(root: Node, der: Uint8Array): Decoded {
  const tbs = expectTag(child(root, 0), TAG.SEQUENCE);
  let i = 0;
  let version = 1;
  if (isContext(tbs.children[0], 0)) {
    version = readSmallInt(child(tbs.children[0], 0)) + 1;
    i = 1;
  }
  const sn = serial(child(tbs, i));
  const issuer = readName(child(tbs, i + 2));
  const validity = expectTag(child(tbs, i + 3), TAG.SEQUENCE);
  const subject = readName(child(tbs, i + 4));
  const publicKey = readPublicKey(child(tbs, i + 5));
  const extWrap = tbs.children.slice(i + 6).find((c) => isContext(c, 3));
  const ext = readExtensions(extWrap?.children[0]);
  return {
    kind: "certificate",
    version,
    serialHex: sn.hex,
    serialDec: sn.dec,
    subject,
    issuer,
    notBefore: readTime(child(validity, 0)),
    notAfter: readTime(child(validity, 1)),
    publicKey,
    signatureAlgorithm: signatureName(child(root, 1)),
    ...ext,
    selfSigned: sameName(issuer, subject),
    der,
  };
}

function decodeRequest(root: Node, der: Uint8Array): Decoded {
  const info = expectTag(child(root, 0), TAG.SEQUENCE);
  const version = readSmallInt(child(info, 0)) + 1;
  const subject = readName(child(info, 1));
  const publicKey = readPublicKey(child(info, 2));
  let extList: Node | undefined;
  const attrs = info.children.find((c) => isContext(c, 0));
  for (const a of attrs?.children ?? []) {
    const oid = readOid(child(a, 0));
    if (oid === "1.2.840.113549.1.9.14") extList = a.children[1]?.children[0];
  }
  return {
    kind: "csr",
    version,
    serialHex: null,
    serialDec: null,
    subject,
    issuer: null,
    notBefore: null,
    notAfter: null,
    publicKey,
    signatureAlgorithm: signatureName(child(root, 1)),
    ...readExtensions(extList),
    selfSigned: false,
    der,
  };
}

/**
 * Decodes one DER certificate or request. `hint` comes from the PEM label; without it the
 * structure decides (a request's inner sequence has 4 elements and no validity).
 */
export function decodeDer(bytes: Uint8Array, hint?: "certificate" | "csr"): Decoded {
  const root = parseDer(bytes);
  if (!isUniversal(root, TAG.SEQUENCE) || root.children.length !== 3)
    fail(
      "This is DER, but not a certificate nor a certificate request.",
      "C'est du DER, mais ni un certificat ni une demande de certificat.",
    );
  const der = bytes.slice(0, root.length);
  const inner = root.children[0];
  const looksCsr =
    !!inner &&
    !isContext(inner.children[0], 0) &&
    inner.children.length === 4 &&
    isContext(inner.children[3], 0);
  const kind = hint ?? (looksCsr ? "csr" : "certificate");
  return kind === "csr" ? decodeRequest(root, der) : decodeCertificate(root, der);
}

/* --- Input ----------------------------------------------------------------------------------- */

export interface Entry {
  /** The PEM label, e.g. "CERTIFICATE", or "DER". */
  label: string;
  result: Result<Decoded>;
}

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;
const CERT_LABELS = ["CERTIFICATE", "X509 CERTIFICATE", "TRUSTED CERTIFICATE"];
const CSR_LABELS = ["CERTIFICATE REQUEST", "NEW CERTIFICATE REQUEST"];

/** Every certificate / request in a pasted text: PEM blocks (a chain), or bare Base64 DER. */
export function parseText(text: string): Entry[] {
  const entries: Entry[] = [];
  for (const m of text.matchAll(PEM_RE)) {
    const label = m[1] as string;
    const kind = CERT_LABELS.includes(label)
      ? "certificate"
      : CSR_LABELS.includes(label)
        ? "csr"
        : null;
    if (!kind) {
      entries.push({
        label,
        result: {
          ok: false,
          error: l(
            `A "${label}" block is not a certificate: it was skipped.`,
            `Un bloc « ${label} » n'est pas un certificat : il est ignoré.`,
          ),
        },
      });
      continue;
    }
    // Drop RFC 1421 headers ("Proc-Type: …") if any, keep the Base64.
    const body = (m[2] as string)
      .split(/\r?\n/)
      .filter((line) => !line.includes(":"))
      .join("");
    entries.push({ label, result: attempt(() => decodeDer(fromBase64(body), kind)) });
  }
  if (entries.length) return entries;
  const bare = text.replace(/\s/g, "");
  if (!bare) return [];
  if (/^[A-Za-z0-9+/=_-]+$/.test(bare) && bare.length > 40)
    return [{ label: "DER", result: attempt(() => decodeDer(fromBase64(bare))) }];
  return [
    {
      label: "",
      result: {
        ok: false,
        error: l(
          "No certificate found: paste a PEM block (-----BEGIN CERTIFICATE-----…) or open a .pem / .crt / .cer / .der file.",
          "Aucun certificat trouvé : colle un bloc PEM (-----BEGIN CERTIFICATE-----…) ou ouvre un fichier .pem / .crt / .cer / .der.",
        ),
      },
    },
  ];
}

/** A file's content: binary DER when it starts with a SEQUENCE, else PEM text. */
export function parseFile(bytes: Uint8Array): Entry[] {
  if (bytes[0] === 0x30) {
    const r = attempt(() => decodeDer(bytes));
    if (r.ok) return [{ label: "DER", result: r }];
  }
  return parseText(new TextDecoder().decode(bytes));
}

/** The DER as a PEM block. */
export function toPem(d: Decoded): string {
  const label = d.kind === "csr" ? "CERTIFICATE REQUEST" : "CERTIFICATE";
  let b64 = "";
  for (let i = 0; i < d.der.length; i += 0x6000)
    b64 += btoa(String.fromCharCode(...d.der.subarray(i, i + 0x6000)));
  return `-----BEGIN ${label}-----\n${(b64.match(/.{1,64}/g) ?? []).join("\n")}\n-----END ${label}-----\n`;
}

/* --- Derived facts --------------------------------------------------------------------------- */

export async function fingerprints(der: Uint8Array): Promise<{ sha1: string; sha256: string }> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-1", new Uint8Array(der)),
    crypto.subtle.digest("SHA-256", new Uint8Array(der)),
  ]);
  return { sha1: colonHex(new Uint8Array(a)), sha256: colonHex(new Uint8Array(b)) };
}

const DAY = 86_400_000;

export type Validity =
  | { state: "valid"; daysLeft: number }
  | { state: "expired"; daysAgo: number }
  | { state: "not-yet"; daysUntil: number };

/** Where `now` falls in the validity period, in whole days. */
export function validity(notBefore: Date, notAfter: Date, now: Date): Validity {
  const t = now.getTime();
  if (t > notAfter.getTime())
    return { state: "expired", daysAgo: Math.floor((t - notAfter.getTime()) / DAY) };
  if (t < notBefore.getTime())
    return { state: "not-yet", daysUntil: Math.ceil((notBefore.getTime() - t) / DAY) };
  return { state: "valid", daysLeft: Math.floor((notAfter.getTime() - t) / DAY) };
}

/** Total length of the validity period in days. */
export function lifetimeDays(notBefore: Date, notAfter: Date): number {
  return Math.round((notAfter.getTime() - notBefore.getTime()) / DAY);
}

/**
 * For each certificate, the index of the certificate in the same list that issued it (its
 * subject is this one's issuer), or null. A self-signed certificate points to itself.
 */
export function issuerLinks(list: (Decoded | null)[]): (number | null)[] {
  return list.map((d, i) => {
    if (!d?.issuer) return null;
    if (d.selfSigned) return i;
    const issuer = formatName(d.issuer);
    const j = list.findIndex(
      (o, k) => k !== i && o?.kind === "certificate" && formatName(o.subject) === issuer,
    );
    return j < 0 ? null : j;
  });
}

/** "RSA 2048 bits", "EC P-256", "Ed25519". */
export function keyLabel(k: PublicKeyInfo, bitsWord: string): string {
  if (k.algorithm === "EC")
    return `EC ${k.curve ?? ""}${k.bits ? ` (${k.bits} ${bitsWord})` : ""}`.trim();
  if (k.algorithm in FIXED_BITS) return k.algorithm;
  return k.bits ? `${k.algorithm} ${k.bits} ${bitsWord}` : k.algorithm;
}
