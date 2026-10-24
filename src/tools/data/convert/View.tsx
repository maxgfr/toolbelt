import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import { EXTENSIONS, type Format, type Indent, parseInput, write } from "./logic";

const T = {
  from: l("From", "De"),
  to: l("To", "Vers"),
  auto: l("Auto", "Auto"),
  input: l("Input", "Entrée"),
  output: l("Result", "Résultat"),
  placeholder: l(
    "Paste JSON, YAML or TOML, or drop a file…",
    "Colle du JSON, du YAML ou du TOML, ou dépose un fichier…",
  ),
  indent: l("Indentation", "Indentation"),
  spaces2: l("2 spaces", "2 espaces"),
  spaces4: l("4 spaces", "4 espaces"),
  swap: l("Use the result as input", "Reprendre le résultat en entrée"),
  detected: l("Detected: {f}", "Détecté : {f}"),
  valid: l("Valid {f}", "{f} valide"),
  tomlRoot: l(
    "TOML needs a table (an object) at the root, not a list or a single value.",
    "Le TOML exige une table (un objet) à la racine, pas une liste ni une valeur seule.",
  ),
  tomlNulls: l(
    "TOML has no null: keys with a null value were left out.",
    "Le TOML n'a pas de null : les clés à valeur null ont été omises.",
  ),
  cannot: l("Cannot write this as {f}: {msg}", "Impossible d'écrire ceci en {f} : {msg}"),
};

const NAMES: Record<Format, string> = { json: "JSON", yaml: "YAML", toml: "TOML" };
const FORMATS: Format[] = ["json", "yaml", "toml"];

export default function Convert() {
  const input = useToolState("input", "");
  const from = useToolState<Format | "auto">("from", "auto");
  const to = useToolState<Format>("to", "yaml");
  const indent = useToolState<Indent>("indent", "2");

  const parsed = useComputed(() =>
    input.value.trim() ? parseInput(input.value, from.value) : null,
  );
  const written = useComputed(() => {
    const p = parsed.value;
    return p?.ok ? write(p.value, to.value, indent.value) : null;
  });
  const p = parsed.value;
  const w = written.value;
  const out = w?.ok ? w.text : "";

  return (
    <>
      <div class="row">
        <span class="muted small">{tr(T.from)}</span>
        <Segmented<Format | "auto">
          label={tr(T.from)}
          value={from.value}
          onChange={(v) => {
            from.value = v;
          }}
          options={[
            { value: "auto", label: tr(T.auto) },
            ...FORMATS.map((f) => ({ value: f, label: NAMES[f] })),
          ]}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="swap"
          title={tr(T.swap)}
          aria-label={tr(T.swap)}
          disabled={!w?.ok}
          onClick={() => {
            const src = p?.ok ? p.format : "json";
            input.value = out;
            from.value = to.value;
            to.value = src === to.value ? "json" : src;
          }}
        />
        <span class="muted small">{tr(T.to)}</span>
        <Segmented<Format>
          label={tr(T.to)}
          value={to.value}
          onChange={(v) => {
            to.value = v;
          }}
          options={FORMATS.map((f) => ({ value: f, label: NAMES[f] }))}
        />
        <span class="spacer" />
        {to.value !== "toml" && (
          <Segmented<Indent>
            label={tr(T.indent)}
            value={indent.value}
            onChange={(v) => {
              indent.value = v;
            }}
            options={[
              { value: "2", label: tr(T.spaces2) },
              { value: "4", label: tr(T.spaces4) },
            ]}
          />
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
          accept=".json,.yaml,.yml,.toml,text/plain"
          rows={22}
          wrap={false}
          invalid={p ? !p.ok : false}
          note={
            p && (
              <ParseNote
                error={p.ok ? null : p}
                ok={
                  p.ok
                    ? tr(from.value === "auto" ? T.detected : T.valid).replace(
                        "{f}",
                        NAMES[p.format],
                      )
                    : undefined
                }
              />
            )
          }
        />
        <TextBox
          label={`${tr(T.output)} · ${NAMES[to.value]}`}
          value={out}
          readOnly
          rows={22}
          wrap={false}
          downloadName={`converted.${EXTENSIONS[to.value]}`}
          invalid={w ? !w.ok : false}
          note={
            w &&
            (!w.ok ? (
              <span class="error">
                {w.error === "root"
                  ? tr(T.tomlRoot)
                  : tr(T.cannot).replace("{f}", NAMES[to.value]).replace("{msg}", w.error)}
              </span>
            ) : w.warning ? (
              <span class="data-warn">{tr(T.tomlNulls)}</span>
            ) : null)
          }
        />
      </div>
    </>
  );
}
