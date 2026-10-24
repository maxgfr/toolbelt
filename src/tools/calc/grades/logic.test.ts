import { describe, expect, it } from "bun:test";
import {
  germanBand,
  gradeFromAveragePoints,
  gradeFromPoints,
  letterGrade,
  markFromPoints,
  mention,
  neededGermanGrade,
  neededGrade,
  parseGermanGrade,
  pointsFromGrade,
  pointsFromPercent,
  rescale,
  totalWeight,
  truncate1,
  weightedAverage,
} from "./logic";

const g = (value: number, coef = 1, outOf = 20) => ({ value, outOf, coef });

describe("weighted average", () => {
  it("weights by coefficient", () => {
    // (12 × 2 + 15 × 1 + 9 × 3) ÷ 6 = 66 ÷ 6 = 11
    expect(weightedAverage([g(12, 2), g(15, 1), g(9, 3)], 20)).toBe(11);
    expect(weightedAverage([g(10), g(20)], 20)).toBe(15);
  });

  it("converts grades out of other scales", () => {
    // 8/10 = 16/20 and 75/100 = 15/20 → 15.5
    expect(weightedAverage([g(8, 1, 10), g(75, 1, 100)], 20)).toBeCloseTo(15.5, 10);
    expect(weightedAverage([g(16)], 100)).toBe(80);
  });

  it("skips unusable rows and handles empty lists", () => {
    expect(weightedAverage([g(12), g(Number.NaN), g(5, 1, 0)], 20)).toBe(12);
    expect(weightedAverage([], 20)).toBeNull();
    expect(weightedAverage([g(12, 0)], 20)).toBeNull();
    expect(totalWeight([g(12, 2), g(Number.NaN, 5)])).toBe(2);
  });
});

describe("grade needed", () => {
  it("finds the next grade to reach a target", () => {
    // Average 11 over weight 6; target 12 with an exam of coef 2: (12 × 8 − 66) ÷ 2 = 15
    const r = neededGrade([g(12, 2), g(15, 1), g(9, 3)], 20, 12, 2);
    expect(r).toEqual({ grade: 15, status: "ok" });
  });

  it("says when it's already reached or impossible", () => {
    expect(neededGrade([g(18, 3)], 20, 10, 1)?.status).toBe("reached");
    expect(neededGrade([g(4, 3)], 20, 15, 1)?.status).toBe("impossible");
    expect(neededGrade([], 20, 12, 1)).toEqual({ grade: 12, status: "ok" });
    expect(neededGrade([g(10)], 20, 12, 0)).toBeNull();
  });
});

describe("scales", () => {
  it("rescales proportionally", () => {
    expect(rescale(14, 20, 100)).toBe(70);
    expect(rescale(7, 10, 20)).toBe(14);
    expect(rescale(5, 0, 20)).toBeNull();
  });

  it("gives US letters", () => {
    expect(letterGrade(95)).toEqual({ letter: "A", gpa: 4 });
    expect(letterGrade(89.996)).toEqual({ letter: "A−", gpa: 3.7 });
    expect(letterGrade(70)).toEqual({ letter: "C−", gpa: 1.7 });
    expect(letterGrade(12).letter).toBe("F");
  });

  it("gives French honours", () => {
    expect(mention(16)).toBe("tb");
    expect(mention(14.5)).toBe("b");
    expect(mention(12)).toBe("ab");
    expect(mention(10)).toBe("pass");
    expect(mention(9.99)).toBe("fail");
  });
});

describe("German grades", () => {
  const de = (value: number, coef = 1) => ({ value, outOf: 6, coef });

  it("parses grades with tendencies and decimal commas", () => {
    expect(parseGermanGrade("2")).toBe(2);
    expect(parseGermanGrade("2+")).toBe(1.7);
    expect(parseGermanGrade("2-")).toBe(2.3);
    expect(parseGermanGrade("3−")).toBe(3.3);
    expect(parseGermanGrade("1+")).toBe(0.7);
    expect(parseGermanGrade("2,5")).toBe(2.5);
    expect(parseGermanGrade(" 4.3 ")).toBe(4.3);
    expect(parseGermanGrade("6")).toBe(6);
  });

  it("rejects what is not a German grade", () => {
    expect(parseGermanGrade("")).toBeNull();
    expect(parseGermanGrade("7")).toBeNull();
    expect(parseGermanGrade("6-")).toBeNull();
    expect(parseGermanGrade("0")).toBeNull();
    expect(parseGermanGrade("2,5+")).toBeNull();
    expect(parseGermanGrade("gut")).toBeNull();
  });

  it("averages like any weighted mean, lower is better", () => {
    // (1 × 2 + 2.3 × 1 + 3 × 1) ÷ 4 = 1.825
    expect(weightedAverage([de(1, 2), de(2.3), de(3)], 6)).toBeCloseTo(1.825, 10);
  });

  it("cuts averages after the first decimal and names the band", () => {
    expect(truncate1(2.36)).toBe(2.3);
    expect(truncate1(2.3)).toBe(2.3);
    expect(germanBand(1.0)).toBe(1);
    expect(germanBand(1.5)).toBe(1);
    expect(germanBand(1.55)).toBe(1);
    expect(germanBand(1.6)).toBe(2);
    expect(germanBand(3.5)).toBe(3);
    expect(germanBand(4.56)).toBe(4);
    expect(germanBand(4.6)).toBe(5);
    expect(germanBand(5.6)).toBe(6);
  });

  it("finds the grade needed, where lower is better", () => {
    // Average 3 over weight 2; target 2.5 with an exam of coef 1: (2.5 × 3 − 3 × 2) ÷ 1 = 1.5
    const r = neededGermanGrade([de(3), de(3)], 2.5, 1);
    expect(r?.grade).toBeCloseTo(1.5, 10);
    expect(r?.status).toBe("ok");
    expect(neededGermanGrade([de(1, 3)], 3, 1)?.status).toBe("reached");
    expect(neededGermanGrade([de(5, 3)], 2, 1)?.status).toBe("impossible");
    expect(neededGermanGrade([de(2)], 2, 0)).toBeNull();
  });
});

describe("Oberstufe points", () => {
  it("maps points to grades with tendencies", () => {
    expect(markFromPoints(15)).toBe("1+");
    expect(markFromPoints(14)).toBe("1");
    expect(markFromPoints(13)).toBe("1−");
    expect(markFromPoints(10)).toBe("2−");
    expect(markFromPoints(5)).toBe("4");
    expect(markFromPoints(1)).toBe("5−");
    expect(markFromPoints(0)).toBe("6");
    expect(gradeFromPoints(12)).toBe(2);
    expect(gradeFromPoints(4)).toBe(4);
    expect(gradeFromPoints(0)).toBe(6);
  });

  it("turns an average of points into a grade like the Abitur", () => {
    expect(gradeFromAveragePoints(15)).toBe(1);
    expect(gradeFromAveragePoints(14)).toBe(1);
    expect(gradeFromAveragePoints(11)).toBe(2);
    expect(gradeFromAveragePoints(5)).toBe(4);
    expect(gradeFromAveragePoints(1)).toBeCloseTo(16 / 3, 10);
    expect(gradeFromAveragePoints(0)).toBe(6);
    expect(pointsFromGrade(2)).toBe(11);
    expect(pointsFromGrade(1)).toBe(14);
    expect(pointsFromGrade(6)).toBe(0);
  });

  it("converts percentages with the usual table", () => {
    expect(pointsFromPercent(100)).toBe(15);
    expect(pointsFromPercent(95)).toBe(15);
    expect(pointsFromPercent(94.99)).toBe(14);
    expect(pointsFromPercent(70)).toBe(10);
    expect(pointsFromPercent(50)).toBe(6);
    expect(pointsFromPercent(33)).toBe(3);
    expect(pointsFromPercent(19)).toBe(0);
  });
});
