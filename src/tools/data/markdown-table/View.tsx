import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Panel, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import {
  type Align,
  type Export,
  exportGrid,
  type Grid,
  parseMarkdownTable,
  readTabular,
  toMarkdown,
} from "./logic";

type Mode = "to-md" | "from-md";

const T = {
  toMd: l("CSV / JSON → Markdown", "CSV / JSON → Markdown"),
  fromMd: l("Markdown → CSV / JSON", "Markdown → CSV / JSON"),
  data: l("CSV, TSV or JSON array", "CSV, TSV ou tableau JSON"),
  markdown: l("Markdown table", "Tableau Markdown"),
  phData: l(
    "Paste CSV, TSV (e.g. copied from a spreadsheet) or a JSON array…",
    "Colle du CSV, du TSV (copié d'un tableur par ex.) ou un tableau JSON…",
  ),
  phMd: l(
    "Paste a Markdown table (text around it is ignored)…",
    "Colle un tableau Markdown (le texte autour est ignoré)…",
  ),
  pretty: l("Pad columns", "Aligner les colonnes"),
  align: l("Column alignment", "Alignement des colonnes"),
  all: l("All columns", "Toutes les colonnes"),
  none: l("Default", "Par défaut"),
  left: l("Left", "Gauche"),
  center: l("Center", "Centre"),
  right: l("Right", "Droite"),
  swap: l("Use the result as input", "Reprendre le résultat en entrée"),
  noTable: l(
    "No Markdown table found: it needs a header line, then a line like | --- | :-: |.",
    "Aucun tableau Markdown trouvé : il faut une ligne d'en-tête, puis une ligne comme | --- | :-: |.",
  ),
  shape: l(
    "Expected an array (of objects, arrays or values) or an object.",
    "Attendu : un tableau (d'objets, de tableaux ou de valeurs) ou un objet.",
  ),
  found: l("{rows} rows × {cols} columns", "{rows} lignes × {cols} colonnes"),
  preview: l("Preview", "Aperçu"),
};

const ALIGNS: Align[] = ["none", "left", "center", "right"];
const ALIGN_LABEL = { none: T.none, left: T.left, center: T.center, right: T.right };
const EXT: Record<Export, string> = { csv: "csv", tsv: "tsv", json: "json" };

function Preview({ grid, aligns }: { grid: Grid; aligns: Align[] }) {
  const cls = (i: number) => `markdown-table-align-${aligns[i] ?? "none"}`;
  const rows = grid.rows.slice(0, 200);
  return (
    <div class="table-wrap markdown-table-preview">
      <table class="table">
        <thead>
          <tr>
            {grid.header.map((h, i) => (
              <th key={i} class={cls(i)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j}>
              {grid.header.map((_, i) => (
                <td key={i} class={cls(i)}>
                  {r[i] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarkdownTable() {
  const mode = useToolState<Mode>("mode", "to-md");
  const input = useToolState("input", "");
  const pretty = useToolState("pretty", true);
  const aligns = useToolState<Align[]>("aligns", []);
  const as = useToolState<Export>("as", "csv");

  const data = useComputed(() =>
    mode.value === "to-md" && input.value.trim() ? readTabular(input.value) : null,
  );
  const md = useComputed(() =>
    mode.value === "from-md" && input.value.trim() ? parseMarkdownTable(input.value) : null,
  );
  const output = useComputed(() => {
    const d = data.value;
    if (d?.ok) return toMarkdown(d.grid, aligns.value, pretty.value);
    const m = md.value;
    return m?.ok ? exportGrid(m.grid, as.value) : "";
  });

  const toMd = mode.value === "to-md";
  const d = data.value;
  const m = md.value;
  const grid = d?.ok ? d.grid : m?.ok ? m.grid : null;
  const shownAligns = d?.ok ? aligns.value : m?.ok ? m.aligns : [];
  const setAlign = (i: number, a: Align) => {
    const next = [...aligns.value];
    while (next.length <= i) next.push("none");
    next[i] = a;
    aligns.value = next;
  };

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "to-md", label: tr(T.toMd) },
            { value: "from-md", label: tr(T.fromMd) },
          ]}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="swap"
          disabled={!output.value || (!toMd && as.value === "json")}
          onClick={() => {
            input.value = output.value;
            mode.value = toMd ? "from-md" : "to-md";
          }}
        >
          {tr(T.swap)}
        </Button>
        <span class="spacer" />
        {toMd ? (
          <Toggle
            checked={pretty.value}
            onChange={(v) => {
              pretty.value = v;
            }}
            label={tr(T.pretty)}
          />
        ) : (
          <Segmented<Export>
            value={as.value}
            onChange={(v) => {
              as.value = v;
            }}
            options={[
              { value: "csv", label: "CSV" },
              { value: "tsv", label: "TSV" },
              { value: "json", label: "JSON" },
            ]}
          />
        )}
      </div>
      {toMd && d?.ok && d.grid.header.length > 0 && (
        <Panel title={tr(T.align)}>
          <div class="markdown-table-aligns">
            <label class="field">
              <span class="field-label">{tr(T.all)}</span>
              <select
                class="input"
                value=""
                onChange={(e) => {
                  const v = (e.currentTarget as HTMLSelectElement).value as Align;
                  if (v) aligns.value = d.grid.header.map(() => v);
                }}
              >
                <option value="">—</option>
                {ALIGNS.map((a) => (
                  <option key={a} value={a}>
                    {tr(ALIGN_LABEL[a])}
                  </option>
                ))}
              </select>
            </label>
            {d.grid.header.map((h, i) => (
              <label class="field" key={i}>
                <span class="field-label markdown-table-col-name" title={h}>
                  {h}
                </span>
                <select
                  class="input"
                  value={aligns.value[i] ?? "none"}
                  onChange={(e) => {
                    setAlign(i, (e.currentTarget as HTMLSelectElement).value as Align);
                  }}
                >
                  {ALIGNS.map((a) => (
                    <option key={a} value={a}>
                      {tr(ALIGN_LABEL[a])}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Panel>
      )}
      <div class="grid-2">
        <TextBox
          label={tr(toMd ? T.data : T.markdown)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(toMd ? T.phData : T.phMd)}
          accept={toMd ? ".csv,.tsv,.json,.txt,text/plain" : ".md,.markdown,.txt,text/plain"}
          rows={16}
          wrap={false}
          invalid={(!!d && !d.ok) || (!!m && !m.ok)}
          note={
            d && !d.ok ? (
              d.error === "shape" ? (
                <span class="error">{tr(T.shape)}</span>
              ) : (
                <ParseNote error={d.error} />
              )
            ) : m && !m.ok ? (
              <span class="error">{tr(T.noTable)}</span>
            ) : grid ? (
              <span class="muted">
                {tr(T.found)
                  .replace("{rows}", fmt(grid.rows.length))
                  .replace("{cols}", fmt(grid.header.length))}
              </span>
            ) : null
          }
        />
        <TextBox
          label={tr(toMd ? T.markdown : T.data)}
          value={output.value}
          readOnly
          rows={16}
          wrap={false}
          downloadName={toMd ? "table.md" : `table.${EXT[as.value]}`}
        />
      </div>
      {grid && grid.header.length > 0 && (
        <Panel title={tr(T.preview)}>
          <Preview grid={grid} aligns={shownAligns} />
        </Panel>
      )}
    </>
  );
}
