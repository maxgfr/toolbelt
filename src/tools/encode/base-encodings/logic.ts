/**
 * Bytes to and from hex, binary, octal, decimal, Base32 (RFC 4648), Base58 (Bitcoin alphabet)
 * and Ascii85. Text goes through UTF-8 first; decoding errors carry an EN + FR + DE message.
 */
import { fail, fromHex, toHex } from "../_shared";

export type Encoding = "hex" | "binary" | "octal" | "decimal" | "base32" | "base58" | "ascii85";

export const ENCODINGS: Encoding[] = [
  "hex",
  "binary",
  "octal",
  "decimal",
  "base32",
  "base58",
  "ascii85",
];

/** Encodings written as one number per byte, which take a separator. */
export const PER_BYTE: Encoding[] = ["hex", "binary", "octal", "decimal"];

export interface EncodeOptions {
  /** Between bytes, for hex / binary / octal / decimal. */
  separator: string;
  /** Hex letters in upper case (Base32 is always upper case). */
  upper: boolean;
  /** Base32 `=` padding. */
  padding: boolean;
  /** Ascii85 `<~ … ~>` delimiters (Adobe). */
  delimiters: boolean;
}

export const DEFAULT_OPTIONS: EncodeOptions = {
  separator: " ",
  upper: false,
  padding: true,
  delimiters: false,
};

export function encode(
  bytes: Uint8Array,
  enc: Encoding,
  o: EncodeOptions = DEFAULT_OPTIONS,
): string {
  switch (enc) {
    case "hex": {
      const hex = toHex(bytes, o.upper);
      return (hex.match(/../g) ?? []).join(o.separator);
    }
    case "binary":
      return [...bytes].map((b) => b.toString(2).padStart(8, "0")).join(o.separator);
    case "octal":
      return [...bytes].map((b) => b.toString(8).padStart(3, "0")).join(o.separator);
    case "decimal":
      return [...bytes].map(String).join(o.separator);
    case "base32":
      return toBase32(bytes, o.padding);
    case "base58":
      return toBase58(bytes);
    case "ascii85":
      return o.delimiters ? `<~${toAscii85(bytes)}~>` : toAscii85(bytes);
  }
}

export function decode(text: string, enc: Encoding): Uint8Array {
  switch (enc) {
    case "hex":
      return fromHex(text.replace(/0x|\\x/gi, "").replace(/,/g, ""));
    case "binary":
      return fromDigits(text, 2, 8);
    case "octal":
      return fromDigits(text, 8, 3);
    case "decimal":
      return fromDigits(text, 10, 0);
    case "base32":
      return fromBase32(text);
    case "base58":
      return fromBase58(text);
    case "ascii85":
      return fromAscii85(text);
  }
}

const NAMES: Record<number, { en: string; fr: string; de: string }> = {
  2: { en: "Binary", fr: "Le binaire", de: "Binärzahlen" },
  8: { en: "Octal", fr: "L'octal", de: "Oktalzahlen" },
  10: { en: "Decimal", fr: "Le décimal", de: "Dezimalzahlen" },
};

/**
 * Numbers in `radix`, one per byte. Separated by spaces, commas or newlines; without separators,
 * the digits are read in fixed groups of `width` (not possible for decimal).
 */
function fromDigits(text: string, radix: number, width: number): Uint8Array {
  const name = NAMES[radix] ?? { en: "", fr: "", de: "" };
  const digits = radix === 2 ? "01" : radix === 8 ? "0-7" : "0-9";
  const trimmed = text.trim();
  if (!trimmed) return new Uint8Array();
  if (new RegExp(`[^${digits}\\s,;]`).test(trimmed))
    fail(
      `${name.en} may only contain the digits ${radix === 10 ? "0–9" : radix === 8 ? "0–7" : "0 and 1"} and separators.`,
      `${name.fr} ne contient que les chiffres ${radix === 10 ? "0–9" : radix === 8 ? "0–7" : "0 et 1"} et des séparateurs.`,
      `${name.de} dürfen nur die Ziffern ${radix === 10 ? "0–9" : radix === 8 ? "0–7" : "0 und 1"} und Trennzeichen enthalten.`,
    );
  let tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 1 && width && trimmed.length > width) {
    if (trimmed.length % width)
      fail(
        `Without separators, the digits must come in groups of ${width}.`,
        `Sans séparateurs, les chiffres doivent aller par groupes de ${width}.`,
        `Ohne Trennzeichen müssen die Ziffern in Gruppen zu ${width} kommen.`,
      );
    tokens = trimmed.match(new RegExp(`.{${width}}`, "g")) ?? [];
  }
  const out = new Uint8Array(tokens.length);
  tokens.forEach((t, i) => {
    const n = Number.parseInt(t, radix);
    if (n > 255)
      fail(
        `"${t}" is more than one byte (255).`,
        `« ${t} » dépasse un octet (255).`,
        `„${t}“ ist größer als ein Byte (255).`,
      );
    out[i] = n;
  });
  return out;
}

/* --- Base32 (RFC 4648 §6) ------------------------------------------------------ */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function toBase32(bytes: Uint8Array, padding = true): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32.charAt((buffer >>> (bits - 5)) & 31);
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32.charAt((buffer << (5 - bits)) & 31);
  if (padding) while (out.length % 8) out += "=";
  return out;
}

/** Base32, case-insensitive, with or without padding; spaces and dashes are ignored. */
export function fromBase32(text: string): Uint8Array {
  const s = text.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (/[^A-Z2-7]/.test(s))
    fail(
      "Base32 may only contain A–Z, 2–7 and = at the end.",
      "Le Base32 ne contient que A–Z, 2–7 et = à la fin.",
      "Base32 darf nur A–Z, 2–7 und = am Ende enthalten.",
    );
  if ([1, 3, 6].includes(s.length % 8))
    fail(
      "Truncated Base32: the length does not match whole bytes.",
      "Base32 tronqué : la longueur ne correspond pas à des octets entiers.",
      "Abgeschnittenes Base32: Die Länge ergibt keine ganzen Bytes.",
    );
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of s) {
    buffer = (buffer << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  return new Uint8Array(out);
}

/* --- Base58 (Bitcoin alphabet) --------------------------------------------------- */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function toBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Repeated division of the big-endian number by 58, digits least significant first.
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i] as number;
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] as number) << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return (
    "1".repeat(zeros) +
    digits
      .reverse()
      .map((d) => B58.charAt(d))
      .join("")
  );
}

export function fromBase58(text: string): Uint8Array {
  const s = text.trim();
  const bad = [...s].find((c) => !B58.includes(c));
  if (bad !== undefined)
    fail(
      `"${bad}" is not in the Base58 alphabet (no 0, O, I or l).`,
      `« ${bad} » n'est pas dans l'alphabet Base58 (pas de 0, O, I ni l).`,
      `„${bad}“ gehört nicht zum Base58-Alphabet (kein 0, O, I oder l).`,
    );
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    let carry = B58.indexOf(s.charAt(i));
    for (let j = 0; j < bytes.length; j++) {
      carry += (bytes[j] as number) * 58;
      bytes[j] = carry & 255;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 255);
      carry >>= 8;
    }
  }
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes.reverse()]);
}

/* --- Ascii85 ---------------------------------------------------------------------- */

export function toAscii85(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const n = chunk.length;
    let v = 0;
    for (let k = 0; k < 4; k++) v = v * 256 + (chunk[k] ?? 0);
    if (v === 0 && n === 4) {
      out += "z";
      continue;
    }
    const block: string[] = [];
    for (let k = 0; k < 5; k++) {
      block.unshift(String.fromCharCode(33 + (v % 85)));
      v = Math.floor(v / 85);
    }
    out += block.slice(0, n + 1).join("");
  }
  return out;
}

export function fromAscii85(text: string): Uint8Array {
  let s = text.replace(/\s/g, "");
  if (s.startsWith("<~")) s = s.slice(2);
  if (s.endsWith("~>")) s = s.slice(0, -2);
  const out: number[] = [];
  let group: number[] = [];
  const flush = (count: number) => {
    let v = 0;
    for (let k = 0; k < 5; k++) v = v * 85 + (group[k] ?? 84);
    if (v > 0xffffffff)
      fail(
        "Invalid Ascii85 group (too large).",
        "Groupe Ascii85 invalide (trop grand).",
        "Ungültige Ascii85-Gruppe (zu groß).",
      );
    const four = [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...four.slice(0, count));
    group = [];
  };
  for (const c of s) {
    if (c === "z") {
      if (group.length)
        fail(
          "“z” may only appear between groups of 5 characters.",
          "« z » ne peut apparaître qu'entre deux groupes de 5 caractères.",
          "„z“ darf nur zwischen Gruppen von 5 Zeichen stehen.",
        );
      out.push(0, 0, 0, 0);
      continue;
    }
    const d = c.charCodeAt(0) - 33;
    if (d < 0 || d > 84)
      fail(
        `"${c}" is not an Ascii85 character (! to u, and z).`,
        `« ${c} » n'est pas un caractère Ascii85 (! à u, et z).`,
        `„${c}“ ist kein Ascii85-Zeichen (! bis u, und z).`,
      );
    group.push(d);
    if (group.length === 5) flush(4);
  }
  if (group.length === 1)
    fail(
      "Truncated Ascii85: a final group needs at least 2 characters.",
      "Ascii85 tronqué : un dernier groupe demande au moins 2 caractères.",
      "Abgeschnittenes Ascii85: Eine letzte Gruppe braucht mindestens 2 Zeichen.",
    );
  if (group.length) flush(group.length - 1);
  return new Uint8Array(out);
}
