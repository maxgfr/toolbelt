import { describe, expect, it } from "bun:test";
import { tb } from "../test-utils";

const BROWSER = [
  "stopwatch",
  "timer",
  "pomodoro",
  "typing-test",
  "metronome",
  "tone",
  "tuner",
  "devices",
  "screen-test",
  "tally",
  "signature",
];

describe("browser-only life tools", () => {
  for (const id of BROWSER)
    it(`${id} prints its link`, async () => {
      const r = await tb([id]);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(`https://maxgfr.github.io/toolbelt/#/${id}`);
      const j = await tb([id, "--json"]);
      expect(JSON.parse(j.stdout)).toMatchObject({ tool: id, browserOnly: true });
      const bad = await tb([id, "--bogus"]);
      expect(bad.code).toBe(2);
      expect(bad.stderr).toContain("unknown option");
    });
});

describe("countdown", () => {
  it("counts calendar and working days", async () => {
    const r = await tb(["countdown", "2026-03-01", "--json"]);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.calendarDays).toBe(45);
    expect(j.workingDays).toBe(32);
    expect(j.past).toBe(false);
    const t = await tb(["countdown", "2026-03-01"]);
    expect(t.stdout).toContain("Working days left: 32");
  });
  it("skips holidays and reads MM-DD", async () => {
    const r = await tb([
      "countdown",
      "2026-03-01",
      "--holidays",
      "2026-02-02,2026-02-03",
      "--json",
    ]);
    expect(JSON.parse(r.stdout).workingDays).toBe(30);
    const x = await tb(["countdown", "12-25", "--json"]);
    expect(JSON.parse(x.stdout).date).toBe("2026-12-25");
  });
  it("rejects bad dates", async () => {
    const r = await tb(["countdown", "2026-02-31"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("is not a date");
    const h = await tb(["countdown", "2026-03-01", "--holidays", "soon"]);
    expect(h.code).toBe(1);
  });
});

describe("random", () => {
  it("draws numbers in range, reproducibly", async () => {
    const r = await tb(["random", "--min", "1", "--max", "6", "--count", "5", "--seed", "42"]);
    expect(r.code).toBe(0);
    const n = r.stdout.trim().split("\n").map(Number);
    expect(n).toHaveLength(5);
    for (const x of n) expect(x >= 1 && x <= 6).toBe(true);
    const again = await tb(["random", "--min", "1", "--max", "6", "--count", "5", "--seed", "42"]);
    expect(again.stdout).toBe(r.stdout);
  });
  it("rolls dice with notation", async () => {
    const r = await tb(["random", "4d6kh3+2", "--seed", "3", "--json"]);
    const j = JSON.parse(r.stdout);
    expect(j.total).toBeGreaterThanOrEqual(5);
    expect(j.total).toBeLessThanOrEqual(20);
    expect(j.min).toBe(5);
    const d = await tb(["dice", "2d6", "--seed", "1"]);
    expect(d.stdout).toContain("Range: 2 to 12");
  });
  it("flips coins, picks, shuffles, makes teams", async () => {
    const c = await tb(["random", "coin", "--count", "3", "--seed", "2"]);
    expect(
      c.stdout
        .trim()
        .split("\n")
        .every((x) => x === "heads" || x === "tails"),
    ).toBe(true);
    const p = await tb(["random", "pick", "A", "B", "C", "D", "--count", "2", "--seed", "1"]);
    expect(p.stdout.trim().split("\n")).toHaveLength(2);
    const s = await tb(["random", "shuffle", "--seed", "1"], { stdin: "x\ny\nz\n" });
    expect(s.stdout.trim().split("\n").sort()).toEqual(["x", "y", "z"]);
    const t = await tb([
      "random",
      "teams",
      "A",
      "B",
      "C",
      "D",
      "E",
      "--teams",
      "2",
      "--json",
      "--seed",
      "1",
    ]);
    const teams = JSON.parse(t.stdout) as string[][];
    expect(teams.map((x) => x.length).sort()).toEqual([2, 3]);
  });
  it("draws a Secret Santa that respects exclusions", async () => {
    for (const seed of ["1", "2", "3"]) {
      const r = await tb([
        "random",
        "santa",
        "Alice",
        "Bob",
        "Carol",
        "Dave",
        "-x",
        "Alice,Bob",
        "--seed",
        seed,
        "--json",
      ]);
      const pairs = JSON.parse(r.stdout) as { giver: string; receiver: string }[];
      expect(pairs).toHaveLength(4);
      for (const p of pairs) {
        expect(p.giver).not.toBe(p.receiver);
        expect([p.giver, p.receiver].sort().join()).not.toBe("Alice,Bob");
      }
    }
  });
  it("reports invalid draws", async () => {
    const a = await tb(["random", "dice", "0d6"]);
    expect(a.code).toBe(1);
    expect(a.stderr).toContain("Roll between 1 and 1000 dice");
    const fr = await tb(["random", "dice", "0d6", "--lang", "fr"]);
    expect(fr.stderr).toContain("Lance entre 1 et 1000 dés");
    const u = await tb(["random", "--min", "1", "--max", "3", "--count", "5", "--unique"]);
    expect(u.code).toBe(1);
    const m = await tb(["random", "foo"]);
    expect(m.code).toBe(2);
    const s = await tb(["random", "santa", "Solo"]);
    expect(s.code).toBe(1);
    expect(s.stderr).toContain("at least two");
  });
});
