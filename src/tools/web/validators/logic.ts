/**
 * Check digits: payment cards (Luhn, brand by IIN range), IBAN (length per country, mod 97),
 * GTIN barcodes (EAN-8, UPC-A, EAN-13, GTIN-14) and ISBN-10/13. Every check takes free text:
 * spaces and hyphens are ignored.
 */

const digitsOnly = (s: string) => s.replace(/[\s-]/g, "");

/* --- Luhn & cards ------------------------------------------------------------- */

export function luhnValid(digits: string): boolean {
  if (!/^\d{2,}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** The digit to append to `partial` so that it passes Luhn. */
export function luhnCheckDigit(partial: string): number {
  for (let d = 0; d <= 9; d++) if (luhnValid(partial + d)) return d;
  return 0;
}

export interface Brand {
  id: string;
  name: string;
  lengths: number[];
  /** Digit groups for display, e.g. [4, 6, 5] for Amex. */
  groups: number[];
}

const B = (id: string, name: string, lengths: number[], groups = [4, 4, 4, 4, 3]): Brand => ({
  id,
  name,
  lengths,
  groups,
});

const iin4 = (s: string) => Number(s.slice(0, 4));

/** Brands by IIN prefix, in the order they must be tested (Maestro last: it takes any 6…). */
const BRANDS: [Brand, (s: string) => boolean][] = [
  [B("amex", "American Express", [15], [4, 6, 5]), (s) => /^3[47]/.test(s)],
  [
    B("diners", "Diners Club", [14, 15, 16, 17, 18, 19], [4, 6, 4, 5]),
    (s) => /^(30[0-5]|3095|36|3[89])/.test(s),
  ],
  [B("jcb", "JCB", [16, 17, 18, 19]), (s) => iin4(s) >= 3528 && iin4(s) <= 3589],
  [B("visa", "Visa", [13, 16, 19]), (s) => s.startsWith("4")],
  [B("mir", "Mir", [16, 17, 18, 19]), (s) => /^220[0-4]/.test(s)],
  [
    B("mastercard", "Mastercard", [16]),
    (s) => /^5[1-5]/.test(s) || (iin4(s) >= 2221 && iin4(s) <= 2720),
  ],
  [B("discover", "Discover", [16, 17, 18, 19]), (s) => /^(6011|64[4-9]|65)/.test(s)],
  [B("unionpay", "UnionPay", [16, 17, 18, 19]), (s) => s.startsWith("62")],
  [B("maestro", "Maestro", [12, 13, 14, 15, 16, 17, 18, 19]), (s) => /^(5[06-8]|6)/.test(s)],
];

export function cardBrand(digits: string): Brand | null {
  for (const [brand, test] of BRANDS) if (test(digits)) return brand;
  return null;
}

/** Groups digits for reading: "4111 1111 1111 1111", "3782 822463 10005". */
export function groupDigits(digits: string, groups: number[]): string {
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(" ");
}

export type CardResult =
  | { ok: false; error: "empty" | "chars" | "short" }
  | {
      ok: true;
      digits: string;
      formatted: string;
      brand: Brand | null;
      luhn: boolean;
      lengthOk: boolean;
      /** The check digit the number should end with. */
      expected: number;
      valid: boolean;
    };

export function checkCard(text: string): CardResult {
  const s = digitsOnly(text);
  if (!s) return { ok: false, error: "empty" };
  if (!/^\d+$/.test(s)) return { ok: false, error: "chars" };
  if (s.length < 8) return { ok: false, error: "short" };
  const brand = cardBrand(s);
  const luhn = luhnValid(s);
  const lengthOk = brand ? brand.lengths.includes(s.length) : s.length >= 12 && s.length <= 19;
  return {
    ok: true,
    digits: s,
    formatted: groupDigits(s, brand?.groups ?? [4, 4, 4, 4, 3]),
    brand,
    luhn,
    lengthOk,
    expected: luhnCheckDigit(s.slice(0, -1)),
    valid: luhn && lengthOk,
  };
}

/* --- IBAN ----------------------------------------------------------------------- */

/** IBAN length per country (SWIFT IBAN registry). */
export const IBAN_LENGTHS: Record<string, number> = {
  AD: 24,
  AE: 23,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BI: 27,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DJ: 27,
  DK: 18,
  DO: 28,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FK: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HN: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  LY: 25,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MN: 20,
  MR: 27,
  MT: 31,
  MU: 30,
  NI: 28,
  NL: 18,
  NO: 15,
  OM: 23,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  RU: 33,
  SA: 24,
  SC: 31,
  SD: 18,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  SO: 23,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
  YE: 30,
};

/** The IBAN remainder mod 97 (country and check digits moved to the end, letters A=10…Z=35). */
export function ibanMod97(iban: string): number {
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= "A" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem;
}

/** The two check digits that make `country` + `bban` a valid IBAN. */
export function ibanCheckDigits(country: string, bban: string): string {
  return String(98 - ibanMod97(`${country}00${bban}`)).padStart(2, "0");
}

export type IbanResult =
  | { ok: false; error: "empty" | "chars" | "country" }
  | {
      ok: true;
      iban: string;
      formatted: string;
      country: string;
      known: boolean;
      expectedLength: number | null;
      lengthOk: boolean;
      checkOk: boolean;
      /** Correct check digits for this country and BBAN. */
      expectedCheck: string;
      bban: string;
      valid: boolean;
    };

export function checkIban(text: string): IbanResult {
  const s = text
    .replace(/^IBAN\s*:?\s*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  if (!s) return { ok: false, error: "empty" };
  if (!/^[A-Z0-9]+$/.test(s)) return { ok: false, error: "chars" };
  if (!/^[A-Z]{2}\d{2}/.test(s)) return { ok: false, error: "country" };
  const country = s.slice(0, 2);
  const expectedLength = IBAN_LENGTHS[country] ?? null;
  const lengthOk = expectedLength ? s.length === expectedLength : s.length >= 15 && s.length <= 34;
  const checkOk = ibanMod97(s) === 1;
  const bban = s.slice(4);
  return {
    ok: true,
    iban: s,
    formatted: s.replace(/(.{4})/g, "$1 ").trim(),
    country,
    known: expectedLength !== null,
    expectedLength,
    lengthOk,
    checkOk,
    expectedCheck: ibanCheckDigits(country, bban),
    bban,
    valid: checkOk && lengthOk && expectedLength !== null,
  };
}

/**
 * Length of the bank code at the start of the BBAN, for the countries whose BBAN is just
 * "bank code + account number": Germany (Bankleitzahl), Austria (BLZ), Switzerland and
 * Liechtenstein (bank clearing number / IID).
 */
const BANK_CODE_LENGTH: Record<string, number> = { DE: 8, AT: 5, CH: 5, LI: 5 };

/** The bank code and account number inside a DE/AT/CH/LI BBAN, or null elsewhere. */
export function ibanBankParts(
  country: string,
  bban: string,
): { bank: string; account: string } | null {
  const n = BANK_CODE_LENGTH[country];
  const len = IBAN_LENGTHS[country];
  if (!n || !len || bban.length !== len - 4) return null;
  return { bank: bban.slice(0, n), account: bban.slice(n) };
}

/* --- GTIN (EAN / UPC) & ISBN --------------------------------------------------- */

/** GTIN check digit of the digits before it (weights 3, 1, 3… from the right). */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export type GtinKind = "EAN-8" | "UPC-A" | "EAN-13" | "GTIN-14";
const GTIN_KINDS: Record<number, GtinKind> = {
  8: "EAN-8",
  12: "UPC-A",
  13: "EAN-13",
  14: "GTIN-14",
};

export type GtinResult =
  | { ok: false; error: "empty" | "chars" | "length" }
  | {
      ok: true;
      digits: string;
      kind: GtinKind;
      expected: number;
      valid: boolean;
      /** EAN-13 starting with 978/979 is an ISBN (“Bookland”). */
      isbn: boolean;
    };

export function checkGtin(text: string): GtinResult {
  const s = digitsOnly(text);
  if (!s) return { ok: false, error: "empty" };
  if (!/^\d+$/.test(s)) return { ok: false, error: "chars" };
  const kind = GTIN_KINDS[s.length];
  if (!kind) return { ok: false, error: "length" };
  const expected = gtinCheckDigit(s.slice(0, -1));
  return {
    ok: true,
    digits: s,
    kind,
    expected,
    valid: Number(s.at(-1)) === expected,
    isbn: kind === "EAN-13" && /^97[89]/.test(s),
  };
}

/** ISBN-10 check character (0–9 or X) of its first nine digits. */
export function isbn10CheckDigit(body: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return c === 10 ? "X" : String(c);
}

export type IsbnResult =
  | { ok: false; error: "empty" | "chars" | "length" | "prefix" }
  | {
      ok: true;
      kind: "ISBN-10" | "ISBN-13";
      compact: string;
      expected: string;
      valid: boolean;
      /** The same book in the other format (null when there is none: 979 has no ISBN-10). */
      isbn10: string | null;
      isbn13: string;
    };

export function checkIsbn(text: string): IsbnResult {
  const s = text
    .replace(/^ISBN(?:-1[03])?:?\s*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  if (!s) return { ok: false, error: "empty" };
  if (!/^\d+X?$/.test(s)) return { ok: false, error: "chars" };
  if (s.length === 10) {
    const body = s.slice(0, 9);
    const expected = isbn10CheckDigit(body);
    const isbn13body = `978${body}`;
    return {
      ok: true,
      kind: "ISBN-10",
      compact: s,
      expected,
      valid: s[9] === expected,
      isbn10: body + expected,
      isbn13: isbn13body + gtinCheckDigit(isbn13body),
    };
  }
  if (s.length === 13 && !s.includes("X")) {
    if (!/^97[89]/.test(s)) return { ok: false, error: "prefix" };
    const expected = String(gtinCheckDigit(s.slice(0, 12)));
    const body9 = s.slice(3, 12);
    return {
      ok: true,
      kind: "ISBN-13",
      compact: s,
      expected,
      valid: s[12] === expected,
      isbn10: s.startsWith("978") ? body9 + isbn10CheckDigit(body9) : null,
      isbn13: s.slice(0, 12) + expected,
    };
  }
  return { ok: false, error: "length" };
}
