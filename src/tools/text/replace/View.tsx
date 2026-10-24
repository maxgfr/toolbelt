import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Field, Panel, Segmented, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { FlagToggles, Highlight, RegexError } from "../_ui";
import { findReplace, linesTouched } from "./logic";

type Mode = "plain" | "regex";

const PREVIEW_MAX = 2000;

const T = {
  find: l("Find", "Rechercher", "Suchen"),
  replace: l("Replace with", "Remplacer par", "Ersetzen durch"),
  findPh: l("Text to find", "Texte à chercher", "Gesuchter Text"),
  findRePh: l(
    "Regular expression, e.g. (\\d+)-(\\d+)",
    "Expression régulière, par ex. (\\d+)-(\\d+)",
    "Regulärer Ausdruck, z. B. (\\d+)-(\\d+)",
  ),
  replacePh: l("Replacement", "Remplacement", "Ersatz"),
  replaceRePh: l("Replacement, e.g. $2-$1", "Remplacement, par ex. $2-$1", "Ersatz, z. B. $2-$1"),
  plain: l("Plain text", "Texte simple", "Normaler Text"),
  regex: l("Regex", "Regex", "Regex"),
  wholeWord: l("Whole words", "Mots entiers", "Ganze Wörter"),
  escapes: l(
    "Read \\n \\t as newline / tab",
    "Lire \\n \\t comme retour / tabulation",
    "\\n \\t als Zeilenumbruch / Tabulator lesen",
  ),
  groupsHint: l(
    "$1, $2… groups · $<name> named group · $& whole match · $$ a dollar sign",
    "$1, $2… groupes · $<nom> groupe nommé · $& correspondance entière · $$ un dollar",
    "$1, $2… Gruppen · $<name> benannte Gruppe · $& ganzer Treffer · $$ ein Dollarzeichen",
  ),
  input: l("Text", "Texte", "Text"),
  inputPh: l(
    "Paste the text to search in…",
    "Colle le texte dans lequel chercher…",
    "Füge den zu durchsuchenden Text ein…",
  ),
  output: l("Result", "Résultat", "Ergebnis"),
  matches: l("Matches", "Occurrences", "Treffer"),
  lines: l("Lines with a match", "Lignes concernées", "Zeilen mit Treffer"),
  preview: l("Preview", "Aperçu", "Vorschau"),
  more: l(
    "Only the first {n} matches are highlighted.",
    "Seules les {n} premières occurrences sont surlignées.",
    "Nur die ersten {n} Treffer werden hervorgehoben.",
  ),
  apply: l("Use result as text", "Reprendre le résultat", "Ergebnis übernehmen"),
};

export default function Replace() {
  const text = useToolState("text", "");
  const find = useToolState("find", "");
  const replace = useToolState("replace", "");
  const mode = useToolState<Mode>("mode", "plain");
  const flags = useToolState("flags", "g");
  const wholeWord = useToolState("wholeWord", false);
  const escapes = useToolState("escapes", false);

  const result = useComputed(() =>
    findReplace(text.value, find.value, replace.value, {
      regex: mode.value === "regex",
      flags: flags.value,
      wholeWord: wholeWord.value,
      escapes: escapes.value,
    }),
  );
  const r = result.value;
  const isRe = mode.value === "regex";

  return (
    <>
      <div class="grid-2">
        <Field label={tr(T.find)}>
          <input
            class="input mono"
            value={find.value}
            placeholder={tr(isRe ? T.findRePh : T.findPh)}
            spellcheck={false}
            aria-invalid={!r.ok}
            onInput={(e) => {
              find.value = e.currentTarget.value;
            }}
          />
        </Field>
        <Field label={tr(T.replace)} {...(isRe ? { hint: tr(T.groupsHint) } : {})}>
          <input
            class="input mono"
            value={replace.value}
            placeholder={tr(isRe ? T.replaceRePh : T.replacePh)}
            spellcheck={false}
            onInput={(e) => {
              replace.value = e.currentTarget.value;
            }}
          />
        </Field>
      </div>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "plain", label: tr(T.plain) },
            { value: "regex", label: tr(T.regex) },
          ]}
        />
        <FlagToggles
          flags={flags.value}
          only={isRe ? undefined : ["g", "i"]}
          onChange={(f) => {
            flags.value = f;
          }}
        />
        {!isRe && (
          <Toggle
            checked={wholeWord.value}
            onChange={(v) => {
              wholeWord.value = v;
            }}
            label={tr(T.wholeWord)}
          />
        )}
        <Toggle
          checked={escapes.value}
          onChange={(v) => {
            escapes.value = v;
          }}
          label={tr(T.escapes)}
        />
      </div>
      {!r.ok && <RegexError message={r.message} hint={r.hint} />}
      {r.ok && find.value && (
        <Stats
          items={[
            { label: tr(T.matches), value: fmt(r.hits.length) },
            {
              label: tr(T.lines),
              value: fmt(linesTouched(text.value, r.hits)),
            },
          ]}
        />
      )}
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.inputPh)}
          rows={14}
        />
        <TextBox
          label={tr(T.output)}
          value={r.ok ? r.output : ""}
          readOnly
          rows={14}
          downloadName="replaced.txt"
          actions={
            r.ok && r.hits.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                icon="swap"
                onClick={() => {
                  if (r.ok) text.value = r.output;
                }}
              >
                {tr(T.apply)}
              </Button>
            ) : null
          }
        />
      </div>
      {r.ok && r.hits.length > 0 && (
        <Panel title={tr(T.preview)}>
          <Highlight
            text={text.value}
            ranges={r.hits.slice(0, PREVIEW_MAX).map((h) => ({
              start: h.start,
              end: h.end,
              cls: "hl-del replace-del",
              after: h.replacement ? (
                <ins class="hl-add replace-ins">{h.replacement}</ins>
              ) : undefined,
            }))}
          />
          {r.hits.length > PREVIEW_MAX && (
            <p class="muted small">{tr(T.more).replace("{n}", fmt(PREVIEW_MAX))}</p>
          )}
        </Panel>
      )}
    </>
  );
}
