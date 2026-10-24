import { describe, expect, it } from "bun:test";
import { fromBase64, toHex } from "../_shared";
import { parseDer, readOid, readTime } from "./asn1";
import {
  type Decoded,
  decodeDer,
  fingerprints,
  formatName,
  issuerLinks,
  keyLabel,
  lifetimeDays,
  parseFile,
  parseText,
  shortName,
  toPem,
  validity,
} from "./logic";

/*
 * Fixtures generated with OpenSSL 4.0 for these tests:
 *   CA:   openssl req -x509 -newkey rsa:2048 -subj "/C=FR/O=Toolbelt Test/CN=Toolbelt Test Root CA"
 *         -not_before 20250101000000Z -not_after 20350101000000Z -set_serial 0x1234567890abcdef
 *         -addext "basicConstraints=critical,CA:TRUE,pathlen:1"
 *         -addext "keyUsage=critical,keyCertSign,cRLSign"
 *   LEAF: P-256 key, subject with a UTF-8 "Île-de-France", signed by CA, serial 4096,
 *         2025-06-01 → 2025-09-01, CA:FALSE, KU digitalSignature+keyAgreement,
 *         EKU serverAuth+clientAuth, SAN DNS/IP v4/IP v6/email/URI, SKI, AKI
 *   ED:   self-signed Ed25519, CN=ed25519.test, 2024 → 2044
 *   CSR:  P-384 request with a SAN and key usage extension request, signed with SHA-384
 */
const CA = `-----BEGIN CERTIFICATE-----
MIIDUTCCAjmgAwIBAgIIEjRWeJCrze8wDQYJKoZIhvcNAQELBQAwRTELMAkGA1UE
BhMCRlIxFjAUBgNVBAoMDVRvb2xiZWx0IFRlc3QxHjAcBgNVBAMMFVRvb2xiZWx0
IFRlc3QgUm9vdCBDQTAeFw0yNTAxMDEwMDAwMDBaFw0zNTAxMDEwMDAwMDBaMEUx
CzAJBgNVBAYTAkZSMRYwFAYDVQQKDA1Ub29sYmVsdCBUZXN0MR4wHAYDVQQDDBVU
b29sYmVsdCBUZXN0IFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
AoIBAQCV4Egg2ApLbCp7XDt7l/vMCZdBgpM+3Ryx2WVJHjwnixpPdi3Kkxyo/ZM7
s8nKvy31G9CBTKkpOwnw6h25l79EEtLqXaOrvyz/65Da/Dg6TYEjkV8dZ+reu6C6
XMPf/ujRCm153JaX0edNVY4Ef3FbZmWEb6OyhdoPgtJ6exb2+t+4I9zH1Lmc2pQP
HBPDb8W9W+KX9PcEchlHuGMvVF0ryz/DjgWkwMTR44jSsBAFH7XJeUDNc3bi3/Pw
yPXrB9+FzVr9TRmyCMfGEp+HlmkTxowNfjI9GpLEfM5lMIlHVhrA8PuQW5BOxLoj
vfrpsXx/xcDojyk9cddUN1pDeCurAgMBAAGjRTBDMB0GA1UdDgQWBBTKMby4gd2V
BL6PGhMq9Cv3hbIbRDASBgNVHRMBAf8ECDAGAQH/AgEBMA4GA1UdDwEB/wQEAwIB
BjANBgkqhkiG9w0BAQsFAAOCAQEAiEpgnJgeErCz3EdOWpHQx3EPVZU9Sid/oBhz
b/CHqsbCLiQus6hFDf1Xyns0+OeoHEKb8aLjBYtZbCz4kjEpaR/WwvVzi7QK62ve
UR5ISL0LRFwyW78kUu4ZDCG3qoDEJrrOU8UVRGnyuBreCjX03IK9Mp84H3kzlaGq
wfDVitdjncmYCa/Jr0V44MJIVZ/xP6diV/nDVB25Pb0qYrYUcY7RGEWqZoMQXryL
QxU8R/N3erFMjCOH5L1xcUH4pqWjIBd5lnU2Ng1von+2i8LAfZp3znu9FCUSXw76
QL6iAZ6ZzE1B4ZnXaYpIZjBURuPEoL+hCCDnCNvtCP6RwGWmVA==
-----END CERTIFICATE-----
`;

const LEAF = `-----BEGIN CERTIFICATE-----
MIIDlzCCAn+gAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwRTELMAkGA1UEBhMCRlIx
FjAUBgNVBAoMDVRvb2xiZWx0IFRlc3QxHjAcBgNVBAMMFVRvb2xiZWx0IFRlc3Qg
Um9vdCBDQTAeFw0yNTA2MDEwMDAwMDBaFw0yNTA5MDEwMDAwMDBaMIGaMQswCQYD
VQQGEwJGUjEXMBUGA1UECAwOw45sZS1kZS1GcmFuY2UxDjAMBgNVBAcMBVBhcmlz
MRYwFAYDVQQKDA1Ub29sYmVsdCBUZXN0MQwwCgYDVQQLDANXZWIxGTAXBgNVBAMM
EHd3dy5leGFtcGxlLnRlc3QxITAfBgkqhkiG9w0BCQEWEmFkbWluQGV4YW1wbGUu
dGVzdDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABDyY5VU7yDXKPi8DNEZOcjpf
ua08tGkQRmGZtoBdeiah8YL1lhkA/BLT+g8+WiB2kf82E0MTPZhwwbzg7X8CpAOj
ggEEMIIBADAMBgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQEAwIDiDAdBgNVHSUEFjAU
BggrBgEFBQcDAQYIKwYBBQUHAwIwgYAGA1UdEQR5MHeCEHd3dy5leGFtcGxlLnRl
c3SCDGV4YW1wbGUudGVzdIISKi5hcGkuZXhhbXBsZS50ZXN0hwTAAAIKhxAgAQ24
AAAAAAAAAAAAAAABgRJhZG1pbkBleGFtcGxlLnRlc3SGFWh0dHBzOi8vZXhhbXBs
ZS50ZXN0LzAdBgNVHQ4EFgQUQa/EyPRc+iQ1uQ8F147hdTLBRM4wHwYDVR0jBBgw
FoAUyjG8uIHdlQS+jxoTKvQr94WyG0QwDQYJKoZIhvcNAQELBQADggEBAEpFAuUs
bgg2KpS7DOKgexurCZTx088TExsP+3mF3efQ0ndQ0y1+wC2C7PDZbFWWXyy+qx86
OzaaBSSzvmJM8YfJgg2lGYPg29S5vd+fhGmBQjABQBb40yz8iGefqJCK0l5FC2yw
1LOlyaGb0SC6orJeZwA4WaHNCnMn28XY5ACAWQVJ1SUqb0R2cCLCDUq/iXsRsedT
n23OtMDGfzP3yOzqdTHcPJrD59p7T2GggUfdcVb2/2UIiSRWgdED+PP6B6Fb8Ym4
A0ytERmu27/ACo/iWWjM8FLb6zNai0dILUVSdWSFBJYhkj8WqKcL1FEtL3QYNn1y
9yONIHGCn8nWMrQ=
-----END CERTIFICATE-----
`;

const ED = `-----BEGIN CERTIFICATE-----
MIIBDjCBwaADAgECAgEBMAUGAytlcDAXMRUwEwYDVQQDDAxlZDI1NTE5LnRlc3Qw
HhcNMjQwMTAxMDAwMDAwWhcNNDQwMTAxMDAwMDAwWjAXMRUwEwYDVQQDDAxlZDI1
NTE5LnRlc3QwKjAFBgMrZXADIQBZ3v6Mt/UtqPhjmCCxdEr1m678IOyn5Cu/x1km
lrlDp6MyMDAwHQYDVR0OBBYEFINX+UKPBa1Dn6uQfd2tejukAYL1MA8GA1UdEwEB
/wQFMAMBAf8wBQYDK2VwA0EAndSt+5wiHTPyXW7Nw3Zd3EagFMMpWbUFX3tW4Puf
mLA7kyp+GigMhR2/NmN1osLAJqoIK2uJyQCBf2cvRQ4wDA==
-----END CERTIFICATE-----
`;

const CSR = `-----BEGIN CERTIFICATE REQUEST-----
MIIBgTCCAQYCAQAwOjELMAkGA1UEBhMCVVMxEDAOBgNVBAoMB0NTUiBPcmcxGTAX
BgNVBAMMEGNzci5leGFtcGxlLnRlc3QwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQx
N3ByvvEWdq9IO3qbDgXZen8F8zOQNvTDKbZo/cuv3rHcncb61Srf51LVLFK80q6F
Sz7aTzwMXT98JYsQZVT2QYKRcQDfG1vay3nTOEmEqYrBtUp7GOjIQTgfknqz9Iig
TTBLBgkqhkiG9w0BCQ4xPjA8MC0GA1UdEQQmMCSCEGNzci5leGFtcGxlLnRlc3SC
EGFsdC5leGFtcGxlLnRlc3QwCwYDVR0PBAQDAgeAMAoGCCqGSM49BAMDA2kAMGYC
MQDsbGHzqxfZ59tZkQAWZqq/dxzpAeP7oCeDd43x4zsx2vS0gQLRBBzR5UG0izvV
rmwCMQCWddO9lHTV0u4JijNH5fGZYEAj2MJSbrCcDY8/NbZGBMCGrHKo3wW4C1SS
9+z5OQo=
-----END CERTIFICATE REQUEST-----
`;

function one(text: string): Decoded {
  const [e] = parseText(text);
  if (!e?.result.ok) throw new Error(e ? (e.result.ok ? "" : e.result.error.en) : "no entry");
  return e.result.value;
}

const pemBody = (pem: string) => pem.replace(/-----[^-]+-----|\s/g, "");

describe("asn1", () => {
  it("decodes OIDs, including the first-arc packing and multi-byte arcs", () => {
    expect(readOid(parseDer(new Uint8Array([6, 3, 0x55, 0x1d, 0x11])))).toBe("2.5.29.17");
    expect(
      readOid(parseDer(new Uint8Array([6, 9, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 1, 1, 11]))),
    ).toBe("1.2.840.113549.1.1.11");
  });

  it("reads UTCTime around the 1950/2049 pivot and GeneralizedTime", () => {
    const t = (tag: number, s: string) =>
      readTime(parseDer(new Uint8Array([tag, s.length, ...Array.from(s, (c) => c.charCodeAt(0))])));
    expect(t(23, "491231235959Z").toISOString()).toBe("2049-12-31T23:59:59.000Z");
    expect(t(23, "500101000000Z").toISOString()).toBe("1950-01-01T00:00:00.000Z");
    expect(t(24, "20501231120000Z").toISOString()).toBe("2050-12-31T12:00:00.000Z");
  });

  it("rejects truncated and indefinite-length encodings", () => {
    expect(() => parseDer(new Uint8Array([0x30, 5, 1, 2]))).toThrow("Invalid DER");
    expect(() => parseDer(new Uint8Array([0x30, 0x80, 0, 0]))).toThrow("Invalid DER");
    expect(() => parseDer(new Uint8Array())).toThrow("Invalid DER");
  });
});

describe("certificates", () => {
  it("decodes an RSA root CA", () => {
    const d = one(CA);
    expect(d.kind).toBe("certificate");
    expect(d.version).toBe(3);
    expect(d.serialHex).toBe("12:34:56:78:90:AB:CD:EF");
    expect(d.serialDec).toBe("1311768467294899695");
    expect(formatName(d.subject)).toBe("C=FR, O=Toolbelt Test, CN=Toolbelt Test Root CA");
    expect(d.selfSigned).toBe(true);
    expect(d.publicKey).toEqual({ algorithm: "RSA", bits: 2048, curve: null, exponent: 65537 });
    expect(d.signatureAlgorithm).toBe("sha256WithRSAEncryption");
    expect(d.basicConstraints).toEqual({ ca: true, pathLen: 1 });
    expect(d.keyUsage).toEqual(["keyCertSign", "cRLSign"]);
    expect(d.extKeyUsage).toBeNull();
    expect(d.subjectKeyId).toBe("CA:31:BC:B8:81:DD:95:04:BE:8F:1A:13:2A:F4:2B:F7:85:B2:1B:44");
    expect(d.notBefore?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(d.notAfter?.toISOString()).toBe("2035-01-01T00:00:00.000Z");
    expect(d.extensions.map((e) => [e.oid, e.critical])).toEqual([
      ["2.5.29.14", false],
      ["2.5.29.19", true],
      ["2.5.29.15", true],
    ]);
  });

  it("decodes an EC leaf with SANs, EKU and UTF-8 names", () => {
    const d = one(LEAF);
    expect(d.serialHex).toBe("10:00");
    expect(d.serialDec).toBe("4096");
    expect(formatName(d.subject)).toBe(
      "C=FR, ST=Île-de-France, L=Paris, O=Toolbelt Test, OU=Web, CN=www.example.test, emailAddress=admin@example.test",
    );
    expect(shortName(d.subject)).toBe("www.example.test");
    expect(d.issuer && formatName(d.issuer)).toBe(
      "C=FR, O=Toolbelt Test, CN=Toolbelt Test Root CA",
    );
    expect(d.selfSigned).toBe(false);
    expect(d.publicKey).toEqual({ algorithm: "EC", bits: 256, curve: "P-256", exponent: null });
    expect(keyLabel(d.publicKey, "bits")).toBe("EC P-256 (256 bits)");
    expect(d.san).toEqual([
      { type: "DNS", value: "www.example.test" },
      { type: "DNS", value: "example.test" },
      { type: "DNS", value: "*.api.example.test" },
      { type: "IP", value: "192.0.2.10" },
      { type: "IP", value: "2001:db8::1" },
      { type: "email", value: "admin@example.test" },
      { type: "URI", value: "https://example.test/" },
    ]);
    expect(d.keyUsage).toEqual(["digitalSignature", "keyAgreement"]);
    expect(d.extKeyUsage?.map((e) => e.name?.en)).toEqual([
      "TLS server authentication",
      "TLS client authentication",
    ]);
    expect(d.basicConstraints).toEqual({ ca: false, pathLen: null });
    expect(d.authorityKeyId).toBe("CA:31:BC:B8:81:DD:95:04:BE:8F:1A:13:2A:F4:2B:F7:85:B2:1B:44");
    expect(lifetimeDays(d.notBefore as Date, d.notAfter as Date)).toBe(92);
  });

  it("decodes an Ed25519 certificate", () => {
    const d = one(ED);
    expect(d.publicKey.algorithm).toBe("Ed25519");
    expect(keyLabel(d.publicKey, "bits")).toBe("Ed25519");
    expect(d.signatureAlgorithm).toBe("Ed25519");
    expect(d.basicConstraints).toEqual({ ca: true, pathLen: null });
  });

  it("computes the same fingerprints as OpenSSL", async () => {
    expect(await fingerprints(one(LEAF).der)).toEqual({
      sha1: "B4:2B:AB:E1:EE:19:02:A3:64:A5:47:77:F4:C0:72:E0:E6:DF:75:FC",
      sha256:
        "23:87:A3:76:A8:3D:18:B5:BC:09:5E:A5:AC:D2:99:DF:AA:58:67:4D:E2:25:AB:E1:E8:85:15:11:BC:46:B3:3F",
    });
    expect((await fingerprints(one(CA).der)).sha256).toBe(
      "55:0A:C6:C9:79:FC:44:F4:B8:C2:74:1A:A8:51:40:BC:BC:EC:65:62:E8:8E:87:93:0F:F7:E0:34:1B:8B:20:3B",
    );
    expect((await fingerprints(one(ED).der)).sha1).toBe(
      "39:ED:65:92:90:92:AC:38:3A:6A:65:BA:89:62:57:DB:D5:10:88:18",
    );
  });

  it("tells valid, expired and not-yet-valid apart", () => {
    const d = one(LEAF);
    const nb = d.notBefore as Date;
    const na = d.notAfter as Date;
    expect(validity(nb, na, new Date("2025-08-21T12:00:00Z"))).toEqual({
      state: "valid",
      daysLeft: 10,
    });
    expect(validity(nb, na, new Date("2025-09-11T00:00:01Z"))).toEqual({
      state: "expired",
      daysAgo: 10,
    });
    expect(validity(nb, na, new Date("2025-05-30T00:00:00Z"))).toEqual({
      state: "not-yet",
      daysUntil: 2,
    });
  });
});

describe("requests", () => {
  it("decodes a PKCS#10 request with requested extensions", async () => {
    const d = one(CSR);
    expect(d.kind).toBe("csr");
    expect(d.version).toBe(1);
    expect(formatName(d.subject)).toBe("C=US, O=CSR Org, CN=csr.example.test");
    expect(d.issuer).toBeNull();
    expect(d.publicKey).toEqual({ algorithm: "EC", bits: 384, curve: "P-384", exponent: null });
    expect(d.signatureAlgorithm).toBe("ecdsa-with-SHA384");
    expect(d.san.map((s) => s.value)).toEqual(["csr.example.test", "alt.example.test"]);
    expect(d.keyUsage).toEqual(["digitalSignature"]);
    expect(
      toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(d.der)))),
    ).toBe("3b0218b767257cadf3d6d78c57093432f6f4d8a4a5858d289c512cabc56a5654");
  });

  it("recognizes a request from its structure when there is no PEM label", () => {
    expect(decodeDer(fromBase64(pemBody(CSR))).kind).toBe("csr");
    expect(decodeDer(fromBase64(pemBody(LEAF))).kind).toBe("certificate");
  });
});

describe("input", () => {
  it("splits a chain and links each certificate to its issuer", () => {
    const entries = parseText(`server chain:\n${LEAF}\n${CA}\n${ED}`);
    expect(entries).toHaveLength(3);
    const list = entries.map((e) => (e.result.ok ? e.result.value : null));
    expect(list.map((d) => d && shortName(d.subject))).toEqual([
      "www.example.test",
      "Toolbelt Test Root CA",
      "ed25519.test",
    ]);
    expect(issuerLinks(list)).toEqual([1, 1, 2]);
  });

  it("reads DER files, PEM files and bare Base64", () => {
    const der = fromBase64(pemBody(CA));
    const fromDer = parseFile(der);
    expect(fromDer[0]?.label).toBe("DER");
    expect(fromDer[0]?.result.ok).toBe(true);
    const fromPem = parseFile(new TextEncoder().encode(CA));
    expect(fromPem[0]?.label).toBe("CERTIFICATE");
    expect(parseText(pemBody(ED))[0]?.result.ok).toBe(true);
  });

  it("round-trips to PEM", () => {
    expect(toPem(one(CA))).toBe(CA);
    expect(toPem(one(CSR))).toBe(CSR);
  });

  it("skips keys, explains garbage, never throws", () => {
    const entries = parseText(
      `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIA==\n-----END PRIVATE KEY-----\n${ED}`,
    );
    expect(entries[0]?.result.ok).toBe(false);
    expect(entries[0]?.result.ok === false && entries[0].result.error.en).toContain("PRIVATE KEY");
    expect(entries[1]?.result.ok).toBe(true);
    expect(parseText("")).toEqual([]);
    const junk = parseText("hello world");
    expect(junk[0]?.result.ok === false && junk[0].result.error.en).toContain("No certificate");
    const broken = parseText(CA.replace("MIIDUTCCAjmgAwIBAgII", "MIIDUTCCAjmgAwIBAgIZ"));
    expect(broken[0]?.result.ok).toBe(false);
    const truncated = parseText(
      `-----BEGIN CERTIFICATE-----\n${pemBody(CA).slice(0, 200)}\n-----END CERTIFICATE-----`,
    );
    expect(truncated[0]?.result.ok === false && truncated[0].result.error.en).toContain(
      "Invalid DER",
    );
  });
});
