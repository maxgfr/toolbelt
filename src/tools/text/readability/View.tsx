import { useComputed } from "@preact/signals";
import { Badge, type BadgeKind, NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Panel, Segmented, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, pick, tr } from "../../../i18n";
import { Highlight, type Range } from "../_ui";
import { analyze, detectLang, type Lang, type Score, type ScoreId } from "./logic";

const T = {
  text: l("Text", "Texte", "Text"),
  placeholder: l(
    "Paste a text in English, French or German (a few paragraphs give steadier scores)…",
    "Colle un texte en français, en anglais ou en allemand (quelques paragraphes donnent des scores plus stables)…",
    "Füge einen deutschen, englischen oder französischen Text ein (ein paar Absätze ergeben stabilere Werte)…",
  ),
  language: l("Language", "Langue", "Sprache"),
  auto: l("Auto", "Auto", "Auto"),
  detected: l("detected", "détectée", "erkannt"),
  english: l("English", "Anglais", "Englisch"),
  french: l("French", "Français", "Französisch"),
  german: l("German", "Allemand", "Deutsch"),
  longFrom: l("Long sentence from", "Phrase longue à partir de", "Langer Satz ab"),
  wordsUnit: l("words", "mots", "Wörtern"),
  sentences: l("Sentences", "Phrases", "Sätze"),
  words: l("Words", "Mots", "Wörter"),
  syllables: l("Syllables", "Syllabes", "Silben"),
  wps: l("Words / sentence", "Mots / phrase", "Wörter / Satz"),
  spw: l("Syllables / word", "Syllabes / mot", "Silben / Wort"),
  complex: l("Words of 3+ syllables", "Mots de 3 syllabes et +", "Wörter mit 3+ Silben"),
  longSentences: l("Long sentences", "Phrases longues", "Lange Sätze"),
  scores: l("Scores", "Scores", "Werte"),
  empty: l(
    "Paste a text to score it.",
    "Colle un texte pour l'évaluer.",
    "Füge einen Text ein, um ihn zu bewerten.",
  ),
  highlighted: l(
    "Long sentences highlighted",
    "Phrases longues surlignées",
    "Lange Sätze hervorgehoben",
  ),
  noLong: l("No long sentence.", "Aucune phrase longue.", "Kein langer Satz."),
  wordsTitle: l("words", "mots", "Wörter"),
  shaky: l(
    "Needs about 30 sentences to be reliable.",
    "Demande environ 30 phrases pour être fiable.",
    "Braucht etwa 30 Sätze, um verlässlich zu sein.",
  ),
  usGrade: l("US school grade", "Niveau scolaire américain (grade)", "US-Klassenstufe"),
  heuristic: l(
    "Syllables are counted with spelling rules, not a dictionary: expect small differences with other tools.",
    "Les syllabes sont comptées avec des règles d'orthographe, pas un dictionnaire : de petits écarts avec d'autres outils sont normaux.",
    "Silben werden nach Rechtschreibregeln gezählt, nicht mit einem Wörterbuch: Kleine Abweichungen zu anderen Werkzeugen sind normal.",
  ),
};

const LANG_NAMES: Record<Lang, L10n> = { en: T.english, fr: T.french, de: T.german };
/** The current UI language first, then the others. */
const LANGS = (): Lang[] => {
  const ui = pick<Lang>({ en: "en", fr: "fr", de: "de" });
  return [ui, ...(["en", "fr", "de"] as Lang[]).filter((x) => x !== ui)];
};

const LEVELS: { label: L10n; kind: BadgeKind }[] = [
  { label: l("Very easy", "Très facile", "Sehr leicht"), kind: "ok" },
  { label: l("Easy", "Facile", "Leicht"), kind: "ok" },
  { label: l("Fairly difficult", "Assez difficile", "Mittelschwer"), kind: "info" },
  { label: l("Difficult", "Difficile", "Schwer"), kind: "warn" },
  { label: l("Very difficult", "Très difficile", "Sehr schwer"), kind: "bad" },
];

const SCORES: Record<ScoreId, { name: string; explain: L10n }> = {
  flesch: {
    name: "Flesch Reading Ease",
    explain: l(
      "0–100, higher is easier. 60–70 is plain English; under 30 reads like an academic paper. Based on words per sentence and syllables per word.",
      "De 0 à 100, plus c'est haut plus c'est facile. 60–70 correspond à un anglais simple ; sous 30, à un article universitaire. Calculé sur les mots par phrase et les syllabes par mot.",
      "0–100, höher ist leichter. 60–70 ist einfaches Englisch, unter 30 liest es sich wie ein Fachaufsatz. Beruht auf Wörtern pro Satz und Silben pro Wort.",
    ),
  },
  fk: {
    name: "Flesch–Kincaid Grade",
    explain: l(
      "The US school grade needed to understand the text (8 ≈ 13–14 years old). Same inputs as Flesch, scaled to grades.",
      "Le niveau scolaire américain nécessaire pour comprendre le texte (8 ≈ 13–14 ans). Mêmes entrées que Flesch, ramenées à un niveau scolaire.",
      "Die US-Klassenstufe, die zum Verstehen des Textes nötig ist (8 ≈ 13–14 Jahre). Dieselben Größen wie bei Flesch, auf Klassenstufen umgerechnet.",
    ),
  },
  fog: {
    name: "Gunning Fog",
    explain: l(
      "Years of formal education needed on a first reading. Weighs sentence length and the share of words of 3 syllables or more. Aim for under 12.",
      "Années d'études nécessaires pour comprendre à la première lecture. Pèse la longueur des phrases et la part de mots de 3 syllabes ou plus. Viser moins de 12.",
      "Schuljahre, die nötig sind, um den Text beim ersten Lesen zu verstehen. Gewichtet Satzlänge und Anteil der Wörter mit 3 oder mehr Silben. Ziel: unter 12.",
    ),
  },
  smog: {
    name: "SMOG",
    explain: l(
      "Grade level from the number of words of 3+ syllables, designed for 30-sentence samples; often used for health information.",
      "Niveau scolaire calculé sur le nombre de mots de 3 syllabes ou plus, prévu pour des extraits de 30 phrases ; souvent utilisé en information médicale.",
      "Klassenstufe aus der Zahl der Wörter mit 3+ Silben, gedacht für Textproben von 30 Sätzen; oft für Gesundheitsinformationen verwendet.",
    ),
  },
  cli: {
    name: "Coleman–Liau",
    explain: l(
      "Grade level from letters per word and sentences per 100 words: no syllable counting, so it is steadier on unusual words.",
      "Niveau scolaire calculé sur les lettres par mot et les phrases pour 100 mots : sans compter les syllabes, il est plus stable sur les mots inhabituels.",
      "Klassenstufe aus Buchstaben pro Wort und Sätzen pro 100 Wörter: Ohne Silbenzählung ist sie bei ungewöhnlichen Wörtern stabiler.",
    ),
  },
  ari: {
    name: "Automated Readability Index",
    explain: l(
      "Grade level from characters per word and words per sentence, made to be computed by machines.",
      "Niveau scolaire calculé sur les caractères par mot et les mots par phrase, conçu pour être calculé par une machine.",
      "Klassenstufe aus Zeichen pro Wort und Wörtern pro Satz, für die Berechnung durch Maschinen entworfen.",
    ),
  },
  kandel: {
    name: "Kandel & Moles",
    explain: l(
      "Flesch's reading ease adapted to French in 1958 (207 − 1.015 × words/sentence − 73.6 × syllables/word). 0–100, higher is easier; 60–70 is standard prose.",
      "L'indice de Flesch adapté au français en 1958 (207 − 1,015 × mots/phrase − 73,6 × syllabes/mot). De 0 à 100, plus c'est haut plus c'est facile ; 60–70 correspond à une prose courante.",
      "Der Flesch-Index, 1958 ans Französische angepasst (207 − 1,015 × Wörter/Satz − 73,6 × Silben/Wort). 0–100, höher ist leichter; 60–70 ist übliche Prosa.",
    ),
  },
  amstad: {
    name: "Flesch–Amstad",
    explain: l(
      "Flesch's reading ease adapted to German by Toni Amstad in 1978 (180 − words/sentence − 58.5 × syllables/word). 0–100, higher is easier; 60–70 is standard prose, under 30 an academic text.",
      "L'indice de Flesch adapté à l'allemand par Toni Amstad en 1978 (180 − mots/phrase − 58,5 × syllabes/mot). De 0 à 100, plus c'est haut plus c'est facile ; 60–70 correspond à une prose courante, sous 30 à un texte universitaire.",
      "Der Flesch-Index, 1978 von Toni Amstad ans Deutsche angepasst (180 − Wörter/Satz − 58,5 × Silben/Wort). 0–100, höher ist leichter; 60–70 ist übliche Prosa, unter 30 ein wissenschaftlicher Text.",
    ),
  },
  wstf: {
    name: "Wiener Sachtextformel",
    explain: l(
      "Bamberger and Vanecek's formula for German non-fiction (1984): roughly the school year needed, from 4 (very easy) to 15 (very hard). Weighs words of 3+ syllables, sentence length, words longer than 6 letters and one-syllable words.",
      "La formule de Bamberger et Vanecek pour les textes documentaires allemands (1984) : à peu près l'année scolaire nécessaire, de 4 (très facile) à 15 (très difficile). Pèse les mots de 3 syllabes et +, la longueur des phrases, les mots de plus de 6 lettres et les mots d'une syllabe.",
      "Die Formel von Bamberger und Vanecek für deutsche Sachtexte (1984): ungefähr die nötige Schulstufe, von 4 (sehr leicht) bis 15 (sehr schwer). Gewichtet Wörter mit 3+ Silben, Satzlänge, Wörter mit mehr als 6 Buchstaben und einsilbige Wörter.",
    ),
  },
  lix: {
    name: "LIX",
    explain: l(
      "Words per sentence plus the percentage of words longer than 6 letters; works for any language. Under 30 very easy, 40 average, over 60 very hard.",
      "Mots par phrase plus le pourcentage de mots de plus de 6 lettres ; vaut pour toutes les langues. Moins de 30 très facile, 40 moyen, plus de 60 très difficile.",
      "Wörter pro Satz plus der Anteil der Wörter mit mehr als 6 Buchstaben in Prozent; gilt für jede Sprache. Unter 30 sehr leicht, 40 mittel, über 60 sehr schwer.",
    ),
  },
};

export default function Readability() {
  const text = useToolState("text", "");
  const langChoice = useToolState<string>("lang", "auto");
  const longFrom = useToolState("longFrom", 25);

  const detected = useComputed<Lang>(() => detectLang(text.value));
  const lang = useComputed<Lang>(() =>
    langChoice.value in LANG_NAMES ? (langChoice.value as Lang) : detected.value,
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
              label: `${tr(T.auto)}${text.value.trim() ? ` (${tr(LANG_NAMES[detected.value])})` : ""}`,
            },
            ...LANGS().map((id) => ({ value: id, label: tr(LANG_NAMES[id]) })),
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
