import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { formatDuration, LIMITS, textStats, wordFrequency } from "./logic";

const T = {
  text: l("Text", "Texte"),
  placeholder: l(
    "Type or paste text, or drop a file…",
    "Tape ou colle du texte, ou dépose un fichier…",
  ),
  characters: l("Characters", "Caractères"),
  graphemes: l("Visible characters", "Caractères visibles"),
  noSpaces: l("Without spaces", "Sans espaces"),
  words: l("Words", "Mots"),
  lines: l("Lines", "Lignes"),
  sentences: l("Sentences", "Phrases"),
  paragraphs: l("Paragraphs", "Paragraphes"),
  bytes: l("Bytes (UTF-8)", "Octets (UTF-8)"),
  tokens: l("Tokens (≈)", "Tokens (≈)"),
  reading: l("Reading time", "Temps de lecture"),
  speaking: l("Speaking time", "Temps de parole"),
  limits: l("Limits", "Limites"),
  frequent: l("Most frequent words", "Mots les plus fréquents"),
  skipShort: l("Skip words under 4 letters", "Ignorer les mots de moins de 4 lettres"),
  word: l("Word", "Mot"),
  count: l("Count", "Nombre"),
  share: l("Share", "Part"),
};

export default function Counter() {
  const text = useToolState("text", "");
  const skipShort = useToolState("skipShort", true);
  const stats = useComputed(() => textStats(text.value, lang.value));
  const top = useComputed(() => wordFrequency(text.value, 12, skipShort.value ? 4 : 1, lang.value));
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
                  <span>{lim.label}</span>
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
