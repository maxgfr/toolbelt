import { describe, expect, it } from "bun:test";
import {
  camelAttr,
  componentName,
  cssProp,
  htmlToJsx,
  type JsxOptions,
  parseHtml,
  reactAttr,
  styleObject,
} from "./logic";

const o: JsxOptions = { component: false, name: "", native: false, typescript: false };
const jsx = (html: string, more: Partial<JsxOptions> = {}) => htmlToJsx(html, { ...o, ...more });

describe("html-to-jsx: parser", () => {
  it("handles void tags, bare and unquoted attributes, implied end tags", () => {
    const nodes = parseHtml('<ul class=list><li>a<li>b</ul><input disabled value="x">');
    expect(nodes).toHaveLength(2);
    const ul = nodes[0];
    expect(ul?.t === "el" && ul.attrs).toEqual([{ name: "class", value: "list" }]);
    expect(ul?.t === "el" && ul.children.length).toBe(2);
    const input = nodes[1];
    expect(input?.t === "el" && input.attrs[0]).toEqual({ name: "disabled", value: null });
  });

  it("is forgiving: stray end tags, unclosed tags, lone <", () => {
    expect(() => parseHtml("</p><div><span>a < b")).not.toThrow();
    const out = jsx("</p><div><span>a < b");
    expect(out.code).toBe("<div>\n  <span>a &lt; b</span>\n</div>\n");
    expect(jsx("").code).toBe("");
    expect(jsx("   \n ").code).toBe("");
  });

  it("keeps script and style bodies raw", () => {
    const nodes = parseHtml("<script>if (a < b) { x('</div>') }</script>");
    expect(nodes[0]?.t === "el" && nodes[0].children[0]).toEqual({
      t: "text",
      v: "if (a < b) { x('</div>') }",
    });
  });
});

describe("html-to-jsx: attributes and styles", () => {
  it("renames attributes", () => {
    expect(reactAttr("class", false)).toBe("className");
    expect(reactAttr("for", false)).toBe("htmlFor");
    expect(reactAttr("TABINDEX", false)).toBe("tabIndex");
    expect(reactAttr("data-userId", false)).toBe("data-userid");
    expect(reactAttr("aria-label", true)).toBe("aria-label");
    expect(reactAttr("viewBox", true)).toBe("viewBox");
    expect(reactAttr("stroke-width", true)).toBe("strokeWidth");
    expect(camelAttr("xlink:href")).toBe("xlinkHref");
    expect(camelAttr("xml:space")).toBe("xmlSpace");
  });

  it("turns style strings into objects", () => {
    expect(cssProp("-webkit-transition")).toBe("WebkitTransition");
    expect(cssProp("-ms-flex")).toBe("msFlex");
    expect(cssProp("--brand-color")).toBe("--brand-color");
    expect(styleObject("color: red; font-size: 12px; opacity: .5; z-index: 2;")).toBe(
      '{{ color: "red", fontSize: "12px", opacity: 0.5, zIndex: 2 }}',
    );
    expect(styleObject("background: url('a;b.png'); --gap: 4")).toBe(
      `{{ background: "url('a;b.png')", "--gap": "4" }}`,
    );
    const warned: string[] = [];
    expect(styleObject("color: red !important", (w) => warned.push(w))).toBe('{{ color: "red" }}');
    expect(warned).toEqual(["important"]);
    expect(styleObject("")).toBe("{{}}");
  });

  it("writes a full element", () => {
    const r = jsx(
      '<label for="n" class="l" style="margin-top: 4px">Name</label><input id="n" value="a" checked tabindex="2" onclick="go()">',
    );
    expect(r.code).toBe(
      [
        "<>",
        '  <label htmlFor="n" className="l" style={{ marginTop: "4px" }}>Name</label>',
        "  <input",
        '    id="n"',
        '    defaultValue="a"',
        "    defaultChecked",
        "    tabIndex={2}",
        "    onClick={(event) => { go(); }}",
        "  />",
        "</>",
        "",
      ].join("\n"),
    );
    expect(r.warnings).toEqual(["event"]);
  });

  it("quotes attribute values safely", () => {
    expect(jsx(`<a title='say "hi"'>x</a>`).code).toBe(`<a title='say "hi"'>x</a>\n`);
    expect(jsx(`<a title="it's &quot;x&quot;">x</a>`).code).toContain(`title="it's &quot;x&quot;"`);
  });
});

describe("html-to-jsx: content", () => {
  it("escapes braces and > in text, converts comments", () => {
    expect(jsx("<p>{a} > b</p>").code).toBe('<p>{"{"}a{"}"} &gt; b</p>\n');
    expect(jsx("<div><!-- note */ here --><br></div>").code).toBe(
      "<div>\n  {/* note * / here */}\n  <br />\n</div>\n",
    );
  });

  it("keeps meaningful spaces between inline elements", () => {
    const code = jsx("<p>Hello <b>big</b> <i>world</i>!</p>").code;
    expect(code).toBe(
      ["<p>", '  Hello{" "}', "  <b>big</b>", '  {" "}', "  <i>world</i>", "  !", "</p>", ""].join(
        "\n",
      ),
    );
  });

  it("preserves <pre> whitespace and moves textarea content to defaultValue", () => {
    expect(jsx("<pre>  a\n b</pre>").code).toBe('<pre>\n  {"  a\\n b"}\n</pre>\n');
    expect(jsx("<textarea>hi</textarea>").code).toBe('<textarea defaultValue="hi" />\n');
  });

  it("wraps style and script bodies in template literals", () => {
    const interp = "$" + "{x}";
    const r = jsx(`<style>.a { content: \`${interp}\` }</style><script>run()</script>`);
    expect(r.code).toContain(`<style>{\`.a { content: \\\`\\${interp}\\\` }\`}</style>`);
    expect(r.warnings).toContain("script");
  });

  it("wraps several roots in a fragment", () => {
    expect(jsx("<p>a</p>\n<p>b</p>").code).toBe("<>\n  <p>a</p>\n  <p>b</p>\n</>\n");
    expect(jsx("just text").code).toBe("<>\n  just text\n</>\n");
  });
});

describe("html-to-jsx: SVG and components", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="i"><path stroke-width="2" d="M1 1"/><use xlink:href="#a"/></svg>';

  it("camelCases SVG attributes and keeps their case", () => {
    const r = jsx(svg);
    expect(r.svg).toBe(true);
    expect(r.code).toContain('<path strokeWidth="2" d="M1 1" />');
    expect(r.code).toContain('<use xlinkHref="#a" />');
    expect(r.code).toContain('viewBox="0 0 24 24"');
    expect(jsx("<svg><linearGradient id='g'/></svg>").code).toContain('<linearGradient id="g" />');
  });

  it("wraps in a component, spreading props on the SVG root", () => {
    const r = jsx(svg, { component: true, name: "arrow-left" });
    expect(r.code).toStartWith("export default function ArrowLeft(props) {\n  return (\n    <svg ");
    expect(r.code).toContain(' className="i" {...props}>');
    expect(r.code).toEndWith("  );\n}\n");
    const ts = jsx(svg, { component: true, name: "", typescript: true }).code;
    expect(ts).toStartWith('import type { SVGProps } from "react";');
    expect(ts).toContain("function Icon(props: SVGProps<SVGSVGElement>)");
    expect(jsx("<p>x</p>", { component: true, name: "" }).code).toBe(
      "export default function Component() {\n  return (\n    <p>x</p>\n  );\n}\n",
    );
  });

  it("writes react-native-svg components", () => {
    const r = jsx(svg, { component: true, name: "Logo", native: true, typescript: true });
    expect(r.code).toStartWith(
      'import Svg, { Path, Use, type SvgProps } from "react-native-svg";\n\nexport default function Logo(props: SvgProps) {',
    );
    expect(r.code).toContain('<Svg viewBox="0 0 24 24" {...props}>');
    expect(r.code).not.toContain("xmlns");
    expect(r.warnings).toEqual(["rnClass"]);
  });

  it("names components", () => {
    expect(componentName("my cool-icon", true)).toBe("MyCoolIcon");
    expect(componentName("", true)).toBe("Icon");
    expect(componentName("3d", false)).toBe("C3d");
  });
});
