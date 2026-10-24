import { describe, expect, it } from "bun:test";
import { ceilTo, splitEven, splitUneven } from "./logic";

describe("tip: even split", () => {
  it("adds the tip and splits", () => {
    const r = splitEven({ bill: 84, tipPct: 15, people: 4, roundTo: 0 });
    expect(r?.tip).toBeCloseTo(12.6, 10);
    expect(r?.total).toBeCloseTo(96.6, 10);
    expect(r?.perPerson).toBeCloseTo(24.15, 10);
    expect(r?.rounded).toBeCloseTo(24.15, 10);
  });

  it("rounds each share up", () => {
    const r = splitEven({ bill: 84, tipPct: 15, people: 4, roundTo: 1 });
    expect(r?.rounded).toBe(25);
    expect(r?.roundedTotal).toBe(100);
    expect(r?.actualTip).toBe(16);
    expect(r?.actualTipPct).toBeCloseTo(19.0476, 4);
    expect(splitEven({ bill: 36, tipPct: 0, people: 3, roundTo: 5 })?.rounded).toBe(15);
    expect(splitEven({ bill: 30, tipPct: 0, people: 3, roundTo: 5 })?.rounded).toBe(10);
  });

  it("ignores float noise when rounding up", () => {
    expect(ceilTo(0.1 + 0.2, 0.1)).toBeCloseTo(0.3, 10);
    expect(ceilTo(12.01, 0.5)).toBe(12.5);
    expect(ceilTo(7.3, 0)).toBe(7.3);
  });

  it("refuses nonsense", () => {
    expect(splitEven({ bill: 50, tipPct: 10, people: 0, roundTo: 0 })).toBeNull();
    expect(splitEven({ bill: -1, tipPct: 10, people: 2, roundTo: 0 })).toBeNull();
  });
});

describe("tip: uneven split", () => {
  it("shares unclaimed items equally and the tip in proportion", () => {
    // Bill 100: Ana had 30, Ben 50, 20 shared (10 each). Tip 10 % = 10.
    const r = splitUneven(100, 10, [
      { name: "Ana", own: 30 },
      { name: "Ben", own: 50 },
    ]);
    expect(r?.unclaimed).toBe(20);
    expect(r?.shares[0]).toMatchObject({ shared: 10, total: 44 });
    expect(r?.shares[1]?.tip).toBeCloseTo(6, 10);
    expect(r?.shares[1]?.total).toBeCloseTo(66, 10);
    expect(r?.total).toBeCloseTo(110, 10);
  });

  it("reports over-claimed bills", () => {
    const r = splitUneven(50, 0, [{ name: "", own: 60 }]);
    expect(r?.unclaimed).toBe(-10);
    expect(r?.shares[0]?.total).toBe(60);
  });

  it("splits evenly when nobody claimed anything", () => {
    const r = splitUneven(90, 0, [
      { name: "", own: 0 },
      { name: "", own: 0 },
      { name: "", own: 0 },
    ]);
    expect(r?.shares.map((s) => s.total)).toEqual([30, 30, 30]);
    expect(splitUneven(10, 0, [])).toBeNull();
  });
});
