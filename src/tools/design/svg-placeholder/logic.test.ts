import { describe, expect, it } from "bun:test";
import {
  autoSize,
  canvasFont,
  cleanPlaceholder,
  DEFAULT,
  escapeXml,
  fileName,
  fontSize,
  label,
  type Placeholder,
  placeholderSvg,
  svgBase64Uri,
  svgDataUri,
} from "./logic";

const ph = (p: Partial<Placeholder>): Placeholder => ({ ...DEFAULT, ...p });

describe("svg-placeholder", () => {
  it("shows the dimensions by default, or the user's text", () => {
    expect(label(ph({ w: 300, h: 150, text: "" }))).toBe("300×150");
    expect(label(ph({ text: "  " }))).toBe("640×360");
    expect(label(ph({ text: "Hero" }))).toBe("Hero");
  });

  it("writes valid, escaped SVG markup", () => {
    const svg = placeholderSvg(
      ph({ w: 300, h: 150, bg: "red", fg: "#fff", text: `<b>"Tom" & 'Jerry'</b>`, size: 20 }),
    );
    expect(svg).toStartWith(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150">',
    );
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('font-size="20"');
    expect(svg).toContain("&lt;b&gt;&quot;Tom&quot; &amp; &apos;Jerry&apos;&lt;/b&gt;");
    expect(svg).not.toContain("<b>");
    expect(escapeXml("a<b")).toBe("a&lt;b");
  });

  it("fits the text automatically", () => {
    expect(autoSize(640, 360, "640×360")).toBe(122);
    // a short text is limited by the height
    expect(autoSize(1000, 100, "A")).toBe(50);
    expect(autoSize(10, 10, "a very long text indeed")).toBeGreaterThanOrEqual(1);
    expect(fontSize(ph({ size: 33 }))).toBe(33);
  });

  it("encodes data URIs", () => {
    const svg = placeholderSvg(ph({ text: "50% #1 ünï" }));
    const uri = svgDataUri(svg);
    expect(uri).toStartWith(
      "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='640'",
    );
    expect(uri).not.toMatch(/["<>#\s]/);
    expect(decodeURIComponent(uri.slice("data:image/svg+xml,".length))).toBe(
      svg.replace(/"/g, "'"),
    );
    const b64 = svgBase64Uri(svg);
    expect(b64).toStartWith("data:image/svg+xml;base64,");
    const bytes = Uint8Array.from(atob(b64.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe(svg);
  });

  it("matches the canvas font to the SVG", () => {
    expect(canvasFont(ph({ size: 24, bold: true, font: "mono" }))).toStartWith(
      "600 24px ui-monospace",
    );
    expect(canvasFont(ph({ size: 24, bold: false, font: "serif" }))).toStartWith("24px Georgia");
    expect(fileName(ph({ w: 10, h: 20 }), "png")).toBe("placeholder-10x20.png");
  });

  it("cleans untrusted state", () => {
    expect(cleanPlaceholder(undefined)).toEqual(DEFAULT);
    const p = cleanPlaceholder({ w: 0, h: 99999, text: 5, font: "comic", size: -3, bold: false });
    expect(p).toEqual({ ...DEFAULT, w: 1, h: 4000, text: "", font: "sans", size: 0, bold: false });
    expect(cleanPlaceholder({ w: 10.6 }).w).toBe(11);
    // invalid colors still make a valid SVG
    expect(placeholderSvg(ph({ bg: "nope" }))).toContain('fill="#000000"');
  });
});
