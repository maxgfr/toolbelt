import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Field, Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { xmlErrorText } from "../xml/messages";
import { detect, jsonToXml, xmlToJsonValue } from "./logic";

type Dir = "json-xml" | "xml-json";
type Indent = "2" | "4" | "tab" | "min";

const T = {
  toXml: l("JSON → XML", "JSON → XML", "JSON → XML"),
  toJson: l("XML → JSON", "XML → JSON", "XML → JSON"),
  json: l("JSON", "JSON", "JSON"),
  xml: l("XML", "XML", "XML"),
  jsonPh: l(
    'Paste JSON, e.g. {"book": {"@id": "1", "title": "Dune", "tag": ["sf", "classic"]}}',
    'Colle du JSON, par ex. {"book": {"@id": "1", "title": "Dune", "tag": ["sf", "classic"]}}',
    'Füge JSON ein, z. B. {"book": {"@id": "1", "title": "Dune", "tag": ["sf", "classic"]}}',
  ),
  xmlPh: l(
    "Paste XML or drop a file…",
    "Colle du XML ou dépose un fichier…",
    "Füge XML ein oder lege eine Datei ab…",
  ),
  root: l("Root element", "Élément racine", "Wurzelelement"),
  rootPh: l("auto", "auto", "auto"),
  rootHint: l(
    "Empty: the single top-level key, or <root>.",
    "Vide : la clé de premier niveau si elle est seule, sinon <root>.",
    "Leer: der einzige Schlüssel der obersten Ebene, sonst <root>.",
  ),
  indent: l("Indentation", "Indentation", "Einrückung"),
  spaces2: l("2 spaces", "2 espaces", "2 Leerzeichen"),
  spaces4: l("4 spaces", "4 espaces", "4 Leerzeichen"),
  tab: l("Tab", "Tabulation", "Tabulator"),
  minify: l("Minified", "Minifié", "Minifiziert"),
  declaration: l("XML declaration", "Déclaration XML", "XML-Deklaration"),
  typed: l(
    "Typed values (numbers, booleans)",
    "Valeurs typées (nombres, booléens)",
    "Typisierte Werte (Zahlen, Booleans)",
  ),
  swap: l("Swap", "Inverser", "Tauschen"),
  validJson: l("Valid JSON", "JSON valide", "Gültiges JSON"),
  validXml: l("Well-formed XML", "XML bien formé", "Wohlgeformtes XML"),
  looksXml: l(
    "This looks like XML: switch to XML → JSON?",
    "Ça ressemble à du XML : passer en XML → JSON ?",
    "Das sieht nach XML aus: zu XML → JSON wechseln?",
  ),
  looksJson: l(
    "This looks like JSON: switch to JSON → XML?",
    "Ça ressemble à du JSON : passer en JSON → XML ?",
    "Das sieht nach JSON aus: zu JSON → XML wechseln?",
  ),
  renamed: l(
    "Renamed to valid XML names: {list}.",
    "Renommés en noms XML valides : {list}.",
    "In gültige XML-Namen umbenannt: {list}.",
  ),
  rules: l(
    'Keys starting with "@" are attributes, "#text" is the text, "#cdata" a CDATA section, arrays repeat the element.',
    'Les clés commençant par "@" sont des attributs, "#text" le texte, "#cdata" une section CDATA, les tableaux répètent l\'élément.',
    'Schlüssel mit "@" am Anfang sind Attribute, "#text" ist der Text, "#cdata" ein CDATA-Abschnitt, Arrays wiederholen das Element.',
  ),
};

const UNITS: Record<Indent, string> = { "2": "  ", "4": "    ", tab: "\t", min: "" };

export default function JsonXml() {
  const dir = useToolState<Dir>("dir", "json-xml");
  const input = useToolState("input", "");
  const root = useToolState("root", "");
  const indent = useToolState<Indent>("indent", "2");
  const declaration = useToolState("declaration", false);
  const typed = useToolState("typed", true);

  const result = useComputed(() => {
    const text = input.value;
    if (!text.trim()) return null;
    if (dir.value === "json-xml") {
      const p = parseJson(text);
      if (!p.ok) return { kind: "json-error" as const, error: p };
      const r = jsonToXml(p.value, {
        root: root.value,
        indent: UNITS[indent.value],
        declaration: declaration.value,
      });
      return { kind: "ok" as const, output: r.xml, renamed: r.renamed };
    }
    const r = xmlToJsonValue(text, typed.value);
    if (!r.ok) return { kind: "xml-error" as const, error: r.error };
    const space =
      indent.value === "min" ? undefined : indent.value === "tab" ? "\t" : Number(indent.value);
    return { kind: "ok" as const, output: JSON.stringify(r.value, null, space), renamed: [] };
  });

  const r = result.value;
  const toXml = dir.value === "json-xml";
  const looks = r && r.kind !== "ok" ? detect(input.value) : null;
  const wrong = looks && (toXml ? looks === "xml" : looks === "json");

  const flip = () => {
    if (r?.kind === "ok") input.value = r.output;
    dir.value = toXml ? "xml-json" : "json-xml";
  };

  let note = null;
  if (r?.kind === "json-error") note = <ParseNote error={r.error} />;
  else if (r?.kind === "xml-error") note = <span class="error">{xmlErrorText(r.error)}</span>;
  else if (r) note = <span class="success">✓ {tr(toXml ? T.validJson : T.validXml)}</span>;

  return (
    <>
      <div class="row">
        <Segmented<Dir>
          value={dir.value}
          onChange={(v) => {
            dir.value = v;
          }}
          options={[
            { value: "json-xml", label: tr(T.toXml) },
            { value: "xml-json", label: tr(T.toJson) },
          ]}
        />
        <Button size="sm" variant="ghost" icon="swap" onClick={flip}>
          {tr(T.swap)}
        </Button>
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
            { value: "min", label: tr(T.minify) },
          ]}
        />
      </div>
      <div class="row">
        {toXml ? (
          <>
            <Field label={tr(T.root)} hint={tr(T.rootHint)}>
              <input
                class="input mono json-xml-root"
                value={root.value}
                placeholder={tr(T.rootPh)}
                spellcheck={false}
                onInput={(e) => {
                  root.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <Toggle
              checked={declaration.value}
              onChange={(v) => {
                declaration.value = v;
              }}
              label={tr(T.declaration)}
            />
          </>
        ) : (
          <Toggle
            checked={typed.value}
            onChange={(v) => {
              typed.value = v;
            }}
            label={tr(T.typed)}
          />
        )}
      </div>
      {wrong && (
        <p class="data-warn small">
          <button
            type="button"
            class="json-xml-switch"
            onClick={() => (dir.value = toXml ? "xml-json" : "json-xml")}
          >
            {tr(toXml ? T.looksXml : T.looksJson)}
          </button>
        </p>
      )}
      <div class="grid-2">
        <TextBox
          label={tr(toXml ? T.json : T.xml)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(toXml ? T.jsonPh : T.xmlPh)}
          accept={
            toXml ? ".json,application/json,text/plain" : ".xml,.svg,.rss,text/xml,application/xml"
          }
          rows={22}
          wrap={false}
          invalid={!!r && r.kind !== "ok"}
          note={note}
        />
        <TextBox
          label={tr(toXml ? T.xml : T.json)}
          value={r?.kind === "ok" ? r.output : ""}
          readOnly
          rows={22}
          wrap={indent.value === "min"}
          downloadName={toXml ? "data.xml" : "data.json"}
          note={
            r?.kind === "ok" && r.renamed.length ? (
              <span class="data-warn">
                {tr(T.renamed).replace(
                  "{list}",
                  r.renamed.map(([a, b]) => `${a} → ${b}`).join(", "),
                )}
              </span>
            ) : (
              <span class="muted">{tr(T.rules)}</span>
            )
          }
        />
      </div>
    </>
  );
}
