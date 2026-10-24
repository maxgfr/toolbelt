import { useComputed } from "@preact/signals";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Field, Panel, TextBox, Toggle } from "../../../app/ui";
import { l, lang, tr } from "../../../i18n";
import { KNOWN, lookupAll, numeronym, numeronymize } from "./logic";

const T = {
  input: l("Words", "Mots"),
  placeholder: l(
    "internationalization, accessibility, Kubernetes…",
    "internationalization, accessibilité, Kubernetes…",
  ),
  output: l("Numeronyms", "Numéronymes"),
  minLength: l("Shorten words from", "Abréger les mots à partir de"),
  letters: l("letters", "lettres"),
  lowercase: l("Lowercase", "Minuscules"),
  lookup: l("What does it stand for?", "Que veut dire ce numéronyme ?"),
  lookupLabel: l("Numeronyms to look up", "Numéronymes à rechercher"),
  lookupPlaceholder: l("i18n, a11y, k8s…", "i18n, a11y, k8s…"),
  unknown: l("not in the list", "absent de la liste"),
  known: l("Well-known numeronyms", "Numéronymes connus"),
  numeronym: l("Numeronym", "Numéronyme"),
  word: l("Word", "Mot"),
  meaning: l("In French", "En français"),
  explain: l(
    "A numeronym keeps the first and last letters of a word and replaces the letters in between with their count: internationalization → i + 18 letters + n → i18n.",
    "Un numéronyme garde la première et la dernière lettre d'un mot et remplace les lettres du milieu par leur nombre : internationalization → i + 18 lettres + n → i18n.",
  ),
};

export default function Numeronym() {
  const text = useToolState("text", "");
  const minLength = useToolState("minLength", 4);
  const lowercase = useToolState("lowercase", false);
  const query = useToolState("q", "");

  const output = useComputed(() =>
    numeronymize(text.value, { minLength: minLength.value, lowercase: lowercase.value }),
  );
  const found = useComputed(() => lookupAll(query.value));
  const hits = useComputed(() => new Set(found.value.flatMap((f) => f.matches.map((m) => m.word))));

  return (
    <>
      <p class="muted small">{tr(T.explain)}</p>
      <div class="row tx-options numeronym-opts">
        <NumberField
          label={tr(T.minLength)}
          value={minLength.value}
          min={3}
          max={50}
          integer
          suffix={tr(T.letters)}
          onChange={(v) => {
            minLength.value = v;
          }}
        />
        <Toggle
          checked={lowercase.value}
          onChange={(v) => {
            lowercase.value = v;
          }}
          label={tr(T.lowercase)}
        />
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.placeholder)}
          rows={6}
          mono={false}
        />
        <TextBox label={tr(T.output)} value={output.value} readOnly rows={6} mono={false} />
      </div>
      <Panel title={tr(T.lookup)}>
        <Field label={tr(T.lookupLabel)}>
          <input
            class="input mono"
            value={query.value}
            placeholder={tr(T.lookupPlaceholder)}
            onInput={(e) => {
              query.value = e.currentTarget.value;
            }}
          />
        </Field>
        {found.value.length > 0 && (
          <ul class="numeronym-found">
            {found.value.map((f) => (
              <li key={f.token}>
                <code class="mono">{f.token}</code> →{" "}
                {f.matches.length ? (
                  f.matches
                    .map((m) => (lang.value === "fr" ? `${m.word} (${m.fr})` : m.word))
                    .join(" · ")
                ) : (
                  <span class="muted">{tr(T.unknown)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={tr(T.known)}>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{tr(T.numeronym)}</th>
                <th>{tr(T.word)}</th>
                <th>{tr(T.meaning)}</th>
              </tr>
            </thead>
            <tbody>
              {[...KNOWN]
                .sort((a, b) => numeronym(a.word).localeCompare(numeronym(b.word)))
                .map((k) => (
                  <tr key={k.word} class={hits.value.has(k.word) ? "numeronym-hit" : ""}>
                    <td class="mono">{numeronym(k.word)}</td>
                    <td>{k.word}</td>
                    <td>{k.fr}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
