import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { compareLists } from "./logic";

const T = {
  a: l("List A", "Liste A", "Liste A"),
  b: l("List B", "Liste B", "Liste B"),
  phA: l("One item per line…", "Un élément par ligne…", "Ein Eintrag pro Zeile…"),
  phB: l("One item per line…", "Un élément par ligne…", "Ein Eintrag pro Zeile…"),
  trim: l("Trim spaces", "Retirer les espaces autour", "Leerzeichen am Rand entfernen"),
  ignoreCase: l("Ignore case", "Ignorer la casse", "Groß-/Kleinschreibung ignorieren"),
  commas: l("Also split on , and ;", "Séparer aussi sur , et ;", "Auch bei , und ; trennen"),
  sort: l("Sort results", "Trier les résultats", "Ergebnisse sortieren"),
  swap: l("Swap A and B", "Inverser A et B", "A und B tauschen"),
  onlyA: l("Only in A", "Seulement dans A", "Nur in A"),
  onlyB: l("Only in B", "Seulement dans B", "Nur in B"),
  both: l("In both", "Dans les deux", "In beiden"),
  union: l("Union (A ∪ B)", "Union (A ∪ B)", "Vereinigung (A ∪ B)"),
  unique: l("{n} unique", "{n} uniques", "{n} eindeutig"),
};

export default function ListCompare() {
  const a = useToolState("a", "");
  const b = useToolState("b", "");
  const trim = useToolState("trim", true);
  const ignoreCase = useToolState("ignoreCase", false);
  const commas = useToolState("commas", false);
  const sort = useToolState("sort", false);
  const r = useComputed(() =>
    compareLists(
      a.value,
      b.value,
      {
        trim: trim.value,
        ignoreCase: ignoreCase.value,
        splitCommas: commas.value,
        sort: sort.value,
      },
      locale(),
    ),
  ).value;

  const toggles: [typeof trim, (typeof T)[keyof typeof T]][] = [
    [trim, T.trim],
    [ignoreCase, T.ignoreCase],
    [commas, T.commas],
    [sort, T.sort],
  ];
  const results: [(typeof T)[keyof typeof T], string[], string][] = [
    [T.onlyA, r.onlyA, "only-a.txt"],
    [T.onlyB, r.onlyB, "only-b.txt"],
    [T.both, r.both, "in-both.txt"],
    [T.union, r.union, "union.txt"],
  ];

  return (
    <>
      <div class="grid-2">
        <TextBox
          label={`${tr(T.a)} · ${tr(T.unique).replace("{n}", fmt(r.a.length))}`}
          value={a.value}
          onInput={(v) => {
            a.value = v;
          }}
          placeholder={tr(T.phA)}
          rows={12}
        />
        <TextBox
          label={`${tr(T.b)} · ${tr(T.unique).replace("{n}", fmt(r.b.length))}`}
          value={b.value}
          onInput={(v) => {
            b.value = v;
          }}
          placeholder={tr(T.phB)}
          rows={12}
        />
      </div>
      <div class="row">
        {toggles.map(([sig, label]) => (
          <Toggle
            key={label.en}
            checked={sig.value}
            onChange={(v) => {
              sig.value = v;
            }}
            label={tr(label)}
          />
        ))}
        <span class="spacer" />
        <Button
          size="sm"
          icon="swap"
          onClick={() => {
            [a.value, b.value] = [b.value, a.value];
          }}
        >
          {tr(T.swap)}
        </Button>
      </div>
      <div class="grid-2">
        {results.map(([label, list, file]) => (
          <TextBox
            key={file}
            label={`${tr(label)} · ${fmt(list.length)}`}
            value={list.join("\n")}
            readOnly
            rows={8}
            downloadName={file}
          />
        ))}
      </div>
    </>
  );
}
