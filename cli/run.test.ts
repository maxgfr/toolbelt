import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lang } from "../src/i18n";
import { errorMessage, resolveLang } from "./run";
import { tb } from "./test-utils";
import { CliError } from "./types";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "toolbelt-cli-"));
  await writeFile(join(dir, "in.txt"), "one two three");
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("run", () => {
  test("no command prints the overview", async () => {
    const r = await tb([]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage: toolbelt <command>");
    expect(r.stdout).toContain("counter");
  });

  test("--version", async () => {
    const r = await tb(["--version"]);
    expect(r.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  test("input from an argument, a file, stdin", async () => {
    expect((await tb(["counter", "a b", "--json"])).stdout).toContain('"words": 2');
    expect((await tb(["counter", "--file", "in.txt", "--json"], { cwd: dir })).stdout).toContain(
      '"words": 3',
    );
    expect((await tb(["counter", "--json"], { stdin: "x y z w" })).stdout).toContain('"words": 4');
    expect((await tb(["counter", "-f", "-", "--json"], { stdin: "x" })).stdout).toContain(
      '"words": 1',
    );
  });

  test("missing input, missing file", async () => {
    const r = await tb(["counter"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("missing input");
    const f = await tb(["counter", "--file", "nope.txt"], { cwd: dir });
    expect(f.code).toBe(1);
    expect(f.stderr).toContain("file not found: nope.txt");
  });

  test("unknown command suggests close ones", async () => {
    const r = await tb(["coun"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Did you mean: counter");
  });

  test("--help on a command", async () => {
    const r = await tb(["case", "--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage: toolbelt case");
    expect(r.stdout).toContain("https://maxgfr.github.io/toolbelt/#/case");
  });

  test("--out writes the output to a file", async () => {
    const r = await tb(["case", "hello world", "--to", "snake", "--out", "out.txt"], { cwd: dir });
    expect(r.stdout).toBe("");
    expect(await readFile(join(dir, "out.txt"), "utf8")).toBe("hello_world\n");
  });

  test("--json without a structured value wraps the text", async () => {
    const r = await tb(["version", "--json"]);
    expect(JSON.parse(r.stdout)).toEqual({ result: expect.stringMatching(/^\d/) });
  });

  test("the language is reset after each run", async () => {
    await tb(["info", "tuner", "--lang", "fr"]);
    expect(lang.value).toBe("en");
  });
});

describe("resolveLang", () => {
  test("flag, then TOOLBELT_LANG / LC_ALL / LANG, then English", () => {
    expect(resolveLang("de", { LANG: "fr_FR.UTF-8" })).toBe("de");
    expect(resolveLang(undefined, { LANG: "fr_FR.UTF-8" })).toBe("fr");
    expect(resolveLang(undefined, { LC_ALL: "de_DE", LANG: "fr_FR" })).toBe("de");
    expect(resolveLang(undefined, { LANG: "C" })).toBe("en");
    expect(resolveLang(undefined, {})).toBe("en");
  });
});

describe("errorMessage", () => {
  test("localizes errors that carry an L10n", () => {
    const e = new CliError({ en: "bad", fr: "mauvais", de: "schlecht" });
    expect(errorMessage(e, "fr")).toBe("mauvais");
    expect(errorMessage(e, "de")).toBe("schlecht");
    expect(errorMessage(new Error("plain"), "fr")).toBe("plain");
  });
});
