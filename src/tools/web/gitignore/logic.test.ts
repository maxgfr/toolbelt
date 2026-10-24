import { describe, expect, it } from "bun:test";
import { buildGitignore, countPatterns, findTemplate, searchTemplates } from "./logic";
import { TEMPLATES } from "./templates";

describe("gitignore", () => {
  it("has the usual stacks, with unique ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(25);
    for (const id of ["node", "python", "go", "rust", "java", "macos", "vscode", "jetbrains"])
      expect(findTemplate(id)).toBeDefined();
    for (const t of TEMPLATES) expect(countPatterns(t.body)).toBeGreaterThan(0);
  });

  it("is empty with nothing selected", () => {
    expect(buildGitignore([])).toBe("");
    expect(buildGitignore(["nope"], "  \n")).toBe("");
  });

  it("writes one titled section per template", () => {
    const out = buildGitignore(["node", "macos"]);
    expect(out).toStartWith("# --- Node.js ---\n");
    expect(out).toContain("\n# --- macOS ---\n.DS_Store");
    expect(out).toEndWith("\n");
  });

  it("drops patterns already present, and blocks left with only comments", () => {
    const out = buildGitignore(["node", "nextjs", "secrets"]);
    expect(out.split("\n").filter((l) => l === ".env")).toHaveLength(1);
    expect(out.split("\n").filter((l) => l === "!.env.example")).toHaveLength(1);
    const custom = buildGitignore(["linux"], "# Editor\n*~\n\n# Mine\nsecret.txt");
    expect(custom).not.toContain("# Editor");
    expect(custom).toContain("# --- Custom ---\n# Mine\nsecret.txt");
  });

  it("ignores repeated ids", () => {
    expect(buildGitignore(["go", "go"])).toBe(buildGitignore(["go"]));
  });

  it("searches names and aliases", () => {
    expect(searchTemplates("intellij").map((t) => t.id)).toEqual(["jetbrains"]);
    expect(searchTemplates("kotlin").map((t) => t.id)).toContain("gradle");
    expect(searchTemplates("")).toHaveLength(TEMPLATES.length);
  });

  it("counts patterns only", () => {
    expect(countPatterns("# c\n\nfoo\n!bar\n")).toBe(2);
  });
});
