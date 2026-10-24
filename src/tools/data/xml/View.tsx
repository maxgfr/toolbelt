import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Segmented, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { atText } from "../_ui";
import { parseXml, writeXml, type XmlError, xmlStats, xmlToJson } from "./logic";

type Mode = "format" | "minify" | "json";
type Indent = "2" | "4" | "tab";

const T = {
  input: l("XML", "XML"),
  output: l("Result", "Résultat"),
  placeholder: l(
    "Paste XML (or SVG, RSS, a sitemap…), or drop a file…",
    "Colle du XML (ou du SVG, du RSS, un sitemap…), ou dépose un fichier…",
  ),
  format: l("Format", "Formater"),
  minify: l("Minify", "Minifier"),
  json: l("XML → JSON", "XML → JSON"),
  indent: l("Indentation", "Indentation"),
  spaces2: l("2 spaces", "2 espaces"),
  spaces4: l("4 spaces", "4 espaces"),
  tab: l("Tab", "Tabulation"),
  removeComments: l("Remove comments", "Retirer les commentaires"),
  collapse: l("Write empty elements as <a/>", "Écrire les éléments vides en <a/>"),
  valid: l("Well-formed XML", "XML bien formé"),
  jsonNote: l(
    'Attributes become "@name", text next to attributes or children becomes "#text", repeated elements become arrays.',
    'Les attributs deviennent "@nom", le texte à côté d\'attributs ou d\'enfants devient "#text", les éléments répétés deviennent des tableaux.',
  ),
  elements: l("Elements", "Éléments"),
  attributes: l("Attributes", "Attributs"),
  depth: l("Depth", "Profondeur"),
  e: {
    unterminated: l("“{name}” is never closed.", "« {name} » n'est jamais fermé."),
    mismatch: l(
      "Closing tag </{name}> does not match the open <{expected}>.",
      "La balise fermante </{name}> ne correspond pas à <{expected}> ouverte.",
    ),
    "unexpected-close": l(
      "Closing tag </{name}> without an opening tag.",
      "Balise fermante </{name}> sans balise ouvrante.",
    ),
    unclosed: l("<{name}> is never closed.", "<{name}> n'est jamais fermée."),
    "text-outside": l("Text outside the root element.", "Du texte en dehors de l'élément racine."),
    "multiple-roots": l(
      "A second root element <{name}>: XML allows only one.",
      "Un second élément racine <{name}> : le XML n'en permet qu'un.",
    ),
    "no-root": l("No root element.", "Aucun élément racine."),
    "bad-tag": l("Invalid tag.", "Balise invalide."),
    "bad-attr": l(
      'Invalid attribute “{name}”: it needs a quoted value, like name="value".',
      'Attribut « {name} » invalide : il faut une valeur entre guillemets, comme nom="valeur".',
    ),
    "dup-attr": l("Attribute “{name}” appears twice.", "L'attribut « {name} » apparaît deux fois."),
    "missing-space": l(
      "Attributes must be separated by a space.",
      "Les attributs doivent être séparés par une espace.",
    ),
    "lt-in-attr": l(
      "“<” is not allowed in the value of “{name}”: write &lt;.",
      "« < » est interdit dans la valeur de « {name} » : écris &lt;.",
    ),
    "bad-entity": l(
      "Invalid or unknown entity “{name}” (write & as &amp;).",
      "Entité invalide ou inconnue « {name} » (écris & sous la forme &amp;).",
    ),
    "cdata-outside": l(
      "A CDATA section outside the root element.",
      "Une section CDATA en dehors de l'élément racine.",
    ),
    "decl-position": l(
      "The <?xml …?> declaration must come first.",
      "La déclaration <?xml …?> doit être au tout début.",
    ),
  },
};

/** Names of the constructs an "unterminated" error can be about. */
const WHAT: Record<string, L10n> = {
  comment: l("comment", "commentaire"),
  cdata: l("CDATA section", "section CDATA"),
  pi: l("<?…?>", "<?…?>"),
  doctype: l("DOCTYPE", "DOCTYPE"),
};

function errorText(e: XmlError): string {
  const what = e.code === "unterminated" && e.name ? WHAT[e.name] : undefined;
  const name = what ? tr(what) : (e.name ?? "");
  return `${atText(e.line, e.column)} — ${tr(T.e[e.code])
    .replace("{name}", name)
    .replace("{expected}", e.expected ?? "")}`;
}

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
              <span class="error">{errorText(d.error)}</span>
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
