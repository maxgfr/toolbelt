import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Segmented, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { formatJson, type Indent, jsonInfo, parseJson } from "./logic";

const T = {
  input: l("JSON", "JSON"),
  output: l("Result", "Résultat"),
  placeholder: l(
    'Paste JSON, e.g. {"name": "toolbelt"}',
    'Colle du JSON, par ex. {"name": "toolbelt"}',
  ),
  indent: l("Indentation", "Indentation"),
  spaces2: l("2 spaces", "2 espaces"),
  spaces4: l("4 spaces", "4 espaces"),
  tab: l("Tab", "Tabulation"),
  minify: l("Minify", "Minifier"),
  sort: l("Sort keys", "Trier les clés"),
  valid: l("Valid JSON", "JSON valide"),
  at: l("line {line}, column {col}", "ligne {line}, colonne {col}"),
  keys: l("Keys", "Clés"),
  depth: l("Depth", "Profondeur"),
  objects: l("Objects", "Objets"),
  arrays: l("Arrays", "Tableaux"),
  size: l("Size", "Taille"),
};

export default function Json() {
  const input = useToolState("input", "");
  const indent = useToolState<Indent>("indent", "2");
  const sort = useToolState("sort", false);
  const parsed = useComputed(() => (input.value.trim() ? parseJson(input.value) : null));
  const output = useComputed(() =>
    parsed.value?.ok ? formatJson(parsed.value.value, indent.value, sort.value) : "",
  );
  const p = parsed.value;
  const info = p?.ok ? jsonInfo(p.value) : null;

  return (
    <>
      <div class="row">
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
        <Toggle
          checked={sort.value}
          onChange={(v) => {
            sort.value = v;
          }}
          label={tr(T.sort)}
        />
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".json,application/json,text/plain"
          rows={20}
          wrap={false}
          invalid={p ? !p.ok : false}
          note={
            p &&
            (p.ok ? (
              <span class="success">✓ {tr(T.valid)}</span>
            ) : (
              <span class="error">
                {tr(T.at).replace("{line}", String(p.line)).replace("{col}", String(p.column))} —{" "}
                {p.message}
              </span>
            ))
          }
        />
        <TextBox
          label={tr(T.output)}
          value={output.value}
          readOnly
          rows={20}
          wrap={false}
          downloadName="formatted.json"
        />
      </div>
      {info && (
        <Stats
          items={[
            { label: tr(T.keys), value: fmt(info.keys) },
            { label: tr(T.depth), value: fmt(info.depth) },
            { label: tr(T.objects), value: fmt(info.objects) },
            { label: tr(T.arrays), value: fmt(info.arrays) },
            {
              label: tr(T.size),
              value: `${fmt(new TextEncoder().encode(output.value).length)} B`,
            },
          ]}
        />
      )}
    </>
  );
}
