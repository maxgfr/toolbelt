import { describe, expect, it } from "bun:test";
import { extract, extractAll, isIPv6, KINDS, luhn, toCsv, trimUrl } from "./logic";

describe("extract", () => {
  it("returns nothing for an empty text", () => {
    for (const k of KINDS) expect(extract("", k)).toEqual([]);
  });

  it("finds emails, including accented and plus-addressed ones", () => {
    expect(
      extract("Write to jean.dupont@exemple.fr, a+b@x.co.uk or éric@café.fr.", "email"),
    ).toEqual(["jean.dupont@exemple.fr", "a+b@x.co.uk", "éric@café.fr"]);
    expect(extract("not @an.email nor foo@bar", "email")).toEqual([]);
  });

  it("finds URLs without the sentence punctuation around them", () => {
    expect(
      extract("See https://en.wikipedia.org/wiki/Foo_(bar)), and (www.example.com/a?b=1).", "url"),
    ).toEqual(["https://en.wikipedia.org/wiki/Foo_(bar)", "www.example.com/a?b=1"]);
    expect(trimUrl("https://x.io/a.")).toBe("https://x.io/a");
  });

  it("finds domains but not file names or mentions", () => {
    expect(
      extract(
        "mail me@sub.example.org, visit toolbelt.dev, read README.md, run main.py, @team.dev",
        "domain",
      ),
    ).toEqual(["sub.example.org", "toolbelt.dev"]);
  });

  it("validates IPv4 octets", () => {
    expect(extract("192.168.1.10, 10.0.0.256, 1.2.3.4.5 and 8.8.8.8.", "ipv4")).toEqual([
      "192.168.1.10",
      "8.8.8.8",
    ]);
  });

  it("validates IPv6 addresses and ignores C++ scopes and times", () => {
    expect(
      extract("2001:db8::1, ::ffff:192.0.2.1, fe80::1%eth0, std::vector, 12:30:45", "ipv6"),
    ).toEqual(["2001:db8::1", "::ffff:192.0.2.1", "fe80::1%eth0"]);
    expect(isIPv6("2001:0db8:0000:0000:0000:ff00:0042:8329")).toBe(true);
    expect(isIPv6("1:2:3:4:5:6:7")).toBe(false);
    expect(isIPv6("1::2::3")).toBe(false);
    expect(isIPv6("12345::1")).toBe(false);
  });

  it("finds loose international phone numbers but not plain numbers or dates", () => {
    expect(
      extract(
        "+33 6 12 34 56 78, (555) 123-4567, 06.12.34.56.78, 0612345678, 123456789, 2024-01-15, 3.14159 2.71828",
        "phone",
      ),
    ).toEqual(["+33 6 12 34 56 78", "(555) 123-4567", "06.12.34.56.78", "0612345678"]);
  });

  it("finds hashtags and mentions, not emails or hex colors", () => {
    expect(extract("#launch #café #ff0000 a#b x&#39;", "hashtag")).toEqual(["#launch", "#café"]);
    expect(extract("hi @maxime and @team.dev. mail a@b.com", "mention")).toEqual([
      "@maxime",
      "@team.dev",
    ]);
  });

  it("finds numbers with thousands and decimal separators", () => {
    expect(extract("Pay 1,234.56 or 3,5 kg, -42 and 6.02e23 (v2 ignored)", "number")).toEqual([
      "1,234.56",
      "3,5",
      "-42",
      "6.02e23",
    ]);
  });

  it("does not report the digits of phones, dates, IPs or colors as numbers", () => {
    expect(
      extract("Call +33 6 12 34 56 78 on 2024-01-15 from 10.0.0.1 (#ff0088), 42 times", "number"),
    ).toEqual(["42"]);
  });

  it("finds ISO, numeric and written dates and checks their ranges", () => {
    expect(
      extract(
        "2024-01-15T10:30:00Z, 15/01/2024, 13/13/2024, 31.12.99, March 5, 2024, 1er janvier 2024, 12 mars 2024, 5th of May",
        "date",
      ),
    ).toEqual([
      "2024-01-15T10:30:00Z",
      "15/01/2024",
      "31.12.99",
      "March 5, 2024",
      "1er janvier 2024",
      "12 mars 2024",
      "5th of May",
    ]);
  });

  it("finds German written dates", () => {
    expect(
      extract("am 3. Oktober 2024, 1. März 2025, 24. Dez. 2023, 7. Jänner, 32. Mai 2024", "date"),
    ).toEqual(["3. Oktober 2024", "1. März 2025", "24. Dez. 2023", "7. Jänner"]);
  });

  it("finds hex and functional colors", () => {
    expect(extract("#fff #11223344 #12345 rgb(255, 0, 0) hsl(120 50% 50%)", "color")).toEqual([
      "#fff",
      "#11223344",
      "rgb(255, 0, 0)",
      "hsl(120 50% 50%)",
    ]);
  });

  it("keeps only Luhn-valid card-like numbers", () => {
    expect(luhn("4111111111111111")).toBe(true);
    expect(luhn("4111111111111112")).toBe(false);
    expect(
      extract(
        "4111 1111 1111 1111, 4111-1111-1111-1112, 5555555555554444, 0000 0000 0000 0000",
        "card",
      ),
    ).toEqual(["4111 1111 1111 1111", "5555555555554444"]);
  });

  it("dedupes (caseless for emails) and sorts", () => {
    const r = extractAll("b@x.io A@X.IO a@x.io #b #a #B", ["email", "hashtag"], {
      dedupe: true,
      sort: true,
    });
    expect(r.email).toEqual(["A@X.IO", "b@x.io"]);
    expect(r.hashtag).toEqual(["#a", "#b"]);
    expect(r.url).toEqual([]);
  });

  it("exports CSV with quoting", () => {
    expect(toCsv({ email: ["a@b.co"], number: ["1,234"] })).toBe(
      'kind,value\nemail,a@b.co\nnumber,"1,234"\n',
    );
  });
});
