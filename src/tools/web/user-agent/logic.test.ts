import { describe, expect, it } from "bun:test";
import { parseUA, SAMPLES } from "./logic";

const sample = (id: string) => SAMPLES.find((s) => s.id === id)?.ua ?? "";

describe("user-agent", () => {
  it("parses a desktop Chrome on Windows", () => {
    const r = parseUA(sample("chrome-windows"));
    expect(r.browser.name).toBe("Chrome");
    expect(r.browser.major).toBe("131");
    expect(r.engine.name).toBe("Blink");
    expect(r.os.name).toBe("Windows");
    expect(r.cpu.architecture).toBe("amd64");
    expect(r.device.type).toBe("");
    expect(r.bot).toBe(false);
  });

  it("parses mobile devices", () => {
    const ios = parseUA(sample("safari-iphone"));
    expect(ios.browser.name).toBe("Mobile Safari");
    expect(ios.os).toEqual({ name: "iOS", version: "17.5" });
    expect(ios.device).toMatchObject({ type: "mobile", vendor: "Apple", model: "iPhone" });
    const android = parseUA(sample("chrome-android"));
    expect(android.os.name).toBe("Android");
    expect(android.device.model).toBe("Pixel 8 Pro");
    expect(parseUA(sample("samsung-tablet")).device.type).toBe("tablet");
  });

  it("tells Edge from Chrome and reads Firefox's Gecko", () => {
    expect(parseUA(sample("edge-windows")).browser.name).toBe("Edge");
    const ff = parseUA(sample("firefox-linux"));
    expect(ff.browser.name).toBe("Firefox");
    expect(ff.engine.name).toBe("Gecko");
    expect(ff.os.name).toBe("Linux");
  });

  it("detects bots and command-line clients", () => {
    expect(parseUA(sample("googlebot")).bot).toBe(true);
    const gpt = parseUA(sample("gptbot"));
    expect(gpt.bot).toBe(true);
    expect(gpt.aiBot).toBe(true);
    expect(parseUA(sample("curl")).browser.name).toBe("curl");
  });

  it("flags Chrome's frozen user agent", () => {
    expect(parseUA(sample("chrome-windows")).frozen).toBe(true);
    expect(parseUA(sample("firefox-linux")).frozen).toBe(false);
  });

  it("returns empty fields for empty or garbage input", () => {
    for (const s of ["", "   ", "🙂 not a browser", "x".repeat(5000)]) {
      const r = parseUA(s);
      expect(r.browser.name).toBe("");
      expect(r.os.name).toBe("");
    }
  });
});
