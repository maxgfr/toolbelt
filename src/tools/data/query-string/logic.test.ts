import { describe, expect, it } from "bun:test";
import { extractQuery, keyPath, parseQuery, toQuery } from "./logic";

const flat = { plus: true, brackets: false };
const nested = { plus: true, brackets: true };

describe("query-string", () => {
  it("extracts the query from a URL", () => {
    expect(extractQuery("https://x.io/p?a=1&b=2#top")).toBe("a=1&b=2");
    expect(extractQuery("?a=1")).toBe("a=1");
    expect(extractQuery("/search?q=x")).toBe("q=x");
    expect(extractQuery("https://x.io/p")).toBe("");
    expect(extractQuery("a=1&b=what?")).toBe("a=1&b=what?");
  });

  it("decodes, with repeated keys as arrays", () => {
    const r = parseQuery("?q=caf%C3%A9+au+lait&tag=a&tag=b&tag=c&empty=&flag", flat);
    expect(r.value).toEqual({ q: "café au lait", tag: ["a", "b", "c"], empty: "", flag: "" });
    expect(r.pairs[0]).toEqual({ key: "q", value: "café au lait" });
    expect(parseQuery("a=1+2", { plus: false, brackets: false }).value).toEqual({ a: "1+2" });
    expect(parseQuery("a[b]=1", flat).value).toEqual({ "a[b]": "1" });
  });

  it("nests bracket keys into objects and arrays", () => {
    expect(
      parseQuery("user[name]=Ann&user[roles][]=admin&user[roles][]=dev&ids[1]=b&ids[0]=a", nested)
        .value,
    ).toEqual({ user: { name: "Ann", roles: ["admin", "dev"] }, ids: ["a", "b"] });
    expect(parseQuery("a[0][x]=1&a[0][y]=2&a[1][x]=3", nested).value).toEqual({
      a: [{ x: "1", y: "2" }, { x: "3" }],
    });
    expect(parseQuery("a%5Bb%5D=1", nested).value).toEqual({ a: { b: "1" } });
    expect(keyPath("a[b][]")).toEqual(["a", "b", ""]);
    expect(keyPath("[x]")).toEqual(["[x]"]);
    expect(keyPath("a[b")).toEqual(["a[b"]);
  });

  it("reports broken encoding and conflicts without throwing", () => {
    const r = parseQuery("a=%E0%A4%A&b=1&b[c]=2", nested);
    expect(r.badEncoding).toEqual(["%E0%A4%A"]);
    expect(r.value.a).toBe("%E0%A4%A");
    expect(r.conflicts).toEqual(["b[c]"]);
    expect(r.value.b).toEqual({ c: "2" });
    expect(parseQuery("", flat).value).toEqual({});
  });

  it("can infer types", () => {
    expect(parseQuery("n=42&ok=true&z=007&x=null&e=", { ...flat, infer: true }).value).toEqual({
      n: 42,
      ok: true,
      z: "007",
      x: null,
      e: "",
    });
  });

  it("is safe with __proto__", () => {
    const r = parseQuery("__proto__[polluted]=1&a=1", nested);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(r.value)).toEqual(["__proto__", "a"]);
  });

  it("encodes JSON as a query string", () => {
    const v = { q: "café au lait", tags: ["a", "b"], user: { name: "A&B" }, n: 1, none: null };
    expect(toQuery(v, flat)).toEqual({
      ok: true,
      text: "q=caf%C3%A9+au+lait&tags=a&tags=b&user=%7B%22name%22%3A%22A%26B%22%7D&n=1&none=",
    });
    expect(toQuery(v, { plus: false, brackets: true })).toEqual({
      ok: true,
      text: "q=caf%C3%A9%20au%20lait&tags[]=a&tags[]=b&user[name]=A%26B&n=1&none=",
    });
    expect(toQuery([1], flat)).toEqual({ ok: false });
  });

  it("round-trips nested values", () => {
    const v = { a: { b: ["1", "2"], c: [{ d: "x" }] }, e: "f g" };
    const q = toQuery(v, nested);
    expect(q.ok && parseQuery(q.text, nested).value).toEqual(v);
  });
});
