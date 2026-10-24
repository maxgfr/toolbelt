import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, lang, tr } from "../../../i18n";
import { type Alphabet, alphabetTable, spell, spellText } from "./logic";

const T = {
  input: l("Text to spell", "Texte à épeler"),
  placeholder: l(
    "A name, a reference, an email address…",
    "Un nom, une référence, une adresse e-mail…",
  ),
  nato: l("International (NATO)", "International (OTAN)"),
  fr: l("French (Anatole, Berthe…)", "Français (Anatole, Berthe…)"),
  markCase: l("Say upper / lower case", "Préciser majuscule / minuscule"),
  output: l("Spelled out", "Épelé"),
  alphabet: l("The whole alphabet", "L'alphabet complet"),
};

export default function Nato() {
  const text = useToolState("text", "");
  const alphabet = useToolState<Alphabet>("alphabet", lang.value === "fr" ? "fr" : "nato");
  const markCase = useToolState("markCase", false);
  const items = useComputed(() => spell(text.value, alphabet.value, markCase.value));
  const output = useComputed(() => spellText(items.value));
  const table = useComputed(() => alphabetTable(alphabet.value));

  return (
    <>
      <div class="row">
        <Segmented<Alphabet>
          value={alphabet.value}
          onChange={(v) => {
            alphabet.value = v;
          }}
          options={[
            { value: "nato", label: tr(T.nato) },
            { value: "fr", label: tr(T.fr) },
          ]}
        />
        <Toggle
          checked={markCase.value}
          onChange={(v) => {
            markCase.value = v;
          }}
          label={tr(T.markCase)}
        />
      </div>
      <TextBox
        label={tr(T.input)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={2}
        mono={false}
        files={false}
      />
      {items.value.length > 0 && (
        <ol class="nato-cards">
          {items.value.map((it, i) =>
            it.space ? (
              <li key={i} class="nato-gap" aria-hidden="true" />
            ) : (
              <li key={i} class={`nato-card ${it.known ? "" : "nato-unknown"}`}>
                <span class="nato-char">{it.char}</span>
                <span class="nato-word">{it.word}</span>
              </li>
            ),
          )}
        </ol>
      )}
      <TextBox label={tr(T.output)} value={output.value} readOnly rows={4} mono={false} />
      <details class="nato-table">
        <summary>{tr(T.alphabet)}</summary>
        <dl>
          {table.value.map((e) => (
            <div key={e.char}>
              <dt>{e.char}</dt>
              <dd>{e.word}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
