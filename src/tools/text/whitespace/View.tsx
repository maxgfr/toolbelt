import { useComputed } from "@preact/signals";
import { Badge, NumberField, Select } from "../../../app/kit";
import { type Json, useToolState } from "../../../app/state";
import { Button, Panel, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { Group } from "../_ui";
import {
  type BlankLines,
  type CleanOptions,
  changedLines,
  clean,
  type Dashes,
  DEFAULTS,
  type Ellipsis,
  inspect,
  type LineEnding,
  type Quotes,
  type StepId,
  type Tabs,
} from "./logic";

const T = {
  input: l("Text", "Texte", "Text"),
  placeholder: l(
    "Paste text copied from a PDF, a web page, Word or a terminal…",
    "Colle un texte copié d'un PDF, d'une page web, de Word ou d'un terminal…",
    "Füge Text aus einem PDF, einer Webseite, Word oder einem Terminal ein…",
  ),
  output: l("Cleaned text", "Texte nettoyé", "Bereinigter Text"),
  spaces: l(
    "Spaces & invisible characters",
    "Espaces et caractères invisibles",
    "Leerzeichen & unsichtbare Zeichen",
  ),
  zeroWidth: l(
    "Remove zero-width & invisible characters",
    "Supprimer les caractères invisibles",
    "Unsichtbare Zeichen entfernen",
  ),
  oddSpaces: l(
    "Non-breaking & odd spaces → normal space",
    "Espaces insécables et spéciales → espace normale",
    "Geschützte & Sonderleerzeichen → normales Leerzeichen",
  ),
  collapseSpaces: l(
    "Collapse repeated spaces",
    "Réduire les espaces répétées",
    "Mehrfache Leerzeichen zusammenfassen",
  ),
  trimTrailing: l(
    "Trim spaces at line ends",
    "Retirer les espaces en fin de ligne",
    "Leerzeichen am Zeilenende entfernen",
  ),
  trimLeading: l(
    "Trim spaces at line starts",
    "Retirer les espaces en début de ligne",
    "Leerzeichen am Zeilenanfang entfernen",
  ),
  trimText: l("Trim the whole text", "Rogner le texte entier", "Ganzen Text trimmen"),
  lines: l("Lines & tabs", "Lignes et tabulations", "Zeilen & Tabulatoren"),
  blankLines: l("Blank lines", "Lignes vides", "Leerzeilen"),
  keep: l("Keep", "Garder", "Behalten"),
  collapse: l("Keep at most one", "En garder une au plus", "Höchstens eine behalten"),
  remove: l("Remove", "Supprimer", "Entfernen"),
  lineEndings: l("Line endings", "Fins de ligne", "Zeilenenden"),
  keepEndings: l(
    "Keep (unify mixed)",
    "Garder (unifier si mélangées)",
    "Behalten (gemischte vereinheitlichen)",
  ),
  tabs: l("Tabs", "Tabulations", "Tabulatoren"),
  toSpaces: l("Tabs → spaces", "Tabulations → espaces", "Tabulatoren → Leerzeichen"),
  toTabs: l("Indentation → tabs", "Indentation → tabulations", "Einrückung → Tabulatoren"),
  tabSize: l("Tab width", "Largeur de tabulation", "Tabulatorbreite"),
  typography: l("Typography", "Typographie", "Typografie"),
  quotes: l("Quotes", "Guillemets", "Anführungszeichen"),
  straight: l("Straight \" '", "Droits \" '", "Gerade \" '"),
  smartQ: l("Curly “ ” ‘ ’", "Courbes “ ” ‘ ’", "Englisch “ ” ‘ ’"),
  germanQ: l("German „ “ ‚ ‘", "Allemands „ “ ‚ ‘", "Deutsch „ “ ‚ ‘"),
  dashes: l("Dashes", "Tirets", "Striche"),
  asciiDash: l("Hyphen -", "Trait d'union -", "Bindestrich -"),
  smartDash: l("-- → —, ranges → –", "-- → —, intervalles → –", "-- → —, Bereiche → –"),
  ellipsis: l("Ellipsis", "Points de suspension", "Auslassungspunkte"),
  asciiEllipsis: l("… → ...", "… → ...", "… → ..."),
  smartEllipsis: l("... → …", "... → …", "... → …"),
  removeGroup: l("Remove", "Supprimer", "Entfernen"),
  removeAccents: l("Accents (é → e)", "Accents (é → e)", "Akzente (é → e)"),
  removePunctuation: l("Punctuation", "Ponctuation", "Satzzeichen"),
  removeDigits: l("Digits", "Chiffres", "Ziffern"),
  removeEmoji: l("Emoji", "Emojis", "Emojis"),
  defaults: l("Default settings", "Réglages par défaut", "Standardoptionen"),
  found: l("In the text", "Dans le texte", "Im Text"),
  fOdd: l("Odd spaces", "Espaces spéciales", "Sonderleerzeichen"),
  fInvisible: l("Invisible chars", "Caractères invisibles", "Unsichtbare Zeichen"),
  fTabs: l("Tabs", "Tabulations", "Tabulatoren"),
  fCrlf: l("CRLF line ends", "Fins de ligne CRLF", "CRLF-Zeilenenden"),
  fTrailing: l("Trailing spaces", "Espaces en fin de ligne", "Leerzeichen am Zeilenende"),
  fQuotes: l("Curly quotes", "Guillemets courbes", "Typogr. Anführungszeichen"),
  fNonAscii: l("Non-ASCII chars", "Caractères non ASCII", "Nicht-ASCII-Zeichen"),
  changes: l("Changes", "Modifications", "Änderungen"),
  noChange: l(
    "Nothing to change with these settings.",
    "Rien à modifier avec ces réglages.",
    "Mit diesen Optionen gibt es nichts zu ändern.",
  ),
  linesChanged: l("lines changed", "lignes modifiées", "Zeilen geändert"),
  chars: l("characters", "caractères", "Zeichen"),
};

const STEP_NAMES: Record<StepId, L10n> = {
  zeroWidth: l(
    "Invisible characters removed",
    "Caractères invisibles supprimés",
    "Unsichtbare Zeichen entfernt",
  ),
  oddSpaces: l("Odd spaces replaced", "Espaces spéciales remplacées", "Sonderleerzeichen ersetzt"),
  removeEmoji: l("Emoji removed", "Emojis supprimés", "Emojis entfernt"),
  removeAccents: l("Accents removed", "Accents supprimés", "Akzente entfernt"),
  quotes: l("Quotes converted", "Guillemets convertis", "Anführungszeichen umgewandelt"),
  dashes: l("Dashes converted", "Tirets convertis", "Striche umgewandelt"),
  ellipsis: l(
    "Ellipses converted",
    "Points de suspension convertis",
    "Auslassungspunkte umgewandelt",
  ),
  removePunctuation: l("Punctuation removed", "Ponctuation supprimée", "Satzzeichen entfernt"),
  removeDigits: l("Digits removed", "Chiffres supprimés", "Ziffern entfernt"),
  tabs: l("Tabs converted", "Tabulations converties", "Tabulatoren umgewandelt"),
  collapseSpaces: l(
    "Space runs collapsed",
    "Suites d'espaces réduites",
    "Mehrfache Leerzeichen zusammengefasst",
  ),
  trimTrailing: l("Line ends trimmed", "Fins de ligne rognées", "Zeilenenden getrimmt"),
  trimLeading: l("Line starts trimmed", "Débuts de ligne rognés", "Zeilenanfänge getrimmt"),
  blankLines: l(
    "Blank line runs fixed",
    "Suites de lignes vides corrigées",
    "Mehrfache Leerzeilen bereinigt",
  ),
  trimText: l("Text trimmed", "Texte rogné", "Text getrimmt"),
  lineEndings: l("Line endings converted", "Fins de ligne converties", "Zeilenenden umgewandelt"),
};

export default function Whitespace() {
  const text = useToolState("text", "");
  const stored = useToolState<{ [k: string]: Json }>("opts", { ...DEFAULTS });
  const o = useComputed<CleanOptions>(() => ({
    ...DEFAULTS,
    ...(stored.value as Partial<CleanOptions>),
  }));
  const set = <K extends keyof CleanOptions>(k: K, v: CleanOptions[K]) => {
    stored.value = { ...o.value, [k]: v };
  };

  const result = useComputed(() => clean(text.value, o.value));
  const found = useComputed(() => inspect(text.value));
  const lines = useComputed(() => changedLines(text.value, result.value.text));

  const toggle = (k: keyof CleanOptions, label: L10n) => (
    <Toggle checked={o.value[k] === true} onChange={(v) => set(k, v as never)} label={tr(label)} />
  );
  const f = found.value;
  const r = result.value;

  return (
    <>
      <Panel
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon="reset"
            onClick={() => {
              stored.value = { ...DEFAULTS };
            }}
          >
            {tr(T.defaults)}
          </Button>
        }
      >
        <div class="whitespace-groups">
          <Group label={tr(T.spaces)}>
            <div class="stack whitespace-toggles">
              {toggle("zeroWidth", T.zeroWidth)}
              {toggle("oddSpaces", T.oddSpaces)}
              {toggle("collapseSpaces", T.collapseSpaces)}
              {toggle("trimTrailing", T.trimTrailing)}
              {toggle("trimLeading", T.trimLeading)}
              {toggle("trimText", T.trimText)}
            </div>
          </Group>
          <Group label={tr(T.lines)}>
            <div class="stack">
              <Select<BlankLines>
                label={tr(T.blankLines)}
                value={o.value.blankLines}
                onChange={(v) => set("blankLines", v)}
                options={[
                  { value: "keep", label: tr(T.keep) },
                  { value: "collapse", label: tr(T.collapse) },
                  { value: "remove", label: tr(T.remove) },
                ]}
              />
              <Select<LineEnding>
                label={tr(T.lineEndings)}
                value={o.value.lineEndings}
                onChange={(v) => set("lineEndings", v)}
                options={[
                  { value: "keep", label: tr(T.keepEndings) },
                  { value: "lf", label: "LF (Unix, macOS)" },
                  { value: "crlf", label: "CRLF (Windows)" },
                ]}
              />
              <div class="row">
                <Select<Tabs>
                  label={tr(T.tabs)}
                  value={o.value.tabs}
                  onChange={(v) => set("tabs", v)}
                  options={[
                    { value: "keep", label: tr(T.keep) },
                    { value: "spaces", label: tr(T.toSpaces) },
                    { value: "tabs", label: tr(T.toTabs) },
                  ]}
                />
                {o.value.tabs !== "keep" && (
                  <NumberField
                    label={tr(T.tabSize)}
                    value={o.value.tabSize}
                    min={1}
                    max={16}
                    integer
                    onChange={(v) => set("tabSize", v)}
                  />
                )}
              </div>
            </div>
          </Group>
          <Group label={tr(T.typography)}>
            <div class="stack">
              <Select<Quotes>
                label={tr(T.quotes)}
                value={o.value.quotes}
                onChange={(v) => set("quotes", v)}
                options={[
                  { value: "keep", label: tr(T.keep) },
                  { value: "straight", label: tr(T.straight) },
                  { value: "smart", label: tr(T.smartQ) },
                  { value: "german", label: tr(T.germanQ) },
                ]}
              />
              <Select<Dashes>
                label={tr(T.dashes)}
                value={o.value.dashes}
                onChange={(v) => set("dashes", v)}
                options={[
                  { value: "keep", label: tr(T.keep) },
                  { value: "ascii", label: tr(T.asciiDash) },
                  { value: "smart", label: tr(T.smartDash) },
                ]}
              />
              <Select<Ellipsis>
                label={tr(T.ellipsis)}
                value={o.value.ellipsis}
                onChange={(v) => set("ellipsis", v)}
                options={[
                  { value: "keep", label: tr(T.keep) },
                  { value: "ascii", label: tr(T.asciiEllipsis) },
                  { value: "smart", label: tr(T.smartEllipsis) },
                ]}
              />
            </div>
          </Group>
          <Group label={tr(T.removeGroup)}>
            <div class="stack whitespace-toggles">
              {toggle("removeAccents", T.removeAccents)}
              {toggle("removePunctuation", T.removePunctuation)}
              {toggle("removeDigits", T.removeDigits)}
              {toggle("removeEmoji", T.removeEmoji)}
            </div>
          </Group>
        </div>
      </Panel>

      {text.value && (
        <Stats
          items={[
            { label: tr(T.fOdd), value: fmt(f.oddSpaces) },
            { label: tr(T.fInvisible), value: fmt(f.invisible) },
            { label: tr(T.fTabs), value: fmt(f.tabs) },
            { label: tr(T.fCrlf), value: fmt(f.crlf) },
            { label: tr(T.fTrailing), value: fmt(f.trailing) },
            { label: tr(T.fQuotes), value: fmt(f.smartQuotes) },
            { label: tr(T.fNonAscii), value: fmt(f.nonAscii) },
          ]}
        />
      )}

      {text.value && (
        <Panel title={tr(T.changes)}>
          {r.changes.length === 0 ? (
            <p class="muted">{tr(T.noChange)}</p>
          ) : (
            <div class="whitespace-changes">
              {r.changes.map((ch) => (
                <Badge key={ch.step} kind="info">
                  {tr(STEP_NAMES[ch.step])} · {fmt(ch.count)}
                </Badge>
              ))}
              <span class="muted small">
                {fmt(lines.value)} {tr(T.linesChanged)} · {fmt(text.value.length)} →{" "}
                {fmt(r.text.length)} {tr(T.chars)}
              </span>
            </div>
          )}
        </Panel>
      )}

      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.placeholder)}
          rows={14}
        />
        <TextBox
          label={tr(T.output)}
          value={r.text}
          readOnly
          rows={14}
          downloadName="cleaned.txt"
        />
      </div>
    </>
  );
}
