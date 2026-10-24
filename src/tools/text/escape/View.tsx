import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox, Toggle } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { type ErrorCode, escapeAs, FORMATS, type Format, unescapeAs } from "./logic";

type Dir = "escape" | "unescape";

const T = {
  escape: l("Escape", "Échapper", "Maskieren"),
  unescape: l("Unescape", "Déséchapper", "Demaskieren"),
  format: l("Format", "Format", "Format"),
  input: l("Text", "Texte", "Text"),
  inputEsc: l("Escaped text", "Texte échappé", "Maskierter Text"),
  output: l("Result", "Résultat", "Ergebnis"),
  phEscape: l(
    "Type or paste the text to escape…",
    "Tape ou colle le texte à échapper…",
    "Tippe oder füge den zu maskierenden Text ein…",
  ),
  phUnescape: l(
    "Paste the escaped text…",
    "Colle le texte échappé…",
    "Füge den maskierten Text ein…",
  ),
  ascii: l("Escape non-ASCII too", "Échapper aussi le non-ASCII", "Auch Nicht-ASCII maskieren"),
  swap: l("Swap", "Inverser", "Tauschen"),
  errors: {
    "trailing-backslash": l(
      "The text ends with a lone backslash.",
      "Le texte se termine par une barre oblique inversée seule.",
      "Der Text endet mit einem einzelnen Backslash.",
    ),
    "bad-escape": l(
      "Invalid escape sequence: {d}",
      "Séquence d'échappement invalide : {d}",
      "Ungültige Escape-Sequenz: {d}",
    ),
    unterminated: l(
      "A {d} quote is never closed.",
      "Un guillemet {d} n'est jamais fermé.",
      "Ein Anführungszeichen {d} wird nie geschlossen.",
    ),
    "stray-quote": l(
      'A quote inside the field is not doubled ("").',
      'Un guillemet dans le champ n\'est pas doublé ("").',
      'Ein Anführungszeichen im Feld ist nicht verdoppelt ("").',
    ),
    json: l(
      "Invalid JSON string: {d}",
      "Chaîne JSON invalide : {d}",
      "Ungültiger JSON-String: {d}",
    ),
  } satisfies Record<ErrorCode, L10n>,
};

const NAMES: Record<Format, L10n> = {
  json: l("JSON", "JSON", "JSON"),
  js: l("JavaScript", "JavaScript", "JavaScript"),
  html: l("HTML", "HTML", "HTML"),
  xml: l("XML", "XML", "XML"),
  sql: l("SQL", "SQL", "SQL"),
  csv: l("CSV", "CSV", "CSV"),
  regex: l("Regex", "Regex", "Regex"),
  shell: l("Shell", "Shell", "Shell"),
};

const HINTS: Record<Format, L10n> = {
  json: l(
    "Content of a JSON string: quotes, backslashes and control characters escaped. Unescaping accepts it with or without the surrounding quotes.",
    "Contenu d'une chaîne JSON : guillemets, barres obliques inversées et caractères de contrôle échappés. Le déséchappement l'accepte avec ou sans guillemets autour.",
    "Inhalt eines JSON-Strings: Anführungszeichen, Backslashes und Steuerzeichen werden maskiert. Beim Demaskieren sind die umgebenden Anführungszeichen optional.",
  ),
  js: l(
    "Safe inside '…', \"…\" or `…`. Unescaping reads \\n, \\xHH, \\uHHHH and \\u{…} without running any code.",
    "Utilisable entre '…', \"…\" ou `…`. Le déséchappement lit \\n, \\xHH, \\uHHHH et \\u{…} sans exécuter de code.",
    "Sicher in '…', \"…\" oder `…`. Beim Demaskieren werden \\n, \\xHH, \\uHHHH und \\u{…} gelesen, ohne Code auszuführen.",
  ),
  html: l(
    "& < > \" ' as entities. Unescaping decodes numeric entities and common named ones (&eacute;, &nbsp;, &hellip;…).",
    "& < > \" ' en entités. Le déséchappement décode les entités numériques et les entités nommées courantes (&eacute;, &nbsp;, &hellip;…).",
    "& < > \" ' als Entitäten. Beim Demaskieren werden numerische und gängige benannte Entitäten dekodiert (&eacute;, &nbsp;, &hellip;…).",
  ),
  xml: l(
    "The five XML entities (&amp; &lt; &gt; &quot; &apos;) and numeric character references.",
    "Les cinq entités XML (&amp; &lt; &gt; &quot; &apos;) et les références numériques.",
    "Die fünf XML-Entitäten (&amp; &lt; &gt; &quot; &apos;) und numerische Zeichenreferenzen.",
  ),
  sql: l(
    "Content of a standard SQL string literal: each ' is doubled. Use query parameters in real code.",
    "Contenu d'une chaîne SQL standard : chaque ' est doublé. Dans du vrai code, utilise des paramètres.",
    "Inhalt eines Standard-SQL-String-Literals: Jedes ' wird verdoppelt. Nutze in echtem Code Abfrageparameter.",
  ),
  csv: l(
    'One CSV field: quoted only when needed (comma, quote, newline, edge spaces), with " doubled.',
    'Un champ CSV : entre guillemets seulement si nécessaire (virgule, guillemet, retour, espaces aux bords), avec " doublé.',
    'Ein CSV-Feld: nur bei Bedarf in Anführungszeichen (Komma, Anführungszeichen, Zeilenumbruch, Leerzeichen am Rand), mit verdoppeltem ".',
  ),
  regex: l(
    "Matches the text literally inside a regular expression: . * + ? ^ $ { } ( ) | [ ] \\ / are escaped.",
    "Fait correspondre le texte tel quel dans une expression régulière : . * + ? ^ $ { } ( ) | [ ] \\ / sont échappés.",
    "Findet den Text wörtlich in einem regulären Ausdruck: . * + ? ^ $ { } ( ) | [ ] \\ / werden maskiert.",
  ),
  shell: l(
    "One single-quoted word for sh, bash and zsh: nothing inside is interpreted. Unescaping reads '…', \"…\" and \\ escapes.",
    "Un mot entre apostrophes pour sh, bash et zsh : rien n'y est interprété. Le déséchappement lit '…', \"…\" et les échappements \\.",
    "Ein Wort in einfachen Anführungszeichen für sh, bash und zsh: Darin wird nichts interpretiert. Beim Demaskieren werden '…', \"…\" und \\-Escapes gelesen.",
  ),
};

export default function Escape() {
  const text = useToolState("text", "");
  const format = useToolState<Format>("format", "json");
  const dir = useToolState<Dir>("dir", "escape");
  const ascii = useToolState("ascii", false);
  const result = useComputed(() =>
    dir.value === "escape"
      ? { ok: true as const, value: escapeAs(format.value, text.value, { asciiOnly: ascii.value }) }
      : unescapeAs(format.value, text.value),
  );
  const r = result.value;
  const asciiApplies = dir.value === "escape" && ["js", "html", "xml"].includes(format.value);

  return (
    <>
      <div class="row">
        <Segmented<Dir>
          value={dir.value}
          onChange={(v) => {
            dir.value = v;
          }}
          options={[
            { value: "escape", label: tr(T.escape) },
            { value: "unescape", label: tr(T.unescape) },
          ]}
        />
        <Segmented<Format>
          label={tr(T.format)}
          value={format.value}
          onChange={(v) => {
            format.value = v;
          }}
          options={FORMATS.map((f) => ({ value: f, label: tr(NAMES[f]) }))}
        />
        {asciiApplies && (
          <Toggle
            checked={ascii.value}
            onChange={(v) => {
              ascii.value = v;
            }}
            label={tr(T.ascii)}
          />
        )}
      </div>
      <p class="muted small">{tr(HINTS[format.value])}</p>
      <div class="grid-2">
        <TextBox
          label={tr(dir.value === "escape" ? T.input : T.inputEsc)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(dir.value === "escape" ? T.phEscape : T.phUnescape)}
          rows={14}
          invalid={!r.ok}
          note={!r.ok && <span class="error">{tr(T.errors[r.code]).replace("{d}", r.detail)}</span>}
        />
        <TextBox
          label={tr(T.output)}
          value={r.ok ? r.value : ""}
          readOnly
          rows={14}
          actions={
            r.ok && r.value ? (
              <Button
                size="sm"
                variant="ghost"
                icon="swap"
                onClick={() => {
                  if (!r.ok) return;
                  text.value = r.value;
                  dir.value = dir.value === "escape" ? "unescape" : "escape";
                }}
              >
                {tr(T.swap)}
              </Button>
            ) : null
          }
        />
      </div>
    </>
  );
}
