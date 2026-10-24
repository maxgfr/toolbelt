import { describe, expect, it } from "bun:test";
import { EncodeError } from "../_shared";
import { decodeUrl, encodeComponent, encodeForm, encodeUrl, looksEncoded } from "./logic";

describe("url-encode", () => {
  it("encodes a component", () => {
    expect(encodeUrl("", "component")).toBe("");
    expect(encodeUrl("a b&c=d/é", "component")).toBe("a%20b%26c%3Dd%2F%C3%A9");
    expect(encodeComponent("it's (ok)*!")).toBe("it's%20(ok)*!");
    expect(encodeComponent("it's (ok)*!", true)).toBe("it%27s%20%28ok%29%2A%21");
  });

  it("keeps the structure of a full URL", () => {
    expect(encodeUrl("https://ex.com/a b?q=é&x=1#top", "uri")).toBe(
      "https://ex.com/a%20b?q=%C3%A9&x=1#top",
    );
  });

  it("encodes form data like URLSearchParams", () => {
    expect(encodeForm("a b&c=d~!")).toBe("a+b%26c%3Dd%7E%21");
    expect(encodeForm("😀")).toBe("%F0%9F%98%80");
    expect(encodeForm("x*y-z._")).toBe(new URLSearchParams({ k: "x*y-z._" }).toString().slice(2));
  });

  it("decodes each mode", () => {
    expect(decodeUrl("a%20b%26c%3Dd%2F%C3%A9", "component")).toBe("a b&c=d/é");
    expect(decodeUrl("a+b%2Bc", "form")).toBe("a b+c");
    expect(decodeUrl("a+b", "component")).toBe("a+b");
    // decodeURI leaves reserved characters escaped.
    expect(decodeUrl("%3F%20x", "uri")).toBe("%3F x");
  });

  it("explains malformed sequences", () => {
    expect(() => decodeUrl("100%", "component")).toThrow(EncodeError);
    expect(() => decodeUrl("%zz", "component")).toThrow(/position 1/);
    expect(() => decodeUrl("ok %E0%A4%A", "component")).toThrow(/position 10/);
    expect(() => decodeUrl("x%C3%28", "component")).toThrow(/not valid UTF-8/);
    expect(() => encodeUrl("\uD800", "component")).toThrow(EncodeError);
  });

  it("spots double encoding", () => {
    const twice = encodeUrl(encodeUrl("a b", "component"), "component");
    expect(twice).toBe("a%2520b");
    expect(looksEncoded(decodeUrl(twice, "component"))).toBe(true);
    expect(looksEncoded("a b")).toBe(false);
  });
});
