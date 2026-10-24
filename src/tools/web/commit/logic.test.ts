import { describe, expect, it } from "bun:test";
import {
  buildMessage,
  type CommitInput,
  gitCommand,
  header,
  imperativeOf,
  issueRefs,
  validate,
  wrap,
} from "./logic";

const base: CommitInput = {
  type: "feat",
  scope: "",
  description: "add dark mode",
  body: "",
  breaking: false,
  breakingNote: "",
  closes: "",
  footers: "",
};
const codes = (c: Partial<CommitInput>) => validate({ ...base, ...c }).map((i) => i.code);

describe("commit", () => {
  it("writes the header", () => {
    expect(header(base)).toBe("feat: add dark mode");
    expect(header({ ...base, scope: " ui ", breaking: true })).toBe("feat(ui)!: add dark mode");
  });

  it("assembles body and footers", () => {
    const msg = buildMessage({
      ...base,
      type: "fix",
      scope: "api",
      description: "reject empty tokens",
      body: "Tokens made of spaces were accepted.",
      breaking: true,
      breakingNote: "empty tokens now return 401",
      closes: "12, #34",
      footers: "Reviewed-by: Ana",
    });
    expect(msg).toBe(
      "fix(api)!: reject empty tokens\n\nTokens made of spaces were accepted.\n\n" +
        "BREAKING CHANGE: empty tokens now return 401\nCloses #12\nCloses #34\nReviewed-by: Ana",
    );
    expect(buildMessage(base)).toBe("feat: add dark mode");
  });

  it("wraps the body at 72 columns, keeping lists aligned", () => {
    const long = `${"word ".repeat(30).trim()}`;
    const w = wrap(long);
    expect(w.split("\n").every((l) => l.length <= 72)).toBe(true);
    expect(w.replace(/\n/g, " ")).toBe(long);
    const list = wrap(`- ${long}`);
    expect(list.split("\n")[1]).toStartWith("  word");
    expect(wrap("    indented code that is very long ".repeat(4))).toContain("indented");
  });

  it("reads issue references", () => {
    expect(issueRefs("12, #34 org/repo#5")).toEqual(["#12", "#34", "org/repo#5"]);
    expect(issueRefs("  ")).toEqual([]);
  });

  it("quotes the git command, one -m per paragraph", () => {
    expect(gitCommand("feat: add x")).toBe("git commit -m 'feat: add x'");
    expect(gitCommand("fix: don't crash\n\nBody line\n\nCloses #1")).toBe(
      `git commit -m 'fix: don'\\''t crash' -m 'Body line' -m 'Closes #1'`,
    );
    expect(gitCommand("feat: $HOME `x`")).toBe("git commit -m 'feat: $HOME `x`'");
  });

  it("validates the header", () => {
    expect(codes({})).toEqual([]);
    expect(codes({ type: "" })).toContain("noType");
    expect(codes({ type: "new feature" })).toContain("badType");
    expect(codes({ scope: "a(b)" })).toContain("badScope");
    expect(codes({ scope: "two words" })).toContain("badScope");
    expect(codes({ scope: "api, ui" })).toEqual([]);
    expect(codes({ description: " " })).toContain("noDescription");
    expect(codes({ description: "x".repeat(70) })).toContain("headerTooLong");
    expect(codes({ description: "x".repeat(50) })).toEqual(["headerLong"]);
    expect(codes({ description: "Add dark mode." })).toEqual(["capitalized", "period"]);
  });

  it("suggests the imperative mood", () => {
    expect(imperativeOf("added")).toBe("add");
    expect(imperativeOf("Fixes")).toBe("fix");
    expect(imperativeOf("updating")).toBe("update");
    expect(imperativeOf("stopped")).toBe("stop");
    expect(imperativeOf("applied")).toBe("apply");
    expect(imperativeOf("add")).toBeNull();
    expect(imperativeOf("readme")).toBeNull();
    expect(validate({ ...base, description: "added dark mode" })).toContainEqual({
      level: "warning",
      code: "notImperative",
      detail: "add",
    });
  });

  it("checks breaking changes and footers", () => {
    expect(codes({ breaking: true })).toContain("breakingNoNote");
    expect(codes({ footers: "Refs: #7\nReviewed-by: Ana\nSee #3" })).toEqual([]);
    expect(codes({ footers: "just some text" })).toContain("badFooter");
  });
});
