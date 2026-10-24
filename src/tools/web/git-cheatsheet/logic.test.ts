import { describe, expect, it } from "bun:test";
import { TIPS } from "./data";
import { groupTips, queryTerms, searchTips } from "./logic";

const first = (q: string) => searchTips(q)[0]?.cmd ?? "";

describe("git-cheatsheet — data", () => {
  it("has many tips, every one complete in all three languages", () => {
    expect(TIPS.length).toBeGreaterThan(70);
    for (const t of TIPS) {
      expect(t.en && t.fr && t.de && t.cmd && t.noteEn && t.noteFr && t.noteDe).toBeTruthy();
      expect(t.de).not.toBe(t.en);
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
    expect(queryTerms("ich will den letzten Commit rückgängig machen").map((t) => t[0])).toEqual([
      "letzten",
      "commit",
      "ruckgangig",
    ]);
    expect(queryTerms("Branch löschen")[1]).toContain("delete");
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

  it("answers plain-language questions in German", () => {
    expect(first("letzten Commit rückgängig machen")).toContain("reset --soft HEAD~1");
    expect(first("Ich will meinen letzten Commit rückgängig machen")).toContain(
      "reset --soft HEAD~1",
    );
    expect(first("Branch umbenennen")).toContain("git branch -m");
    expect(first("Branch löschen")).toContain("git branch -d <branch>");
    expect(first("Remote-Branch löschen")).toContain("push origin --delete");
    expect(first("Commit finden, der einen Bug eingeführt hat")).toContain("git bisect start");
    expect(first("verlorenen Commit wiederherstellen")).toContain("git reflog");
    expect(first("nicht versionierte Dateien stashen")).toContain("stash push");
    expect(first("Änderungen an einer Datei verwerfen")).toContain("git restore <file>");
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
