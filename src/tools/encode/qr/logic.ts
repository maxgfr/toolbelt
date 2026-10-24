/**
 * QR codes: text → module matrix (qrcode-generator, UTF-8 bytes), payload builders for Wi-Fi
 * and vCard presets, SVG output, and what a decoded payload looks like (link, Wi-Fi, contact).
 */
import qrcode from "qrcode-generator";
import { bytesToLatin1, fail, utf8 } from "../_shared";

export type Ecc = "L" | "M" | "Q" | "H";

/** The modules of a QR code, `true` for dark, row by row. */
export type Matrix = boolean[][];

export function qrMatrix(text: string, ecc: Ecc): Matrix {
  if (!text) fail("Nothing to encode.", "Rien à encoder.");
  const qr = qrcode(0, ecc);
  // The library's default turns each UTF-16 unit into one byte: give it UTF-8 bytes instead.
  qr.addData(bytesToLatin1(utf8(text)), "Byte");
  try {
    qr.make();
  } catch {
    fail(
      "Too much data for a QR code at this error correction level.",
      "Trop de données pour un QR code avec ce niveau de correction.",
    );
  }
  const n = qr.getModuleCount();
  const m: Matrix = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    m.push(row);
  }
  return m;
}

/** QR version (1–40) of a matrix: 21 modules for version 1, +4 per version. */
export function qrVersion(m: Matrix): number {
  return (m.length - 17) / 4;
}

/** An SVG path drawing the dark modules (one subpath per horizontal run), offset by `margin`. */
export function matrixPath(m: Matrix, margin = 4): string {
  let d = "";
  m.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      d += `M${start + margin} ${y + margin}h${x - start}v1h-${x - start}z`;
    }
  });
  return d;
}

export interface SvgOptions {
  fg: string;
  bg: string;
  /** Quiet zone, in modules (the standard asks for 4). */
  margin: number;
  /** Rendered width and height, in pixels. */
  size: number;
}

/** A standalone SVG document of the code. A transparent background when `bg` is empty. */
export function qrSvg(m: Matrix, o: SvgOptions): string {
  const view = m.length + o.margin * 2;
  const bg = o.bg ? `<rect width="${view}" height="${view}" fill="${o.bg}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.size}" height="${o.size}" ` +
    `viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges">${bg}` +
    `<path fill="${o.fg}" d="${matrixPath(m, o.margin)}"/></svg>\n`
  );
}

/** Pixels per module and canvas side for a PNG close to `size` with whole-pixel modules. */
export function pngLayout(m: Matrix, margin: number, size: number): { cell: number; side: number } {
  const units = m.length + margin * 2;
  const cell = Math.max(1, Math.round(size / units));
  return { cell, side: cell * units };
}

/* --- Payload builders ----------------------------------------------------------- */

export type WifiSecurity = "WPA" | "WEP" | "nopass";

export interface Wifi {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

/** Backslash-escapes the characters with a meaning in the Wi-Fi QR syntax. */
export function escapeWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, "\\$1");
}

/** `WIFI:T:WPA;S:name;P:secret;;`, the format phone cameras recognize. */
export function wifiPayload(w: Wifi): string {
  let s = `WIFI:T:${w.security};S:${escapeWifi(w.ssid)};`;
  if (w.security !== "nopass") s += `P:${escapeWifi(w.password)};`;
  if (w.hidden) s += "H:true;";
  return `${s};`;
}

/** Reads a `WIFI:` payload back, or null when the text is not one. */
export function parseWifi(text: string): Wifi | null {
  if (!/^WIFI:/i.test(text)) return null;
  const fields: Record<string, string> = {};
  let i = 5;
  while (i < text.length) {
    const colon = text.indexOf(":", i);
    if (colon < 0) break;
    const key = text.slice(i, colon).toUpperCase();
    let val = "";
    let j = colon + 1;
    for (; j < text.length && text[j] !== ";"; j++) {
      if (text[j] === "\\" && j + 1 < text.length) j++;
      val += text[j];
    }
    if (key) fields[key] = val;
    i = j + 1;
    if (text[i] === ";") break;
  }
  if (!("S" in fields)) return null;
  const t = (fields.T ?? "nopass").toUpperCase();
  return {
    ssid: fields.S ?? "",
    password: fields.P ?? "",
    security: t === "WEP" ? "WEP" : t === "NOPASS" || t === "" ? "nopass" : "WPA",
    hidden: (fields.H ?? "").toLowerCase() === "true",
  };
}

export type Contact = {
  first: string;
  last: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  address: string;
  note: string;
};

function escapeVcard(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/([,;])/g, "\\$1")
    .replace(/\r?\n/g, "\\n");
}

/** A vCard 3.0 with only the fields that are filled in (CRLF line endings). */
export function vcardPayload(c: Contact): string {
  const e = (s: string) => escapeVcard(s.trim());
  const full = [c.first, c.last]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${e(c.last)};${e(c.first)};;;`];
  lines.push(`FN:${e(full || c.org)}`);
  if (c.org.trim()) lines.push(`ORG:${e(c.org)}`);
  if (c.title.trim()) lines.push(`TITLE:${e(c.title)}`);
  if (c.phone.trim()) lines.push(`TEL;TYPE=CELL:${e(c.phone)}`);
  if (c.email.trim()) lines.push(`EMAIL:${e(c.email)}`);
  if (c.url.trim()) lines.push(`URL:${e(c.url)}`);
  if (c.address.trim()) lines.push(`ADR:;;${e(c.address)};;;;`);
  if (c.note.trim()) lines.push(`NOTE:${e(c.note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** Adds `https://` to something that looks like a bare domain ("example.com/x"). */
export function normalizeUrl(s: string): string {
  const t = s.trim();
  if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  return /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(t) ? `https://${t}` : t;
}

/* --- Reading ------------------------------------------------------------------- */

export type PayloadKind = "url" | "wifi" | "vcard" | "email" | "phone" | "otp" | "text";

export function payloadKind(text: string): PayloadKind {
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return "url";
  if (/^WIFI:/i.test(t)) return "wifi";
  if (/^BEGIN:VCARD/i.test(t)) return "vcard";
  if (/^mailto:/i.test(t)) return "email";
  if (/^tel:/i.test(t)) return "phone";
  if (/^otpauth:\/\//i.test(t)) return "otp";
  return "text";
}

/** Width and height scaled down to fit `max` pixels on the longest side (never up). */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** WCAG contrast ratio of two #rrggbb colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** True when the dark modules are lighter than the background (many scanners fail). */
export function isInverted(fg: string, bg: string): boolean {
  return contrast(fg, "#000000") > contrast(bg, "#000000");
}
