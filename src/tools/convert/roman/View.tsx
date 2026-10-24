import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Field, Panel } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { convert, MAX, romanParts } from "./logic";

const T = {
  input: l("Number or Roman numeral", "Nombre ou chiffres romains"),
  placeholder: l("2024 or MMXXIV", "2024 ou MMXXIV"),
  hint: l(
    "Digits are written in Roman numerals, letters are read back as a number.",
    "Les chiffres sont écrits en romain, les lettres relues en nombre.",
  ),
  result: l("Result", "Résultat"),
  range: l(
    "Roman numerals go from 1 to {max} (there is no zero, nor negatives).",
    "Les chiffres romains vont de 1 à {max} (ni zéro, ni négatifs).",
  ),
  badChar: l(
    "“{c}” is not a Roman numeral. Use I, V, X, L, C, D, M.",
    "« {c} » n'est pas un chiffre romain. Utilise I, V, X, L, C, D, M.",
  ),
  form: l(
    "Not a standard numeral. Read as {v}, which is written {r}.",
    "Écriture non standard. Lu comme {v}, qui s'écrit {r}.",
  ),
  formBig: l(
    "Not a standard numeral, and {v} is beyond {max}.",
    "Écriture non standard, et {v} dépasse {max}.",
  ),
  symbols: l("Symbols", "Symboles"),
  examples: l("Examples", "Exemples"),
};

const SYMBOLS: [string, number][] = [
  ["I", 1],
  ["V", 5],
  ["X", 10],
  ["L", 50],
  ["C", 100],
  ["D", 500],
  ["M", 1000],
];

export default function Roman() {
  const input = useToolState("input", String(new Date().getFullYear()));
  const result = useComputed(() => convert(input.value));
  const r = result.value;

  let output = "";
  let value: number | null = null;
  let error: string | null = null;
  if (r.kind === "number") {
    if (r.roman) {
      output = r.roman;
      value = r.value;
    } else error = tr(T.range).replace("{max}", fmt(MAX));
  } else if (r.kind === "roman") {
    const x = r.result;
    if (x.ok) {
      output = String(x.value);
      value = x.value;
    } else if (x.error === "char") error = tr(T.badChar).replace("{c}", x.char);
    else if (x.error === "form")
      error = x.canonical
        ? tr(T.form).replace("{v}", fmt(x.value)).replace("{r}", x.canonical)
        : tr(T.formBig).replace("{v}", fmt(x.value)).replace("{max}", fmt(MAX));
  }

  return (
    <>
      <Field label={tr(T.input)} hint={tr(T.hint)}>
        <input
          class="input ro-input mono"
          type="text"
          value={input.value}
          placeholder={tr(T.placeholder)}
          spellcheck={false}
          autocomplete="off"
          aria-invalid={!!error}
          onInput={(e) => {
            input.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      <div class="row">
        <span class="muted small">{tr(T.examples)}</span>
        {["1990", "2024", "3999", "MCMLXXXIV", "XLII"].map((x) => (
          <Button
            key={x}
            size="sm"
            variant="ghost"
            onClick={() => {
              input.value = x;
            }}
          >
            {x}
          </Button>
        ))}
      </div>
      <ErrorNote error={error} />
      {output && (
        <Panel title={tr(T.result)} actions={<CopyButton text={output} />}>
          <p class="ro-result mono">{output}</p>
          {value !== null && (
            <div class="ro-parts">
              {romanParts(value).map((p, i) => (
                <span class="ro-part" key={i}>
                  <span class="mono">{p.symbol}</span>
                  <span class="muted small">{fmt(p.value)}</span>
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}
      <Panel title={tr(T.symbols)}>
        <div class="ro-parts">
          {SYMBOLS.map(([s, v]) => (
            <span class="ro-part" key={s}>
              <span class="mono">{s}</span>
              <span class="muted small">{fmt(v)}</span>
            </span>
          ))}
        </div>
      </Panel>
    </>
  );
}
