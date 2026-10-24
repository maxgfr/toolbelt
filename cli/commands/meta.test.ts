import { describe, expect, test } from "bun:test";
import { tb } from "../test-utils";
import { coerce, readLink } from "./meta";

describe("list", () => {
  test("every tool, or one category, as text or JSON", async () => {
    const all = await tb(["list", "--json"]);
    expect(all.code).toBe(0);
    expect(JSON.parse(all.stdout).length).toBe(139);
    const enc = JSON.parse((await tb(["list", "--category", "encode", "--json"])).stdout);
    expect(enc.every((t: { category: string }) => t.category === "encode")).toBe(true);
    const text = await tb(["list"]);
    expect(text.stdout).toContain("TOOL");
    expect(text.stdout).toMatch(/tuner\s+life\s+browser/);
  });

  test("unknown category", async () => {
    const r = await tb(["list", "--category", "nope"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("must be one of");
  });
});

describe("search", () => {
  test("finds tools in any language", async () => {
    const r = await tb(["search", "mot", "de", "passe"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("password");
  });

  test("no words, no match", async () => {
    expect((await tb(["search"])).code).toBe(2);
    const r = await tb(["search", "zzzqqq"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("No tool matches");
  });
});

describe("info", () => {
  test("title, URL, CLI support", async () => {
    const r = await tb(["info", "counter"]);
    expect(r.stdout).toContain("Character & word counter (counter)");
    expect(r.stdout).toContain("https://maxgfr.github.io/toolbelt/#/counter");
    expect(r.stdout).toContain("CLI:      yes");
    const j = JSON.parse((await tb(["info", "tuner", "--json"])).stdout);
    expect(j).toMatchObject({
      id: "tuner",
      cli: false,
      url: "https://maxgfr.github.io/toolbelt/#/tuner",
    });
  });

  test("localized with --lang", async () => {
    const r = await tb(["info", "counter", "--lang", "fr"]);
    expect(r.stdout).toContain("Compteur de caractères et de mots");
  });

  test("unknown tool", async () => {
    const r = await tb(["info", "nope"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('unknown tool "nope"');
  });
});

describe("link", () => {
  test("no state: the bare URL", async () => {
    const r = await tb(["link", "counter"]);
    expect(r.stdout).toBe("https://maxgfr.github.io/toolbelt/#/counter\n");
  });

  test("--set and --state round-trip through the site's decoder", async () => {
    const r = await tb([
      "link",
      "json",
      "--set",
      'input={"a":1}',
      "--state",
      '{"sort":true}',
      "--set",
      "indent=4",
    ]);
    expect(r.code).toBe(0);
    const url = r.stdout.trim();
    expect(url).toStartWith("https://maxgfr.github.io/toolbelt/#/json?s=");
    expect(await readLink(url)).toEqual({ sort: true, input: '{"a":1}', indent: "4" });
  });

  test("typed values: numbers, booleans, JSON", async () => {
    const r = await tb(["link", "uuid", "--set", "count=3", "--set", "uppercase=true", "--json"]);
    const j = JSON.parse(r.stdout);
    expect(j.state).toEqual({ count: 3, uppercase: true });
    expect(await readLink(j.url)).toEqual({ count: 3, uppercase: true });
  });

  test("errors: unknown key, bad value, bad --state, unknown tool", async () => {
    const k = await tb(["link", "json", "--set", "nope=1"]);
    expect(k.code).toBe(2);
    expect(k.stderr).toContain('"nope" is not a state key of json');
    expect((await tb(["link", "uuid", "--set", "count=many"])).stderr).toContain(
      "expects a number",
    );
    expect((await tb(["link", "json", "--state", "[1]"])).stderr).toContain("JSON object");
    expect((await tb(["link", "nope"])).code).toBe(1);
  });
});

describe("coerce", () => {
  test("follows the key's type", () => {
    expect(coerce("5", { key: "n", type: "number" })).toBe(5);
    expect(coerce("5", { key: "s", type: "string" })).toBe("5");
    expect(coerce("off", { key: "b", type: "boolean" })).toBe(false);
    expect(coerce("[1,2]", { key: "a", type: "array" })).toEqual([1, 2]);
    expect(coerce("hello", undefined)).toBe("hello");
    expect(() => coerce("x", { key: "a", type: "object" })).toThrow(/expects JSON/);
  });
});

describe("help and version", () => {
  test("help lists commands; help <command> details one", async () => {
    expect((await tb(["help"])).stdout).toContain("Global options");
    const r = await tb(["help", "link"]);
    expect(r.stdout).toContain("Usage: toolbelt link <tool>");
    expect((await tb(["help", "nope"])).code).toBe(2);
  });

  test("version", async () => {
    expect((await tb(["version"])).stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect((await tb(["version", "--nope"])).code).toBe(2);
  });
});
