import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { parseQuery, toQuery } from "./logic";

type Mode = "qs2json" | "json2qs";

const T = {
  qs2json: l("Query string → JSON", "Query string → JSON"),
  json2qs: l("JSON → query string", "JSON → query string"),
  qs: l("Query string or URL", "Query string ou URL"),
  json: l("JSON", "JSON"),
  phQs: l(
    "Paste a URL or a query string, e.g. https://example.com/?q=caf%C3%A9&tag=a&tag=b",
    "Colle une URL ou une query string, par ex. https://example.com/?q=caf%C3%A9&tag=a&tag=b",
  ),
  phJson: l(
    'Paste a JSON object, e.g. {"q": "café", "tags": ["a", "b"]}',
    'Colle un objet JSON, par ex. {"q": "café", "tags": ["a", "b"]}',
  ),
  plusIn: l("Read + as a space", "Lire + comme une espace"),
  plusOut: l("Write spaces as +", "Écrire les espaces en +"),
  brackets: l("Nested keys a[b]=1, a[]=1", "Clés imbriquées a[b]=1, a[]=1"),
  infer: l("Detect numbers, booleans, null", "Détecter nombres, booléens, null"),
  swap: l("Use the result as input", "Reprendre le résultat en entrée"),
  notObject: l("Expected a JSON object.", "Attendu : un objet JSON."),
  badEncoding: l(
    "Broken %-encoding, kept as typed: {parts}",
    "Encodage % invalide, gardé tel quel : {parts}",
  ),
  conflicts: l(
    "Keys used both as a value and as an object (the later one wins): {keys}",
    "Clés utilisées à la fois comme valeur et comme objet (la dernière l'emporte) : {keys}",
  ),
  key: l("Key", "Clé"),
  value: l("Value", "Valeur"),
  count: l("{n} parameters", "{n} paramètres"),
};

export default function QueryString() {
  const mode = useToolState<Mode>("mode", "qs2json");
  const input = useToolState("input", "");
  const plus = useToolState("plus", true);
  const brackets = useToolState("brackets", true);
  const infer = useToolState("infer", false);

  const opts = useComputed(() => ({
    plus: plus.value,
    brackets: brackets.value,
    infer: infer.value,
  }));
  const qs = useComputed(() =>
    mode.value === "qs2json" && input.value.trim() ? parseQuery(input.value, opts.value) : null,
  );
  const json = useComputed(() => {
    if (mode.value !== "json2qs" || !input.value.trim()) return null;
    const p = parseJson(input.value);
    return { p, w: p.ok ? toQuery(p.value, opts.value) : null };
  });
  const output = useComputed(() => {
    if (qs.value) return JSON.stringify(qs.value.value, null, 2);
    const w = json.value?.w;
    return w?.ok ? w.text : "";
  });

  const toJson = mode.value === "qs2json";
  const q = qs.value;
  const j = json.value;

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "qs2json", label: tr(T.qs2json) },
            { value: "json2qs", label: tr(T.json2qs) },
          ]}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="swap"
          disabled={!output.value}
          onClick={() => {
            input.value = output.value;
            mode.value = toJson ? "json2qs" : "qs2json";
          }}
        >
          {tr(T.swap)}
        </Button>
      </div>
      <div class="row">
        <Toggle
          checked={plus.value}
          onChange={(v) => {
            plus.value = v;
          }}
          label={tr(toJson ? T.plusIn : T.plusOut)}
        />
        <Toggle
          checked={brackets.value}
          onChange={(v) => {
            brackets.value = v;
          }}
          label={tr(T.brackets)}
        />
        {toJson && (
          <Toggle
            checked={infer.value}
            onChange={(v) => {
              infer.value = v;
            }}
            label={tr(T.infer)}
          />
        )}
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(toJson ? T.qs : T.json)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(toJson ? T.phQs : T.phJson)}
          rows={toJson ? 8 : 16}
          wrap={toJson}
          invalid={!!j && (!j.p.ok || !j.w?.ok)}
          note={
            j && !j.p.ok ? (
              <ParseNote error={j.p} />
            ) : j && !j.w?.ok ? (
              <span class="error">{tr(T.notObject)}</span>
            ) : q ? (
              <span class="muted">{tr(T.count).replace("{n}", fmt(q.pairs.length))}</span>
            ) : null
          }
        />
        <TextBox
          label={tr(toJson ? T.json : T.qs)}
          value={output.value}
          readOnly
          rows={toJson ? 16 : 8}
          wrap={!toJson}
        />
      </div>
      {q && q.badEncoding.length > 0 && (
        <p class="data-warn small">
          {tr(T.badEncoding).replace("{parts}", q.badEncoding.join(", "))}
        </p>
      )}
      {q && q.conflicts.length > 0 && (
        <p class="data-warn small">{tr(T.conflicts).replace("{keys}", q.conflicts.join(", "))}</p>
      )}
      {q && q.pairs.length > 0 && (
        <div class="table-wrap query-string-pairs">
          <table class="table">
            <thead>
              <tr>
                <th>{tr(T.key)}</th>
                <th>{tr(T.value)}</th>
              </tr>
            </thead>
            <tbody>
              {q.pairs.slice(0, 500).map((p, i) => (
                <tr key={i}>
                  <td class="mono">{p.key}</td>
                  <td class="mono query-string-value">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
