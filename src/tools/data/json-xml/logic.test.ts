import { describe, expect, it } from "bun:test";
import {
  detect,
  escapeAttr,
  jsonToXml,
  type ToXmlOptions,
  typeValues,
  xmlName,
  xmlToJsonValue,
} from "./logic";

const o: ToXmlOptions = { root: "", indent: "  ", declaration: false };
const x = (v: unknown, more: Partial<ToXmlOptions> = {}) => jsonToXml(v, { ...o, ...more }).xml;

describe("json-xml: JSON → XML", () => {
  it("uses a single top-level key as the root, attributes and text", () => {
    expect(
      x({
        book: {
          "@id": 7,
          "@lang": "fr",
          title: "Les Misérables",
          price: { "@cur": "EUR", "#text": 9.5 },
        },
      }),
    ).toBe(
      [
        '<book id="7" lang="fr">',
        "  <title>Les Misérables</title>",
        '  <price cur="EUR">9.5</price>',
        "</book>",
        "",
      ].join("\n"),
    );
  });

  it("repeats elements for arrays and wraps several keys in a root", () => {
    expect(x({ a: 1, tag: ["x", "y"], empty: null, flag: true })).toBe(
      [
        "<root>",
        "  <a>1</a>",
        "  <tag>x</tag>",
        "  <tag>y</tag>",
        "  <empty/>",
        "  <flag>true</flag>",
        "</root>",
        "",
      ].join("\n"),
    );
    expect(x([1, 2], { root: "list" })).toBe(
      "<list>\n  <item>1</item>\n  <item>2</item>\n</list>\n",
    );
    expect(x({ m: [[1, 2], [3]] })).toContain(
      "<m>\n    <item>1</item>\n    <item>2</item>\n  </m>",
    );
    expect(x({ only: [1, 2] })).toBe("<root>\n  <only>1</only>\n  <only>2</only>\n</root>\n");
  });

  it("escapes text and attributes, and supports CDATA", () => {
    expect(x({ a: { "@t": 'say "hi" & <go>', "#text": "1 < 2 && 3 > 2" } })).toBe(
      '<a t="say &quot;hi&quot; &amp; &lt;go&gt;">1 &lt; 2 &amp;&amp; 3 &gt; 2</a>\n',
    );
    expect(x({ s: { "#cdata": "a]]>b" } })).toBe("<s><![CDATA[a]]]]><![CDATA[>b]]></s>\n");
    expect(escapeAttr("a\nb")).toBe("a&#10;b");
  });

  it("fixes invalid names and reports them", () => {
    expect(xmlName("first name")).toBe("first_name");
    expect(xmlName("1st")).toBe("_1st");
    expect(xmlName("")).toBe("_");
    expect(xmlName("ns:tag")).toBe("ns:tag");
    expect(xmlName("café")).toBe("café");
    const r = jsonToXml({ "my key": 1, "2": 2 }, o);
    expect(r.xml).toContain("<my_key>1</my_key>");
    expect(r.renamed).toEqual([
      ["2", "_2"],
      ["my key", "my_key"],
    ]);
  });

  it("minifies, adds the declaration, honours the root option", () => {
    expect(x({ a: { b: 1 } }, { indent: "" })).toBe("<a><b>1</b></a>");
    expect(x({ a: 1 }, { declaration: true })).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<a>1</a>\n',
    );
    expect(x({ a: 1 }, { root: "doc" })).toBe("<doc>\n  <a>1</a>\n</doc>\n");
    expect(x("hello")).toBe("<root>hello</root>\n");
    expect(x({})).toBe("<root/>\n");
    expect(x({ a: { nested: { deep: 1 } } }, { indent: "\t" })).toBe(
      "<a>\n\t<nested>\n\t\t<deep>1</deep>\n\t</nested>\n</a>\n",
    );
  });
});

describe("json-xml: XML → JSON", () => {
  it("converts with the xml tool's conventions, typed or not", () => {
    const xml =
      '<book id="7"><title>T</title><tag>a</tag><tag>b</tag><zip>007</zip><ok>true</ok></book>';
    expect(xmlToJsonValue(xml, false)).toEqual({
      ok: true,
      value: { book: { "@id": "7", title: "T", tag: ["a", "b"], zip: "007", ok: "true" } },
    });
    expect(xmlToJsonValue(xml, true)).toEqual({
      ok: true,
      value: { book: { "@id": 7, title: "T", tag: ["a", "b"], zip: "007", ok: true } },
    });
  });

  it("reports XML errors with a position", () => {
    const r = xmlToJsonValue("<a><b></a>", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: "mismatch", line: 1 });
  });

  it("round-trips", () => {
    const value = {
      order: {
        "@id": "42",
        item: [
          { "@sku": "A", "#text": "Pen" },
          { "@sku": "B", "#text": "Ink" },
        ],
        note: "x",
      },
    };
    const back = xmlToJsonValue(jsonToXml(value, o).xml, false);
    expect(back).toEqual({ ok: true, value });
  });

  it("types values without touching keys", () => {
    expect(typeValues({ a: ["1", "x", ""], b: { c: "null" } })).toEqual({
      a: [1, "x", ""],
      b: { c: null },
    });
  });

  it("detects the input format", () => {
    expect(detect('  {"a": 1}')).toBe("json");
    expect(detect("[1]")).toBe("json");
    expect(detect("<a/>")).toBe("xml");
    expect(detect("hello")).toBeNull();
    expect(detect("")).toBeNull();
  });
});
