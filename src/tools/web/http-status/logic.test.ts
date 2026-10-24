import { describe, expect, it } from "bun:test";
import { STATUSES } from "./data";
import { classOf, findStatus, groupByClass, searchStatuses } from "./logic";

describe("http-status", () => {
  it("has unique, sorted codes in every language", () => {
    const codes = STATUSES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort((a, b) => a - b)).toEqual(codes);
    for (const s of STATUSES) {
      expect(s.name && s.nameFr && s.nameDe && s.en && s.fr && s.de && s.ref).toBeTruthy();
      expect(s.code).toBeGreaterThanOrEqual(100);
      expect(s.code).toBeLessThan(600);
    }
  });

  it("covers the registry's essentials", () => {
    for (const c of [
      100, 101, 103, 200, 201, 204, 206, 301, 302, 304, 307, 308, 400, 401, 403, 404,
    ])
      expect(findStatus(c)).toBeDefined();
    for (const c of [405, 409, 410, 412, 413, 415, 418, 422, 429, 451, 500, 502, 503, 504, 511])
      expect(findStatus(c)).toBeDefined();
    expect(findStatus(306)).toBeUndefined();
    expect(findStatus(422)?.name).toBe("Unprocessable Content");
  });

  it("classifies codes", () => {
    expect(classOf(204)).toBe(2);
    expect(classOf(451)).toBe(4);
  });

  it("searches by code, prefix and class", () => {
    expect(searchStatuses("404").map((s) => s.code)).toEqual([404]);
    expect(searchStatuses("50").map((s) => s.code)).toEqual([
      500, 501, 502, 503, 504, 505, 506, 507, 508,
    ]);
    expect(searchStatuses("3xx").every((s) => classOf(s.code) === 3)).toBe(true);
    expect(searchStatuses("999")).toEqual([]);
  });

  it("searches words in English, French and German, ignoring accents", () => {
    expect(searchStatuses("teapot").map((s) => s.code)).toEqual([418]);
    expect(searchStatuses("theiere").map((s) => s.code)).toEqual([418]);
    expect(searchStatuses("introuvable").map((s) => s.code)).toContain(404);
    expect(searchStatuses("rate limit").map((s) => s.code)).toEqual([429]);
    expect(searchStatuses("Teekanne").map((s) => s.code)).toEqual([418]);
    expect(searchStatuses("nicht gefunden").map((s) => s.code)).toContain(404);
    expect(searchStatuses("interner serverfehler").map((s) => s.code)).toEqual([500]);
  });

  it("filters by class and hides rare codes on request", () => {
    expect(searchStatuses("", 2).every((s) => classOf(s.code) === 2)).toBe(true);
    const common = searchStatuses("", 0, false);
    expect(common.some((s) => s.code === 418)).toBe(false);
    expect(common.some((s) => s.code === 404)).toBe(true);
    // A typed code always shows, rare or not.
    expect(searchStatuses("418", 0, false).map((s) => s.code)).toEqual([418]);
  });

  it("groups by class", () => {
    const g = groupByClass(searchStatuses("redirect"));
    expect(g.map((x) => x.cls)).toEqual([3]);
  });
});
