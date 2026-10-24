import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Output, Panel, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { type Flag, FORMS, inspect, normalizeSpaces, removeInvisible, summarize } from "./logic";

const ROWS = 2000;

const T = {
  text: l("Text", "Texte", "Text"),
  placeholder: l(
    "Paste text to see every character, including the invisible ones…",
    "Colle du texte pour voir chaque caractère, y compris les invisibles…",
    "Füge Text ein, um jedes Zeichen zu sehen, auch die unsichtbaren…",
  ),
  codePoints: l("Code points", "Points de code", "Codepoints"),
  graphemes: l("Visible characters", "Caractères visibles", "Sichtbare Zeichen"),
  utf16: l("UTF-16 units", "Unités UTF-16", "UTF-16-Einheiten"),
  utf8: l("UTF-8 bytes", "Octets UTF-8", "UTF-8-Bytes"),
  suspicious: l("Invisible / special", "Invisibles / spéciaux", "Unsichtbar / speziell"),
  removeInvisible: l(
    "Remove invisible characters",
    "Supprimer les caractères invisibles",
    "Unsichtbare Zeichen entfernen",
  ),
  normalizeSpaces: l(
    "Make special spaces plain",
    "Remplacer les espaces spéciaux",
    "Sonderleerzeichen ersetzen",
  ),
  bidiWarn: l(
    "This text contains bidirectional control characters: they can reorder how it displays, so what you read may not be what a program sees (“Trojan Source”).",
    "Ce texte contient des caractères de contrôle bidirectionnels : ils peuvent réordonner son affichage, et ce que tu lis peut différer de ce qu'un programme voit (« Trojan Source »).",
    "Dieser Text enthält bidirektionale Steuerzeichen: Sie können die Anzeige umordnen, sodass das, was du liest, nicht unbedingt das ist, was ein Programm sieht („Trojan Source“).",
  ),
  hiddenWarn: l(
    "This text contains {n} invisible or zero-width characters.",
    "Ce texte contient {n} caractères invisibles ou de largeur nulle.",
    "Dieser Text enthält {n} unsichtbare Zeichen oder Zeichen ohne Breite.",
  ),
  characters: l("Characters", "Caractères", "Zeichen"),
  char: l("Char", "Car.", "Zeichen"),
  code: l("Code point", "Point de code", "Codepoint"),
  name: l("Name", "Nom", "Name"),
  category: l("Category", "Catégorie", "Kategorie"),
  script: l("Script", "Écriture", "Schrift"),
  grapheme: l("Grapheme", "Graphème", "Graphem"),
  truncated: l(
    "Only the first {n} code points are listed.",
    "Seuls les {n} premiers points de code sont listés.",
    "Nur die ersten {n} Codepoints werden aufgelistet.",
  ),
  normalization: l("Normalization", "Normalisation", "Normalisierung"),
  same: l("same as the input", "identique à l'entrée", "identisch mit der Eingabe"),
  differs: l("{n} code points", "{n} points de code", "{n} Codepoints"),
  normHint: l(
    "NFC composes (é is one code point), NFD decomposes (e + ◌\u0301); the K forms also fold look-alikes (ﬁ → fi, ² → 2).",
    "NFC compose (é est un seul point de code), NFD décompose (e + ◌\u0301) ; les formes K replient aussi les variantes (ﬁ → fi, ² → 2).",
    "NFC setzt zusammen (é ist ein Codepoint), NFD zerlegt (e + ◌\u0301); die K-Formen vereinheitlichen auch ähnliche Zeichen (ﬁ → fi, ² → 2).",
  ),
};

const FLAGS: Record<Flag, L10n> = {
  bidi: l("Bidi control", "Contrôle bidi", "Bidi-Steuerung"),
  "zero-width": l("Zero width", "Largeur nulle", "Ohne Breite"),
  invisible: l("Invisible", "Invisible", "Unsichtbar"),
  space: l("Special space", "Espace spécial", "Sonderleerzeichen"),
  control: l("Control", "Contrôle", "Steuerzeichen"),
};

const CATS: Record<string, L10n> = {
  Lu: l("Uppercase letter", "Lettre majuscule", "Großbuchstabe"),
  Ll: l("Lowercase letter", "Lettre minuscule", "Kleinbuchstabe"),
  Lt: l("Titlecase letter", "Lettre de titre", "Titelbuchstabe"),
  Lm: l("Modifier letter", "Lettre modificative", "Modifikatorbuchstabe"),
  Lo: l("Other letter", "Autre lettre", "Anderer Buchstabe"),
  Mn: l("Combining mark", "Marque combinante", "Kombinierendes Zeichen"),
  Mc: l("Spacing mark", "Marque avec chasse", "Zeichen mit Breite"),
  Me: l("Enclosing mark", "Marque englobante", "Umschließendes Zeichen"),
  Nd: l("Decimal digit", "Chiffre décimal", "Dezimalziffer"),
  Nl: l("Letter number", "Nombre lettre", "Buchstabenzahl"),
  No: l("Other number", "Autre nombre", "Andere Zahl"),
  Pc: l("Connector punctuation", "Ponctuation de liaison", "Verbindungszeichen"),
  Pd: l("Dash", "Tiret", "Strich"),
  Ps: l("Opening punctuation", "Ponctuation ouvrante", "Öffnendes Satzzeichen"),
  Pe: l("Closing punctuation", "Ponctuation fermante", "Schließendes Satzzeichen"),
  Pi: l("Initial quote", "Guillemet initial", "Anführungszeichen (Anfang)"),
  Pf: l("Final quote", "Guillemet final", "Anführungszeichen (Ende)"),
  Po: l("Other punctuation", "Autre ponctuation", "Anderes Satzzeichen"),
  Sm: l("Math symbol", "Symbole mathématique", "Mathematisches Symbol"),
  Sc: l("Currency symbol", "Symbole monétaire", "Währungssymbol"),
  Sk: l("Modifier symbol", "Symbole modificatif", "Modifikatorsymbol"),
  So: l("Other symbol", "Autre symbole", "Anderes Symbol"),
  Zs: l("Space", "Espace", "Leerzeichen"),
  Zl: l("Line separator", "Séparateur de ligne", "Zeilentrenner"),
  Zp: l("Paragraph separator", "Séparateur de paragraphe", "Absatztrenner"),
  Cc: l("Control", "Contrôle", "Steuerzeichen"),
  Cf: l("Format", "Formatage", "Formatierung"),
  Cs: l("Surrogate", "Demi-code", "Surrogat"),
  Co: l("Private use", "Usage privé", "Private Nutzung"),
  Cn: l("Unassigned", "Non attribué", "Nicht zugewiesen"),
};

/** What to draw for characters that do not show by themselves. */
function glyph(char: string, cp: number, cat: string): string {
  if (cp === 0x20) return "␠";
  if (cp === 0x09) return "⇥";
  if (cp === 0x0a) return "↵";
  if (cp === 0x0d) return "␍";
  if (cat === "Mn" || cat === "Me") return `◌${char}`;
  if (cat.startsWith("C") || cat.startsWith("Z")) return "·";
  return char;
}

export default function Unicode() {
  const text = useToolState("text", "");
  const rows = useComputed(() => inspect(text.value, ROWS + 1));
  const sum = useComputed(() => summarize(text.value));
  const norms = useComputed(() => FORMS.map((f) => ({ form: f, value: text.value.normalize(f) })));
  const s = sum.value;
  const hidden = s.flagged.invisible + s.flagged["zero-width"] + s.flagged.bidi;

  return (
    <>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={6}
        mono={false}
      />
      {text.value && (
        <div class="row">
          <Button
            size="sm"
            icon="trash"
            disabled={hidden + s.flagged.control === 0}
            onClick={() => {
              text.value = removeInvisible(text.value);
            }}
          >
            {tr(T.removeInvisible)}
          </Button>
          <Button
            size="sm"
            disabled={s.flagged.space === 0}
            onClick={() => {
              text.value = normalizeSpaces(text.value);
            }}
          >
            {tr(T.normalizeSpaces)}
          </Button>
        </div>
      )}
      {s.flagged.bidi > 0 && <p class="error-note">{tr(T.bidiWarn)}</p>}
      {hidden - s.flagged.bidi > 0 && (
        <p class="unicode-warn">{tr(T.hiddenWarn).replace("{n}", fmt(hidden - s.flagged.bidi))}</p>
      )}
      <Stats
        items={[
          { label: tr(T.graphemes), value: fmt(s.graphemes) },
          { label: tr(T.codePoints), value: fmt(s.codePoints) },
          { label: tr(T.utf16), value: fmt(s.utf16) },
          { label: tr(T.utf8), value: fmt(s.utf8) },
          {
            label: tr(T.suspicious),
            value: fmt(hidden + s.flagged.space + s.flagged.control),
          },
        ]}
      />
      {rows.value.length > 0 && (
        <div class="table-wrap unicode-table">
          <table class="table">
            <thead>
              <tr>
                <th class="num" title={tr(T.grapheme)}>
                  #
                </th>
                <th>{tr(T.char)}</th>
                <th>{tr(T.code)}</th>
                <th>{tr(T.name)}</th>
                <th>{tr(T.category)}</th>
                <th>{tr(T.script)}</th>
                <th>UTF-8</th>
                <th>UTF-16</th>
              </tr>
            </thead>
            <tbody>
              {rows.value.slice(0, ROWS).map((r, i) => {
                const first = i === 0 || rows.value[i - 1]?.grapheme !== r.grapheme;
                return (
                  <tr
                    key={i}
                    class={`${r.flag ? `unicode-flag unicode-${r.flag}` : ""} ${first ? "" : "unicode-cont"}`}
                  >
                    <td class="num muted">{first ? r.grapheme + 1 : ""}</td>
                    <td>
                      <span class={`unicode-char ${r.flag ? "is-special" : ""}`}>
                        {glyph(r.char, r.cp, r.category)}
                      </span>
                    </td>
                    <td class="mono">{r.hex}</td>
                    <td class="small">
                      {r.name && <span class="mono">{r.name}</span>}
                      {r.flag && (
                        <span class={`unicode-badge unicode-badge-${r.flag}`}>
                          {tr(FLAGS[r.flag])}
                        </span>
                      )}
                    </td>
                    <td class="small">
                      <span class="mono">{r.category}</span>{" "}
                      <span class="muted">
                        {CATS[r.category] ? tr(CATS[r.category] as L10n) : ""}
                      </span>
                    </td>
                    <td class="small">{r.script}</td>
                    <td class="mono small">{r.utf8}</td>
                    <td class="mono small">{r.utf16}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.value.length > ROWS && (
        <p class="muted small">{tr(T.truncated).replace("{n}", fmt(ROWS))}</p>
      )}
      {text.value && (
        <Panel title={tr(T.normalization)}>
          <p class="muted small">{tr(T.normHint)}</p>
          <div class="stack unicode-norms">
            {norms.value.map((n) => (
              <div key={n.form} class="stack unicode-norm">
                <Output label={n.form} value={n.value} />
                <span class="small muted">
                  {n.value === text.value
                    ? tr(T.same)
                    : tr(T.differs).replace("{n}", fmt([...n.value].length))}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
