import { describe, expect, it } from "bun:test";
import {
  type BuilderField,
  buildCron,
  cronToBuilder,
  defaultBuilder,
  describeCron,
  everySpec,
  type FieldSpec,
  fieldToCron,
  nextRuns,
  PRESETS,
  parseCron,
  parseField,
} from "./logic";

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
  it("explains in English, French and German", () => {
    expect(describeCron("*/5 * * * *", "en")).toBe("Every 5 minutes");
    expect(describeCron("*/5 * * * *", "fr")).toBe("Toutes les 5 minutes");
    expect(describeCron("0 9 * * 1-5", "en")).toBe("At 09:00 AM, Monday through Friday");
    expect(describeCron("0 9 * * 1-5", "fr")).toBe("À 09:00, de lundi à vendredi");
    expect(describeCron("*/5 * * * *", "de")).toBe("Alle 5 Minuten");
    expect(describeCron("0 9 * * 1-5", "de")).toBe("Um 09:00, Montag bis Freitag");
    expect(describeCron("0 9 * * 1#2", "de")).toBe("Um 09:00, am zweiten Montag des Monats");
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

describe("builder", () => {
  const spec = (over: Partial<FieldSpec>, f: BuilderField = "minute"): FieldSpec => ({
    ...everySpec(f),
    ...over,
  });

  it("writes each mode", () => {
    expect(fieldToCron("minute", spec({ mode: "every" }))).toBe("*");
    expect(fieldToCron("minute", spec({ mode: "step", step: 15 }))).toBe("*/15");
    expect(fieldToCron("minute", spec({ mode: "step", step: 15, start: 5 }))).toBe("5-59/15");
    expect(fieldToCron("hour", spec({ mode: "specific", values: [17, 9, 9, 12] }, "hour"))).toBe(
      "9,12,17",
    );
    expect(fieldToCron("dow", spec({ mode: "range", from: 1, to: 5 }, "dow"))).toBe("1-5");
    expect(fieldToCron("hour", spec({ mode: "range", from: 18, to: 8, step: 2 }, "hour"))).toBe(
      "8-18/2",
    );
  });

  it("clamps out-of-range numbers and never writes an empty field", () => {
    expect(fieldToCron("minute", spec({ mode: "specific", values: [] }))).toBe("*");
    expect(fieldToCron("minute", spec({ mode: "specific", values: [99, -3] }))).toBe("0,59");
    expect(fieldToCron("minute", spec({ mode: "step", step: 0 }))).toBe("*/1");
    expect(fieldToCron("dom", spec({ mode: "range", from: 0, to: 40 }, "dom"))).toBe("1-31");
    expect(fieldToCron("minute", spec({ mode: "step", step: Number.NaN }))).toBe("*/1");
  });

  it("builds valid expressions", () => {
    expect(buildCron(defaultBuilder())).toBe("0 9 * * 1-5");
    const b = defaultBuilder();
    b.minute = spec({ mode: "step", step: 10 });
    b.hour = spec({ mode: "range", from: 8, to: 18 }, "hour");
    b.month = spec({ mode: "specific", values: [1, 7] }, "month");
    const expr = buildCron(b);
    expect(expr).toBe("*/10 8-18 * 1,7 1-5");
    expect(parseCron(expr).ok).toBe(true);
  });

  it("reads fields back, with names and Sunday as 7", () => {
    expect(parseField("minute", "*")?.mode).toBe("every");
    expect(parseField("minute", "*/5")).toMatchObject({ mode: "step", step: 5, start: 0 });
    expect(parseField("minute", "5-59/15")).toMatchObject({ mode: "step", step: 15, start: 5 });
    expect(parseField("hour", "9-17/2")).toMatchObject({ mode: "range", from: 9, to: 17, step: 2 });
    expect(parseField("dow", "MON-FRI")).toMatchObject({ mode: "range", from: 1, to: 5 });
    expect(parseField("dow", "1-7")).toMatchObject({ mode: "range", from: 1, to: 6 });
    expect(parseField("dow", "7")).toMatchObject({ mode: "specific", values: [0] });
    expect(parseField("month", "jan,jul,3")).toMatchObject({ values: [1, 3, 7] });
    expect(parseField("dom", "1-3,10")).toMatchObject({ mode: "specific", values: [1, 2, 3, 10] });
  });

  it("refuses what the builder cannot show", () => {
    expect(parseField("dom", "L")).toBeNull();
    expect(parseField("dow", "1#2")).toBeNull();
    expect(parseField("minute", "60")).toBeNull();
    expect(parseField("hour", "5-2")).toBeNull();
    expect(parseField("minute", "")).toBeNull();
    expect(cronToBuilder("*/30 * * * * *")).toBeNull();
    expect(cronToBuilder("0 0 L * *")).toBeNull();
    expect(cronToBuilder("nope")).toBeNull();
  });

  it("round-trips expressions and macros", () => {
    for (const e of ["0 9 * * 1-5", "*/15 * * * *", "5-59/20 0,12 1 */3 0", "0 8-18/2 * * *"]) {
      const b = cronToBuilder(e);
      expect(b && buildCron(b)).toBe(e);
    }
    const daily = cronToBuilder("@daily");
    expect(daily && buildCron(daily)).toBe("0 0 * * *");
  });
});
