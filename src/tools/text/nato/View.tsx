import { useComputed } from "@preact/signals";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { TextBox, Toggle } from "../../../app/ui";
import { type L10n, l, pick, tr } from "../../../i18n";
import { ALPHABETS, type Alphabet, alphabetTable, spell, spellText } from "./logic";

const T = {
  input: l("Text to spell", "Texte à épeler", "Text zum Buchstabieren"),
  placeholder: l(
    "A name, a reference, an email address…",
    "Un nom, une référence, une adresse e-mail…",
    "Ein Name, eine Referenz, eine E-Mail-Adresse…",
  ),
  alphabetLabel: l("Spelling alphabet", "Alphabet d'épellation", "Buchstabiertafel"),
  markCase: l(
    "Say upper / lower case",
    "Préciser majuscule / minuscule",
    "Groß-/Kleinschreibung ansagen",
  ),
  output: l("Spelled out", "Épelé", "Buchstabiert"),
  alphabet: l("The whole alphabet", "L'alphabet complet", "Das ganze Alphabet"),
};

const NAMES: Record<Alphabet, L10n> = {
  nato: l("International (NATO)", "International (OTAN)", "International (NATO)"),
  fr: l(
    "French (Anatole, Berthe…)",
    "Français (Anatole, Berthe…)",
    "Französisch (Anatole, Berthe…)",
  ),
  de: l(
    "German, DIN 5009 (Aachen, Berlin…)",
    "Allemand, DIN 5009 (Aachen, Berlin…)",
    "Deutsch, DIN 5009 (Aachen, Berlin…)",
  ),
  deNames: l(
    "German, classic (Anton, Berta…)",
    "Allemand, classique (Anton, Berta…)",
    "Deutsch, klassisch (Anton, Berta…)",
  ),
};

export default function Nato() {
  const text = useToolState("text", "");
  const alphabet = useToolState<Alphabet>(
    "alphabet",
    pick<Alphabet>({ en: "nato", fr: "fr", de: "de" }),
  );
  const markCase = useToolState("markCase", false);
  const items = useComputed(() => spell(text.value, alphabet.value, markCase.value));
  const output = useComputed(() => spellText(items.value));
  const table = useComputed(() => alphabetTable(alphabet.value));

  return (
    <>
      <div class="row tx-options nato-options">
        <Select<Alphabet>
          label={tr(T.alphabetLabel)}
          value={alphabet.value}
          onChange={(v) => {
            alphabet.value = v;
          }}
          options={ALPHABETS.map((a) => ({ value: a, label: tr(NAMES[a]) }))}
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
