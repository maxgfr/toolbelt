import { describe, expect, it } from "bun:test";
import {
  bmi,
  bmr,
  category,
  cmToFeetInches,
  dailyCalories,
  feetInchesToCm,
  gaugePosition,
  healthyRange,
  lbToKg,
} from "./logic";

describe("BMI", () => {
  it("computes kg / m²", () => {
    expect(bmi(70, 175)).toBeCloseTo(22.857, 3);
    expect(bmi(95, 180)).toBeCloseTo(29.321, 3);
    expect(bmi(70, 0)).toBeNull();
    expect(bmi(Number.NaN, 170)).toBeNull();
  });

  it("works in imperial units", () => {
    // 160 lb, 5 ft 9 in → 72.57 kg, 175.26 cm → BMI 23.6
    const kg = lbToKg(160);
    const cm = feetInchesToCm(5, 9);
    expect(kg).toBeCloseTo(72.5748, 4);
    expect(cm).toBeCloseTo(175.26, 2);
    expect(bmi(kg, cm)).toBeCloseTo(23.63, 2);
    expect(cmToFeetInches(175.26)).toEqual({ feet: 5, inches: 9 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });

  it("uses the WHO categories (lower bound included)", () => {
    expect(category(18.4)).toBe("under");
    expect(category(18.5)).toBe("normal");
    expect(category(24.99)).toBe("normal");
    expect(category(25)).toBe("over");
    expect(category(30)).toBe("obese1");
    expect(category(35)).toBe("obese2");
    expect(category(52)).toBe("obese3");
  });

  it("gives the healthy weight range", () => {
    const r = healthyRange(175);
    expect(r?.min).toBeCloseTo(56.66, 2);
    expect(r?.max).toBeCloseTo(76.26, 2);
  });

  it("places the gauge", () => {
    expect(gaugePosition(15)).toBe(0);
    expect(gaugePosition(27.5)).toBe(0.5);
    expect(gaugePosition(60)).toBe(1);
  });
});

describe("energy", () => {
  it("uses Mifflin–St Jeor", () => {
    // 10 × 70 + 6.25 × 175 − 5 × 30 + 5 = 1 648.75
    expect(bmr(70, 175, 30, "male")).toBeCloseTo(1648.75, 10);
    // 10 × 60 + 6.25 × 165 − 5 × 40 − 161 = 1 270.25
    expect(bmr(60, 165, 40, "female")).toBeCloseTo(1270.25, 10);
    expect(bmr(60, 165, 0, "female")).toBeNull();
  });

  it("multiplies by the activity factor", () => {
    expect(dailyCalories(1648.75, "sedentary")).toBeCloseTo(1978.5, 10);
    expect(dailyCalories(1648.75, "moderate")).toBeCloseTo(2555.5625, 10);
  });
});
