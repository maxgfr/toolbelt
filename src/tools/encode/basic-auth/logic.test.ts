import { describe, expect, it } from "bun:test";
import {
  curlHeader,
  curlUser,
  decode,
  header,
  headerValue,
  shellQuote,
  token,
  tryDecode,
  warnings,
} from "./logic";

const ALADDIN = { user: "Aladdin", password: "open sesame" };

describe("encode", () => {
  it("matches the RFC 7617 examples", () => {
    expect(token(ALADDIN)).toBe("QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
    expect(header(ALADDIN)).toBe("Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
    // §2.1: charset=UTF-8, user "test", password "123£".
    expect(headerValue({ user: "test", password: "123£" })).toBe("Basic dGVzdDoxMjPCow==");
  });

  it("handles empty values and Unicode", () => {
    expect(token({ user: "", password: "" })).toBe("Og==");
    expect(decode(`Basic ${token({ user: "zoë", password: "pässwörd 🔑" })}`)).toEqual({
      user: "zoë",
      password: "pässwörd 🔑",
      source: "header",
    });
  });

  it("writes shell-safe curl commands", () => {
    expect(shellQuote("simple")).toBe("simple");
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
    expect(curlUser(ALADDIN, "https://api.test/x?a=1&b=2")).toBe(
      "curl -u 'Aladdin:open sesame' 'https://api.test/x?a=1&b=2'",
    );
    expect(curlUser({ user: "u", password: "p" }, "")).toBe("curl -u u:p https://example.com/");
    expect(curlHeader(ALADDIN, "https://api.test/")).toBe(
      "curl -H 'Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==' https://api.test/",
    );
  });

  it("warns about a colon in the user id and control characters", () => {
    expect(warnings(ALADDIN)).toEqual([]);
    expect(warnings({ user: "a:b", password: "x\n" })).toEqual(["colon", "control"]);
  });
});

describe("decode", () => {
  it("reads headers, values and bare tokens", () => {
    const want = { ...ALADDIN };
    expect(decode("Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==")).toEqual({
      ...want,
      source: "header",
    });
    expect(decode("authorization:basic   QWxhZGRpbjpvcGVuIHNlc2FtZQ==")).toEqual({
      ...want,
      source: "header",
    });
    expect(decode("Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ")).toEqual({ ...want, source: "header" });
    expect(decode("  QWxhZGRpbjpvcGVuIHNlc2FtZQ==\n")).toEqual({ ...want, source: "token" });
  });

  it("keeps colons in the password", () => {
    expect(decode(token({ user: "u", password: "a:b:c" }))).toEqual({
      user: "u",
      password: "a:b:c",
      source: "token",
    });
  });

  it("reads curl -u / --user and curl -H", () => {
    expect(decode("curl -u 'Aladdin:open sesame' https://x.test")).toEqual({
      ...ALADDIN,
      source: "curl",
    });
    expect(decode(`curl --user "bob:p\\"w" https://x.test`)).toEqual({
      user: "bob",
      password: 'p"w',
      source: "curl",
    });
    expect(decode("curl --user=al:pw https://x")).toEqual({
      user: "al",
      password: "pw",
      source: "curl",
    });
    expect(decode("curl -u 'it'\\''s:x' u")).toEqual({
      user: "it's",
      password: "x",
      source: "curl",
    });
    expect(decode("curl -u alice https://x")).toEqual({
      user: "alice",
      password: "",
      source: "curl",
    });
    expect(decode(curlHeader(ALADDIN, "https://x"))).toEqual({ ...ALADDIN, source: "header" });
  });

  it("reads credentials in a URL", () => {
    expect(decode("https://bob:s%40cret@example.com/path")).toEqual({
      user: "bob",
      password: "s@cret",
      source: "url",
    });
  });

  it("explains bad input instead of throwing out of the view", () => {
    expect(tryDecode("   ")).toBeNull();
    const noColon = tryDecode("Basic aGVsbG8=");
    expect(noColon?.ok === false && noColon.error.en).toContain('no ":"');
    const junk = tryDecode("hello world!");
    expect(junk?.ok === false && junk.error.en).toContain("No Basic credentials");
    const badB64 = tryDecode("Basic a");
    expect(badB64?.ok).toBe(false);
  });
});
