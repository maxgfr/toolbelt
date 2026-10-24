import { describe, expect, it } from "bun:test";
import { DEFAULTS, slugify, slugifyLines } from "./logic";

describe("slugify", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("Crème brûlée à l'été !", DEFAULTS)).toBe("creme-brulee-a-lete");
    expect(slugify("  Hello,   World!  ", DEFAULTS)).toBe("hello-world");
    expect(slugify("Straße Œuvre Søren Łódź", DEFAULTS)).toBe("strasse-oeuvre-soren-lodz");
  });

  it("uses the chosen separator and case", () => {
    expect(slugify("My Blog Post", { ...DEFAULTS, separator: "_" })).toBe("my_blog_post");
    expect(slugify("My Blog Post", { ...DEFAULTS, lowercase: false })).toBe("My-Blog-Post");
    expect(slugify("My Blog Post", { ...DEFAULTS, separator: "" })).toBe("myblogpost");
  });

  it("cuts at a word boundary under the maximum length", () => {
    expect(slugify("the quick brown fox", { ...DEFAULTS, maxLength: 12 })).toBe("the-quick");
    expect(slugify("supercalifragilistic", { ...DEFAULTS, maxLength: 5 })).toBe("super");
  });

  it("keeps or drops non-Latin letters", () => {
    expect(slugify("Привет мир", DEFAULTS)).toBe("");
    expect(slugify("Привет мир", { ...DEFAULTS, asciiOnly: false })).toBe("привет-мир");
    expect(slugify("１２３ ＡＢＣ", DEFAULTS)).toBe("123-abc");
  });

  it("slugs each line and skips empty ones", () => {
    expect(slugifyLines("First post\n\nSecond post\n", DEFAULTS)).toBe("first-post\nsecond-post");
    expect(slugifyLines("", DEFAULTS)).toBe("");
  });
});
