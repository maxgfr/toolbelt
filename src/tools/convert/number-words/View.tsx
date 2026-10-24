import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { ErrorNote, Field, Output, Panel, Segmented, Toggle } from "../../../app/ui";
import { l, lang, tr } from "../../../i18n";
import {
  type Currency,
  enOrdinal,
  frOrdinal,
  type Lang,
  moneyToWords,
  numberToWords,
  parseDecimal,
  type Variant,
} from "./logic";

const T = {
  input: l("Number", "Nombre"),
  placeholder: l("1234.56", "1234,56"),
  hint: l(
    "Up to 36 digits. Decimal separator: . or ,",
    "Jusqu'à 36 chiffres. Séparateur décimal : , ou .",
  ),
  currency: l("Currency", "Devise"),
  reform: l(
    "French: 1990 spelling (vingt-et-un, deux-cents)",
    "Français : orthographe de 1990 (vingt-et-un, deux-cents)",
  ),
  variant: l("French tens", "Dizaines en français"),
  france: l("France", "France"),
  belgium: l("Belgium (septante, nonante)", "Belgique (septante, nonante)"),
  swiss: l("Switzerland (huitante)", "Suisse (huitante)"),
  english: l("English", "Anglais"),
  french: l("French", "Français"),
  number: l("Number", "Nombre"),
  ordinal: l("Ordinal", "Ordinal"),
  amount: l("Amount", "Montant"),
  invalid: l("Type a number, e.g. 1234.56 or -21.", "Tape un nombre, par ex. 1234,56 ou -21."),
  big: l(
    "Too large: up to 36 digits before the decimal point.",
    "Trop grand : jusqu'à 36 chiffres avant la virgule.",
  ),
};

export default function NumberWords() {
  const input = useToolState("input", "1234.56");
  const currency = useToolState<Currency>("currency", "eur");
  const reform = useToolState("reform", false);
  const variant = useToolState<Variant>("variant", "fr");
  const parsed = useComputed(() => parseDecimal(input.value));
  const p = parsed.value;
  const opts = { reform: reform.value, variant: variant.value };
  const isWhole = p.ok && !/[1-9]/.test(p.frac) && !p.negative;

  const panel = (out: Lang) => {
    if (!p.ok) return null;
    const ord = isWhole ? (out === "fr" ? frOrdinal(p.int, opts) : enOrdinal(p.int)) : null;
    return (
      <Panel key={out} title={tr(out === "fr" ? T.french : T.english)}>
        <div class="stack nw-list">
          <Output label={tr(T.number)} value={numberToWords(p, out, opts)} mono={false} />
          {ord && <Output label={tr(T.ordinal)} value={ord} mono={false} />}
          <Output
            label={tr(T.amount)}
            value={moneyToWords(p, currency.value, out, opts)}
            mono={false}
          />
        </div>
      </Panel>
    );
  };

  return (
    <>
      <Field label={tr(T.input)} hint={tr(T.hint)}>
        <input
          class="input nw-input"
          type="text"
          inputMode="decimal"
          value={input.value}
          placeholder={tr(T.placeholder)}
          aria-invalid={!p.ok && p.error !== "empty"}
          onInput={(e) => {
            input.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      <div class="row">
        <Segmented<Currency>
          label={tr(T.currency)}
          value={currency.value}
          onChange={(v) => {
            currency.value = v;
          }}
          options={[
            { value: "eur", label: "€ EUR" },
            { value: "usd", label: "$ USD" },
          ]}
        />
        <Segmented<Variant>
          label={tr(T.variant)}
          value={variant.value}
          onChange={(v) => {
            variant.value = v;
          }}
          options={[
            { value: "fr", label: tr(T.france) },
            { value: "be", label: tr(T.belgium) },
            { value: "ch", label: tr(T.swiss) },
          ]}
        />
        <Toggle
          checked={reform.value}
          onChange={(v) => {
            reform.value = v;
          }}
          label={tr(T.reform)}
        />
      </div>
      {!p.ok && p.error !== "empty" && (
        <ErrorNote error={tr(p.error === "big" ? T.big : T.invalid)} />
      )}
      {p.ok && (
        <div class="grid-2">
          {(lang.value === "fr" ? (["fr", "en"] as const) : (["en", "fr"] as const)).map(panel)}
        </div>
      )}
    </>
  );
}
