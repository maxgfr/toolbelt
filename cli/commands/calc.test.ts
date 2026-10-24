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

describe("calculator", () => {
  it("evaluates an expression", async () => {
    expect(await ok(["calculator", "2 * (3 + 4)^2 / sqrt(16)"])).toBe("24.5\n");
    expect(await ok(["calc", "200 + 10%"])).toBe("220\n");
    expect(await ok(["calculator", "1,5 * 2", "--decimal-comma"])).toBe("3\n");
  });
  it("evaluates a sheet from stdin, with variables", async () => {
    const out = await ok(["calculator"], "x = 3\nx * 2\nsum\n");
    expect(out).toBe("x = 3  = 3\nx * 2  = 6\nsum  = 9\n");
  });
  it("reports errors", async () => {
    expect(await fails(["calculator", "1/0"])).toContain("division by zero");
    const r = await tb(["calculator"], { stdin: "1+1\nfoo(\n" });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("→ error: syntax error");
  });
});

describe("vat", () => {
  it("splits from net, gross or a country rate", async () => {
    expect(await ok(["vat", "100", "--rate", "20"])).toContain("Gross (with tax): 120.00");
    const j = JSON.parse(await ok(["vat", "121", "--from", "gross", "--country", "be", "--json"]));
    expect(j.rate).toBe(21);
    expect(j.rounded.net).toBe(100);
    expect(await ok(["vat", "--net", "100", "--gross", "119"])).toBe("VAT rate: 19 %\n");
  });
  it("totals invoice lines and lists rates", async () => {
    const out = await ok(["vat", "--invoice"], "2 49.90 20\n1 12 5.5\n");
    expect(out).toContain("Total gross: 132.42");
    expect(await ok(["vat", "--rates"])).toContain("fr  France: 20 %");
  });
  it("rejects bad input", async () => {
    await fails(["vat", "100", "--country", "zz"], 2);
    expect(await fails(["vat", "abc"])).toContain("not a number");
  });
});

describe("salary", () => {
  it("estimates net from gross", async () => {
    const out = await ok(["salary", "3000", "--status", "cadre"]);
    expect(out).toContain("Net            14.84  2250.00  27000.00");
    const j = JSON.parse(
      await ok(["salary", "2250", "--from", "net", "--status", "cadre", "--json"]),
    );
    expect(j.gross.month).toBeCloseTo(3000, 6);
  });
  it("converts pay periods", async () => {
    expect(await ok(["salary", "25", "--pay-period", "hour", "--hours-per-week", "35"])).toContain(
      "Per year:  45500.00",
    );
  });
  it("rejects impossible input", async () => {
    expect(await fails(["salary", "3000", "--employee-rate", "100"])).toContain("check the rates");
    await fails(["salary", "3000", "--status", "boss"], 2);
  });
});

describe("loan", () => {
  it("computes the payment and the schedule", async () => {
    expect(
      await ok(["loan", "200000", "--rate", "3.5", "--years", "20", "--insurance", "0.3"]),
    ).toContain("Monthly payment:        1159.92");
    const out = await ok(["loan", "15000", "--rate", "5", "--months", "24", "--schedule"]);
    expect(out).toContain("2     7896.85");
  });
  it("computes the borrowing capacity", async () => {
    expect(await ok(["loan", "--budget", "1200", "--rate", "3.5", "--years", "25"])).toContain(
      "You can borrow: 239701.06",
    );
  });
  it("rejects a missing rate or duration", async () => {
    await fails(["loan", "200000"], 2);
    expect(await fails(["loan", "200000", "--rate", "3", "--months", "0"])).toContain("duration");
  });
});

describe("savings", () => {
  it("compounds", async () => {
    const out = await ok(["savings", "1000", "--monthly", "100", "--rate", "3", "--years", "3"]);
    expect(out).toContain("Final balance:    4852.53");
    expect(out).toContain("Doubling time:    23.4 years");
  });
  it("rejects an impossible duration", async () => {
    expect(await fails(["savings", "1000", "--years", "500"])).toContain("duration");
  });
});

describe("tip", () => {
  it("splits evenly with rounding", async () => {
    const out = await ok(["tip", "84", "--tip", "10", "--people", "4", "--round", "5"]);
    expect(out).toContain("Per person:         23.10");
    expect(out).toContain("Rounded per person: 25.00");
  });
  it("splits by what each person ordered", async () => {
    const j = JSON.parse(await ok(["tip", "100", "--own", "Ann=30", "--own", "Bob=25", "--json"]));
    expect(j.shares[0].name).toBe("Ann");
    expect(j.total).toBeCloseTo(110, 6);
  });
  it("rejects zero people", async () => {
    expect(await fails(["tip", "84", "--people", "0"])).toContain("at least 1 person");
  });
});

describe("discount", () => {
  it("stacks discounts and finds percents", async () => {
    expect(await ok(["discount", "80", "--off", "30", "--off", "10"])).toContain(
      "Final price:         50.40",
    );
    expect(await ok(["discount", "80", "--sale", "60"])).toContain("Discount: 25 %");
    expect(await ok(["discount", "--sale", "45", "--off", "25"])).toBe("Original price: 60.00\n");
  });
  it("compares unit prices", async () => {
    const out = await ok(["discount", "--compare", "2.49 500g", "--compare", "4.20 1kg"]);
    expect(out).toContain("4.20 / kg  best");
  });
  it("rejects unreadable products and missing discounts", async () => {
    expect(await fails(["discount", "--compare", "cheap"])).toContain("cannot read");
    await fails(["discount", "80"], 2);
  });
});

describe("bmi", () => {
  it("computes BMI and calories", async () => {
    const out = await ok(["bmi", "70", "175", "--age", "30", "--sex", "male"]);
    expect(out).toContain("BMI:            22.9");
    expect(out).toContain("normal weight");
    expect(out).toContain("BMR:            1649 kcal/day");
    expect(await ok(["bmi", "154", "--imperial", "--feet", "5", "--inches", "9"])).toContain(
      "22.7",
    );
  });
  it("rejects a missing height", async () => {
    await fails(["bmi", "70"], 2);
    expect(await fails(["bmi", "0", "175"])).toContain("positive");
  });
});

describe("age", () => {
  it("computes the age at the fixed date", async () => {
    const out = await ok(["age", "1990-05-15"]);
    expect(out).toContain("35 years, 8 months, 0 days");
    expect(out).toContain("2026-05-15 (Friday), turning 36, in 120 days");
    expect(await ok(["age", "1990-05-15", "--at", "10000"])).toBe(
      "10000 days old on 2017-09-30 (Saturday)\n",
    );
  });
  it("rejects invalid or future dates", async () => {
    expect(await fails(["age", "1990-13-01"])).toContain("invalid date");
    expect(await fails(["age", "2030-01-01"])).toContain("after");
  });
});

describe("fuel", () => {
  it("computes a trip cost", async () => {
    const out = await ok([
      "fuel",
      "450",
      "--consumption",
      "6.5",
      "--price",
      "1.85",
      "--people",
      "2",
    ]);
    expect(out).toContain("Cost:       54.11");
    expect(await ok(["fuel", "300", "--ev", "--round-trip"])).toContain("Energy:     102 kWh");
    expect(await ok(["fuel", "--liters", "42", "--km", "700"])).toContain("L/100 km: 6");
  });
  it("rejects a zero consumption", async () => {
    expect(await fails(["fuel", "450", "--consumption", "0"])).toContain("consumption");
  });
});

describe("cooking", () => {
  it("converts kitchen units and oven temperatures", async () => {
    expect(await ok(["cooking", "1", "cup", "g", "--ingredient", "flour"])).toBe(
      "1 cup = 125.39 g (flour)\n",
    );
    expect(await ok(["cooking", "--temp", "180"])).toContain("Fahrenheit: 356 °F");
  });
  it("scales a recipe", async () => {
    expect(await ok(["cooking", "--servings", "4:6"], "200 g flour\n1/2 cup milk\n")).toBe(
      "300 g flour\n¾ cup milk\n",
    );
  });
  it("rejects unknown units and ingredients", async () => {
    expect(await fails(["cooking", "1", "bucket", "g"])).toContain("unknown unit");
    expect(await fails(["cooking", "1", "cup", "g", "--ingredient", "gold"])).toContain(
      "unknown ingredient",
    );
  });
});

describe("grades", () => {
  it("averages weighted grades and finds the one needed", async () => {
    expect(await ok(["grades", "15/20 x2; 12; 8/10 x3"])).toContain("Average:      15 / 20");
    expect(await ok(["grades", "12; 9; 14", "--target", "12", "--next-coef", "2"])).toContain(
      "Needed next:  12.5 / 20 (ok)",
    );
    expect(await ok(["grades", "2+; 3; 1-", "--system", "de"])).toContain("Average:       2");
  });
  it("rejects unreadable grades", async () => {
    expect(await fails(["grades", "great"])).toContain("cannot read the grade");
  });
});

describe("eta", () => {
  it("estimates the finish time", async () => {
    const out = await ok(["eta", "--total", "120", "--done", "30", "--elapsed", "2"]);
    expect(out).toContain("Pace:      15 per hour");
    expect(out).toContain("Done at:   2026-01-15T18:00:00.000Z");
    expect(await ok(["eta", "--left", "90", "--speed", "20"])).toContain("Time needed: 4 h 30 min");
  });
  it("finds the pace needed for a deadline", async () => {
    const out = await ok([
      "eta",
      "--total",
      "500",
      "--done",
      "120",
      "--start",
      "2026-01-15T08:00",
      "--deadline",
      "2026-01-16T18:00",
    ]);
    expect(out).toContain("Needed pace: 12.67 per hour");
  });
  it("rejects incomplete or impossible input", async () => {
    await fails(["eta", "--total", "10"], 2);
    expect(await fails(["eta", "--total", "10", "--done", "20", "--elapsed", "1"])).toContain(
      "--done",
    );
  });
});
