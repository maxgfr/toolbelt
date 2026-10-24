import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Output, Panel, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { type Flag, FORMS, inspect, normalizeSpaces, removeInvisible, summarize } from "./logic";

const ROWS = 2000;

const T = {
  text: l("Text", "Texte"),
  placeholder: l(
    "Paste text to see every character, including the invisible ones…",
    "Colle du texte pour voir chaque caractère, y compris les invisibles…",
  ),
  codePoints: l("Code points", "Points de code"),
  graphemes: l("Visible characters", "Caractères visibles"),
  utf16: l("UTF-16 units", "Unités UTF-16"),
  utf8: l("UTF-8 bytes", "Octets UTF-8"),
  suspicious: l("Invisible / special", "Invisibles / spéciaux"),
  removeInvisible: l("Remove invisible characters", "Supprimer les caractères invisibles"),
  normalizeSpaces: l("Make special spaces plain", "Remplacer les espaces spéciaux"),
  bidiWarn: l(
    "This text contains bidirectional control characters: they can reorder how it displays, so what you read may not be what a program sees (“Trojan Source”).",
    "Ce texte contient des caractères de contrôle bidirectionnels : ils peuvent réordonner son affichage, et ce que tu lis peut différer de ce qu'un programme voit (« Trojan Source »).",
  ),
  hiddenWarn: l(
    "This text contains {n} invisible or zero-width characters.",
    "Ce texte contient {n} caractères invisibles ou de largeur nulle.",
  ),
  characters: l("Characters", "Caractères"),
  char: l("Char", "Car."),
  code: l("Code point", "Point de code"),
  name: l("Name", "Nom"),
  category: l("Category", "Catégorie"),
  script: l("Script", "Écriture"),
  grapheme: l("Grapheme", "Graphème"),
  truncated: l(
    "Only the first {n} code points are listed.",
    "Seuls les {n} premiers points de code sont listés.",
  ),
  normalization: l("Normalization", "Normalisation"),
  same: l("same as the input", "identique à l'entrée"),
  differs: l("{n} code points", "{n} points de code"),
  normHint: l(
    "NFC composes (é is one code point), NFD decomposes (e + ◌\u0301); the K forms also fold look-alikes (ﬁ → fi, ² → 2).",
    "NFC compose (é est un seul point de code), NFD décompose (e + ◌\u0301) ; les formes K replient aussi les variantes (ﬁ → fi, ² → 2).",
  ),
};

const FLAGS: Record<Flag, L10n> = {
  bidi: l("Bidi control", "Contrôle bidi"),
  "zero-width": l("Zero width", "Largeur nulle"),
  invisible: l("Invisible", "Invisible"),
  space: l("Special space", "Espace spécial"),
  control: l("Control", "Contrôle"),
};

const CATS: Record<string, L10n> = {
  Lu: l("Uppercase letter", "Lettre majuscule"),
  Ll: l("Lowercase letter", "Lettre minuscule"),
  Lt: l("Titlecase letter", "Lettre de titre"),
  Lm: l("Modifier letter", "Lettre modificative"),
  Lo: l("Other letter", "Autre lettre"),
  Mn: l("Combining mark", "Marque combinante"),
  Mc: l("Spacing mark", "Marque avec chasse"),
  Me: l("Enclosing mark", "Marque englobante"),
  Nd: l("Decimal digit", "Chiffre décimal"),
  Nl: l("Letter number", "Nombre lettre"),
  No: l("Other number", "Autre nombre"),
  Pc: l("Connector punctuation", "Ponctuation de liaison"),
  Pd: l("Dash", "Tiret"),
  Ps: l("Opening punctuation", "Ponctuation ouvrante"),
  Pe: l("Closing punctuation", "Ponctuation fermante"),
  Pi: l("Initial quote", "Guillemet initial"),
  Pf: l("Final quote", "Guillemet final"),
  Po: l("Other punctuation", "Autre ponctuation"),
  Sm: l("Math symbol", "Symbole mathématique"),
  Sc: l("Currency symbol", "Symbole monétaire"),
  Sk: l("Modifier symbol", "Symbole modificatif"),
  So: l("Other symbol", "Autre symbole"),
  Zs: l("Space", "Espace"),
  Zl: l("Line separator", "Séparateur de ligne"),
  Zp: l("Paragraph separator", "Séparateur de paragraphe"),
  Cc: l("Control", "Contrôle"),
  Cf: l("Format", "Formatage"),
  Cs: l("Surrogate", "Demi-code"),
  Co: l("Private use", "Usage privé"),
  Cn: l("Unassigned", "Non attribué"),
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
