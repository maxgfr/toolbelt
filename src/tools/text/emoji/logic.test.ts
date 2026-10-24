import { describe, expect, it } from "bun:test";
import { EMOJI_DATA } from "./data";
import {
  buildIndex,
  codePoints,
  fold,
  GROUP_IDS,
  parseCatalog,
  pushRecent,
  search,
  shortcode,
  withTone,
} from "./logic";

const groups = parseCatalog(EMOJI_DATA);
const index = buildIndex(groups);

describe("emoji catalogue", () => {
  it("has every group, in order, with names", () => {
    expect(groups.map((g) => g.id)).toEqual([...GROUP_IDS]);
    const all = groups.flatMap((g) => g.items);
    expect(all.length).toBeGreaterThan(1800);
    expect(all.every((e) => e.e && e.en && e.fr)).toBe(true);
    expect(all.find((e) => e.e === "#️⃣")?.group).toBe("symbols");
  });

  it("parses an empty catalogue", () => {
    expect(parseCatalog("")).toEqual([]);
  });

  it("has French names", () => {
    const grin = groups[0]?.items[0];
    expect(grin?.e).toBe("😀");
    expect(grin?.fr).toBe("visage rieur");
  });

  it("has German names, falling back to English", () => {
    const all = groups.flatMap((g) => g.items);
    expect(all.find((e) => e.e === "😀")?.de).toBe("grinsendes Gesicht");
    expect(all.every((e) => e.de)).toBe(true);
    expect(all.filter((e) => e.de !== e.en).length).toBeGreaterThan(1800);
  });
});

describe("skin tones", () => {
  it("adds the modifier after a single person or hand, replacing VS16", () => {
    expect(withTone("👍", 3)).toBe("👍🏽");
    expect(withTone("✌️", 1)).toBe("✌🏻");
    expect(withTone("🏌️‍♂️", 5)).toBe("🏌🏿‍♂️");
  });

  it("tones each person of a ZWJ sequence but not the handshake between them", () => {
    expect(withTone("👩‍💻", 2)).toBe("👩🏼‍💻");
    expect(withTone("🧑‍🤝‍🧑", 4)).toBe("🧑🏾‍🤝‍🧑🏾");
  });

  it("leaves the emoji alone for tone 0 or out of range", () => {
    expect(withTone("👍", 0)).toBe("👍");
    expect(withTone("👍", 9)).toBe("👍");
    expect(withTone("😀", 3)).toBe("😀");
  });
});

describe("names and code points", () => {
  it("lists code points", () => {
    expect(codePoints("👋🏽")).toBe("U+1F44B U+1F3FD");
    expect(codePoints("©")).toBe("U+00A9");
    expect(codePoints("")).toBe("");
  });

  it("builds shortcode-like names", () => {
    expect(shortcode("thumbs up")).toBe(":thumbs_up:");
    expect(shortcode("piñata")).toBe(":pinata:");
    expect(shortcode("flag: Côte d’Ivoire")).toBe(":flag_cote_d_ivoire:");
  });

  it("folds accents and ligatures", () => {
    expect(fold("Cœur Éclair")).toBe("coeur eclair");
  });
});

describe("search", () => {
  it("returns nothing for an empty query", () => {
    expect(search(index, "  ")).toEqual([]);
  });

  it("ranks exact names first, in English and French", () => {
    expect(search(index, "cat face")[0]?.e).toBe("🐱");
    expect(search(index, "chat")[0]?.e).toBe("🐈");
    expect(search(index, "drapeau france")[0]?.e).toBe("🇫🇷");
  });

  it("finds emojis by German names and keywords, umlauts optional", () => {
    expect(search(index, "Flagge: Deutschland")[0]?.e).toBe("🇩🇪");
    expect(search(index, "rotes herz").map((e) => e.e)).toContain("❤️");
    expect(search(index, "Katzengesicht")[0]?.e).toBe("🐱");
    expect(search(index, "grosse")[0]).toBeDefined();
    expect(search(index, "frohlich").length).toBeGreaterThan(0);
  });

  it("needs every word, as word prefixes, accents optional", () => {
    const red = search(index, "red heart").map((e) => e.e);
    expect(red).toContain("❤️");
    expect(search(index, "coeur").length).toBeGreaterThan(10);
    expect(search(index, "zzqx")).toEqual([]);
  });

  it("finds a pasted emoji", () => {
    expect(search(index, "👍")[0]?.e).toBe("👍");
  });
});

describe("recent", () => {
  it("keeps newest first without duplicates", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b"], "c", 2)).toEqual(["c", "a"]);
  });
});
