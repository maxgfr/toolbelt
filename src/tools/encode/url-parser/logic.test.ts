import { describe, expect, it } from "bun:test";
import { EncodeError } from "../_shared";
import { jsonToQuery, parseUrl, queryToJson, withParams } from "./logic";

describe("url-parser", () => {
  it("splits a full URL into its parts", () => {
    const u = parseUrl(
      "https://alice:s%20cret@Example.com:8443/a/b%20c?q=caf%C3%A9&x=1&x=2#sec%201",
    );
    expect(u.protocol).toBe("https");
    expect(u.username).toBe("alice");
    expect(u.password).toBe("s cret");
    expect(u.hostname).toBe("example.com");
    expect(u.port).toBe("8443");
    expect(u.pathname).toBe("/a/b%20c");
    expect(u.segments).toEqual(["a", "b c"]);
    expect(u.params).toEqual([
      ["q", "café"],
      ["x", "1"],
      ["x", "2"],
    ]);
    expect(u.hash).toBe("sec 1");
    expect(u.origin).toBe("https://example.com:8443");
    expect(u.assumedScheme).toBe(false);
  });

  it("drops the default port and accepts URLs without scheme", () => {
    expect(parseUrl("https://example.com:443/").port).toBe("");
    const bare = parseUrl("example.com/path?a=1");
    expect(bare.assumedScheme).toBe(true);
    expect(bare.hostname).toBe("example.com");
    const local = parseUrl("localhost:3000/api");
    expect(local.hostname).toBe("localhost");
    expect(local.port).toBe("3000");
  });

  it("parses relative URLs and other schemes", () => {
    const rel = parseUrl("/search?q=a+b#top");
    expect(rel.relative).toBe(true);
    expect(rel.hostname).toBe("");
    expect(rel.params).toEqual([["q", "a b"]]);
    const mail = parseUrl("mailto:someone@example.com?subject=Hi");
    expect(mail.protocol).toBe("mailto");
    expect(mail.params).toEqual([["subject", "Hi"]]);
  });

  it("rejects what is not a URL", () => {
    expect(() => parseUrl("")).toThrow(EncodeError);
    expect(() => parseUrl("not a url")).toThrow(EncodeError);
    expect(() => parseUrl("http://exa mple.com")).toThrow(EncodeError);
  });

  it("rebuilds the URL from edited parameters, in the same form", () => {
    expect(
      withParams("https://ex.com/p?old=1#h", [
        ["q", "a b&c"],
        ["", ""],
        ["n", "é"],
      ]),
    ).toBe("https://ex.com/p?q=a+b%26c&n=%C3%A9#h");
    expect(withParams("ex.com/p?x=1", [["x", "2"]])).toBe("ex.com/p?x=2");
    expect(withParams("/p?x=1", [])).toBe("/p");
  });

  it("converts a query string to JSON", () => {
    expect(queryToJson("")).toEqual({});
    expect(queryToJson("?a=1&a=2&b=x+y&tags[]=t1&user[name]=Ann&user[age]=3")).toEqual({
      a: ["1", "2"],
      b: "x y",
      tags: ["t1"],
      user: { name: "Ann", age: "3" },
    });
    expect(queryToJson("https://ex.com/?q=%C3%A9#frag")).toEqual({ q: "é" });
  });

  it("converts JSON to a query string and back", () => {
    const q = jsonToQuery('{"q":"a b","page":2,"tags":["x","y"],"f":{"min":1},"n":null}');
    expect(q).toBe("q=a+b&page=2&tags=x&tags=y&f%5Bmin%5D=1&n=");
    expect(queryToJson(q)).toEqual({
      q: "a b",
      page: "2",
      tags: ["x", "y"],
      f: { min: "1" },
      n: "",
    });
    expect(() => jsonToQuery("[1]")).toThrow(EncodeError);
    expect(() => jsonToQuery("{")).toThrow(EncodeError);
  });
});
