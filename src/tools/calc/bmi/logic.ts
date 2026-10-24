/**
 * Body mass index with the WHO adult categories, basal metabolic rate (Mifflin–St Jeor),
 * daily energy needs by activity level and the weight range of a "normal" BMI.
 */

export const LB = 0.45359237;
export const INCH = 2.54;

export function lbToKg(lb: number): number {
  return lb * LB;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * INCH;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = cm / INCH;
  let feet = Math.floor(total / 12);
  let inches = Math.round((total - feet * 12) * 10) / 10;
  if (inches >= 12) {
    feet += 1;
    inches -= 12;
  }
  return { feet, inches };
}

/** kg ÷ m²; null when the height is not positive. */
export function bmi(kg: number, cm: number): number | null {
  if (!(kg > 0) || !(cm > 0)) return null;
  const m = cm / 100;
  return kg / (m * m);
}

export type Category = "under" | "normal" | "over" | "obese1" | "obese2" | "obese3";

/** WHO adult classification. */
export const CATEGORIES: { id: Category; min: number; max: number }[] = [
  { id: "under", min: 0, max: 18.5 },
  { id: "normal", min: 18.5, max: 25 },
  { id: "over", min: 25, max: 30 },
  { id: "obese1", min: 30, max: 35 },
  { id: "obese2", min: 35, max: 40 },
  { id: "obese3", min: 40, max: Number.POSITIVE_INFINITY },
];

export function category(value: number): Category {
  return (
    (CATEGORIES.find((c) => value < c.max) ?? CATEGORIES[CATEGORIES.length - 1])?.id ?? "obese3"
  );
}

/** Weights (kg) giving a BMI from 18.5 to 24.9 at this height. */
export function healthyRange(cm: number): { min: number; max: number } | null {
  if (!(cm > 0)) return null;
  const m2 = (cm / 100) ** 2;
  return { min: 18.5 * m2, max: 24.9 * m2 };
}

export type Sex = "male" | "female";

/** Mifflin–St Jeor (1990): 10 × kg + 6.25 × cm − 5 × age + 5 (men) or − 161 (women), kcal/day. */
export function bmr(kg: number, cm: number, age: number, sex: Sex): number | null {
  if (!(kg > 0) || !(cm > 0) || !(age > 0)) return null;
  return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
}

export type Activity = "sedentary" | "light" | "moderate" | "active" | "very";

export const ACTIVITY: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
};

export function dailyCalories(bmrValue: number, activity: Activity): number {
  return bmrValue * ACTIVITY[activity];
}

/** Where a BMI value sits on a 15–40 scale, 0–1, for a gauge. */
export function gaugePosition(value: number, lo = 15, hi = 40): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}
