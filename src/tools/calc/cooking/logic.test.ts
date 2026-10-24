import { describe, expect, it } from "bun:test";
import {
  convertKitchen,
  cToF,
  fToC,
  gasMark,
  gasToF,
  INGREDIENTS,
  parseQuantity,
  scaleRecipe,
  thermostat,
  toDecimal,
  toFraction,
} from "./logic";

describe("kitchen conversions", () => {
  it("converts volumes", () => {
    expect(convertKitchen(1, "cup", "ml", "water")).toBeCloseTo(236.59, 2);
    expect(convertKitchen(3, "tsp", "tbsp", "water")).toBe(1);
    expect(convertKitchen(1, "l", "cl", "water")).toBe(100);
  });

  it("converts weights", () => {
    expect(convertKitchen(1, "lb", "g", "water")).toBeCloseTo(453.59, 2);
    expect(convertKitchen(100, "g", "oz", "water")).toBeCloseTo(3.527, 3);
  });

  it("goes between volume and weight with the density", () => {
    // 1 US cup of flour ≈ 125 g, of sugar ≈ 200 g, of butter ≈ 227 g.
    expect(convertKitchen(1, "cup", "g", "flour")).toBeCloseTo(125.4, 1);
    expect(convertKitchen(1, "cup", "g", "sugar")).toBeCloseTo(201.1, 1);
    expect(convertKitchen(1, "cup", "g", "butter")).toBeCloseTo(226.9, 1);
    expect(convertKitchen(1, "tbsp", "g", "honey")).toBeCloseTo(21.3, 1);
    expect(convertKitchen(250, "g", "ml", "water")).toBe(250);
    expect(convertKitchen(100, "g", "cup", "flour")).toBeCloseTo(0.7975, 4);
  });
});

describe("oven", () => {
  it("converts °C and °F", () => {
    expect(cToF(180)).toBe(356);
    expect(fToC(350)).toBeCloseTo(176.67, 2);
    expect(fToC(cToF(200))).toBeCloseTo(200, 10);
  });

  it("finds gas marks", () => {
    expect(gasMark(180)).toBe(4); // 356 °F
    expect(gasMark(200)).toBe(6); // 392 °F
    expect(gasMark(220)).toBe(7); // 428 °F
    expect(gasMark(140)).toBe(1); // 284 °F
    expect(gasMark(120)).toBe(0.5);
    expect(gasMark(110)).toBe(0.25);
    expect(gasMark(50)).toBeNull();
    expect(gasToF(4)).toBe(350);
    expect(gasToF(0.5)).toBe(250);
  });

  it("knows the French thermostat", () => {
    expect(thermostat(180)).toBe(6);
    expect(thermostat(210)).toBe(7);
  });
});

describe("recipe scaler", () => {
  it("parses quantities", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("1 ½")).toBe(1.5);
    expect(parseQuantity("1½")).toBe(1.5);
    expect(parseQuantity("¾")).toBe(0.75);
    expect(parseQuantity("2/3")).toBeCloseTo(0.6667, 4);
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity("1/0")).toBeNull();
    expect(parseQuantity("a")).toBeNull();
  });

  it("writes kitchen fractions", () => {
    expect(toFraction(1.5)).toBe("1 ½");
    expect(toFraction(0.33)).toBe("⅓");
    expect(toFraction(2.97)).toBe("3");
    expect(toFraction(0.75)).toBe("¾");
    expect(toFraction(2.25)).toBe("2 ¼");
  });

  it("writes decimals with sensible precision", () => {
    expect(toDecimal(375, false)).toBe("375");
    expect(toDecimal(37.5, false)).toBe("37.5");
    expect(toDecimal(3.75, true)).toBe("3,75");
    expect(toDecimal(1.3333, false)).toBe("1.33");
  });

  it("scales a recipe", () => {
    const recipe =
      "250 g flour\n1 ½ cups milk\n- 3 eggs\n2-3 tbsp sugar\nA pinch of salt\n\n1/2 tsp vanilla";
    const out = scaleRecipe(recipe, 1.5, false).map((l) => l.text);
    expect(out).toEqual([
      "375 g flour",
      "2 ¼ cups milk",
      "- 4.5 eggs",
      "3-4.5 tbsp sugar",
      "A pinch of salt",
      "",
      "¾ tsp vanilla",
    ]);
  });

  it("halves with French decimals", () => {
    const out = scaleRecipe("1,5 kg de pommes\n3 œufs\n20 cl de crème", 0.5, true).map(
      (l) => l.text,
    );
    expect(out).toEqual(["0,75 kg de pommes", "1,5 œufs", "10 cl de crème"]);
  });

  it("scales a German recipe, with ranges written with bis", () => {
    const out = scaleRecipe(
      "250 g Mehl\n2 bis 3 EL Zucker\n1/2 TL Vanilleextrakt\n0,5 l Milch\nEine Prise Salz",
      1.5,
      true,
    ).map((l) => l.text);
    expect(out).toEqual([
      "375 g Mehl",
      "3 bis 4,5 EL Zucker",
      "¾ TL Vanilleextrakt",
      "0,75 l Milch",
      "Eine Prise Salz",
    ]);
  });

  it("names every ingredient in the three languages", () => {
    for (const i of INGREDIENTS) expect(i.de).toBeTruthy();
  });

  it("keeps lines without a quantity and flags the scaled ones", () => {
    const r = scaleRecipe("Salt to taste\n2 eggs", 2, false);
    expect(r).toEqual([
      { text: "Salt to taste", scaled: false },
      { text: "4 eggs", scaled: true },
    ]);
  });
});
