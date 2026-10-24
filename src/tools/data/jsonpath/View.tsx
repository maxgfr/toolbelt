import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { formatPath, preview } from "../_shared";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { PRESETS, type QueryError, query, SAMPLE } from "./logic";

type Show = "values" | "paths";

const T = {
  json: l("JSON", "JSON", "JSON"),
  placeholder: l(
    "Paste the JSON to query, or load the sample…",
    "Colle le JSON à interroger, ou charge l'exemple…",
    "Füge das abzufragende JSON ein oder lade das Beispiel…",
  ),
  query: l("JSONPath query", "Requête JSONPath", "JSONPath-Abfrage"),
  sample: l("Load sample", "Charger l'exemple", "Beispiel laden"),
  examples: l("Examples", "Exemples", "Beispiele"),
  values: l("Values", "Valeurs", "Werte"),
  paths: l("Paths", "Chemins", "Pfade"),
  results: l("Results", "Résultats", "Ergebnisse"),
  matches: l("{n} matches", "{n} résultats", "{n} Treffer"),
  one: l("1 match", "1 résultat", "1 Treffer"),
  none: l("No match.", "Aucun résultat.", "Kein Treffer."),
  path: l("Path", "Chemin", "Pfad"),
  value: l("Value", "Valeur", "Wert"),
  capped: l(
    "Showing the first {shown} of {total}.",
    "Affichage des {shown} premiers sur {total}.",
    "Die ersten {shown} von {total} werden angezeigt.",
  ),
  root: l(
    "A JSONPath starts with $.",
    "Une requête JSONPath commence par $.",
    "Ein JSONPath beginnt mit $.",
  ),
  empty: l(
    "Type a query, e.g. $.store.book[*].author",
    "Tape une requête, par ex. $.store.book[*].author",
    "Gib eine Abfrage ein, z. B. $.store.book[*].author",
  ),
  unexpected: l(
    "Unexpected character at column {col}.",
    "Caractère inattendu à la colonne {col}.",
    "Unerwartetes Zeichen an Spalte {col}.",
  ),
  expected: l(
    "Expected {what} at column {col}.",
    "{what} attendu à la colonne {col}.",
    "An Spalte {col} wurde {what} erwartet.",
  ),
  aName: l("a name", "Un nom", "ein Name"),
  quoted: l('"{x}"', "« {x} »", "„{x}“"),
  unterminated: l(
    "Unclosed string starting at column {col}.",
    "Chaîne non fermée à partir de la colonne {col}.",
    "Nicht geschlossener String ab Spalte {col}.",
  ),
  syntax: l(
    "Supported: $ .key ['key'] [n] [-n] [start:end:step] [*] .. [a,b] [?(@.x < 1 && @.y == 'z')]",
    "Pris en charge : $ .clé ['clé'] [n] [-n] [début:fin:pas] [*] .. [a,b] [?(@.x < 1 && @.y == 'z')]",
    "Unterstützt: $ .schlüssel ['schlüssel'] [n] [-n] [start:ende:schritt] [*] .. [a,b] [?(@.x < 1 && @.y == 'z')]",
  ),
};

const MAX = 500;

function errorText(e: QueryError): string {
  const col = fmt(e.pos + 1);
  switch (e.code) {
    case "root":
      return tr(T.root);
    case "empty":
      return tr(T.empty);
    case "unterminated":
      return tr(T.unterminated).replace("{col}", col);
    case "expected":
      return tr(T.expected)
        .replace(
          "{what}",
          e.expected === "name" ? tr(T.aName) : tr(T.quoted).replace("{x}", e.expected ?? ""),
        )
        .replace("{col}", col);
    default:
      return tr(T.unexpected).replace("{col}", col);
  }
}

export default function JsonPath() {
  const input = useToolState("input", "");
  const q = useToolState("query", "$.store.book[*].author");
  const show = useToolState<Show>("show", "values");

  const parsed = useComputed(() => (input.value.trim() ? parseJson(input.value) : null));
  const result = useComputed(() => {
    const p = parsed.value;
    return p?.ok ? query(p.value, q.value) : null;
  });
  const output = useComputed(() => {
    const r = result.value;
    if (!r?.ok) return "";
    return show.value === "values"
      ? JSON.stringify(
          r.nodes.map((n) => n.value),
          null,
          2,
        )
      : r.nodes.map((n) => formatPath(n.path)).join("\n");
  });
  const p = parsed.value;
  const r = result.value;

  return (
    <>
      <div class="stack jsonpath-query">
        <label class="field">
          <span class="field-label">{tr(T.query)}</span>
          <input
            class="input mono"
            value={q.value}
            spellcheck={false}
            aria-invalid={!!r && !r.ok}
            onInput={(e) => {
              q.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
          <span class="field-hint">
            {r && !r.ok ? <span class="error">{errorText(r.error)}</span> : tr(T.syntax)}
          </span>
        </label>
        <div class="row">
          <span class="muted small">{tr(T.examples)}</span>
          {PRESETS.map((pr) => (
            <button
              type="button"
              key={pr}
              class={`jsonpath-chip mono ${q.value === pr ? "on" : ""}`}
              onClick={() => {
                q.value = pr;
              }}
            >
              {pr}
            </button>
          ))}
        </div>
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.json)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".json,application/json,text/plain"
          rows={20}
          wrap={false}
          invalid={p ? !p.ok : false}
          note={p && !p.ok ? <ParseNote error={p} /> : null}
          actions={
            <Button
              size="sm"
              variant="ghost"
              icon="file"
              onClick={() => {
                input.value = JSON.stringify(SAMPLE, null, 2);
              }}
            >
              {tr(T.sample)}
            </Button>
          }
        />
        <div class="stack">
          <Segmented<Show>
            value={show.value}
            onChange={(v) => {
              show.value = v;
            }}
            options={[
              { value: "values", label: tr(T.values) },
              { value: "paths", label: tr(T.paths) },
            ]}
          />
          <TextBox
            label={
              r?.ok
                ? r.nodes.length === 1
                  ? tr(T.one)
                  : tr(T.matches).replace("{n}", fmt(r.nodes.length))
                : tr(T.results)
            }
            value={output.value}
            readOnly
            rows={16}
            wrap={false}
            downloadName={show.value === "values" ? "results.json" : "paths.txt"}
          />
        </div>
      </div>
      {r?.ok &&
        (r.nodes.length === 0 ? (
          <p class="muted">{tr(T.none)}</p>
        ) : (
          <>
            <div class="table-wrap jsonpath-results">
              <table class="table">
                <thead>
                  <tr>
                    <th>{tr(T.path)}</th>
                    <th>{tr(T.value)}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.nodes.slice(0, MAX).map((n, i) => (
                    <tr key={i}>
                      <td class="mono jsonpath-path">{formatPath(n.path)}</td>
                      <td class="mono jsonpath-val">{preview(n.value, 200)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.nodes.length > MAX && (
              <p class="muted small">
                {tr(T.capped).replace("{shown}", fmt(MAX)).replace("{total}", fmt(r.nodes.length))}
              </p>
            )}
          </>
        ))}
    </>
  );
}
