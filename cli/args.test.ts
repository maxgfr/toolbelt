import { describe, expect, test } from "bun:test";
import { GLOBAL_OPTIONS, parseArgs } from "./args";
import type { OptionSpec } from "./types";

const SPECS: OptionSpec[] = [
  ...GLOBAL_OPTIONS,
  { name: "decode", alias: "d", type: "boolean", desc: "" },
  { name: "count", alias: "n", type: "number", desc: "" },
  { name: "to", type: "string", values: ["a", "b"], desc: "" },
  { name: "set", type: "list", desc: "" },
  { name: "min-length", type: "number", desc: "" },
];

describe("parseArgs", () => {
  test("positionals, booleans, values and aliases", () => {
    const p = parseArgs(["hello", "-d", "--count", "3", "--to=b", "world"], SPECS);
    expect(p.args).toEqual(["hello", "world"]);
    expect(p.opts).toEqual({ decode: true, count: 3, to: "b" });
  });

  test("--no-flag, inline alias values, repeated lists, camelCase names", () => {
    const p = parseArgs(
      ["--no-decode", "-n5", "--set", "a=1", "--set", "b=2", "--minLength", "4"],
      SPECS,
    );
    expect(p.opts).toEqual({ decode: false, count: 5, set: ["a=1", "b=2"], "min-length": 4 });
  });

  test("negative numbers are values; -- ends the options", () => {
    const p = parseArgs(["-5", "--count", "-2", "--", "--decode"], SPECS);
    expect(p.args).toEqual(["-5", "--decode"]);
    expect(p.opts.count).toBe(-2);
  });

  test("errors: unknown option, bad number, value not allowed, missing value", () => {
    expect(() => parseArgs(["--nope"], SPECS)).toThrow(/unknown option --nope/);
    expect(() => parseArgs(["--count", "x"], SPECS)).toThrow(/expects a number/);
    expect(() => parseArgs(["--to", "c"], SPECS)).toThrow(/must be one of: a, b/);
    expect(() => parseArgs(["--count"], SPECS)).toThrow(/needs a value/);
    expect(() => parseArgs(["--decode=maybe"], SPECS)).toThrow(/takes no value/);
  });
});
