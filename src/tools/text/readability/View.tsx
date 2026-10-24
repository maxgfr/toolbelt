import { useComputed } from "@preact/signals";
import { Badge, type BadgeKind, NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Panel, Segmented, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { Highlight, type Range } from "../_ui";
import { analyze, detectLang, type Lang, type Score, type ScoreId } from "./logic";

const T = {
  text: l("Text", "Texte"),
  placeholder: l(
    "Paste a text in English or French (a few paragraphs give steadier scores)…",
    "Colle un texte en français ou en anglais (quelques paragraphes donnent des scores plus stables)…",
  ),
  language: l("Language", "Langue"),
  auto: l("Auto", "Auto"),
  detected: l("detected", "détectée"),
  english: l("English", "Anglais"),
  french: l("French", "Français"),
  longFrom: l("Long sentence from", "Phrase longue à partir de"),
  wordsUnit: l("words", "mots"),
  sentences: l("Sentences", "Phrases"),
  words: l("Words", "Mots"),
  syllables: l("Syllables", "Syllabes"),
  wps: l("Words / sentence", "Mots / phrase"),
  spw: l("Syllables / word", "Syllabes / mot"),
  complex: l("Words of 3+ syllables", "Mots de 3 syllabes et +"),
  longSentences: l("Long sentences", "Phrases longues"),
  scores: l("Scores", "Scores"),
  empty: l("Paste a text to score it.", "Colle un texte pour l'évaluer."),
  highlighted: l("Long sentences highlighted", "Phrases longues surlignées"),
  noLong: l("No long sentence.", "Aucune phrase longue."),
  wordsTitle: l("words", "mots"),
  shaky: l(
    "Needs about 30 sentences to be reliable.",
    "Demande environ 30 phrases pour être fiable.",
  ),
  usGrade: l("US school grade", "Niveau scolaire américain (grade)"),
  heuristic: l(
    "Syllables are counted with spelling rules, not a dictionary: expect small differences with other tools.",
    "Les syllabes sont comptées avec des règles d'orthographe, pas un dictionnaire : de petits écarts avec d'autres outils sont normaux.",
  ),
};

const LEVELS: { label: L10n; kind: BadgeKind }[] = [
  { label: l("Very easy", "Très facile"), kind: "ok" },
  { label: l("Easy", "Facile"), kind: "ok" },
  { label: l("Fairly difficult", "Assez difficile"), kind: "info" },
  { label: l("Difficult", "Difficile"), kind: "warn" },
  { label: l("Very difficult", "Très difficile"), kind: "bad" },
];

const SCORES: Record<ScoreId, { name: string; explain: L10n }> = {
  flesch: {
    name: "Flesch Reading Ease",
    explain: l(
      "0–100, higher is easier. 60–70 is plain English; under 30 reads like an academic paper. Based on words per sentence and syllables per word.",
      "De 0 à 100, plus c'est haut plus c'est facile. 60–70 correspond à un anglais simple ; sous 30, à un article universitaire. Calculé sur les mots par phrase et les syllabes par mot.",
    ),
  },
  fk: {
    name: "Flesch–Kincaid Grade",
    explain: l(
      "The US school grade needed to understand the text (8 ≈ 13–14 years old). Same inputs as Flesch, scaled to grades.",
      "Le niveau scolaire américain nécessaire pour comprendre le texte (8 ≈ 13–14 ans). Mêmes entrées que Flesch, ramenées à un niveau scolaire.",
    ),
  },
  fog: {
    name: "Gunning Fog",
    explain: l(
      "Years of formal education needed on a first reading. Weighs sentence length and the share of words of 3 syllables or more. Aim for under 12.",
      "Années d'études nécessaires pour comprendre à la première lecture. Pèse la longueur des phrases et la part de mots de 3 syllabes ou plus. Viser moins de 12.",
    ),
  },
  smog: {
    name: "SMOG",
    explain: l(
      "Grade level from the number of words of 3+ syllables, designed for 30-sentence samples; often used for health information.",
      "Niveau scolaire calculé sur le nombre de mots de 3 syllabes ou plus, prévu pour des extraits de 30 phrases ; souvent utilisé en information médicale.",
    ),
  },
  cli: {
    name: "Coleman–Liau",
    explain: l(
      "Grade level from letters per word and sentences per 100 words: no syllable counting, so it is steadier on unusual words.",
      "Niveau scolaire calculé sur les lettres par mot et les phrases pour 100 mots : sans compter les syllabes, il est plus stable sur les mots inhabituels.",
    ),
  },
  ari: {
    name: "Automated Readability Index",
    explain: l(
      "Grade level from characters per word and words per sentence, made to be computed by machines.",
      "Niveau scolaire calculé sur les caractères par mot et les mots par phrase, conçu pour être calculé par une machine.",
    ),
  },
  kandel: {
    name: "Kandel & Moles",
    explain: l(
      "Flesch's reading ease adapted to French in 1958 (207 − 1.015 × words/sentence − 73.6 × syllables/word). 0–100, higher is easier; 60–70 is standard prose.",
      "L'indice de Flesch adapté au français en 1958 (207 − 1,015 × mots/phrase − 73,6 × syllabes/mot). De 0 à 100, plus c'est haut plus c'est facile ; 60–70 correspond à une prose courante.",
    ),
  },
  lix: {
    name: "LIX",
    explain: l(
      "Words per sentence plus the percentage of words longer than 6 letters; works for any language. Under 30 very easy, 40 average, over 60 very hard.",
      "Mots par phrase plus le pourcentage de mots de plus de 6 lettres ; vaut pour toutes les langues. Moins de 30 très facile, 40 moyen, plus de 60 très difficile.",
    ),
  },
};

export default function Readability() {
  const text = useToolState("text", "");
  const langChoice = useToolState<string>("lang", "auto");
  const longFrom = useToolState("longFrom", 25);

  const detected = useComputed<Lang>(() => detectLang(text.value));
  const lang = useComputed<Lang>(() =>
    langChoice.value === "en" || langChoice.value === "fr" ? langChoice.value : detected.value,
  );
  const a = useComputed(() => analyze(text.value, lang.value));
  const ranges = useComputed<Range[]>(() =>
    a.value.sentences
      .filter((s) => s.words >= longFrom.value)
      .map((s) => ({
        start: s.start,
        end: s.end,
        cls: s.words >= longFrom.value * 1.5 ? "readability-vlong" : "readability-long",
        title: `${fmt(s.words)} ${tr(T.wordsTitle)}`,
      })),
  );

  const r = a.value;
  const S = Math.max(1, r.sentences.length);
  const num = (n: number, d = 1) => fmt(n, { maximumFractionDigits: d });

  return (
    <>
      <div class="row tx-options">
        <Segmented<string>
          label={tr(T.language)}
          value={langChoice.value}
          onChange={(v) => {
            langChoice.value = v;
          }}
          options={[
            {
              value: "auto",
              label: `${tr(T.auto)}${text.value.trim() ? ` (${detected.value === "fr" ? tr(T.french) : tr(T.english)})` : ""}`,
            },
            { value: "en", label: tr(T.english) },
            { value: "fr", label: tr(T.french) },
          ]}
        />
        <NumberField
          label={tr(T.longFrom)}
          value={longFrom.value}
          min={5}
          max={200}
          integer
          suffix={tr(T.wordsUnit)}
          onChange={(v) => {
            longFrom.value = v;
          }}
        />
      </div>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={10}
        mono={false}
        spellcheck
      />
      {r.words === 0 ? (
        <p class="muted">{tr(T.empty)}</p>
      ) : (
        <>
          <Stats
            items={[
              { label: tr(T.sentences), value: fmt(r.sentences.length) },
              { label: tr(T.words), value: fmt(r.words) },
              { label: tr(T.syllables), value: fmt(r.syllables) },
              { label: tr(T.wps), value: num(r.words / S) },
              { label: tr(T.spw), value: num(r.syllables / r.words, 2) },
              {
                label: tr(T.complex),
                value: fmt(r.complex / r.words, { style: "percent", maximumFractionDigits: 0 }),
              },
              { label: tr(T.longSentences), value: fmt(ranges.value.length) },
            ]}
          />
          <Panel title={tr(T.scores)}>
            <div class="readability-scores">
              {r.scores.map((s) => (
                <ScoreCard key={s.id} s={s} />
              ))}
            </div>
            <p class="muted small">{tr(T.heuristic)}</p>
          </Panel>
          <Panel title={tr(T.highlighted)}>
            {ranges.value.length === 0 ? (
              <p class="muted">{tr(T.noLong)}</p>
            ) : (
              <div class="readability-text">
                <Highlight text={text.value} ranges={ranges.value} />
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function ScoreCard({ s }: { s: Score }) {
  const meta = SCORES[s.id];
  const lvl = LEVELS[s.level] ?? LEVELS[2];
  return (
    <article class="readability-score">
      <header>
        <h3>{meta.name}</h3>
        {lvl && <Badge kind={lvl.kind}>{tr(lvl.label)}</Badge>}
      </header>
      <div class="readability-value">
        {fmt(s.value, { maximumFractionDigits: 1 })}
        {s.grade !== null && <span class="muted small"> {tr(T.usGrade)}</span>}
      </div>
      <p class="small">{tr(meta.explain)}</p>
      {s.shaky && <p class="small readability-shaky">{tr(T.shaky)}</p>}
    </article>
  );
}
