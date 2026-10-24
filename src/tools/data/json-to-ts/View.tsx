import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { type Options, toTypeScript, toZod } from "./logic";

type Tab = "ts" | "zod";

const T = {
  input: l("JSON sample", "Exemple JSON", "JSON-Beispiel"),
  placeholder: l(
    'Paste a JSON sample, e.g. {"id": 1, "tags": ["a"], "owner": {"name": "Ann"}}',
    'Colle un exemple JSON, par ex. {"id": 1, "tags": ["a"], "owner": {"name": "Ann"}}',
    'Füge ein JSON-Beispiel ein, z. B. {"id": 1, "tags": ["a"], "owner": {"name": "Ann"}}',
  ),
  rootName: l("Root type name", "Nom du type racine", "Name des Wurzeltyps"),
  interfaces: l("Interfaces", "Interfaces", "Interfaces"),
  types: l("Type aliases", "Alias de type", "Typ-Aliase"),
  readonly: l("readonly", "readonly", "readonly"),
  output: l("Types", "Types", "Typen"),
  hint: l(
    "Keys missing from some array items become optional; mixed values become unions.",
    "Les clés absentes de certains éléments d'un tableau deviennent optionnelles ; les valeurs mélangées deviennent des unions.",
    "Schlüssel, die in manchen Array-Elementen fehlen, werden optional; gemischte Werte werden zu Unions.",
  ),
  valid: l("Valid JSON", "JSON valide", "Gültiges JSON"),
};

export default function JsonToTs() {
  const input = useToolState("input", "");
  const rootName = useToolState("rootName", "Root");
  const style = useToolState<Options["style"]>("style", "interface");
  const readonly = useToolState("readonly", false);
  const tab = useToolState<Tab>("tab", "ts");

  const parsed = useComputed(() => (input.value.trim() ? parseJson(input.value) : null));
  const output = useComputed(() => {
    const p = parsed.value;
    if (!p?.ok) return "";
    const o: Options = {
      rootName: rootName.value.trim() || "Root",
      style: style.value,
      readonly: readonly.value,
    };
    return tab.value === "ts" ? toTypeScript(p.value, o) : toZod(p.value, o);
  });
  const p = parsed.value;

  return (
    <>
      <div class="row">
        <label class="row small">
          <span class="muted">{tr(T.rootName)}</span>
          <input
            class="input mono json-to-ts-root"
            value={rootName.value}
            spellcheck={false}
            onInput={(e) => {
              rootName.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </label>
        <Segmented<Options["style"]>
          value={style.value}
          onChange={(v) => {
            style.value = v;
          }}
          options={[
            { value: "interface", label: tr(T.interfaces) },
            { value: "type", label: tr(T.types) },
          ]}
        />
        <Toggle
          checked={readonly.value}
          onChange={(v) => {
            readonly.value = v;
          }}
          label={tr(T.readonly)}
        />
        <span class="spacer" />
        <Segmented<Tab>
          value={tab.value}
          onChange={(v) => {
            tab.value = v;
          }}
          options={[
            { value: "ts", label: "TypeScript" },
            { value: "zod", label: "Zod" },
          ]}
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
          rows={22}
          wrap={false}
          invalid={p ? !p.ok : false}
          note={p ? <ParseNote error={p.ok ? null : p} ok={tr(T.valid)} /> : null}
        />
        <TextBox
          label={tab.value === "ts" ? tr(T.output) : "Zod"}
          value={output.value}
          readOnly
          rows={22}
          wrap={false}
          downloadName={tab.value === "ts" ? "types.ts" : "schema.ts"}
          note={<span class="muted">{tr(T.hint)}</span>}
        />
      </div>
    </>
  );
}
