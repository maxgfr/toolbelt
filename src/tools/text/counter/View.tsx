import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, locale, tr } from "../../../i18n";
import { formatDuration, LIMITS, textStats, wordFrequency } from "./logic";

const T = {
  text: l("Text", "Texte", "Text"),
  placeholder: l(
    "Type or paste text, or drop a file…",
    "Tape ou colle du texte, ou dépose un fichier…",
    "Tippe oder füge Text ein, oder lege eine Datei ab…",
  ),
  characters: l("Characters", "Caractères", "Zeichen"),
  graphemes: l("Visible characters", "Caractères visibles", "Sichtbare Zeichen"),
  noSpaces: l("Without spaces", "Sans espaces", "Ohne Leerzeichen"),
  words: l("Words", "Mots", "Wörter"),
  lines: l("Lines", "Lignes", "Zeilen"),
  sentences: l("Sentences", "Phrases", "Sätze"),
  paragraphs: l("Paragraphs", "Paragraphes", "Absätze"),
  bytes: l("Bytes (UTF-8)", "Octets (UTF-8)", "Bytes (UTF-8)"),
  tokens: l("Tokens (≈)", "Tokens (≈)", "Tokens (≈)"),
  reading: l("Reading time", "Temps de lecture", "Lesezeit"),
  speaking: l("Speaking time", "Temps de parole", "Sprechzeit"),
  limits: l("Limits", "Limites", "Längengrenzen"),
  frequent: l("Most frequent words", "Mots les plus fréquents", "Häufigste Wörter"),
  skipShort: l(
    "Skip words under 4 letters",
    "Ignorer les mots de moins de 4 lettres",
    "Wörter unter 4 Buchstaben ignorieren",
  ),
  word: l("Word", "Mot", "Wort"),
  count: l("Count", "Nombre", "Anzahl"),
  share: l("Share", "Part", "Anteil"),
};

/** Names of the limits that are not brand names. */
const LIMIT_NAMES: Partial<Record<(typeof LIMITS)[number]["id"], L10n>> = {
  title: l("SEO title", "Titre SEO", "SEO-Titel"),
  meta: l("Meta description", "Méta-description", "Meta-Beschreibung"),
};

export default function Counter() {
  const text = useToolState("text", "");
  const skipShort = useToolState("skipShort", true);
  const stats = useComputed(() => textStats(text.value, locale()));
  const top = useComputed(() => wordFrequency(text.value, 12, skipShort.value ? 4 : 1, locale()));
  const s = stats.value;

  return (
    <>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={12}
        mono={false}
        spellcheck
      />
      <Stats
        items={[
          { label: tr(T.characters), value: fmt(s.characters) },
          { label: tr(T.noSpaces), value: fmt(s.noSpaces) },
          { label: tr(T.graphemes), value: fmt(s.graphemes) },
          { label: tr(T.words), value: fmt(s.words) },
          { label: tr(T.lines), value: fmt(s.lines) },
          { label: tr(T.sentences), value: fmt(s.sentences) },
          { label: tr(T.paragraphs), value: fmt(s.paragraphs) },
          { label: tr(T.bytes), value: fmt(s.bytes) },
          { label: tr(T.tokens), value: fmt(s.tokens) },
          { label: tr(T.reading), value: formatDuration(s.readingMinutes) },
          { label: tr(T.speaking), value: formatDuration(s.speakingMinutes) },
        ]}
      />
      <div class="grid-2">
        <section class="panel">
          <h2 class="panel-title">{tr(T.limits)}</h2>
          <ul class="limits">
            {LIMITS.map((lim) => {
              const pct = Math.min(100, (s.graphemes / lim.max) * 100);
              const over = s.graphemes > lim.max;
              return (
                <li key={lim.id}>
                  <span>{LIMIT_NAMES[lim.id] ? tr(LIMIT_NAMES[lim.id] as L10n) : lim.label}</span>
                  <meter min={0} max={lim.max} value={Math.min(s.graphemes, lim.max)} />
                  <span class={`mono small ${over ? "error" : "muted"}`}>
                    {fmt(s.graphemes)} / {fmt(lim.max)}
                  </span>
                  <span class="sr-only">{Math.round(pct)}%</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section class="panel">
          <div class="row">
            <h2 class="panel-title">{tr(T.frequent)}</h2>
            <span class="spacer" />
            <Toggle
              checked={skipShort.value}
              onChange={(v) => {
                skipShort.value = v;
              }}
              label={tr(T.skipShort)}
            />
          </div>
          {top.value.length > 0 && (
            <table class="table">
              <thead>
                <tr>
                  <th>{tr(T.word)}</th>
                  <th class="num">{tr(T.count)}</th>
                  <th class="num">{tr(T.share)}</th>
                </tr>
              </thead>
              <tbody>
                {top.value.map((w) => (
                  <tr key={w.word}>
                    <td>{w.word}</td>
                    <td class="num">{fmt(w.count)}</td>
                    <td class="num">
                      {fmt(w.count / Math.max(1, s.words), {
                        style: "percent",
                        maximumFractionDigits: 1,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
