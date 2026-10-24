import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Field, Output, Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, pick, tr } from "../../../i18n";
import { Group, NumberInput } from "../_ui";
import { DEFAULTS, slugifyLines } from "./logic";

type Sep = "-" | "_" | "." | "";

const T = {
  text: l("Text", "Texte", "Text"),
  placeholder: l(
    "A title, e.g. “Crème brûlée: the recipe” — one slug per line",
    "Un titre, par ex. « Crème brûlée : la recette » — un slug par ligne",
    "Ein Titel, z. B. „Käsespätzle: das Rezept“ – ein Slug pro Zeile",
  ),
  separator: l("Separator", "Séparateur", "Trennzeichen"),
  none: l("None", "Aucun", "Keines"),
  lowercase: l("Lowercase", "Minuscules", "Kleinbuchstaben"),
  ascii: l("ASCII only", "ASCII uniquement", "Nur ASCII"),
  umlauts: l("Umlauts as ae, oe, ue", "Umlauts en ae, oe, ue", "Umlaute als ae, oe, ue"),
  maxLength: l("Max length", "Longueur max", "Max. Länge"),
  noLimit: l("0 = no limit", "0 = sans limite", "0 = keine Grenze"),
  slug: l("Slug", "Slug", "Slug"),
  slugs: l("Slugs", "Slugs", "Slugs"),
};

export default function Slugify() {
  const text = useToolState("text", "");
  const sep = useToolState<Sep>("sep", "-");
  const lowercase = useToolState("lowercase", DEFAULTS.lowercase);
  const ascii = useToolState("ascii", DEFAULTS.asciiOnly);
  // German writes ä as ae when the dots are dropped; elsewhere ä → a is the usual slug.
  const umlauts = useToolState("umlauts", pick({ en: false, fr: false, de: true }));
  const maxLength = useToolState("maxLength", 0);
  const out = useComputed(() =>
    slugifyLines(text.value, {
      separator: sep.value,
      lowercase: lowercase.value,
      asciiOnly: ascii.value,
      umlauts: umlauts.value,
      maxLength: maxLength.value,
    }),
  );
  const many = out.value.includes("\n");

  return (
    <>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={4}
        mono={false}
      />
      <div class="row tx-options">
        <Group label={tr(T.separator)}>
          <Segmented<Sep>
            label={tr(T.separator)}
            value={sep.value}
            onChange={(v) => {
              sep.value = v;
            }}
            options={[
              { value: "-", label: "-" },
              { value: "_", label: "_" },
              { value: ".", label: "." },
              { value: "", label: tr(T.none) },
            ]}
          />
        </Group>
        <Field label={tr(T.maxLength)} hint={tr(T.noLimit)}>
          <NumberInput
            class="slugify-max"
            value={maxLength.value}
            min={0}
            max={500}
            onChange={(v) => {
              maxLength.value = v;
            }}
          />
        </Field>
        <Toggle
          checked={lowercase.value}
          onChange={(v) => {
            lowercase.value = v;
          }}
          label={tr(T.lowercase)}
        />
        <Toggle
          checked={ascii.value}
          onChange={(v) => {
            ascii.value = v;
          }}
          label={tr(T.ascii)}
        />
        <Toggle
          checked={umlauts.value}
          onChange={(v) => {
            umlauts.value = v;
          }}
          label={tr(T.umlauts)}
        />
      </div>
      {many ? (
        <TextBox label={tr(T.slugs)} value={out.value} readOnly rows={6} downloadName="slugs.txt" />
      ) : (
        <Output label={tr(T.slug)} value={out.value} />
      )}
    </>
  );
}
