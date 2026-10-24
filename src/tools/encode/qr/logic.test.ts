import { describe, expect, it } from "bun:test";
import jsQR from "jsqr";
import {
  contrast,
  escapeWifi,
  fitWithin,
  isInverted,
  type Matrix,
  matrixPath,
  normalizeUrl,
  parseWifi,
  payloadKind,
  pngLayout,
  qrMatrix,
  qrSvg,
  qrVersion,
  vcardPayload,
  wifiPayload,
} from "./logic";

/** Renders a matrix to RGBA pixels (4 px per module, 4-module quiet zone) and decodes it. */
function decode(m: Matrix): string | null {
  const cell = 4;
  const side = (m.length + 8) * cell;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [y, row] of m.entries())
    for (const [x, dark] of row.entries()) {
      if (!dark) continue;
      for (let dy = 0; dy < cell; dy++)
        for (let dx = 0; dx < cell; dx++) {
          const i = (((y + 4) * cell + dy) * side + (x + 4) * cell + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }
  return jsQR(data, side, side)?.data ?? null;
}

describe("qr", () => {
  it("builds a square matrix of a valid version", () => {
    const m = qrMatrix("hello", "M");
    expect(m.length).toBe(21);
    expect(m.every((r) => r.length === 21)).toBe(true);
    expect(qrVersion(m)).toBe(1);
    // Top-left finder pattern: a dark 7×7 ring.
    expect(m[0]?.slice(0, 7).every(Boolean)).toBe(true);
    expect(m[1]?.[1]).toBe(false);
  });

  it("round-trips ASCII and UTF-8 text through a decoder", () => {
    expect(decode(qrMatrix("https://example.com/?q=1", "L"))).toBe("https://example.com/?q=1");
    expect(decode(qrMatrix("Crème brûlée 🍮 — 東京", "H"))).toBe("Crème brûlée 🍮 — 東京");
  });

  it("grows with the error correction level and rejects empty or oversized input", () => {
    const text = "x".repeat(100);
    expect(qrMatrix(text, "H").length).toBeGreaterThan(qrMatrix(text, "L").length);
    expect(() => qrMatrix("", "M")).toThrow();
    expect(() => qrMatrix("x".repeat(3000), "H")).toThrow(/Too much data/);
  });

  it("draws runs of dark modules as one subpath", () => {
    expect(matrixPath([[true, true, false, true]], 0)).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
    expect(matrixPath([[false, true]], 4)).toBe("M5 4h1v1h-1z");
  });

  it("writes a standalone SVG with colors and quiet zone", () => {
    const svg = qrSvg(qrMatrix("a", "L"), { fg: "#112233", bg: "#ffffff", margin: 4, size: 300 });
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="300"');
    expect(svg).toContain('viewBox="0 0 29 29"');
    expect(svg).toContain('fill="#112233"');
    expect(svg).toContain('<rect width="29" height="29" fill="#ffffff"/>');
    expect(qrSvg([[true]], { fg: "#000", bg: "", margin: 0, size: 10 })).not.toContain("<rect");
  });

  it("lays out PNG pixels in whole modules", () => {
    const m = qrMatrix("a", "L");
    expect(pngLayout(m, 4, 290)).toEqual({ cell: 10, side: 290 });
    expect(pngLayout(m, 4, 10).cell).toBe(1);
  });

  it("escapes and builds Wi-Fi payloads", () => {
    expect(escapeWifi('a;b,c:d\\e"f')).toBe('a\\;b\\,c\\:d\\\\e\\"f');
    expect(wifiPayload({ ssid: "Home", password: "p;w", security: "WPA", hidden: false })).toBe(
      "WIFI:T:WPA;S:Home;P:p\\;w;;",
    );
    expect(wifiPayload({ ssid: "Café", password: "x", security: "nopass", hidden: true })).toBe(
      "WIFI:T:nopass;S:Café;H:true;;",
    );
  });

  it("parses Wi-Fi payloads back, escapes included", () => {
    const w = { ssid: 'My "net";1', password: "a:b\\c,d", security: "WEP" as const, hidden: true };
    expect(parseWifi(wifiPayload(w))).toEqual(w);
    expect(parseWifi("WIFI:S:Open;;")).toEqual({
      ssid: "Open",
      password: "",
      security: "nopass",
      hidden: false,
    });
    expect(parseWifi("hello")).toBeNull();
  });

  it("builds a vCard 3.0 with only the filled fields", () => {
    const v = vcardPayload({
      first: "Ada",
      last: "Lovelace",
      org: "Analytical, Engines",
      title: "",
      phone: "+44 20 1234",
      email: "ada@example.com",
      url: "",
      address: "",
      note: "line 1\nline 2",
    });
    const lines = v.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines).toContain("VERSION:3.0");
    expect(lines).toContain("N:Lovelace;Ada;;;");
    expect(lines).toContain("FN:Ada Lovelace");
    expect(lines).toContain("ORG:Analytical\\, Engines");
    expect(lines).toContain("NOTE:line 1\\nline 2");
    expect(v).not.toContain("TITLE");
    expect(lines.at(-1)).toBe("END:VCARD");
  });

  it("adds a scheme to bare domains only", () => {
    expect(normalizeUrl("example.com/path")).toBe("https://example.com/path");
    expect(normalizeUrl("http://x.org")).toBe("http://x.org");
    expect(normalizeUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(normalizeUrl("just words")).toBe("just words");
    expect(normalizeUrl("")).toBe("");
  });

  it("recognizes decoded payloads", () => {
    expect(payloadKind("https://a.b/c")).toBe("url");
    expect(payloadKind("WIFI:S:x;;")).toBe("wifi");
    expect(payloadKind("BEGIN:VCARD\r\nEND:VCARD")).toBe("vcard");
    expect(payloadKind("otpauth://totp/x?secret=A")).toBe("otp");
    expect(payloadKind("hello")).toBe("text");
  });

  it("fits images within a maximum side without upscaling", () => {
    expect(fitWithin(4000, 2000, 1600)).toEqual({ w: 1600, h: 800 });
    expect(fitWithin(300, 200, 1600)).toEqual({ w: 300, h: 200 });
  });

  it("measures contrast and inverted colors", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBe(1);
    expect(isInverted("#ffffff", "#000000")).toBe(true);
    expect(isInverted("#1e3a8a", "#ffffff")).toBe(false);
  });
});
