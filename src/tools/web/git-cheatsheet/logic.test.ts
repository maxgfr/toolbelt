import { describe, expect, it } from "bun:test";
import { TIPS } from "./data";
import { groupTips, queryTerms, searchTips } from "./logic";

const first = (q: string) => searchTips(q)[0]?.cmd ?? "";

describe("git-cheatsheet — data", () => {
  it("has many tips, every one complete in both languages", () => {
    expect(TIPS.length).toBeGreaterThan(70);
    for (const t of TIPS) {
      expect(t.en && t.fr && t.cmd && t.noteEn && t.noteFr).toBeTruthy();
      expect(t.cmd.trim()).toBe(t.cmd);
    }
  });

  it("flags destructive commands", () => {
    const danger = TIPS.filter((t) => t.danger).map((t) => t.cmd);
    expect(danger.some((c) => c.includes("reset --hard"))).toBe(true);
    expect(danger.some((c) => c.includes("clean -fd"))).toBe(true);
    expect(danger.some((c) => c.includes("branch -D"))).toBe(true);
    // A safe one is not flagged.
    expect(TIPS.find((t) => t.cmd.startsWith("git revert"))?.danger).toBeUndefined();
  });
});

describe("git-cheatsheet — search", () => {
  it("drops filler words and expands synonyms", () => {
    expect(queryTerms("I want to undo my last commit").map((t) => t[0])).toEqual([
      "undo",
      "last",
      "commit",
    ]);
    expect(queryTerms("")).toEqual([]);
    expect(queryTerms("je veux annuler")[0]).toContain("undo");
  });

  it("answers plain-language questions in English and French", () => {
    expect(first("I want to undo my last commit")).toContain("reset --soft HEAD~1");
    expect(first("annuler le dernier commit")).toContain("reset --soft HEAD~1");
    expect(first("rename a branch")).toContain("git branch -m");
    expect(first("renommer une branche")).toContain("git branch -m");
    expect(first("find the commit that introduced a bug")).toContain("git bisect start");
    expect(first("delete remote branch")).toContain("push origin --delete");
    expect(first("recover lost commit")).toContain("git reflog");
    expect(first("stash untracked files")).toContain("stash push");
  });

  it("matches commands and flags too", () => {
    expect(searchTips("--force-with-lease").length).toBeGreaterThan(0);
    expect(searchTips("cherry-pick")[0]?.cmd).toContain("cherry-pick");
  });

  it("filters by group and danger", () => {
    expect(searchTips("", "tags").every((t) => t.group === "tags")).toBe(true);
    expect(searchTips("", "all", true).every((t) => t.danger)).toBe(true);
    expect(searchTips("")).toHaveLength(TIPS.length);
    expect(searchTips("xyzzy plugh")).toEqual([]);
  });

  it("groups results in order", () => {
    const g = groupTips(TIPS);
    expect(g[0]?.group).toBe("setup");
    expect(g.reduce((n, x) => n + x.items.length, 0)).toBe(TIPS.length);
    expect(groupTips([])).toEqual([]);
  });
});
