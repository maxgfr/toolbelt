import { describe, expect, it } from "bun:test";
import { decode, dotMs, encode, looksLikeMorse, timings } from "./logic";

describe("morse", () => {
  it("encodes letters, digits and punctuation", () => {
    expect(encode("SOS").morse).toBe("... --- ...");
    expect(encode("Hello world 2").morse).toBe(
      ".... . .-.. .-.. --- / .-- --- .-. .-.. -.. / ..---",
    );
    expect(encode("a.b").morse).toBe(".- .-.-.- -...");
  });

  it("handles accents and reports characters without a code", () => {
    expect(encode("é").morse).toBe("..-..");
    expect(encode("ê").morse).toBe(".");
    const r = encode("a#b😀");
    expect(r.morse).toBe(".- -...");
    expect(r.unknown).toEqual(["#", "😀"]);
    expect(encode("   ").morse).toBe("");
  });

  it("decodes with any word separator and look-alike symbols", () => {
    expect(decode("... --- ...").text).toBe("SOS");
    expect(decode(".... ..  /  - .... . .-. .").text).toBe("HI THERE");
    expect(decode(".... ..   - .... . .-. .").text).toBe("HI THERE");
    expect(decode("·– –···").text).toBe("AB");
    const bad = decode("...... .-");
    expect(bad.text).toBe("?A");
    expect(bad.unknown).toEqual(["......"]);
    expect(decode("").text).toBe("");
  });

  it("round-trips", () => {
    const s = "THE QUICK BROWN FOX JUMPS OVER 13 LAZY DOGS?";
    expect(decode(encode(s).morse).text).toBe(s);
  });

  it("detects Morse input", () => {
    expect(looksLikeMorse("... --- ...")).toBe(true);
    expect(looksLikeMorse("SOS")).toBe(false);
    expect(looksLikeMorse("  ")).toBe(false);
  });

  it("times dots, dashes and gaps", () => {
    expect(timings(".- / -")).toEqual([
      { on: true, units: 1 },
      { on: false, units: 1 },
      { on: true, units: 3 },
      { on: false, units: 7 },
      { on: true, units: 3 },
    ]);
    expect(dotMs(20)).toBe(60);
  });
});
