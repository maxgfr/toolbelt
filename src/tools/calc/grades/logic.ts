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

/* German grades: 1 (sehr gut) … 6 (ungenügend), lower is better. */

/** The best and worst German grade (1+ is 0.7 on some report cards, but 1 is the usual best). */
export const DE_BEST = 1;
export const DE_WORST = 6;

/**
 * A German grade as typed: "2", "2,5", "2.3", "2+" (1.7), "2-" or "2−" (2.3). Between 0.7 (1+)
 * and 6; null otherwise.
 */
export function parseGermanGrade(input: string): number | null {
  const m = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*([+\-−]?)\s*$/.exec(input);
  if (!m) return null;
  const base = Number((m[1] ?? "").replace(",", "."));
  if (m[2] && !Number.isInteger(base)) return null;
  const v = m[2] === "+" ? base - 0.3 : m[2] ? base + 0.3 : base;
  const r = Math.round(v * 100) / 100;
  return r >= 0.7 && r <= DE_WORST ? r : null;
}

/** An average cut after the first decimal, as on German report cards: 2.36 → 2.3. */
export function truncate1(n: number): number {
  return Math.floor(n * 10 + 1e-9) / 10;
}

/** The whole grade (1…6) an average stands for: up to x.5 counts for the better grade. */
export function germanBand(avg: number): 1 | 2 | 3 | 4 | 5 | 6 {
  const t = truncate1(avg);
  if (t <= 1.5) return 1;
  if (t <= 2.5) return 2;
  if (t <= 3.5) return 3;
  if (t <= 4.5) return 4;
  if (t <= 5.5) return 5;
  return 6;
}

/**
 * Grade needed on the next exam to keep the average at `target` or better (lower). It is
 * "reached" when even a 6 would do, and "impossible" when it would take better than a 1.
 */
export function neededGermanGrade(grades: Grade[], target: number, coef: number): Needed | null {
  const r = neededGrade(grades, DE_WORST, target, coef);
  if (!r) return null;
  return {
    grade: r.grade,
    status: r.grade >= DE_WORST ? "reached" : r.grade < DE_BEST ? "impossible" : "ok",
  };
}

/** Oberstufe points (0…15) to the whole grade: 13–15 → 1, 10–12 → 2 … 1–3 → 5, 0 → 6. */
export function gradeFromPoints(points: number): 1 | 2 | 3 | 4 | 5 | 6 {
  const p = Math.min(15, Math.max(0, Math.round(points)));
  return (6 - Math.ceil(p / 3)) as 1 | 2 | 3 | 4 | 5 | 6;
}

/** Oberstufe points to the grade with its tendency: 15 → "1+", 14 → "1", 13 → "1−", 0 → "6". */
export function markFromPoints(points: number): string {
  const p = Math.min(15, Math.max(0, Math.round(points)));
  const g = gradeFromPoints(p);
  if (p === 0) return String(g);
  return `${g}${["+", "−", ""][p % 3]}`;
}

/**
 * An average of Oberstufe points as a grade, with the Abitur formula (17 − P) ÷ 3, between 1
 * and 6 (below 1 point it runs on to 6 at 0 points).
 */
export function gradeFromAveragePoints(points: number): number {
  if (points < 1) return 6 - (2 / 3) * Math.max(0, points);
  return Math.min(DE_WORST, Math.max(DE_BEST, (17 - points) / 3));
}

/** A grade (1…6) as Oberstufe points, the inverse of the Abitur formula: 17 − 3 × grade. */
export function pointsFromGrade(grade: number): number {
  return Math.min(15, Math.max(0, 17 - 3 * grade));
}

/** The usual percentage thresholds of the Oberstufe points (95 % → 15 … 20 % → 1); schools vary. */
export const POINTS_TABLE: { points: number; min: number }[] = [
  { points: 15, min: 95 },
  { points: 14, min: 90 },
  { points: 13, min: 85 },
  { points: 12, min: 80 },
  { points: 11, min: 75 },
  { points: 10, min: 70 },
  { points: 9, min: 65 },
  { points: 8, min: 60 },
  { points: 7, min: 55 },
  { points: 6, min: 50 },
  { points: 5, min: 45 },
  { points: 4, min: 40 },
  { points: 3, min: 33 },
  { points: 2, min: 27 },
  { points: 1, min: 20 },
  { points: 0, min: Number.NEGATIVE_INFINITY },
];

/** A percentage to Oberstufe points with the usual table. */
export function pointsFromPercent(percent: number): number {
  const p = Math.round(percent * 100) / 100;
  return POINTS_TABLE.find((x) => p >= x.min)?.points ?? 0;
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
