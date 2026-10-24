import { describe, expect, it } from "bun:test";
import { decodeEntities, parseXml, writeXml, xmlStats, xmlToJson } from "./logic";

const pretty = { indent: "  ", removeComments: false, collapseEmpty: false };
const min = { indent: "", removeComments: false, collapseEmpty: false };

function fmtXml(src: string, o = pretty): string {
  const d = parseXml(src);
  if (!d.ok) throw new Error(d.error.code);
  return writeXml(d.nodes, o);
}

const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<!-- catalog -->
<catalog><book id="b1" lang='fr'><title>L'Étranger</title><author>Camus</author>
<notes/><empty></empty><![CDATA[ <raw> & stuff ]]></book>
<book id="b2"><title> Spaced  title </title></book></catalog>`;

describe("xml", () => {
  it("pretty-prints, keeping comments, CDATA and text as is", () => {
    expect(fmtXml(DOC)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!-- catalog -->",
        "<catalog>",
        "  <book id=\"b1\" lang='fr'>",
        "    <title>L'Étranger</title>",
        "    <author>Camus</author>",
        "    <notes/>",
        "    <empty></empty>",
        "    <![CDATA[ <raw> & stuff ]]>",
        "  </book>",
        '  <book id="b2">',
        "    <title> Spaced  title </title>",
        "  </book>",
        "</catalog>",
      ].join("\n"),
    );
  });

  it("minifies and can drop comments or collapse empty elements", () => {
    expect(fmtXml("<a>\n  <!-- c -->\n  <b> x </b>\n  <c></c>\n</a>", min)).toBe(
      "<a><!-- c --><b> x </b><c></c></a>",
    );
    expect(
      fmtXml("<a>\n  <!-- c -->\n  <b/>\n  <c></c>\n</a>", {
        indent: "\t",
        removeComments: true,
        collapseEmpty: true,
      }),
    ).toBe("<a>\n\t<b/>\n\t<c/>\n</a>");
  });

  it("puts mixed content on separate lines", () => {
    expect(fmtXml("<p>Hello <b>world</b> !</p>")).toBe("<p>\n  Hello\n  <b>world</b>\n  !\n</p>");
  });

  it("keeps a doctype with an internal subset and allows its entities", () => {
    const src = '<!DOCTYPE note [<!ENTITY who "me">]>\n<note>&who; &amp; &#233;</note>';
    expect(fmtXml(src)).toBe(
      '<!DOCTYPE note [<!ENTITY who "me">]>\n<note>&who; &amp; &#233;</note>',
    );
  });

  it("reports well-formedness errors with a position", () => {
    const err = (s: string) => {
      const d = parseXml(s);
      return d.ok ? null : d.error;
    };
    expect(err("<a>\n  <b>\n</a>")).toEqual({
      code: "mismatch",
      name: "a",
      expected: "b",
      line: 3,
      column: 1,
    });
    expect(err("<a><b></b>")).toMatchObject({ code: "unclosed", name: "a", line: 1, column: 1 });
    expect(err("<a/><b/>")).toMatchObject({ code: "multiple-roots", name: "b" });
    expect(err("</a>")).toMatchObject({ code: "unexpected-close" });
    expect(err("hello")).toMatchObject({ code: "text-outside" });
    expect(err("")).toMatchObject({ code: "no-root" });
    expect(err('<a x="1" x="2"/>')).toMatchObject({ code: "dup-attr", name: "x", column: 10 });
    expect(err('<a x="1"y="2"/>')).toMatchObject({ code: "missing-space" });
    expect(err("<a x=1/>")).toMatchObject({ code: "bad-attr", name: "x" });
    expect(err('<a x="<"/>')).toMatchObject({ code: "lt-in-attr" });
    expect(err("<a>Tom & Jerry</a>")).toMatchObject({ code: "bad-entity", column: 8 });
    expect(err("<a>&nbsp;</a>")).toMatchObject({ code: "bad-entity", name: "&nbsp;" });
    expect(err("<a><!-- open</a>")).toMatchObject({ code: "unterminated", name: "comment" });
    expect(err("<![CDATA[x]]><a/>")).toMatchObject({ code: "cdata-outside" });
    expect(err('<a/><?xml version="1.0"?>')).toMatchObject({ code: "decl-position" });
    expect(err("<a><1/></a>")).toMatchObject({ code: "bad-tag" });
  });

  it("converts to JSON", () => {
    const d = parseXml(DOC);
    if (!d.ok) throw new Error("parse");
    expect(xmlToJson(d.root)).toEqual({
      catalog: {
        book: [
          {
            "@id": "b1",
            "@lang": "fr",
            title: "L'Étranger",
            author: "Camus",
            notes: "",
            empty: "",
            "#text": "<raw> & stuff",
          },
          { "@id": "b2", title: " Spaced  title " },
        ],
      },
    });
    const one = parseXml('<r><item k="a &amp; b">x &lt; y</item></r>');
    expect(one.ok && xmlToJson(one.root)).toEqual({
      r: { item: { "@k": "a & b", "#text": "x < y" } },
    });
  });

  it("decodes entities, handles Unicode names and a BOM, counts things", () => {
    expect(decodeEntities("&lt;&#x1F600;&#233;&unknown;")).toBe("<😀é&unknown;");
    const d = parseXml('\uFEFF<café prix="3"><thé/></café>');
    expect(d.ok && xmlStats(d.root)).toEqual({ elements: 2, attributes: 1, depth: 2 });
  });
});

describe("xml edge cases", () => {
  it("leaves out-of-range character references alone", () => {
    expect(decodeEntities("&#99999999;&#x110000;&#65;")).toBe("&#99999999;&#x110000;A");
  });
});
