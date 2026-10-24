import { describe, expect, it } from "bun:test";
import { tb } from "../test-utils";

async function ok(argv: string[], stdin?: string) {
  const r = await tb(argv, stdin === undefined ? {} : { stdin });
  expect(r.stderr).toBe("");
  expect(r.code).toBe(0);
  return r.stdout;
}

async function fails(argv: string[], code = 1) {
  const r = await tb(argv);
  expect(r.code).toBe(code);
  expect(r.stderr).toStartWith("error: ");
  return r.stderr;
}

describe("timestamp", () => {
  it("reads a Unix timestamp in seconds", async () => {
    const out = await ok(["timestamp", "1700000000"]);
    expect(out).toContain("2023-11-14T22:13:20.000Z");
    expect(out).toContain("Tue, 14 Nov 2023 22:13:20 +0000");
    expect(out).toContain("timestamp in seconds");
  });
  it("reads a date in a zone, and defaults to now", async () => {
    const out = JSON.parse(
      await ok(["timestamp", "2024-01-31 12:00", "--zone", "Europe/Paris", "--json"]),
    );
    expect(out.isoUtc).toBe("2024-01-31T11:00:00.000Z");
    expect(out.isoZone).toBe("2024-01-31T12:00:00.000+01:00");
    expect(await ok(["timestamp"])).toContain("2026-01-15T12:00:00.000Z");
  });
  it("rejects garbage and bad zones", async () => {
    expect(await fails(["timestamp", "not a date"])).toContain("cannot read");
    expect(await fails(["timestamp", "1", "--zone", "Nowhere/Land"])).toContain(
      "unknown time zone",
    );
  });
});

describe("timezones", () => {
  it("converts a time to other zones", async () => {
    const out = await ok([
      "timezones",
      "2026-03-10",
      "09:00",
      "--from",
      "Europe/Paris",
      "--to",
      "America/New_York",
      "--to",
      "tokyo",
    ]);
    expect(out).toContain("America/New_York  2026-03-10 04:00");
    expect(out).toContain("Asia/Tokyo        2026-03-10 17:00");
  });
  it("searches zones", async () => {
    expect(await ok(["timezones", "--search", "tokyo"])).toContain("Asia/Tokyo");
  });
  it("rejects an invalid time", async () => {
    expect(await fails(["timezones", "2026-01-01", "25:99"])).toContain("invalid time");
  });
});

describe("date-calc", () => {
  it("counts the days between two dates", async () => {
    const out = JSON.parse(await ok(["date-calc", "2026-01-01", "2026-12-31", "--json"]));
    expect(out.totalDays).toBe(364);
    expect(out.businessDays).toBe(260);
  });
  it("adds days and working days", async () => {
    expect(await ok(["date-calc", "2026-03-01", "--days", "90"])).toBe("2026-05-30 (Saturday)\n");
    expect(await ok(["date-calc", "2026-03-02", "--workdays", "10", "--subtract"])).toBe(
      "2026-02-16 (Monday)\n",
    );
  });
  it("rejects invalid dates", async () => {
    expect(await fails(["date-calc", "2026-02-30", "2026-03-01"])).toContain("invalid date");
    expect(await fails(["date-calc", "2026-01-01", "--days", "1.5"])).toContain("whole number");
  });
});

describe("cron", () => {
  it("explains and lists the next runs", async () => {
    const out = await ok(["cron", "0 9 * * 1-5", "--next", "2"]);
    expect(out).toContain("At 09:00 AM, Monday through Friday");
    expect(out).toContain("2026-01-16T09:00:00.000Z");
    expect(out).toContain("2026-01-19T09:00:00.000Z");
  });
  it("follows --lang and --zone", async () => {
    const out = JSON.parse(
      await ok([
        "cron",
        "@daily",
        "--lang",
        "fr",
        "--zone",
        "Europe/Paris",
        "--next",
        "1",
        "--json",
      ]),
    );
    expect(out.description).toContain("00:00");
    expect(out.next).toEqual(["2026-01-16T00:00:00.000+01:00"]);
  });
  it("rejects bad expressions", async () => {
    expect(await fails(["cron", "* * *"])).toContain("found 3");
    expect(await fails(["cron", "99 * * * *"])).toContain("not valid");
  });
});

describe("number-base", () => {
  it("converts to every base", async () => {
    const out = await ok(["number-base", "255"]);
    expect(out).toContain("Binary (2):       11111111");
    expect(out).toContain("Hexadecimal (16): FF");
    expect(await ok(["number-base", "0xff", "--to", "2"])).toBe("11111111\n");
  });
  it("shows two's complement", async () => {
    expect(await ok(["number-base", "-1", "--bits", "16"])).toContain("16-bit unsigned:  65535");
  });
  it("rejects a digit outside the base", async () => {
    expect(await fails(["number-base", "102", "--from", "2"])).toContain(
      '"2" is not a digit in base 2',
    );
  });
});

describe("bytes", () => {
  it("converts sizes", async () => {
    const out = await ok(["bytes", "1.5GB"]);
    expect(out).toContain("IEC (1024): 1.397 GiB");
    expect(await ok(["bytes", "1", "GiB", "--to", "MB"])).toBe("1073.741824 MB\n");
  });
  it("computes a transfer time", async () => {
    expect(await ok(["bytes", "4.7", "GB", "--rate", "100 Mbit/s"])).toContain("6 min 16 s");
  });
  it("rejects unknown units and values", async () => {
    expect(await fails(["bytes", "abc"])).toContain("not a number");
    expect(await fails(["bytes", "1", "--to", "XB"])).toContain("unknown unit");
  });
});

describe("roman", () => {
  it("converts both ways", async () => {
    expect(await ok(["roman", "1990"])).toBe("MCMXC\n");
    expect(await ok(["roman", "mmxxvi"])).toBe("2026\n");
  });
  it("rejects out of range and non-standard numerals", async () => {
    expect(await fails(["roman", "4000"])).toContain("1 to 3999");
    expect(await fails(["roman", "IIII"])).toContain("written IV");
  });
});

describe("number-words", () => {
  it("writes numbers in each language", async () => {
    expect(await ok(["number-words", "1234"])).toBe("one thousand two hundred thirty-four\n");
    expect(await ok(["number-words", "80", "--language", "fr"])).toBe("quatre-vingts\n");
    expect(await ok(["number-words", "21", "--ordinal", "--language", "de"])).toBe(
      "einundzwanzigste\n",
    );
    expect(await ok(["number-words", "1.5", "--currency", "eur", "--lang", "fr"])).toContain(
      "euro",
    );
  });
  it("rejects non-numbers", async () => {
    expect(await fails(["number-words", "twelve"])).toContain("not a number");
  });
});

describe("percentage", () => {
  it("answers the everyday questions", async () => {
    expect(await ok(["percentage", "of", "15", "200"])).toBe("15 % of 200 = 30\n");
    expect(await ok(["percentage", "change", "80", "100"])).toBe("80 → 100: +25 %\n");
    expect(await ok(["percentage", "reverse", "20", "120"])).toBe("120 after +20 % was 100\n");
    expect(JSON.parse(await ok(["percentage", "add", "-10", "50", "--json"])).result).toBe(45);
  });
  it("rejects unknown operations and division by zero", async () => {
    await fails(["percentage", "times", "1", "2"], 2);
    expect(await fails(["percentage", "what", "1", "0"])).toContain("division by zero");
  });
});

describe("units", () => {
  it("converts between units", async () => {
    expect(await ok(["units", "5", "km", "mi"])).toBe("5 km = 3.106855961 mi\n");
    expect(await ok(["units", "100", "f", "to", "c"])).toBe("100 °F = 37.77777778 °C\n");
    expect(await ok(["units", "1", "m"])).toContain("3.280839895");
    expect(await ok(["units", "--list", "--category", "temperature"])).toContain(
      "temperature: c (°C)",
    );
  });
  it("rejects unknown units and impossible temperatures", async () => {
    expect(await fails(["units", "5", "furlongs", "m"])).toContain("unknown unit");
    expect(await fails(["units", "5", "km", "kg"])).toContain("not a length unit");
    expect(await fails(["units", "-300", "c", "k"])).toContain("absolute zero");
  });
});

describe("aspect-ratio", () => {
  it("simplifies and resizes", async () => {
    expect(await ok(["aspect-ratio", "1920x1080"])).toContain("Ratio:          16:9");
    expect(await ok(["aspect-ratio", "16:9", "--width", "1280"])).toContain("1280 × 720");
  });
  it("rejects a missing height", async () => {
    await fails(["aspect-ratio", "1920"], 2);
    expect(await fails(["aspect-ratio", "0x5"])).toContain("positive");
  });
});
