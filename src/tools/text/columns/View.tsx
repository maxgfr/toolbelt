import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Field, Segmented, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { Group } from "../_ui";
import {
  type Delimiter,
  delimiterString,
  detectDelimiter,
  extract,
  parse,
  parseSpec,
  resolveSpec,
  toSpec,
} from "./logic";

type In = "auto" | Delimiter;
type Out = "same" | "comma" | "tab" | "semicolon" | "pipe" | "space" | "custom";

const PREVIEW_ROWS = 8;

const T = {
  input: l("Delimited text", "Texte délimité", "Text mit Trennzeichen"),
  placeholder: l(
    "Paste CSV, TSV, a log or a command output…",
    "Colle du CSV, du TSV, un journal ou une sortie de commande…",
    "Füge CSV, TSV, ein Log oder eine Befehlsausgabe ein…",
  ),
  delimiter: l("Delimiter", "Délimiteur", "Trennzeichen"),
  auto: l("Auto", "Auto", "Auto"),
  spaces: l("Spaces", "Espaces", "Leerzeichen"),
  space: l("Space", "Espace", "Leerzeichen"),
  tab: l("Tab", "Tab", "Tab"),
  custom: l("Other", "Autre", "Andere"),
  same: l("Same", "Identique", "Gleich"),
  detected: l("detected: {d}", "détecté : {d}", "erkannt: {d}"),
  quotes: l('Respect "quotes"', 'Respecter les "guillemets"', '"Anführungszeichen" beachten'),
  trim: l("Trim fields", "Retirer les espaces des champs", "Felder trimmen"),
  columns: l("Columns", "Colonnes", "Spalten"),
  columnsPh: l(
    "e.g. 1,3-4 or 2- (empty = all)",
    "par ex. 1,3-4 ou 2- (vide = toutes)",
    "z. B. 1,3-4 oder 2- (leer = alle)",
  ),
  columnsHint: l(
    "Or click the column headers below.",
    "Ou clique sur les en-têtes de colonnes ci-dessous.",
    "Oder klicke unten auf die Spaltenköpfe.",
  ),
  badSpec: l(
    "“{t}” is not a column or range (use 2, 1-3, 4-).",
    "« {t} » n'est ni une colonne ni un intervalle (utilise 2, 1-3, 4-).",
    "„{t}“ ist weder Spalte noch Bereich (nutze 2, 1-3, 4-).",
  ),
  output: l("Output delimiter", "Délimiteur de sortie", "Trennzeichen der Ausgabe"),
  result: l("Extracted columns", "Colonnes extraites", "Extrahierte Spalten"),
  rows: l("Rows", "Lignes", "Zeilen"),
  width: l("Columns", "Colonnes", "Spalten"),
  picked: l("Picked", "Choisies", "Ausgewählt"),
  preview: l("Preview (first rows)", "Aperçu (premières lignes)", "Vorschau (erste Zeilen)"),
  toggleCol: l("Toggle column {n}", "Basculer la colonne {n}", "Spalte {n} umschalten"),
};

const IN_LABELS: Record<Exclude<In, "auto" | "custom" | "spaces" | "tab">, string> = {
  comma: ",",
  semicolon: ";",
  pipe: "|",
};

const DETECTED: Record<Exclude<Delimiter, "custom">, L10n> = {
  comma: l("comma", "virgule", "Komma"),
  tab: l("tab", "tabulation", "Tabulator"),
  semicolon: l("semicolon", "point-virgule", "Semikolon"),
  pipe: l("pipe", "barre verticale", "senkrechter Strich"),
  spaces: l("spaces", "espaces", "Leerzeichen"),
};

export default function Columns() {
  const text = useToolState("text", "");
  const delim = useToolState<In>("delim", "auto");
  const custom = useToolState("custom", "");
  const quotes = useToolState("quotes", true);
  const trim = useToolState("trim", true);
  const spec = useToolState("spec", "");
  const out = useToolState<Out>("out", "same");
  const outCustom = useToolState("outCustom", "");

  const actual = useComputed<Delimiter>(() =>
    delim.value === "auto" ? detectDelimiter(text.value) : delim.value,
  );
  const rows = useComputed(() =>
    parse(text.value, delimiterString(actual.value, custom.value), quotes.value),
  );
  const width = useComputed(() => rows.value.reduce((m, r) => Math.max(m, r.length), 0));
  const parsedSpec = useComputed(() => parseSpec(spec.value));
  const cols = useComputed(() =>
    parsedSpec.value.ok ? resolveSpec(parsedSpec.value.items, width.value) : [],
  );
  const outSep = useComputed(() => {
    const o = out.value;
    if (o === "same") {
      const s = delimiterString(actual.value, custom.value);
      return s === "spaces" ? " " : s;
    }
    if (o === "custom") return outCustom.value;
    return { comma: ",", tab: "\t", semicolon: ";", pipe: "|", space: " " }[o];
  });
  const result = useComputed(() =>
    parsedSpec.value.ok
      ? extract(rows.value, cols.value, outSep.value, { trim: trim.value, quote: quotes.value })
      : "",
  );
  const ps = parsedSpec.value;

  const toggleCol = (c: number) => {
    const current = spec.value.trim() ? cols.value : [];
    spec.value = toSpec(current.includes(c) ? current.filter((x) => x !== c) : [...current, c]);
  };

  return (
    <>
      <div class="row tx-options">
        <Group label={tr(T.delimiter)}>
          <div class="row">
            <Segmented<In>
              label={tr(T.delimiter)}
              value={delim.value}
              onChange={(v) => {
                delim.value = v;
              }}
              options={[
                { value: "auto", label: tr(T.auto) },
                ...(Object.keys(IN_LABELS) as (keyof typeof IN_LABELS)[]).map((k) => ({
                  value: k,
                  label: IN_LABELS[k],
                })),
                { value: "tab", label: tr(T.tab) },
                { value: "spaces", label: tr(T.spaces) },
                { value: "custom", label: tr(T.custom) },
              ]}
            />
            {delim.value === "custom" && (
              <input
                class="input mono columns-sep"
                value={custom.value}
                aria-label={tr(T.custom)}
                onInput={(e) => {
                  custom.value = e.currentTarget.value;
                }}
              />
            )}
            {delim.value === "auto" && text.value.trim() && actual.value !== "custom" && (
              <span class="muted small">
                {tr(T.detected).replace("{d}", tr(DETECTED[actual.value]))}
              </span>
            )}
          </div>
        </Group>
        <Toggle
          checked={quotes.value}
          onChange={(v) => {
            quotes.value = v;
          }}
          label={tr(T.quotes)}
        />
        <Toggle
          checked={trim.value}
          onChange={(v) => {
            trim.value = v;
          }}
          label={tr(T.trim)}
        />
      </div>
      <TextBox
        label={tr(T.input)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        accept=".csv,.tsv,.txt,.log,text/*"
        rows={10}
        wrap={false}
      />
      <div class="row tx-options">
        <Field label={tr(T.columns)} hint={tr(T.columnsHint)} class="columns-spec">
          <input
            class="input mono"
            value={spec.value}
            placeholder={tr(T.columnsPh)}
            aria-invalid={!ps.ok}
            spellcheck={false}
            onInput={(e) => {
              spec.value = e.currentTarget.value;
            }}
          />
        </Field>
        <Group label={tr(T.output)}>
          <div class="row">
            <Segmented<Out>
              label={tr(T.output)}
              value={out.value}
              onChange={(v) => {
                out.value = v;
              }}
              options={[
                { value: "same", label: tr(T.same) },
                { value: "comma", label: "," },
                { value: "semicolon", label: ";" },
                { value: "pipe", label: "|" },
                { value: "tab", label: tr(T.tab) },
                { value: "space", label: tr(T.space) },
                { value: "custom", label: tr(T.custom) },
              ]}
            />
            {out.value === "custom" && (
              <input
                class="input mono columns-sep"
                value={outCustom.value}
                aria-label={tr(T.custom)}
                onInput={(e) => {
                  outCustom.value = e.currentTarget.value;
                }}
              />
            )}
          </div>
        </Group>
      </div>
      {!ps.ok && <p class="error-note">{tr(T.badSpec).replace("{t}", ps.token)}</p>}
      {rows.value.length > 0 && (
        <>
          <Stats
            items={[
              { label: tr(T.rows), value: fmt(rows.value.length) },
              { label: tr(T.width), value: fmt(width.value) },
              { label: tr(T.picked), value: fmt(cols.value.length) },
            ]}
          />
          <div class="table-wrap columns-preview">
            <table class="table">
              <caption class="sr-only">{tr(T.preview)}</caption>
              <thead>
                <tr>
                  {Array.from({ length: width.value }, (_, c) => (
                    <th
                      key={c}
                      class={spec.value.trim() && cols.value.includes(c) ? "columns-on" : ""}
                    >
                      <button
                        type="button"
                        class="columns-head"
                        aria-pressed={!!spec.value.trim() && cols.value.includes(c)}
                        aria-label={tr(T.toggleCol).replace("{n}", String(c + 1))}
                        onClick={() => toggleCol(c)}
                      >
                        {c + 1}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.value.slice(0, PREVIEW_ROWS).map((r, i) => (
                  <tr key={i}>
                    {Array.from({ length: width.value }, (_, c) => (
                      <td
                        key={c}
                        class={spec.value.trim() && cols.value.includes(c) ? "columns-on" : ""}
                      >
                        {r[c] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <TextBox
        label={tr(T.result)}
        value={result.value}
        readOnly
        rows={10}
        wrap={false}
        downloadName="columns.txt"
      />
    </>
  );
}
