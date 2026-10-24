import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { ErrorNote, Field, Output, Panel, Segmented, Toggle } from "../../../app/ui";
import { l, lang, tr } from "../../../i18n";
import {
  type Currency,
  deOrdinal,
  enOrdinal,
  frOrdinal,
  type Lang,
  moneyToWords,
  numberToWords,
  parseDecimal,
  type Variant,
} from "./logic";

const T = {
  input: l("Number", "Nombre", "Zahl"),
  placeholder: l("1234.56", "1234,56", "1234,56"),
  hint: l(
    "Up to 36 digits. Decimal separator: . or ,",
    "Jusqu'à 36 chiffres. Séparateur décimal : , ou .",
    "Bis zu 36 Ziffern. Dezimaltrennzeichen: , oder .",
  ),
  currency: l("Currency", "Devise", "Währung"),
  reform: l(
    "French: 1990 spelling (vingt-et-un, deux-cents)",
    "Français : orthographe de 1990 (vingt-et-un, deux-cents)",
    "Französisch: Rechtschreibung von 1990 (vingt-et-un, deux-cents)",
  ),
  variant: l("French tens", "Dizaines en français", "Französische Zehner"),
  france: l("France", "France", "Frankreich"),
  belgium: l(
    "Belgium (septante, nonante)",
    "Belgique (septante, nonante)",
    "Belgien (septante, nonante)",
  ),
  swiss: l("Switzerland (huitante)", "Suisse (huitante)", "Schweiz (huitante)"),
  english: l("English", "Anglais", "Englisch"),
  french: l("French", "Français", "Französisch"),
  german: l("German", "Allemand", "Deutsch"),
  number: l("Number", "Nombre", "Zahl"),
  ordinal: l("Ordinal", "Ordinal", "Ordnungszahl"),
  amount: l("Amount", "Montant", "Betrag"),
  invalid: l(
    "Type a number, e.g. 1234.56 or -21.",
    "Tape un nombre, par ex. 1234,56 ou -21.",
    "Gib eine Zahl ein, z. B. 1234,56 oder -21.",
  ),
  big: l(
    "Too large: up to 36 digits before the decimal point.",
    "Trop grand : jusqu'à 36 chiffres avant la virgule.",
    "Zu groß: bis zu 36 Ziffern vor dem Komma.",
  ),
};

const LANGS: Lang[] = ["en", "fr", "de"];
const TITLE = { en: T.english, fr: T.french, de: T.german };
const ORDINAL = { en: enOrdinal, fr: frOrdinal, de: deOrdinal };

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
    const ord = isWhole ? ORDINAL[out](p.int, opts) : null;
    return (
      <Panel key={out} title={tr(TITLE[out])}>
        <div class="stack nw-list" lang={out}>
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
        <div class="stack">{[lang.value, ...LANGS.filter((x) => x !== lang.value)].map(panel)}</div>
      )}
    </>
  );
}
