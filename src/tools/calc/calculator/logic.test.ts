import { describe, expect, it } from "bun:test";
import { CalcError, calc, evaluateSheet, splitLine } from "./logic";

const code = (f: () => unknown) => {
  try {
    f();
    return "ok";
  } catch (e) {
    return e instanceof CalcError ? e.code : "other";
  }
};

describe("calculator: arithmetic", () => {
  it("respects precedence and parentheses", () => {
    expect(calc("1 + 2 × 3")).toBe(7);
    expect(calc("(1 + 2) * 3")).toBe(9);
    expect(calc("10 ÷ 4")).toBe(2.5);
    expect(calc("2 ^ 3 ^ 2")).toBe(512); // right-associative
    expect(calc("-2^2")).toBe(-4);
    expect(calc("2^-1")).toBe(0.5);
    expect(calc("2**10")).toBe(1024);
    expect(calc("7 − 10")).toBe(-3);
    expect(calc("17 mod 5")).toBe(2);
    expect(calc("5!")).toBe(120);
  });

  it("handles percentages like a desk calculator", () => {
    expect(calc("50%")).toBe(0.5);
    expect(calc("200 + 10%")).toBeCloseTo(220, 10);
    expect(calc("200 - 25%")).toBe(150);
    expect(calc("80 × 15%")).toBeCloseTo(12, 10);
  });

  it("multiplies implicitly", () => {
    expect(calc("2(3 + 4)")).toBe(14);
    expect(calc("(1 + 1)(2 + 3)")).toBe(10);
    expect(calc("2pi")).toBeCloseTo(6.283185307, 8);
    expect(code(() => calc("2 3"))).toBe("syntax");
  });

  it("knows functions and constants", () => {
    expect(calc("sqrt(16)")).toBe(4);
    expect(calc("sqrt 9")).toBe(3);
    expect(calc("sin(30)")).toBeCloseTo(0.5, 12);
    expect(calc("sin(180)")).toBe(0);
    expect(calc("cos(90)")).toBe(0);
    expect(calc("tan(45)")).toBeCloseTo(1, 12);
    expect(calc("sin(pi/2)", { angle: "rad" })).toBe(1);
    expect(calc("asin(1)")).toBe(90);
    expect(calc("log(1000)")).toBeCloseTo(3, 12);
    expect(calc("log(8, 2)")).toBeCloseTo(3, 12);
    expect(calc("ln(e)")).toBe(1);
    expect(calc("abs(-4.5)")).toBe(4.5);
    expect(calc("round(2.5)")).toBe(3);
    expect(calc("round(-2.5)")).toBe(-3);
    expect(calc("round(3.14159, 2)")).toBe(3.14);
    expect(calc("floor(2.7) + ceil(2.1)")).toBe(5);
    expect(calc("min(4, 2, 8) + max(1, 9)")).toBe(11);
    expect(calc("avg(2; 4; 9)")).toBe(5);
    expect(calc("SQRT(4)")).toBe(2);
    expect(calc("π")).toBe(Math.PI);
  });

  it("reads numbers the way people type them", () => {
    expect(calc("1 000 000 / 4")).toBe(250000);
    expect(calc("1,000 + 1")).toBe(1001);
    expect(calc("1'500")).toBe(1500);
    expect(calc("1,5 + 1", { decimalComma: true })).toBe(2.5);
    expect(calc("1 234,5", { decimalComma: true })).toBe(1234.5);
    expect(calc("2.5 * 2", { decimalComma: true })).toBe(5);
    expect(calc("max(1; 2,5)", { decimalComma: true })).toBe(2.5);
    expect(calc("max(1, 2)", { decimalComma: true })).toBe(2);
    expect(calc("19,99 * 3", { decimalComma: true })).toBeCloseTo(59.97, 10);
    expect(calc("2e3")).toBe(2000);
    expect(calc(".5 + .25")).toBe(0.75);
  });

  it("reports errors instead of returning garbage", () => {
    expect(code(() => calc("1 / 0"))).toBe("divZero");
    expect(code(() => calc("sqrt(-1)"))).toBe("domain");
    expect(code(() => calc("(1 + 2"))).toBe("paren");
    expect(code(() => calc("1 + 2)"))).toBe("paren");
    expect(code(() => calc("1 +"))).toBe("syntax");
    expect(code(() => calc("foo + 1"))).toBe("name");
    expect(code(() => calc("1 $ 2"))).toBe("char");
    expect(code(() => calc("round(1, 2, 3)"))).toBe("args");
    expect(code(() => calc("10^400"))).toBe("overflow");
    expect(code(() => calc("tan(90)"))).toBe("domain");
    expect(code(() => calc("(-1)!"))).toBe("domain");
  });
});

describe("calculator: sheets", () => {
  const opts = { angle: "deg", decimalComma: false } as const;

  it("carries variables and ans from line to line", () => {
    const r = evaluateSheet("x = 3\ny = x * 2\nans + 1\n\nx^2", opts);
    expect(r.map((l) => (l.kind === "value" ? l.value : l.kind))).toEqual([3, 6, 7, "blank", 9]);
    expect(r[0]).toMatchObject({ name: "x" });
  });

  it("sums a block with total", () => {
    const r = evaluateSheet("Rent: 800\nFood: 300 # groceries\ntotal\n\n5\nsum", opts);
    expect(r[2]).toMatchObject({ kind: "value", value: 1100 });
    expect(r[5]).toMatchObject({ kind: "value", value: 5 });
    expect(r[0]).toMatchObject({ label: "Rent", value: 800 });
  });

  it("understands German names", () => {
    const de = { angle: "deg", decimalComma: true } as const;
    const r = evaluateSheet("Miete: 850\nEssen: 12,5 × 2\nsumme\nwurzel(16)\nrunden(2,345; 2)", de);
    expect(r[2]).toMatchObject({ kind: "value", value: 875 });
    expect(r[3]).toMatchObject({ kind: "value", value: 4 });
    expect(r[4]).toMatchObject({ kind: "value", value: 2.35 });
    expect(calc("mittel(1; 2; 6)")).toBe(3);
  });

  it("keeps going after an error", () => {
    const r = evaluateSheet("1/0\n2+2\npi = 3", opts);
    expect(r[0]).toMatchObject({ kind: "error", code: "divZero" });
    expect(r[1]).toMatchObject({ kind: "value", value: 4 });
    expect(r[2]).toMatchObject({ kind: "error", code: "reserved" });
  });

  it("handles empty input and comments", () => {
    expect(evaluateSheet("", opts)).toEqual([{ kind: "blank" }]);
    expect(evaluateSheet("// just a note", opts)).toEqual([{ kind: "blank" }]);
  });

  it("splits labels, but not a division by colon", () => {
    expect(splitLine("Loyer : 850")).toEqual({ label: "Loyer", expr: "850" });
    expect(splitLine("10 : 2").label).toBe("");
    expect(calc("10 : 4")).toBe(2.5);
  });
});
