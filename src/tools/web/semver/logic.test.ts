import { describe, expect, it } from "bun:test";
import {
  compare,
  diff,
  format,
  formatRange,
  inc,
  maxSatisfying,
  parse,
  parseRange,
  type Release,
  type SemVer,
  satisfies,
  validPreId,
} from "./logic";

const v = (s: string): SemVer => {
  const r = parse(s);
  if (!r) throw new Error(`bad version ${s}`);
  return r;
};
const sat = (ver: string, range: string, incPr = false) => {
  const r = parseRange(range, incPr);
  if (!r) throw new Error(`bad range ${range}`);
  return satisfies(v(ver), r, incPr);
};
const norm = (range: string, incPr = false) => {
  const r = parseRange(range, incPr);
  return r ? formatRange(r) : null;
};

describe("semver — parse & compare", () => {
  it("parses strict versions", () => {
    expect(v("1.2.3-beta.1+build.5")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ["beta", 1],
      build: ["build", "5"],
    });
    expect(format(v("v1.0.0"))).toBe("1.0.0");
    expect(format(v("=1.0.0-rc.1+abc"), true)).toBe("1.0.0-rc.1+abc");
    for (const bad of [
      "",
      "1",
      "1.2",
      "01.2.3",
      "1.2.3-",
      "1.2.3-01",
      "1.2.3+",
      "a.b.c",
      "1.2.3.4",
    ])
      expect(parse(bad)).toBeNull();
  });

  it("orders versions by the SemVer 2.0.0 precedence", () => {
    const order = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1",
      "1.1.0",
      "2.0.0",
    ];
    for (let i = 0; i < order.length - 1; i++)
      expect(compare(v(order[i] ?? ""), v(order[i + 1] ?? ""))).toBe(-1);
    expect(compare(v("1.0.0+a"), v("1.0.0+b"))).toBe(0);
    expect(compare(v("10.0.0"), v("9.0.0"))).toBe(1);
  });

  it("says which part differs", () => {
    expect(diff(v("1.2.3"), v("2.0.0"))).toBe("major");
    expect(diff(v("1.2.3"), v("1.3.0"))).toBe("minor");
    expect(diff(v("1.2.3"), v("1.2.4"))).toBe("patch");
    expect(diff(v("1.2.3-a"), v("1.2.3"))).toBe("prerelease");
    expect(diff(v("1.2.3+a"), v("1.2.3+b"))).toBe("build");
    expect(diff(v("1.2.3"), v("1.2.3"))).toBeNull();
  });
});

describe("semver — ranges (node-semver semantics)", () => {
  it("desugars like node-semver", () => {
    expect(norm("^1.2.3")).toBe(">=1.2.3 <2.0.0-0");
    expect(norm("^0.2.3")).toBe(">=0.2.3 <0.3.0-0");
    expect(norm("^0.0.3")).toBe(">=0.0.3 <0.0.4-0");
    expect(norm("^1.2.x")).toBe(">=1.2.0 <2.0.0-0");
    expect(norm("^0.0.x")).toBe(">=0.0.0 <0.1.0-0");
    expect(norm("^0.x")).toBe(">=0.0.0 <1.0.0-0");
    expect(norm("~1.2.3")).toBe(">=1.2.3 <1.3.0-0");
    expect(norm("~1.2")).toBe(">=1.2.0 <1.3.0-0");
    expect(norm("~1")).toBe(">=1.0.0 <2.0.0-0");
    expect(norm("~> 1.2.3-beta.2")).toBe(">=1.2.3-beta.2 <1.3.0-0");
    expect(norm("1.x")).toBe(">=1.0.0 <2.0.0-0");
    expect(norm("1.2")).toBe(">=1.2.0 <1.3.0-0");
    expect(norm("*")).toBe("*");
    expect(norm("")).toBe("*");
    expect(norm(">1")).toBe(">=2.0.0");
    expect(norm(">1.2")).toBe(">=1.3.0");
    expect(norm("<=1.2")).toBe("<1.3.0-0");
    expect(norm("<1.2")).toBe("<1.2.0-0");
    expect(norm(">= 1.2.3")).toBe(">=1.2.3");
    expect(norm("=1.2.3")).toBe("1.2.3");
    expect(norm("1.2.3 - 2.3.4")).toBe(">=1.2.3 <=2.3.4");
    expect(norm("1.2 - 2.3.4")).toBe(">=1.2.0 <=2.3.4");
    expect(norm("1.2.3 - 2.3")).toBe(">=1.2.3 <2.4.0-0");
    expect(norm("1.2.3 - 2")).toBe(">=1.2.3 <3.0.0-0");
    expect(norm("<*")).toBe("<0.0.0-0");
    expect(norm("1.x || >=2.5.0 || 5.0.0 - 7.2.3")).toBe(
      ">=1.0.0 <2.0.0-0 || >=2.5.0 || >=5.0.0 <=7.2.3",
    );
  });

  it("adds -0 lower bounds when prereleases are included", () => {
    expect(norm("1.x", true)).toBe(">=1.0.0-0 <2.0.0-0");
    expect(norm("^0.2.3", true)).toBe(">=0.2.3-0 <0.3.0-0");
    expect(norm("1.2.3 - 2.3.4", true)).toBe(">=1.2.3-0 <2.3.5-0");
  });

  it("rejects invalid ranges", () => {
    for (const bad of ["^a.b", "1.2.3.4", ">=foo", "~1.2.3 - 2", "1.2.3 -"])
      expect(parseRange(bad)).toBeNull();
  });

  it("tests versions against ranges", () => {
    expect(sat("1.9.9", "^1.2.3")).toBe(true);
    expect(sat("2.0.0", "^1.2.3")).toBe(false);
    expect(sat("1.2.2", "^1.2.3")).toBe(false);
    expect(sat("0.2.9", "^0.2.3")).toBe(true);
    expect(sat("0.3.0", "^0.2.3")).toBe(false);
    expect(sat("1.2.9", "~1.2.3")).toBe(true);
    expect(sat("1.3.0", "~1.2.3")).toBe(false);
    expect(sat("3.0.0", "1.x || >=2.5.0")).toBe(true);
    expect(sat("2.4.0", "1.x || >=2.5.0")).toBe(false);
    expect(sat("2.3.4", "1.2.3 - 2.3.4")).toBe(true);
    expect(sat("2.3.5", "1.2.3 - 2.3.4")).toBe(false);
    expect(sat("1.5.0", ">=1.2.0 <1.6.0")).toBe(true);
    expect(sat("1.0.0", "*")).toBe(true);
    expect(sat("1.0.0", "<*")).toBe(false);
  });

  it("applies the prerelease rule", () => {
    expect(sat("1.2.3-beta.4", "^1.2.3-beta.2")).toBe(true);
    expect(sat("1.2.4-beta.0", "^1.2.3-beta.2")).toBe(false);
    expect(sat("3.4.5-alpha.9", ">1.2.3-alpha.3")).toBe(false);
    expect(sat("1.2.3-alpha.7", ">1.2.3-alpha.3")).toBe(true);
    expect(sat("2.0.0-alpha", "^1.2.3")).toBe(false);
    expect(sat("1.5.0-beta", "^1.2.3")).toBe(false);
    expect(sat("1.5.0-beta", "^1.2.3", true)).toBe(true);
    expect(sat("1.0.0-beta", "*")).toBe(false);
    expect(sat("1.0.0-beta", "*", true)).toBe(true);
  });

  it("finds the highest satisfying version", () => {
    const list = ["1.2.3", "1.4.0", "2.0.0", "1.5.0-rc.1"].map(v);
    const r = parseRange("^1.2.0");
    if (!r) throw new Error();
    expect(format(maxSatisfying(list, r) ?? v("0.0.0"))).toBe("1.4.0");
    expect(format(maxSatisfying(list, r, true) ?? v("0.0.0"))).toBe("1.5.0-rc.1");
    const none = parseRange(">=3");
    expect(none && maxSatisfying(list, none)).toBeNull();
  });
});

describe("semver — bumps", () => {
  const bump = (s: string, r: Release, id = "") => format(inc(v(s), r, id));
  it("bumps like npm version", () => {
    expect(bump("1.2.3", "major")).toBe("2.0.0");
    expect(bump("1.2.3", "minor")).toBe("1.3.0");
    expect(bump("1.2.3", "patch")).toBe("1.2.4");
    expect(bump("1.0.0-rc.1", "major")).toBe("1.0.0");
    expect(bump("1.2.0-rc.1", "minor")).toBe("1.2.0");
    expect(bump("1.2.3-rc.1", "patch")).toBe("1.2.3");
    expect(bump("1.2.3+build", "patch")).toBe("1.2.4");
  });

  it("bumps prereleases", () => {
    expect(bump("1.2.3", "prerelease")).toBe("1.2.4-0");
    expect(bump("1.2.3", "prerelease", "beta")).toBe("1.2.4-beta.0");
    expect(bump("1.2.4-beta.0", "prerelease", "beta")).toBe("1.2.4-beta.1");
    expect(bump("1.2.4-beta.1", "prerelease", "rc")).toBe("1.2.4-rc.0");
    expect(bump("1.2.4-beta", "prerelease")).toBe("1.2.4-beta.0");
    expect(bump("1.2.4-alpha.1.b", "prerelease")).toBe("1.2.4-alpha.2.b");
    expect(bump("1.2.3", "premajor", "alpha")).toBe("2.0.0-alpha.0");
    expect(bump("1.2.3", "preminor")).toBe("1.3.0-0");
    expect(bump("1.2.3", "prepatch", "rc")).toBe("1.2.4-rc.0");
  });

  it("validates prerelease identifiers", () => {
    expect(validPreId("beta")).toBe(true);
    expect(validPreId("")).toBe(true);
    expect(validPreId("01")).toBe(false);
    expect(validPreId("be ta")).toBe(false);
  });
});
