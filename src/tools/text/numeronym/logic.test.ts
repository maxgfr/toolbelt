import { describe, expect, it } from "bun:test";
import { expand, KNOWN, lookupAll, numeronym, numeronymize } from "./logic";

describe("numeronym", () => {
  it("abbreviates the classic examples", () => {
    expect(numeronym("internationalization")).toBe("i18n");
    expect(numeronym("localization")).toBe("l10n");
    expect(numeronym("accessibility")).toBe("a11y");
    expect(numeronym("Kubernetes")).toBe("K8s");
    expect(numeronym("internationalisation")).toBe("i18n");
  });

  it("leaves short words and respects the minimum length", () => {
    expect(numeronym("cat")).toBe("cat");
    expect(numeronym("tree")).toBe("t2e");
    expect(numeronym("tree", 5)).toBe("tree");
    expect(numeronym("")).toBe("");
  });

  it("counts letters, not UTF-16 units", () => {
    expect(numeronym("été")).toBe("été");
    expect(numeronym("𝒶bcdé")).toBe("𝒶3é");
  });
});

describe("numeronymize", () => {
  it("keeps spacing and punctuation, splits on hyphens and apostrophes", () => {
    expect(
      numeronymize("Internationalization & kebab-case, l'été!", { minLength: 4, lowercase: false }),
    ).toBe("I18n & k3b-c2e, l'été!");
  });

  it("can lowercase and leaves numbers alone", () => {
    expect(numeronymize("Accessibility 2024", { minLength: 4, lowercase: true })).toBe("a11y 2024");
    expect(numeronymize("", { minLength: 4, lowercase: false })).toBe("");
  });
});

describe("expand", () => {
  it("finds known words, case-insensitively", () => {
    expect(expand("a11y").map((k) => k.word)).toEqual(["accessibility"]);
    expect(expand("K8s").map((k) => k.word)).toEqual(["kubernetes"]);
  });

  it("returns every candidate for ambiguous numeronyms", () => {
    expect(expand("c14n").map((k) => k.word)).toEqual(["canonicalization", "containerization"]);
  });

  it("returns nothing for unknown or malformed tokens", () => {
    expect(expand("z9z")).toEqual([]);
    expect(expand("i18")).toEqual([]);
    expect(expand("")).toEqual([]);
  });

  it("has a list whose entries are unique words", () => {
    expect(new Set(KNOWN.map((k) => k.word)).size).toBe(KNOWN.length);
    for (const k of KNOWN) expect(expand(numeronym(k.word))).toContainEqual(k);
    expect(KNOWN.every((k) => k.fr && k.de)).toBe(true);
    expect(expand("a11y")[0]?.de).toBe("Barrierefreiheit");
  });

  it("looks up every numeronym in a text once", () => {
    const r = lookupAll("Ship i18n and a11y, then I18N again; x1y? h2o");
    expect(r.map((x) => x.token)).toEqual(["i18n", "a11y", "x1y", "h2o"]);
    expect(r[0]?.matches[0]?.word).toBe("internationalization");
    expect(r[2]?.matches).toEqual([]);
  });
});
