import { describe, expect, it } from "bun:test";
import { ENTRIES, entryForType, extensionOf, GROUPS, searchMime, typesForExtension } from "./logic";

describe("mime", () => {
  it("has a clean table", () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(200);
    const types = ENTRIES.map((e) => e.type);
    expect(new Set(types).size).toBe(types.length);
    for (const e of ENTRIES) {
      expect(e.type).toMatch(/^[a-z]+\/[A-Za-z0-9.+_-]+$/);
      expect(GROUPS as readonly string[]).toContain(e.group);
      for (const x of e.extensions) expect(x).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("reads extensions from file names", () => {
    expect(extensionOf("photo.JPG")).toBe("jpg");
    expect(extensionOf(".tar.gz")).toBe("gz");
    expect(extensionOf("png")).toBe("png");
    expect(extensionOf("image/png")).toBe("");
    expect(extensionOf("")).toBe("");
  });

  it("maps extensions to types, the standard one first", () => {
    expect(typesForExtension("json")[0]?.type).toBe("application/json");
    expect(typesForExtension("report.PDF")[0]?.type).toBe("application/pdf");
    expect(typesForExtension("song.wav")[0]?.type).toBe("audio/wav");
    expect(typesForExtension("app.js")[0]?.type).toBe("text/javascript");
    expect(typesForExtension(".docx")[0]?.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(typesForExtension("nothing.qqq")).toEqual([]);
  });

  it("maps types to extensions, ignoring parameters", () => {
    expect(entryForType("image/jpeg")?.extensions[0]).toBe("jpg");
    expect(entryForType("Text/HTML; charset=utf-8")?.extensions).toContain("html");
    expect(entryForType("foo/bar")).toBeUndefined();
  });

  it("searches both ways", () => {
    expect(searchMime(".png")[0]?.type).toBe("image/png");
    expect(searchMime("image/webp")[0]?.type).toBe("image/webp");
    expect(searchMime("mp4").map((e) => e.type)).toContain("video/mp4");
    expect(searchMime("openxml").length).toBeGreaterThanOrEqual(3);
    expect(searchMime("zzzz")).toEqual([]);
    expect(searchMime("", "font").every((e) => e.group === "font")).toBe(true);
    expect(searchMime("").length).toBe(ENTRIES.length);
  });
});
