import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Field, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { NumberInput } from "../_ui";
import { lorem, MAX, type Unit } from "./logic";

const T = {
  count: l("How many", "Combien"),
  paragraphs: l("Paragraphs", "Paragraphes"),
  sentences: l("Sentences", "Phrases"),
  words: l("Words", "Mots"),
  start: l("Start with “Lorem ipsum…”", "Commencer par « Lorem ipsum… »"),
  html: l("HTML <p> tags", "Balises HTML <p>"),
  regenerate: l("Regenerate", "Régénérer"),
  output: l("Placeholder text", "Faux texte"),
  stats: l("{w} words · {c} characters", "{w} mots · {c} caractères"),
};

export default function Lorem() {
  const unit = useToolState<Unit>("unit", "paragraphs");
  const count = useToolState("count", 3);
  const start = useToolState("start", true);
  const html = useToolState("html", false);
  const seed = useToolState("seed", 1);
  const text = useComputed(() =>
    lorem({
      unit: unit.value,
      count: count.value,
      startWithLorem: start.value,
      html: html.value,
      seed: seed.value,
    }),
  );
  const words = text.value
    .replace(/<\/?p>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <>
      <div class="row tx-options">
        <Field label={tr(T.count)}>
          <NumberInput
            class="lorem-count"
            value={count.value}
            min={1}
            max={MAX[unit.value]}
            onChange={(v) => {
              count.value = v;
            }}
          />
        </Field>
        <Segmented<Unit>
          value={unit.value}
          onChange={(v) => {
            unit.value = v;
            if (count.value > MAX[v]) count.value = MAX[v];
          }}
          options={[
            { value: "paragraphs", label: tr(T.paragraphs) },
            { value: "sentences", label: tr(T.sentences) },
            { value: "words", label: tr(T.words) },
          ]}
        />
        <Toggle
          checked={start.value}
          onChange={(v) => {
            start.value = v;
          }}
          label={tr(T.start)}
        />
        <Toggle
          checked={html.value}
          onChange={(v) => {
            html.value = v;
          }}
          label={tr(T.html)}
        />
        <span class="spacer" />
        <Button
          icon="refresh"
          onClick={() => {
            seed.value = 1 + ((Math.random() * 2 ** 31) | 0);
          }}
        >
          {tr(T.regenerate)}
        </Button>
      </div>
      <TextBox
        label={tr(T.output)}
        value={text.value}
        readOnly
        rows={16}
        mono={html.value}
        downloadName={html.value ? "lorem.html" : "lorem.txt"}
        note={
          <span class="muted">
            {tr(T.stats).replace("{w}", fmt(words)).replace("{c}", fmt(text.value.length))}
          </span>
        }
      />
    </>
  );
}
