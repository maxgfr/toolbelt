import { describe, expect, it } from "bun:test";
import { type LoremOptions, lorem } from "./logic";

const O: LoremOptions = {
  unit: "paragraphs",
  count: 3,
  startWithLorem: true,
  html: false,
  seed: 1,
};

describe("lorem", () => {
  it("makes the requested number of paragraphs, starting with Lorem ipsum", () => {
    const t = lorem(O);
    expect(t.split("\n\n").length).toBe(3);
    expect(t.startsWith("Lorem ipsum dolor sit amet, consectetur adipiscing elit.")).toBe(true);
  });

  it("makes exactly n words and n sentences", () => {
    const w = lorem({ ...O, unit: "words", count: 12 });
    expect(w.split(" ").length).toBe(12);
    expect(w.startsWith("Lorem ipsum dolor")).toBe(true);
    expect(w.endsWith(".")).toBe(true);
    expect(lorem({ ...O, unit: "words", count: 3 })).toBe("Lorem ipsum dolor.");
    const s = lorem({ ...O, unit: "sentences", count: 5, startWithLorem: false });
    expect(s.match(/\./g)?.length).toBe(5);
    expect(s.startsWith("Lorem ipsum")).toBe(false);
  });

  it("is deterministic for a seed and changes with it", () => {
    expect(lorem({ ...O, startWithLorem: false })).toBe(lorem({ ...O, startWithLorem: false }));
    expect(lorem({ ...O, seed: 2 })).not.toBe(lorem(O));
  });

  it("wraps paragraphs in <p> for HTML", () => {
    const h = lorem({ ...O, html: true, count: 2 });
    expect(h.split("\n").every((p) => p.startsWith("<p>") && p.endsWith("</p>"))).toBe(true);
  });

  it("clamps the count", () => {
    expect(lorem({ ...O, count: 0 })).toBe("");
    expect(lorem({ ...O, count: -4 })).toBe("");
    expect(lorem({ ...O, count: 1e9 }).split("\n\n").length).toBe(100);
  });
});
