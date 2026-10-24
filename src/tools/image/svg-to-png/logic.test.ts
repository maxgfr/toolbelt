import { describe, expect, it } from "bun:test";
import {
  attrs,
  byteLength,
  cleanSvg,
  fmtNum,
  parseLength,
  parseViewBox,
  renderSize,
  roundNumbers,
  svgInfo,
  withSize,
} from "./logic";

describe("size", () => {
  it("parses lengths and view boxes", () => {
    expect(parseLength("24")).toBe(24);
    expect(parseLength("24px")).toBe(24);
    expect(parseLength("1in")).toBe(96);
    expect(parseLength("25.4mm")).toBeCloseTo(96);
    expect(parseLength("100%")).toBeNull();
    expect(parseLength("auto")).toBeNull();
    expect(parseLength("-5")).toBeNull();
    expect(parseViewBox("0 0 24 24")).toEqual([0, 0, 24, 24]);
    expect(parseViewBox("0,0,10,5")).toEqual([0, 0, 10, 5]);
    expect(parseViewBox("0 0 0 5")).toBeNull();
  });

  it("finds the intrinsic size", () => {
    expect(svgInfo('<svg width="100" height="50">').width).toBe(100);
    expect(svgInfo('<svg viewBox="0 0 24 12">')).toMatchObject({
      width: 24,
      height: 12,
      known: true,
    });
    expect(svgInfo('<svg width="48" viewBox="0 0 24 12">')).toMatchObject({
      width: 48,
      height: 24,
    });
    expect(svgInfo('<svg height="100%" viewBox="0 0 24 12">')).toMatchObject({
      width: 24,
      height: 12,
    });
    expect(svgInfo("<svg>")).toMatchObject({ width: 300, height: 150, known: false });
    expect(() => svgInfo("<div>")).toThrow(/svg/);
  });

  it("forces a render size and adds what an <img> needs", () => {
    const out = withSize(
      '<svg width="10" height="5"><rect width="10" height="5"/></svg>',
      200,
      100,
    );
    const a = attrs(/<svg[^>]*>/.exec(out)?.[0] ?? "");
    expect(a.get("width")).toBe("200");
    expect(a.get("height")).toBe("100");
    expect(a.get("viewBox")).toBe("0 0 10 5");
    expect(a.get("xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(out).toContain('<rect width="10" height="5"/>');
    const keep = withSize(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><use xlink:href='#a'/></svg>",
      8,
      8,
    );
    expect(keep).toContain("viewBox='0 0 1 1'");
    expect(keep).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(keep.match(/xmlns=/g)).toHaveLength(1);
  });

  it("computes the output size", () => {
    const info = svgInfo('<svg viewBox="0 0 24 12">');
    expect(renderSize(info, "scale", 4, 0)).toEqual({ w: 96, h: 48 });
    expect(renderSize(info, "width", 1, 1000)).toEqual({ w: 1000, h: 500 });
    expect(renderSize(info, "width", 1, 99999)).toEqual({ w: 16384, h: 8192 });
  });
});

describe("numbers", () => {
  it("rounds and keeps numbers apart", () => {
    expect(fmtNum(1.23456, 2)).toBe("1.23");
    expect(fmtNum(2.5, 0)).toBe("3");
    expect(fmtNum(-0.0001, 2)).toBe("0");
    expect(fmtNum(10, 3)).toBe("10");
    expect(roundNumbers("M1.234 5.678L9.0001,1e-5", 1)).toBe("M1.2 5.7L9,0");
    expect(roundNumbers("M1.5.5", 0)).toBe("M2 1");
    expect(roundNumbers("l1.26-2.4", 0)).toBe("l1-2");
    expect(roundNumbers("l1-0.2", 0)).toBe("l1 0");
  });
});

describe("cleanSvg", () => {
  const inkscape = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   width="24.000001"
   height="24"
   viewBox="0 0 24.000001 24"
   inkscape:version="1.2"
   sodipodi:docname="icon.svg">
  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="1.4" />
  <metadata id="metadata5">
    <rdf:RDF><dc:format>image/svg+xml</dc:format></rdf:RDF>
  </metadata>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1">
    <path d="M 2.0000001,3.1234567 L 21.999999,20.876543 Z" style="fill:none;stroke:#000" />
    <text x="1.23456" y="20">Hello   world</text>
  </g>
  <g></g>
  <defs/>
</svg>
`;

  it("removes editor cruft and rounds geometry", () => {
    const out = cleanSvg(inkscape, { decimals: 2 });
    expect(out).not.toMatch(/inkscape|sodipodi|metadata|<!--|<\?xml|DOCTYPE|xmlns:dc|xmlns:rdf/);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('width="24"');
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('d="M 2,3.12 L 22,20.88 Z"');
    expect(out).toContain('style="fill:none;stroke:#000"');
    // Text content and its attributes are left alone.
    expect(out).toContain('<text x="1.23456" y="20">Hello   world</text>');
    expect(out).not.toContain("<g></g>");
    expect(out).not.toContain("<defs/>");
    expect(out).not.toMatch(/>\s+</);
    expect(byteLength(out)).toBeLessThan(byteLength(inkscape) / 2);
  });

  it("keeps numbers with decimals = -1, and arcs untouched", () => {
    const svg = '<svg viewBox="0 0 10.5 10.5"><path d="M1 1a1.5 1.5 0 01.5.5"/></svg>';
    expect(cleanSvg(svg, { decimals: -1 })).toBe(svg);
    expect(cleanSvg(svg, { decimals: 0 })).toBe(
      '<svg viewBox="0 0 11 11"><path d="M1 1a1.5 1.5 0 01.5.5"/></svg>',
    );
  });

  it("keeps styles and CDATA verbatim and rejects non-SVG", () => {
    const svg =
      "<svg><style>\n  .a { fill: red }\n</style>\n<script><![CDATA[ if (a < b) {} ]]></script></svg>";
    const out = cleanSvg(svg, { decimals: 2 });
    expect(out).toContain("<style>\n  .a { fill: red }\n</style>");
    expect(out).toContain("<![CDATA[ if (a < b) {} ]]>");
    expect(() => cleanSvg("hello", { decimals: 2 })).toThrow(/svg/);
    expect(cleanSvg("<svg/>", { decimals: 2 })).toBe("<svg/>");
  });

  it("handles Unicode", () => {
    expect(byteLength("é")).toBe(2);
    expect(
      cleanSvg('<svg aria-label="café ☕">  <title>Café</title>  </svg>', { decimals: 2 }),
    ).toBe('<svg aria-label="café ☕"><title>Café</title></svg>');
  });
});
