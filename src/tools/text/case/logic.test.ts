import { describe, expect, it } from "bun:test";
import { CASES, convertCase, words } from "./logic";

describe("case", () => {
  it("splits identifiers at separators and case changes", () => {
    expect(words("XMLHttpRequest")).toEqual(["XML", "Http", "Request"]);
    expect(words("user_id-v2.final")).toEqual(["user", "id", "v2", "final"]);
    expect(words("  hello   world  ")).toEqual(["hello", "world"]);
    expect(words("don't stop")).toEqual(["dont", "stop"]);
  });

  it("converts to every identifier style", () => {
    const s = "Hello world, user ID";
    expect(convertCase(s, "camel")).toBe("helloWorldUserId");
    expect(convertCase(s, "pascal")).toBe("HelloWorldUserId");
    expect(convertCase(s, "snake")).toBe("hello_world_user_id");
    expect(convertCase(s, "kebab")).toBe("hello-world-user-id");
    expect(convertCase(s, "constant")).toBe("HELLO_WORLD_USER_ID");
    expect(convertCase(s, "dot")).toBe("hello.world.user.id");
    expect(convertCase(s, "train")).toBe("Hello-World-User-Id");
  });

  it("round-trips between identifier styles", () => {
    expect(convertCase("getHTTPResponseCode", "snake")).toBe("get_http_response_code");
    expect(convertCase("get_http_response_code", "camel")).toBe("getHttpResponseCode");
  });

  it("converts each line separately", () => {
    expect(convertCase("first name\nlast name", "camel")).toBe("firstName\nlastName");
  });

  it("handles prose styles and accents", () => {
    expect(convertCase("l'été EST chaud", "title")).toBe("L'été Est Chaud");
    expect(convertCase("HELLO. how ARE you? fine", "sentence")).toBe("Hello. How are you? Fine");
    expect(convertCase("élan Vital", "upper")).toBe("ÉLAN VITAL");
    expect(convertCase("hello world", "alternating")).toBe("hElLo WoRlD");
    expect(convertCase("Ça va très bien", "kebab")).toBe("ça-va-très-bien");
  });

  it("returns empty output for empty input", () => {
    for (const c of CASES) expect(convertCase("", c)).toBe("");
  });
});
