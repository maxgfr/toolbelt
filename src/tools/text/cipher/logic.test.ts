import { describe, expect, it } from "bun:test";
import { applyCipher, atbash, bruteForce, caesar, rot13, rot47 } from "./logic";

describe("cipher", () => {
  it("ROT13 is its own inverse and leaves the rest alone", () => {
    expect(rot13("Hello, World! é 123")).toBe("Uryyb, Jbeyq! é 123");
    expect(rot13(rot13("The Quick Brown Fox"))).toBe("The Quick Brown Fox");
  });

  it("ROT47 rotates printable ASCII", () => {
    expect(rot47("Hello, World!")).toBe("w6==@[ (@C=5P");
    expect(rot47(rot47("a~!{} 😀"))).toBe("a~!{} 😀");
  });

  it("Caesar shifts both ways, wrapping around", () => {
    expect(caesar("xyz ABC", 3)).toBe("abc DEF");
    expect(caesar("abc", -3)).toBe("xyz");
    expect(caesar("abc", 29)).toBe("def");
    expect(applyCipher(applyCipher("Attack at dawn", "caesar", 7, false), "caesar", 7, true)).toBe(
      "Attack at dawn",
    );
  });

  it("Atbash mirrors the alphabet", () => {
    expect(atbash("Hello")).toBe("Svool");
    expect(atbash(atbash("Zebra"))).toBe("Zebra");
  });

  it("finds the readable Caesar shift first", () => {
    const secret = caesar("meet me at the station when it is dark", 11);
    expect(bruteForce(secret)[0]?.shift).toBe(11);
    expect(bruteForce("")).toHaveLength(25);
  });
});
