import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Segmented, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { parseXml, writeXml, xmlStats, xmlToJson } from "./logic";
import { xmlErrorText } from "./messages";

type Mode = "format" | "minify" | "json";
type Indent = "2" | "4" | "tab";

const T = {
  input: l("XML", "XML", "XML"),
  output: l("Result", "Résultat", "Ergebnis"),
  placeholder: l(
    "Paste XML (or SVG, RSS, a sitemap…), or drop a file…",
    "Colle du XML (ou du SVG, du RSS, un sitemap…), ou dépose un fichier…",
    "Füge XML ein (oder SVG, RSS, eine Sitemap…) oder lege eine Datei ab…",
  ),
  format: l("Format", "Formater", "Formatieren"),
  minify: l("Minify", "Minifier", "Minifizieren"),
  json: l("XML → JSON", "XML → JSON", "XML → JSON"),
  indent: l("Indentation", "Indentation", "Einrückung"),
  spaces2: l("2 spaces", "2 espaces", "2 Leerzeichen"),
  spaces4: l("4 spaces", "4 espaces", "4 Leerzeichen"),
  tab: l("Tab", "Tabulation", "Tabulator"),
  removeComments: l("Remove comments", "Retirer les commentaires", "Kommentare entfernen"),
  collapse: l(
    "Write empty elements as <a/>",
    "Écrire les éléments vides en <a/>",
    "Leere Elemente als <a/> schreiben",
  ),
  valid: l("Well-formed XML", "XML bien formé", "Wohlgeformtes XML"),
  jsonNote: l(
    'Attributes become "@name", text next to attributes or children becomes "#text", repeated elements become arrays.',
    'Les attributs deviennent "@nom", le texte à côté d\'attributs ou d\'enfants devient "#text", les éléments répétés deviennent des tableaux.',
    'Attribute werden zu "@name", Text neben Attributen oder Kindelementen wird zu "#text", wiederholte Elemente werden zu Arrays.',
  ),
  elements: l("Elements", "Éléments", "Elemente"),
  attributes: l("Attributes", "Attributs", "Attribute"),
  depth: l("Depth", "Profondeur", "Tiefe"),
};

const UNITS: Record<Indent, string> = { "2": "  ", "4": "    ", tab: "\t" };

export default function Xml() {
  const input = useToolState("input", "");
  const mode = useToolState<Mode>("mode", "format");
  const indent = useToolState<Indent>("indent", "2");
  const removeComments = useToolState("removeComments", false);
  const collapse = useToolState("collapse", false);

  const doc = useComputed(() => (input.value.trim() ? parseXml(input.value) : null));
  const output = useComputed(() => {
    const d = doc.value;
    if (!d?.ok) return "";
    if (mode.value === "json")
      return JSON.stringify(
        xmlToJson(d.root),
        null,
        indent.value === "tab" ? "\t" : Number(indent.value),
      );
    return writeXml(d.nodes, {
      indent: mode.value === "minify" ? "" : UNITS[indent.value],
      removeComments: removeComments.value,
      collapseEmpty: collapse.value,
    });
  });
  const d = doc.value;
  const stats = d?.ok ? xmlStats(d.root) : null;

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "format", label: tr(T.format) },
            { value: "minify", label: tr(T.minify) },
            { value: "json", label: tr(T.json) },
          ]}
        />
        {mode.value !== "minify" && (
          <Segmented<Indent>
            label={tr(T.indent)}
            value={indent.value}
            onChange={(v) => {
              indent.value = v;
            }}
            options={[
              { value: "2", label: tr(T.spaces2) },
              { value: "4", label: tr(T.spaces4) },
              { value: "tab", label: tr(T.tab) },
            ]}
          />
        )}
        {mode.value !== "json" && (
          <>
            <Toggle
              checked={removeComments.value}
              onChange={(v) => {
                removeComments.value = v;
              }}
              label={tr(T.removeComments)}
            />
            <Toggle
              checked={collapse.value}
              onChange={(v) => {
                collapse.value = v;
              }}
              label={tr(T.collapse)}
            />
          </>
        )}
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".xml,.svg,.rss,.atom,.xsd,.xsl,.plist,text/xml,application/xml"
          rows={22}
          wrap={false}
          invalid={d ? !d.ok : false}
          note={
            d &&
            (d.ok ? (
              <span class="success">✓ {tr(T.valid)}</span>
            ) : (
              <span class="error">{xmlErrorText(d.error)}</span>
            ))
          }
        />
        <TextBox
          label={tr(T.output)}
          value={output.value}
          readOnly
          rows={22}
          wrap={mode.value === "minify"}
          downloadName={
            mode.value === "json"
              ? "data.json"
              : mode.value === "minify"
                ? "data.min.xml"
                : "data.xml"
          }
          note={mode.value === "json" ? <span class="muted">{tr(T.jsonNote)}</span> : null}
        />
      </div>
      {stats && (
        <Stats
          items={[
            { label: tr(T.elements), value: fmt(stats.elements) },
            { label: tr(T.attributes), value: fmt(stats.attributes) },
            { label: tr(T.depth), value: fmt(stats.depth) },
          ]}
        />
      )}
    </>
  );
}
