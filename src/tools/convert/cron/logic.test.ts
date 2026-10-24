import { describe, expect, it } from "bun:test";
import { describeCron, nextRuns, PRESETS, parseCron } from "./logic";

const FROM = new Date("2024-01-31T12:00:00Z"); // a Wednesday

describe("parseCron", () => {
  it("accepts 5 and 6 fields", () => {
    const five = parseCron("  0  9 * * 1-5 ");
    expect(five.ok && five.expr).toBe("0 9 * * 1-5");
    expect(five.ok && five.fields.map((f) => f.name)).toEqual([
      "minute",
      "hour",
      "dom",
      "month",
      "dow",
    ]);
    const six = parseCron("*/30 * * * * *");
    expect(six.ok && six.fields[0]).toEqual({ name: "second", value: "*/30" });
  });

  it("expands macros", () => {
    const p = parseCron("@daily");
    expect(p.ok && p.expr).toBe("0 0 * * *");
  });

  it("reports empty input, wrong field counts and bad values", () => {
    expect(parseCron("")).toEqual({ ok: false, error: "empty" });
    expect(parseCron("* * *")).toEqual({ ok: false, error: "count", count: 3 });
    expect(parseCron("0 0 0 * * * *")).toEqual({ ok: false, error: "count", count: 7 });
    const bad = parseCron("61 * * * *");
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toBe("syntax");
    expect(parseCron("a b c d e").ok).toBe(false);
  });

  it("has valid presets", () => {
    for (const p of PRESETS) expect(parseCron(p.expr).ok).toBe(true);
  });
});

describe("describeCron", () => {
  it("explains in English and French", () => {
    expect(describeCron("*/5 * * * *", "en")).toBe("Every 5 minutes");
    expect(describeCron("*/5 * * * *", "fr")).toBe("Toutes les 5 minutes");
    expect(describeCron("0 9 * * 1-5", "en")).toBe("At 09:00 AM, Monday through Friday");
    expect(describeCron("0 9 * * 1-5", "fr")).toBe("À 09:00, de lundi à vendredi");
  });

  it("returns null when it cannot", () => {
    expect(describeCron("nope", "en")).toBeNull();
  });
});

describe("nextRuns", () => {
  const iso = (ds: Date[]) => ds.map((d) => d.toISOString());

  it("lists the next runs in UTC", () => {
    expect(iso(nextRuns("*/15 * * * *", 3, FROM, "UTC"))).toEqual([
      "2024-01-31T12:15:00.000Z",
      "2024-01-31T12:30:00.000Z",
      "2024-01-31T12:45:00.000Z",
    ]);
  });

  it("follows the chosen zone, weekdays and DST", () => {
    expect(iso(nextRuns("0 9 * * 1-5", 3, FROM, "Europe/Paris"))).toEqual([
      "2024-02-01T08:00:00.000Z",
      "2024-02-02T08:00:00.000Z",
      "2024-02-05T08:00:00.000Z",
    ]);
    // Across the March DST change, 09:00 in Paris moves from 08:00 to 07:00 UTC.
    const spring = nextRuns("0 9 * * *", 2, new Date("2024-03-30T12:00:00Z"), "Europe/Paris");
    expect(iso(spring)).toEqual(["2024-03-31T07:00:00.000Z", "2024-04-01T07:00:00.000Z"]);
  });

  it("handles seconds and gives 10 runs", () => {
    const runs = nextRuns("*/30 * * * * *", 10, FROM, "UTC");
    expect(runs).toHaveLength(10);
    expect(runs[0]?.toISOString()).toBe("2024-01-31T12:00:30.000Z");
  });

  it("returns nothing for an invalid expression", () => {
    expect(nextRuns("bad", 3, FROM, "UTC")).toEqual([]);
  });
});
