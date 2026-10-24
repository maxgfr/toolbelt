import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Output, TextBox } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { CASES, type CaseId, convertCase } from "./logic";

const T = {
  text: l("Text", "Texte"),
  placeholder: l(
    "Type or paste a phrase or identifiers, one per line…",
    "Tape ou colle une phrase ou des identifiants, un par ligne…",
  ),
  hint: l(
    "Identifier styles convert each line separately.",
    "Les styles d'identifiants convertissent chaque ligne séparément.",
  ),
};

const LABELS: Record<CaseId, L10n> = {
  camel: l("camelCase", "camelCase"),
  pascal: l("PascalCase", "PascalCase"),
  snake: l("snake_case", "snake_case"),
  kebab: l("kebab-case", "kebab-case"),
  constant: l("CONSTANT_CASE", "CONSTANT_CASE"),
  dot: l("dot.case", "dot.case"),
  path: l("path/case", "path/case"),
  train: l("Train-Case", "Train-Case"),
  title: l("Title Case", "Casse De Titre"),
  sentence: l("Sentence case", "Casse de phrase"),
  lower: l("lower case", "minuscules"),
  upper: l("UPPER CASE", "MAJUSCULES"),
  alternating: l("aLtErNaTiNg", "aLtErNé"),
};

export default function Case() {
  const text = useToolState("text", "");
  const results = useComputed(() =>
    CASES.map((id) => ({ id, value: convertCase(text.value, id) })),
  );

  return (
    <>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={5}
        note={<span class="muted">{tr(T.hint)}</span>}
      />
      <div class="stack case-list">
        {results.value.map((r) => (
          <Output key={r.id} label={tr(LABELS[r.id])} value={r.value} />
        ))}
      </div>
    </>
  );
}
