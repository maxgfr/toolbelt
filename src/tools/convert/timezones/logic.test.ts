import { describe, expect, it } from "bun:test";
import { convertZones, isWorkingHour, nowIn, splitDiff } from "./logic";

describe("time zone converter", () => {
  it("converts a time to several zones, with offsets and day shifts", () => {
    const c = convertZones("2024-01-31", "09:00", "Europe/Paris", [
      "America/New_York",
      "Asia/Tokyo",
      "Pacific/Honolulu",
      "UTC",
    ]);
    if (!c.ok) throw new Error("expected ok");
    expect(c.instant.toISOString()).toBe("2024-01-31T08:00:00.000Z");
    expect(c.source).toMatchObject({ time: "09:00", offset: 60, dayShift: 0, diff: 0 });
    const [ny, tokyo, hnl, utc] = c.rows;
    expect(ny).toMatchObject({ date: "2024-01-31", time: "03:00", offset: -300, diff: -360 });
    expect(tokyo).toMatchObject({ date: "2024-01-31", time: "17:00", dayShift: 0, diff: 480 });
    expect(hnl).toMatchObject({ date: "2024-01-30", time: "22:00", dayShift: -1 });
    expect(utc).toMatchObject({ time: "08:00", offset: 0 });
  });

  it("shows the next day when it is already tomorrow there", () => {
    const c = convertZones("2024-01-31", "20:00", "America/Los_Angeles", ["Asia/Kolkata"]);
    expect(c.ok && c.rows[0]).toMatchObject({ date: "2024-02-01", time: "09:30", dayShift: 1 });
  });

  it("follows daylight saving time on each side", () => {
    // 2024-03-15: New York is already on EDT, Paris still on CET.
    const c = convertZones("2024-03-15", "12:00", "America/New_York", ["Europe/Paris"]);
    expect(c.ok && c.rows[0]).toMatchObject({ time: "17:00", diff: 300 });
  });

  it("flags a time skipped by DST", () => {
    const c = convertZones("2024-03-31", "02:30", "Europe/Paris", []);
    expect(c.ok && c.shifted).toBe(true);
    expect(c.ok && c.source.time).toBe("03:30");
  });

  it("rejects bad input and skips unknown target zones", () => {
    expect(convertZones("2024-02-30", "09:00", "UTC", [])).toEqual({ ok: false, error: "date" });
    expect(convertZones("2024-02-01", "9h", "UTC", [])).toEqual({ ok: false, error: "time" });
    expect(convertZones("2024-02-01", "09:00", "Mars/Olympus", [])).toEqual({
      ok: false,
      error: "zone",
    });
    const c = convertZones("2024-02-01", "09:00", "UTC", ["Nope/Nowhere", "Asia/Tokyo"]);
    expect(c.ok && c.rows.map((r) => r.zone)).toEqual(["Asia/Tokyo"]);
  });

  it("gives the current time in a zone", () => {
    expect(nowIn("Asia/Tokyo", new Date("2024-01-31T20:15:00Z"))).toEqual({
      date: "2024-02-01",
      time: "05:15",
    });
  });

  it("splits differences and spots working hours", () => {
    expect(splitDiff(330)).toEqual({ sign: "+", hours: 5, minutes: 30 });
    expect(splitDiff(-60)).toEqual({ sign: "-", hours: 1, minutes: 0 });
    expect(isWorkingHour(10, 3)).toBe(true);
    expect(isWorkingHour(10, 6)).toBe(false);
    expect(isWorkingHour(19, 2)).toBe(false);
  });
});
