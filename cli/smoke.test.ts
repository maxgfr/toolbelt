/** The committed bundle, run with Node the way an agent runs it. */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const BUNDLE = join(ROOT, "skills/toolbelt/scripts/toolbelt.mjs");
const hasNode = spawnSync("node", ["--version"]).status === 0;
// Run a copy far from node_modules, so a dependency left out of the bundle cannot resolve.
const DIR = mkdtempSync(join(tmpdir(), "toolbelt-smoke-"));
const COPY = join(DIR, "toolbelt.mjs");
if (existsSync(BUNDLE)) copyFileSync(BUNDLE, COPY);
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

function node(args: string[], input?: string) {
  const r = spawnSync("node", [COPY, ...args], {
    cwd: DIR,
    input,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", LANG: "C" },
    timeout: 30_000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe.if(hasNode)("bundle (node skills/toolbelt/scripts/toolbelt.mjs)", () => {
  test("exists, starts with a shebang, has no import of a package", () => {
    expect(existsSync(BUNDLE)).toBe(true);
    const src = readFileSync(BUNDLE, "utf8");
    expect(src.startsWith("#!/usr/bin/env node\n")).toBe(true);
    // Only Node built-ins may be imported: everything else is inlined.
    const specs = [
      ...src.matchAll(
        /(?:^|[;\n])import\s*(?:[\w$*{},\s]+from\s*)?"([^"]+)"|\bimport\("([^"]+)"\)/g,
      ),
    ].map((m) => m[1] ?? m[2]);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs.filter((s) => s && !s.startsWith("node:"))).toEqual([]);
  });

  test("help and version", () => {
    const h = node(["help"]);
    expect(h.code).toBe(0);
    expect(h.stdout).toContain("Usage: toolbelt <command>");
    expect(node(["--version"]).stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("counter from stdin", () => {
    const r = node(["counter", "--json"], "hello wide world\n");
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).words).toBe(3);
  });

  test("hash", () => {
    const r = node(["hash", "abc", "--algo", "sha256"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("diff (inline)", () => {
    const r = node(["diff", "--a", "one\ntwo\n", "--b", "one\nthree\n"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("-two");
    expect(r.stdout).toContain("+three");
  });

  test("json format and an invalid document", () => {
    expect(node(["json", '{"b":1,"a":[1,2]}']).stdout).toContain('"a": [');
    const bad = node(["json", "{nope"]);
    expect(bad.code).toBe(1);
    expect(bad.stderr).toMatch(/error:/);
  });

  test("cron explain", () => {
    const r = node(["cron", "0 9 * * 1-5"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/09:00/);
  });

  test("link round trip", () => {
    const r = node(["link", "counter", "--set", "text=hello"]);
    expect(r.stdout).toMatch(/^https:\/\/maxgfr\.github\.io\/toolbelt\/#\/counter\?s=[\w-]+\n$/);
  });

  test("a browser-only tool prints its link", () => {
    const r = node(["tuner"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("https://maxgfr.github.io/toolbelt/#/tuner");
  });

  test("unknown command", () => {
    const r = node(["nope"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unknown command "nope"');
  });
});
