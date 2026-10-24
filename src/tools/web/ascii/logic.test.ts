import { describe, expect, it } from "bun:test";
import { ASCII, combo, type KeyInfo, keyLabel, searchAscii } from "./logic";

const key = (k: Partial<KeyInfo>): KeyInfo => ({
  key: "",
  code: "",
  keyCode: 0,
  which: 0,
  location: 0,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  ...k,
});

describe("ascii", () => {
  it("has the 128 codes, each named in both languages", () => {
    expect(ASCII).toHaveLength(128);
    for (const r of ASCII) {
      expect(r.name.en).not.toBe("");
      expect(r.name.fr).not.toBe("");
    }
  });

  it("gives every notation", () => {
    const a = ASCII[65];
    expect(a).toMatchObject({ char: "A", hex: "41", oct: "101", bin: "1000001", html: "&#65;" });
    expect(a?.name.en).toBe("Latin capital letter A");
    expect(ASCII[38]?.htmlNamed).toBe("&amp;");
    expect(ASCII[60]?.htmlNamed).toBe("&lt;");
  });

  it("names control characters", () => {
    expect(ASCII[0]).toMatchObject({ char: "NUL", caret: "^@", escape: "\\0", glyph: "␀" });
    expect(ASCII[10]).toMatchObject({ char: "LF", caret: "^J", escape: "\\n" });
    expect(ASCII[27]?.escape).toBe("\\e");
    expect(ASCII[127]).toMatchObject({ char: "DEL", caret: "^?", glyph: "␡" });
    expect(ASCII[127]?.control).toBe(true);
    expect(ASCII[32]?.control).toBe(false);
  });

  it("searches by character, code and name", () => {
    expect(searchAscii("A").map((r) => r.code)).toEqual([65]);
    expect(searchAscii(" ").map((r) => r.code)).toEqual([32]);
    expect(searchAscii("65").map((r) => r.code)).toEqual([65]);
    expect(searchAscii("0x7e").map((r) => r.code)).toEqual([126]);
    expect(searchAscii("\\x0A").map((r) => r.code)).toEqual([10]);
    expect(searchAscii("tab").map((r) => r.code)).toEqual([9, 11]);
    expect(searchAscii("accolade").map((r) => r.code)).toEqual([123, 125]);
    expect(searchAscii("esperluette").map((r) => r.code)).toEqual([38]);
    expect(searchAscii("")).toHaveLength(128);
    expect(searchAscii("nothing like this")).toEqual([]);
  });

  it("filters by kind", () => {
    expect(searchAscii("", "control")).toHaveLength(33);
    expect(searchAscii("", "printable")).toHaveLength(95);
    expect(searchAscii("", "letters")).toHaveLength(52);
    expect(searchAscii("", "digits")).toHaveLength(10);
    expect(searchAscii("", "symbols")).toHaveLength(33);
  });

  it("writes keyboard shortcuts", () => {
    expect(combo(key({ key: "k", ctrlKey: true, shiftKey: true }))).toBe("Ctrl + Shift + K");
    expect(combo(key({ key: "Shift", shiftKey: true }))).toBe("Shift");
    expect(combo(key({ key: "s", metaKey: true }), true)).toBe("⌘S");
    expect(combo(key({ key: " " }))).toBe("Space");
    expect(keyLabel("")).toBe("Unidentified");
  });
});
