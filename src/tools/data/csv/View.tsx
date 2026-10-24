import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Panel, Segmented, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { DataTable, ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import {
  type CsvIssue,
  type Delimiter,
  jsonToTable,
  parseCsv,
  type Shape,
  tableToCsv,
  tableToJson,
} from "./logic";

type Mode = "csv2json" | "json2csv";

const T = {
  csv2json: l("CSV → JSON", "CSV → JSON", "CSV → JSON"),
  json2csv: l("JSON → CSV", "JSON → CSV", "JSON → CSV"),
  csv: l("CSV", "CSV", "CSV"),
  json: l("JSON", "JSON", "JSON"),
  phCsv: l(
    "Paste CSV or TSV, or drop a file…\nname,age\nAnn,30",
    "Colle du CSV ou du TSV, ou dépose un fichier…\nnom,âge\nAnn,30",
    "Füge CSV oder TSV ein oder lege eine Datei ab…\nName,Alter\nAnn,30",
  ),
  phJson: l(
    'Paste a JSON array, e.g. [{"name": "Ann", "address": {"city": "Lyon"}}]',
    'Colle un tableau JSON, par ex. [{"nom": "Ann", "adresse": {"ville": "Lyon"}}]',
    'Füge ein JSON-Array ein, z. B. [{"name": "Ann", "adresse": {"stadt": "Berlin"}}]',
  ),
  delimiter: l("Delimiter", "Séparateur", "Trennzeichen"),
  auto: l("Auto-detect", "Détection auto", "Automatisch erkennen"),
  comma: l("Comma ,", "Virgule ,", "Komma ,"),
  semicolon: l("Semicolon ;", "Point-virgule ;", "Semikolon ;"),
  tab: l("Tab", "Tabulation", "Tabulator"),
  pipe: l("Pipe |", "Barre verticale |", "Senkrechter Strich |"),
  header: l(
    "First row is a header",
    "La première ligne est un en-tête",
    "Erste Zeile ist eine Kopfzeile",
  ),
  headerOut: l("Write a header row", "Écrire une ligne d'en-tête", "Kopfzeile schreiben"),
  objects: l("Objects", "Objets", "Objekte"),
  arrays: l("Arrays", "Tableaux", "Arrays"),
  infer: l(
    "Detect numbers, booleans, null",
    "Détecter nombres, booléens, null",
    "Zahlen, Booleans, null erkennen",
  ),
  minify: l("Minify", "Minifier", "Minifizieren"),
  swap: l(
    "Use the result as input",
    "Reprendre le résultat en entrée",
    "Ergebnis als Eingabe verwenden",
  ),
  flatHint: l(
    "Nested objects become dotted columns (address.city); arrays are written as JSON.",
    "Les objets imbriqués deviennent des colonnes pointées (adresse.ville) ; les tableaux sont écrits en JSON.",
    "Verschachtelte Objekte werden zu Spalten mit Punkt (adresse.stadt); Arrays werden als JSON geschrieben.",
  ),
  notTable: l(
    "Expected an array (of objects, arrays or values) or an object.",
    "Attendu : un tableau (d'objets, de tableaux ou de valeurs) ou un objet.",
    "Erwartet: ein Array (aus Objekten, Arrays oder Werten) oder ein Objekt.",
  ),
  quotes: l(
    "Line {n}: unclosed quote.",
    "Ligne {n} : guillemet non fermé.",
    "Zeile {n}: Anführungszeichen nicht geschlossen.",
  ),
  fields: l(
    "Row {n}: {found} fields instead of {expected}.",
    "Ligne {n} : {found} champs au lieu de {expected}.",
    "Zeile {n}: {found} Felder statt {expected}.",
  ),
  more: l("…and {n} more.", "…et {n} de plus.", "…und {n} weitere."),
  rows: l("Rows", "Lignes", "Zeilen"),
  columns: l("Columns", "Colonnes", "Spalten"),
  detected: l("Delimiter", "Séparateur", "Trennzeichen"),
  preview: l("Preview", "Aperçu", "Vorschau"),
};

const DELIMS: { value: Delimiter; label: L10n }[] = [
  { value: "auto", label: T.auto },
  { value: ",", label: T.comma },
  { value: ";", label: T.semicolon },
  { value: "\t", label: T.tab },
  { value: "|", label: T.pipe },
];

function delimName(d: string): string {
  const found = DELIMS.find((x) => x.value === d && d !== "auto");
  return found ? tr(found.label) : JSON.stringify(d);
}

function issueText(i: CsvIssue): string {
  if (i.kind === "quotes") return tr(T.quotes).replace("{n}", fmt(i.at));
  return tr(T.fields)
    .replace("{n}", fmt(i.at))
    .replace("{found}", fmt(i.found ?? 0))
    .replace("{expected}", fmt(i.expected ?? 0));
}

export default function Csv() {
  const mode = useToolState<Mode>("mode", "csv2json");
  const input = useToolState("input", "");
  const delimiter = useToolState<Delimiter>("delimiter", "auto");
  const header = useToolState("header", true);
  const shape = useToolState<Shape>("shape", "objects");
  const infer = useToolState("infer", true);
  const minify = useToolState("minify", false);

  const csv = useComputed(() =>
    mode.value === "csv2json" && input.value.trim()
      ? parseCsv(input.value, delimiter.value, header.value)
      : null,
  );
  const json = useComputed(() => {
    if (mode.value !== "json2csv" || !input.value.trim()) return null;
    const p = parseJson(input.value);
    return p.ok ? { parse: p, table: jsonToTable(p.value) } : { parse: p, table: null };
  });
  const output = useComputed(() => {
    const c = csv.value;
    if (c) {
      const v = tableToJson(c, shape.value, infer.value, header.value);
      return minify.value ? JSON.stringify(v) : JSON.stringify(v, null, 2);
    }
    const t = json.value?.table;
    return t?.ok ? tableToCsv(t.header, t.rows, delimiter.value, header.value) : "";
  });

  const toJson = mode.value === "csv2json";
  const c = csv.value;
  const j = json.value;
  const table = c
    ? { header: c.header, rows: c.rows }
    : j?.table?.ok
      ? { header: j.table.header, rows: j.table.rows }
      : null;
  const issues = c?.issues ?? [];

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "csv2json", label: tr(T.csv2json) },
            { value: "json2csv", label: tr(T.json2csv) },
          ]}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="swap"
          disabled={!output.value}
          onClick={() => {
            input.value = output.value;
            mode.value = toJson ? "json2csv" : "csv2json";
          }}
        >
          {tr(T.swap)}
        </Button>
      </div>
      <div class="row">
        <label class="row small">
          <span class="muted">{tr(T.delimiter)}</span>
          <select
            class="input csv-delim"
            value={delimiter.value}
            onChange={(e) => {
              delimiter.value = (e.currentTarget as HTMLSelectElement).value as Delimiter;
            }}
          >
            {DELIMS.map((d) => (
              <option key={d.value} value={d.value}>
                {tr(d.label)}
              </option>
            ))}
          </select>
        </label>
        <Toggle
          checked={header.value}
          onChange={(v) => {
            header.value = v;
          }}
          label={tr(toJson ? T.header : T.headerOut)}
        />
        {toJson && (
          <>
            <Segmented<Shape>
              value={shape.value}
              onChange={(v) => {
                shape.value = v;
              }}
              options={[
                { value: "objects", label: tr(T.objects) },
                { value: "arrays", label: tr(T.arrays) },
              ]}
            />
            <Toggle
              checked={infer.value}
              onChange={(v) => {
                infer.value = v;
              }}
              label={tr(T.infer)}
            />
            <Toggle
              checked={minify.value}
              onChange={(v) => {
                minify.value = v;
              }}
              label={tr(T.minify)}
            />
          </>
        )}
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(toJson ? T.csv : T.json)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(toJson ? T.phCsv : T.phJson)}
          accept={toJson ? ".csv,.tsv,.txt,text/csv,text/plain" : ".json,application/json"}
          rows={18}
          wrap={false}
          invalid={!!j && (!j.parse.ok || !j.table?.ok)}
          note={
            j ? (
              !j.parse.ok ? (
                <ParseNote error={j.parse} />
              ) : !j.table?.ok ? (
                <span class="error">{tr(T.notTable)}</span>
              ) : (
                <span class="muted">{tr(T.flatHint)}</span>
              )
            ) : issues.length ? (
              <span class="data-warn">
                {issues.slice(0, 3).map(issueText).join(" ")}
                {issues.length > 3 && ` ${tr(T.more).replace("{n}", fmt(issues.length - 3))}`}
              </span>
            ) : null
          }
        />
        <TextBox
          label={tr(toJson ? T.json : T.csv)}
          value={output.value}
          readOnly
          rows={18}
          wrap={false}
          downloadName={toJson ? "data.json" : "data.csv"}
        />
      </div>
      {table && (
        <>
          <Stats
            items={[
              { label: tr(T.rows), value: fmt(table.rows.length) },
              { label: tr(T.columns), value: fmt(table.header.length) },
              ...(c ? [{ label: tr(T.detected), value: delimName(c.delimiter) }] : []),
            ]}
          />
          {table.header.length > 0 && (
            <Panel title={tr(T.preview)}>
              <DataTable header={table.header} rows={table.rows} />
            </Panel>
          )}
        </>
      )}
    </>
  );
}
