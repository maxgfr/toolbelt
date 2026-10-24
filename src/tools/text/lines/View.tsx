import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Field, Panel, Segmented, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { splitLines } from "../_shared";
import { Group, NumberInput } from "../_ui";
import { DEFAULTS, processLines, type SortMode } from "./logic";

const T = {
  input: l("Lines", "Lignes"),
  output: l("Result", "Résultat"),
  placeholder: l("One item per line…", "Un élément par ligne…"),
  operations: l("Operations", "Opérations"),
  clean: l("Clean up", "Nettoyage"),
  trim: l("Trim spaces", "Retirer les espaces autour"),
  removeEmpty: l("Remove empty lines", "Supprimer les lignes vides"),
  dedupe: l("Remove duplicates", "Supprimer les doublons"),
  ignoreCase: l("Ignore case", "Ignorer la casse"),
  sort: l("Sort", "Tri"),
  none: l("None", "Aucun"),
  az: l("A → Z", "A → Z"),
  za: l("Z → A", "Z → A"),
  natural: l("Natural (2 < 10)", "Naturel (2 < 10)"),
  length: l("By length", "Par longueur"),
  order: l("Order", "Ordre"),
  reverse: l("Reverse", "Inverser"),
  shuffle: l("Shuffle", "Mélanger"),
  reshuffle: l("Shuffle again", "Remélanger"),
  number: l("Number lines", "Numéroter les lignes"),
  start: l("Start at", "Commencer à"),
  numberSep: l("After the number", "Après le numéro"),
  prefix: l("Prefix", "Préfixe"),
  suffix: l("Suffix", "Suffixe"),
  before: l("Lines before", "Lignes avant"),
  after: l("Lines after", "Lignes après"),
  removed: l("Removed", "Supprimées"),
};

export default function Lines() {
  const text = useToolState("text", "");
  const trim = useToolState("trim", DEFAULTS.trim);
  const removeEmpty = useToolState("removeEmpty", DEFAULTS.removeEmpty);
  const dedupe = useToolState("dedupe", DEFAULTS.dedupe);
  const dedupeIgnoreCase = useToolState("dedupeIgnoreCase", DEFAULTS.dedupeIgnoreCase);
  const sort = useToolState<SortMode>("sort", DEFAULTS.sort);
  const sortIgnoreCase = useToolState("sortIgnoreCase", DEFAULTS.sortIgnoreCase);
  const reverse = useToolState("reverse", DEFAULTS.reverse);
  const shuffle = useToolState("shuffle", DEFAULTS.shuffle);
  const seed = useToolState("seed", DEFAULTS.seed);
  const number = useToolState("number", DEFAULTS.number);
  const numberStart = useToolState("numberStart", DEFAULTS.numberStart);
  const numberSep = useToolState("numberSep", DEFAULTS.numberSep);
  const prefix = useToolState("prefix", DEFAULTS.prefix);
  const suffix = useToolState("suffix", DEFAULTS.suffix);

  const before = useComputed(() => splitLines(text.value).length);
  const lines = useComputed(() =>
    processLines(
      text.value,
      {
        trim: trim.value,
        removeEmpty: removeEmpty.value,
        dedupe: dedupe.value,
        dedupeIgnoreCase: dedupeIgnoreCase.value,
        sort: sort.value,
        sortIgnoreCase: sortIgnoreCase.value,
        reverse: reverse.value,
        shuffle: shuffle.value,
        seed: seed.value,
        number: number.value,
        numberStart: numberStart.value,
        numberSep: numberSep.value,
        prefix: prefix.value,
        suffix: suffix.value,
      },
      lang.value,
    ),
  );
  const output = useComputed(() => lines.value.join("\n"));

  const toggle = (sig: { value: boolean }, label: string) => (
    <Toggle
      checked={sig.value}
      onChange={(v) => {
        sig.value = v;
      }}
      label={label}
    />
  );

  return (
    <>
      <Panel title={tr(T.operations)}>
        <div class="lines-ops">
          <Group label={tr(T.clean)}>
            <div class="row">
              {toggle(trim, tr(T.trim))}
              {toggle(removeEmpty, tr(T.removeEmpty))}
              {toggle(dedupe, tr(T.dedupe))}
              {dedupe.value && toggle(dedupeIgnoreCase, tr(T.ignoreCase))}
            </div>
          </Group>
          <Group label={tr(T.sort)}>
            <div class="row">
              <Segmented<SortMode>
                label={tr(T.sort)}
                value={sort.value}
                onChange={(v) => {
                  sort.value = v;
                }}
                options={[
                  { value: "none", label: tr(T.none) },
                  { value: "az", label: tr(T.az) },
                  { value: "za", label: tr(T.za) },
                  { value: "natural", label: tr(T.natural) },
                  { value: "length", label: tr(T.length) },
                ]}
              />
              {sort.value !== "none" && toggle(sortIgnoreCase, tr(T.ignoreCase))}
            </div>
          </Group>
          <Group label={tr(T.order)}>
            <div class="row">
              {toggle(reverse, tr(T.reverse))}
              {toggle(shuffle, tr(T.shuffle))}
              {shuffle.value && (
                <Button
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    seed.value = (Math.random() * 2 ** 31) | 0;
                  }}
                >
                  {tr(T.reshuffle)}
                </Button>
              )}
            </div>
          </Group>
          <div class="row tx-options">
            {toggle(number, tr(T.number))}
            {number.value && (
              <>
                <Field label={tr(T.start)}>
                  <NumberInput
                    class="lines-num"
                    value={numberStart.value}
                    min={-1_000_000}
                    max={1_000_000}
                    onChange={(v) => {
                      numberStart.value = v;
                    }}
                  />
                </Field>
                <Field label={tr(T.numberSep)}>
                  <input
                    class="input mono lines-num"
                    value={numberSep.value}
                    onInput={(e) => {
                      numberSep.value = e.currentTarget.value;
                    }}
                  />
                </Field>
              </>
            )}
            <Field label={tr(T.prefix)}>
              <input
                class="input mono lines-affix"
                value={prefix.value}
                onInput={(e) => {
                  prefix.value = e.currentTarget.value;
                }}
              />
            </Field>
            <Field label={tr(T.suffix)}>
              <input
                class="input mono lines-affix"
                value={suffix.value}
                onInput={(e) => {
                  suffix.value = e.currentTarget.value;
                }}
              />
            </Field>
          </div>
        </div>
      </Panel>
      <Stats
        items={[
          { label: tr(T.before), value: fmt(before.value) },
          { label: tr(T.after), value: fmt(lines.value.length) },
          { label: tr(T.removed), value: fmt(Math.max(0, before.value - lines.value.length)) },
        ]}
      />
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.placeholder)}
          rows={16}
          wrap={false}
        />
        <TextBox
          label={tr(T.output)}
          value={output.value}
          readOnly
          rows={16}
          wrap={false}
          downloadName="lines.txt"
        />
      </div>
    </>
  );
}
