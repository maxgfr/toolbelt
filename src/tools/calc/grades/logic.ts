/** Weighted grade averages, the grade needed to reach a target, and conversions between scales. */

export interface Grade {
  /** The mark obtained. */
  value: number;
  /** What it was out of (20, 10, 100…). */
  outOf: number;
  /** Coefficient (weight). */
  coef: number;
}

/** Weighted average on `scale` (e.g. /20); grades out of other scales are converted first. */
export function weightedAverage(grades: Grade[], scale: number): number | null {
  let sum = 0;
  let weights = 0;
  for (const g of grades) {
    if (!(g.outOf > 0) || !(g.coef >= 0) || !Number.isFinite(g.value)) continue;
    sum += (g.value / g.outOf) * scale * g.coef;
    weights += g.coef;
  }
  return weights > 0 ? sum / weights : null;
}

/** Sum of the coefficients of the usable grades. */
export function totalWeight(grades: Grade[]): number {
  return grades.reduce(
    (s, g) => (g.outOf > 0 && g.coef >= 0 && Number.isFinite(g.value) ? s + g.coef : s),
    0,
  );
}

export interface Needed {
  /** The grade needed on the next exam, on `scale`. */
  grade: number;
  /** Already reached even with 0; impossible (above the maximum). */
  status: "ok" | "reached" | "impossible";
}

/**
 * Grade needed on an exam of coefficient `coef` to bring the average to `target`:
 * (target × (W + coef) − current × W) ÷ coef.
 */
export function neededGrade(
  grades: Grade[],
  scale: number,
  target: number,
  coef: number,
): Needed | null {
  if (!(coef > 0) || !(scale > 0)) return null;
  const w = totalWeight(grades);
  const avg = weightedAverage(grades, scale) ?? 0;
  const grade = (target * (w + coef) - avg * w) / coef;
  return { grade, status: grade <= 0 ? "reached" : grade > scale ? "impossible" : "ok" };
}

/** A mark on one scale to another, proportionally: 14/20 → 70/100. */
export function rescale(value: number, from: number, to: number): number | null {
  return from > 0 ? (value / from) * to : null;
}

/** US letter grades from a percentage (common 4.0 scale). */
export const LETTERS: { letter: string; min: number; gpa: number }[] = [
  { letter: "A+", min: 97, gpa: 4.0 },
  { letter: "A", min: 93, gpa: 4.0 },
  { letter: "A−", min: 90, gpa: 3.7 },
  { letter: "B+", min: 87, gpa: 3.3 },
  { letter: "B", min: 83, gpa: 3.0 },
  { letter: "B−", min: 80, gpa: 2.7 },
  { letter: "C+", min: 77, gpa: 2.3 },
  { letter: "C", min: 73, gpa: 2.0 },
  { letter: "C−", min: 70, gpa: 1.7 },
  { letter: "D+", min: 67, gpa: 1.3 },
  { letter: "D", min: 63, gpa: 1.0 },
  { letter: "D−", min: 60, gpa: 0.7 },
  { letter: "F", min: Number.NEGATIVE_INFINITY, gpa: 0 },
];

export function letterGrade(percent: number): { letter: string; gpa: number } {
  const p = Math.round(percent * 100) / 100;
  const l =
    LETTERS.find((x) => p >= x.min) ?? (LETTERS[LETTERS.length - 1] as (typeof LETTERS)[number]);
  return { letter: l.letter, gpa: l.gpa };
}

export type Mention = "tb" | "b" | "ab" | "pass" | "fail";

/** French baccalauréat-style honours from a mark out of 20. */
export function mention(on20: number): Mention {
  if (on20 >= 16) return "tb";
  if (on20 >= 14) return "b";
  if (on20 >= 12) return "ab";
  if (on20 >= 10) return "pass";
  return "fail";
}
