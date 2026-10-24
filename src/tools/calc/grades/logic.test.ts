import { describe, expect, it } from "bun:test";
import { letterGrade, mention, neededGrade, rescale, totalWeight, weightedAverage } from "./logic";

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
