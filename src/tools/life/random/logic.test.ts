import { describe, expect, test } from "bun:test";
import { cryptoInt, type RandomInt, seededInt } from "../_shared";
import {
  flipCoin,
  makeTeams,
  parseDice,
  parseExclusions,
  parseList,
  pick,
  randomNumbers,
  rollDice,
  sampleDistinct,
  secretSanta,
  shuffle,
} from "./logic";

/** A source that returns the given values in turn (mod max). */
function fixed(...values: number[]): RandomInt {
  let i = 0;
  return (max) => (values[i++ % values.length] as number) % max;
}

function value<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

describe("cryptoInt", () => {
  test("stays in range, covers small ranges, and handles large ones", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const x = cryptoInt(6);
      expect(x >= 0 && x < 6).toBe(true);
      seen.add(x);
    }
    expect(seen.size).toBe(6);
    const big = cryptoInt(2 ** 40 + 3);
    expect(Number.isInteger(big) && big >= 0 && big < 2 ** 40 + 3).toBe(true);
    expect(cryptoInt(1)).toBe(0);
    expect(() => cryptoInt(0)).toThrow();
    expect(() => cryptoInt(1.5)).toThrow();
  });
});

describe("randomNumbers", () => {
  test("integers in [min, max] inclusive", () => {
    const r = value(
      randomNumbers(seededInt(1), { min: 1, max: 6, count: 600, decimals: 0, unique: false }),
    );
    expect(Math.min(...r)).toBe(1);
    expect(Math.max(...r)).toBe(6);
    expect(r.every(Number.isInteger)).toBe(true);
  });
  test("min and max may be swapped; fixed source maps to the grid", () => {
    expect(
      value(randomNumbers(fixed(0, 9), { min: 10, max: 1, count: 2, decimals: 0, unique: false })),
    ).toEqual([1, 10]);
  });
  test("decimals use an even grid", () => {
    const r = value(
      randomNumbers(fixed(0, 5, 10), { min: 0, max: 1, count: 3, decimals: 1, unique: false }),
    );
    expect(r).toEqual([0, 0.5, 1]);
  });
  test("unique values", () => {
    const r = value(
      randomNumbers(seededInt(7), { min: 1, max: 10, count: 10, decimals: 0, unique: true }),
    );
    expect([...r].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(
      randomNumbers(seededInt(7), { min: 1, max: 3, count: 4, decimals: 0, unique: true }).ok,
    ).toBe(false);
  });
  test("errors", () => {
    const base = { min: 0, max: 10, count: 1, decimals: 0, unique: false };
    expect(randomNumbers(seededInt(1), { ...base, count: 0 }).ok).toBe(false);
    expect(randomNumbers(seededInt(1), { ...base, min: Number.NaN }).ok).toBe(false);
    expect(randomNumbers(seededInt(1), { ...base, min: 0.2, max: 0.8 }).ok).toBe(false);
    expect(randomNumbers(seededInt(1), { ...base, min: -1e300, max: 1e300 }).ok).toBe(false);
  });
  test("sampleDistinct returns distinct values in range", () => {
    const r = sampleDistinct(seededInt(3), 1_000_000, 50);
    expect(new Set(r).size).toBe(50);
    expect(r.every((x) => x >= 0 && x < 1_000_000)).toBe(true);
  });
});

describe("dice", () => {
  test("parses notation", () => {
    const t = value(parseDice("2d6 + d20 - 1"));
    expect(t.map((x) => [x.sign, x.count, x.sides])).toEqual([
      [1, 2, 6],
      [1, 1, 20],
      [-1, 0, 1],
    ]);
    expect(value(parseDice("D%"))[0]?.sides).toBe(100);
    expect(value(parseDice("4d6kh3"))[0]?.keep).toEqual({ which: "h", n: 3 });
    expect(value(parseDice("2d20kl1"))[0]?.keep).toEqual({ which: "l", n: 1 });
    expect(value(parseDice("4d6k3"))[0]?.keep).toEqual({ which: "h", n: 3 });
  });
  test.each(["", "abc", "2d", "d1", "0d6", "2d6+", "5", "1001d6", "2d6kh3", "3d6 4"])(
    "rejects %p",
    (s) => {
      expect(parseDice(s).ok).toBe(false);
    },
  );
  test("rolls with a fixed source", () => {
    // rand(6) → 2, 5 → dice 3 and 6; then +1.
    const r = rollDice(fixed(2, 5), value(parseDice("2d6+1")));
    expect(r.terms[0]?.rolls).toEqual([3, 6]);
    expect(r.total).toBe(10);
    expect([r.min, r.max]).toEqual([3, 13]);
    expect(r.notation).toBe("2d6 + 1");
  });
  test("keep highest drops the lowest dice", () => {
    const r = rollDice(fixed(0, 5, 3, 1), value(parseDice("4d6kh3")));
    expect(r.terms[0]?.rolls).toEqual([1, 6, 4, 2]);
    expect(r.terms[0]?.kept).toEqual([false, true, true, true]);
    expect(r.total).toBe(12);
    expect([r.min, r.max]).toEqual([3, 18]);
  });
  test("negative dice terms", () => {
    const r = rollDice(fixed(3), value(parseDice("-1d6")));
    expect(r.total).toBe(-4);
    expect([r.min, r.max]).toEqual([-6, -1]);
  });
  test("every face shows up", () => {
    const rand = seededInt(42);
    const faces = new Set<number>();
    for (let i = 0; i < 400; i++) faces.add(rollDice(rand, value(parseDice("d20"))).total);
    expect(faces.size).toBe(20);
  });
});

describe("coins and lists", () => {
  test("coin", () => {
    expect(flipCoin(fixed(0))).toBe("heads");
    expect(flipCoin(fixed(1))).toBe("tails");
  });
  test("parseList trims and drops blanks", () => {
    expect(parseList(" a \n\n b\r\nc ")).toEqual(["a", "b", "c"]);
  });
  test("shuffle is a permutation and does not mutate", () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(seededInt(9), src);
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  test("shuffle is roughly uniform over 3 items", () => {
    const rand = seededInt(5);
    const counts = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      const k = shuffle(rand, ["a", "b", "c"]).join("");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const c of counts.values()) expect(Math.abs(c - 1000)).toBeLessThan(150);
  });
  test("pick: distinct winners, errors", () => {
    const w = value(pick(seededInt(2), ["a", "b", "c", "d"], 3));
    expect(new Set(w).size).toBe(3);
    expect(value(pick(fixed(2), ["a", "b", "c"], 1))).toEqual(["c"]);
    expect(pick(seededInt(2), [], 1).ok).toBe(false);
    expect(pick(seededInt(2), ["a"], 2).ok).toBe(false);
  });
  test("teams are balanced", () => {
    const names = "abcdefghij".split("");
    const t = value(makeTeams(seededInt(4), names, 3));
    expect(t.map((x) => x.length).sort()).toEqual([3, 3, 4]);
    expect(t.flat().sort()).toEqual(names);
    const bySize = value(makeTeams(seededInt(4), names, 5, "size"));
    expect(bySize.map((x) => x.length)).toEqual([5, 5]);
    expect(makeTeams(seededInt(4), ["a", "b"], 3).ok).toBe(false);
  });
});

describe("secret santa", () => {
  const names = ["Alice", "Bob", "Chloé", "David", "Emma"];
  test("everyone gives and receives once, never to themselves", () => {
    for (let seed = 0; seed < 50; seed++) {
      const pairs = value(secretSanta(seededInt(seed), names));
      expect(pairs.map((p) => p.giver)).toEqual(names);
      expect([...pairs.map((p) => p.receiver)].sort()).toEqual([...names].sort());
      expect(pairs.every((p) => p.giver !== p.receiver)).toBe(true);
    }
  });
  test("exclusions are respected", () => {
    const ex = parseExclusions("Alice, Bob\nChloé > David");
    expect(ex).toEqual([
      { from: "Alice", to: "Bob" },
      { from: "Bob", to: "Alice" },
      { from: "Chloé", to: "David" },
    ]);
    for (let seed = 0; seed < 50; seed++) {
      const pairs = value(secretSanta(seededInt(seed), names, ex));
      const to = new Map(pairs.map((p) => [p.giver, p.receiver]));
      expect(to.get("Alice")).not.toBe("Bob");
      expect(to.get("Bob")).not.toBe("Alice");
      expect(to.get("Chloé")).not.toBe("David");
    }
  });
  test("tight rules use the fallback; impossible ones fail", () => {
    // Only A→B→C→A (or the reverse) is possible once A cannot give to C.
    const r = value(secretSanta(fixed(0), ["A", "B", "C"], [{ from: "A", to: "C" }]));
    expect(r).toEqual([
      { giver: "A", receiver: "B" },
      { giver: "B", receiver: "C" },
      { giver: "C", receiver: "A" },
    ]);
    expect(secretSanta(seededInt(1), ["A", "B"], parseExclusions("A, B")).ok).toBe(false);
  });
  test("duplicates and too few people", () => {
    expect(secretSanta(seededInt(1), ["A", "a"]).ok).toBe(false);
    expect(secretSanta(seededInt(1), ["A"]).ok).toBe(false);
  });
});
