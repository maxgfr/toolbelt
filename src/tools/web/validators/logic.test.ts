import { describe, expect, it } from "bun:test";
import {
  checkCard,
  checkGtin,
  checkIban,
  checkIsbn,
  gtinCheckDigit,
  IBAN_LENGTHS,
  ibanBankParts,
  ibanCheckDigits,
  luhnCheckDigit,
  luhnValid,
} from "./logic";

const card = (s: string) => {
  const r = checkCard(s);
  if (!r.ok) throw new Error(r.error);
  return r;
};
const iban = (s: string) => {
  const r = checkIban(s);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe("validators — cards", () => {
  it("runs the Luhn algorithm", () => {
    expect(luhnValid("79927398713")).toBe(true);
    expect(luhnValid("79927398710")).toBe(false);
    expect(luhnValid("")).toBe(false);
    expect(luhnCheckDigit("7992739871")).toBe(3);
  });

  it("detects the brand and checks the length", () => {
    const cases: [string, string][] = [
      ["4111 1111 1111 1111", "visa"],
      ["5555-5555-5555-4444", "mastercard"],
      ["2223003122003222", "mastercard"],
      ["378282246310005", "amex"],
      ["6011111111111117", "discover"],
      ["36227206271667", "diners"],
      ["3566002020360505", "jcb"],
      ["6200000000000005", "unionpay"],
      ["2200000000000004", "mir"],
      ["6759649826438453", "maestro"],
    ];
    for (const [n, brand] of cases) {
      const r = card(n);
      expect(r.brand?.id).toBe(brand);
      expect(r.luhn).toBe(true);
    }
    expect(card("378282246310005").formatted).toBe("3782 822463 10005");
    expect(card("4111111111111111").formatted).toBe("4111 1111 1111 1111");
  });

  it("explains invalid numbers", () => {
    const bad = card("4111111111111112");
    expect(bad.valid).toBe(false);
    expect(bad.expected).toBe(1);
    expect(card("41111111111111111").lengthOk).toBe(false);
    expect(checkCard("")).toEqual({ ok: false, error: "empty" });
    expect(checkCard("4111-abcd")).toEqual({ ok: false, error: "chars" });
    expect(checkCard("4111")).toEqual({ ok: false, error: "short" });
  });
});

describe("validators — IBAN", () => {
  it("accepts valid IBANs and formats them", () => {
    for (const s of [
      "DE89 3704 0044 0532 0130 00",
      "GB82 WEST 1234 5698 7654 32",
      "FR14 2004 1010 0505 0001 3M02 606",
      "be68539007547034",
      "NL91ABNA0417164300",
      "IBAN: CH93 0076 2011 6238 5295 7",
    ])
      expect(iban(s).valid).toBe(true);
    expect(iban("de89370400440532013000").formatted).toBe("DE89 3704 0044 0532 0130 00");
  });

  it("rejects wrong check digits and lengths, and gives the right check digits", () => {
    const r = iban("DE88 3704 0044 0532 0130 00");
    expect(r.checkOk).toBe(false);
    expect(r.expectedCheck).toBe("89");
    expect(iban("DE89 3704 0044 0532 0130 0").lengthOk).toBe(false);
    expect(iban("ZZ12 3456 7890 1234 56").known).toBe(false);
    expect(ibanCheckDigits("GB", "WEST12345698765432")).toBe("82");
  });

  it("refuses non-IBAN input", () => {
    expect(checkIban("")).toEqual({ ok: false, error: "empty" });
    expect(checkIban("DE89 3704 ✓")).toEqual({ ok: false, error: "chars" });
    expect(checkIban("1234567890")).toEqual({ ok: false, error: "country" });
  });

  it("checks and splits German, Austrian and Swiss IBANs", () => {
    for (const s of [
      "DE89 3704 0044 0532 0130 00",
      "AT61 1904 3002 3457 3201",
      "CH93 0076 2011 6238 5295 7",
    ])
      expect(iban(s).valid).toBe(true);
    expect(iban("at611904300234573201").formatted).toBe("AT61 1904 3002 3457 3201");
    expect(ibanBankParts("DE", "370400440532013000")).toEqual({
      bank: "37040044",
      account: "0532013000",
    });
    expect(ibanBankParts("AT", "1904300234573201")).toEqual({
      bank: "19043",
      account: "00234573201",
    });
    expect(ibanBankParts("CH", "00762011623852957")).toEqual({
      bank: "00762",
      account: "011623852957",
    });
    expect(ibanBankParts("DE", "3704004405320130")).toBeNull();
    expect(ibanBankParts("FR", "20041010050500013M02606")).toBeNull();
  });

  it("has a sane country table", () => {
    for (const [cc, len] of Object.entries(IBAN_LENGTHS)) {
      expect(cc).toMatch(/^[A-Z]{2}$/);
      expect(len).toBeGreaterThanOrEqual(15);
      expect(len).toBeLessThanOrEqual(34);
    }
    expect(IBAN_LENGTHS.FR).toBe(27);
    expect(IBAN_LENGTHS.NO).toBe(15);
  });
});

describe("validators — barcodes and ISBN", () => {
  it("checks GTIN check digits", () => {
    expect(gtinCheckDigit("400638133393")).toBe(1);
    const ean = checkGtin("4006381333931");
    expect(ean.ok && ean.kind === "EAN-13" && ean.valid).toBe(true);
    const upc = checkGtin("036000291452");
    expect(upc.ok && upc.kind === "UPC-A" && upc.valid).toBe(true);
    const ean8 = checkGtin("9638-5074");
    expect(ean8.ok && ean8.kind === "EAN-8" && ean8.valid).toBe(true);
    const bad = checkGtin("4006381333932");
    expect(bad.ok && !bad.valid && bad.expected).toBe(1);
    expect(checkGtin("12345")).toEqual({ ok: false, error: "length" });
    expect(checkGtin("")).toEqual({ ok: false, error: "empty" });
    const book = checkGtin("9780306406157");
    expect(book.ok && book.isbn).toBe(true);
  });

  it("checks ISBN-10 and ISBN-13 and converts between them", () => {
    const ten = checkIsbn("0-306-40615-2");
    expect(ten).toMatchObject({ ok: true, kind: "ISBN-10", valid: true, isbn13: "9780306406157" });
    const x = checkIsbn("ISBN 0-8044-2957-X");
    expect(x).toMatchObject({ ok: true, valid: true });
    const thirteen = checkIsbn("978-0-306-40615-7");
    expect(thirteen).toMatchObject({
      ok: true,
      kind: "ISBN-13",
      valid: true,
      isbn10: "0306406152",
    });
    expect(checkIsbn("979-10-90636-07-1")).toMatchObject({ ok: true, valid: true, isbn10: null });
    const bad = checkIsbn("0306406153");
    expect(bad).toMatchObject({ ok: true, valid: false, expected: "2" });
    expect(checkIsbn("9771234567898")).toEqual({ ok: false, error: "prefix" });
    expect(checkIsbn("12345")).toEqual({ ok: false, error: "length" });
    expect(checkIsbn("abc")).toEqual({ ok: false, error: "chars" });
  });
});
