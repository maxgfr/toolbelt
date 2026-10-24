import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Output, Panel, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { FlagToggles, Highlight, RegexError } from "../_ui";
import { PRESETS, type PresetId, testRegex, toLiteral } from "./logic";

const LIMIT = 1000;

const T = {
  pattern: l("Pattern", "Motif", "Muster"),
  patternPh: l(
    "e.g. (\\w+)@(\\w+)\\.com",
    "par ex. (\\w+)@(\\w+)\\.com",
    "z. B. (\\w+)@(\\w+)\\.com",
  ),
  presets: l("Examples", "Exemples", "Beispiele"),
  text: l("Test text", "Texte de test", "Testtext"),
  textPh: l(
    "Paste the text to test the pattern on…",
    "Colle le texte sur lequel tester le motif…",
    "Füge den Text ein, an dem das Muster getestet wird…",
  ),
  matches: l("Matches", "Correspondances", "Treffer"),
  groups: l("Groups", "Groupes", "Gruppen"),
  highlighted: l("Highlighted matches", "Correspondances surlignées", "Hervorgehobene Treffer"),
  table: l("Match details", "Détail des correspondances", "Trefferdetails"),
  position: l("Position", "Position", "Position"),
  match: l("Match", "Correspondance", "Treffer"),
  none: l("No match.", "Aucune correspondance.", "Kein Treffer."),
  empty: l("(empty)", "(vide)", "(leer)"),
  unset: l("not matched", "non capturé", "nicht erfasst"),
  truncated: l(
    "Only the first {n} matches are shown.",
    "Seules les {n} premières correspondances sont affichées.",
    "Nur die ersten {n} Treffer werden angezeigt.",
  ),
  literal: l("JavaScript", "JavaScript", "JavaScript"),
  cheats: l("Cheat sheet", "Aide-mémoire", "Spickzettel"),
};

const PRESET_LABELS: Record<PresetId, L10n> = {
  email: l("Email", "E-mail", "E-Mail"),
  url: l("URL", "URL", "URL"),
  ipv4: l("IPv4", "IPv4", "IPv4"),
  date: l("Date (YYYY-MM-DD)", "Date (AAAA-MM-JJ)", "Datum (JJJJ-MM-TT)"),
  uuid: l("UUID", "UUID", "UUID"),
  hex: l("Hex color", "Couleur hex", "Hex-Farbe"),
  time: l("Time (HH:MM)", "Heure (HH:MM)", "Uhrzeit (HH:MM)"),
};

const CHEATS: [string, L10n][] = [
  [
    ".",
    l(
      "any character except newline",
      "n'importe quel caractère sauf retour à la ligne",
      "beliebiges Zeichen außer Zeilenumbruch",
    ),
  ],
  [
    "\\d \\w \\s",
    l(
      "digit, word character, whitespace",
      "chiffre, caractère de mot, espace",
      "Ziffer, Wortzeichen, Leerraum",
    ),
  ],
  [
    "\\D \\W \\S",
    l(
      "not a digit, word character, whitespace",
      "tout sauf chiffre, mot, espace",
      "keine Ziffer, kein Wortzeichen, kein Leerraum",
    ),
  ],
  ["\\b", l("word boundary", "limite de mot", "Wortgrenze")],
  [
    "^ $",
    l(
      "start / end (of line with m)",
      "début / fin (de ligne avec m)",
      "Anfang / Ende (der Zeile mit m)",
    ),
  ],
  [
    "[abc] [^abc] [a-z]",
    l(
      "one of, none of, range",
      "un parmi, aucun de, intervalle",
      "eines davon, keines davon, Bereich",
    ),
  ],
  [
    "* + ?",
    l(
      "0 or more, 1 or more, 0 or 1",
      "0 ou plus, 1 ou plus, 0 ou 1",
      "0 oder mehr, 1 oder mehr, 0 oder 1",
    ),
  ],
  [
    "{n} {n,} {n,m}",
    l(
      "exactly n, at least n, n to m",
      "exactement n, au moins n, de n à m",
      "genau n, mindestens n, n bis m",
    ),
  ],
  [
    "*? +?",
    l(
      "lazy: as few as possible",
      "paresseux : le moins possible",
      "nicht gierig: so wenige wie möglich",
    ),
  ],
  [
    "(…) (?:…)",
    l(
      "capturing / non-capturing group",
      "groupe capturant / non capturant",
      "erfassende / nicht erfassende Gruppe",
    ),
  ],
  ["(?<name>…)", l("named group", "groupe nommé", "benannte Gruppe")],
  ["a|b", l("a or b", "a ou b", "a oder b")],
  [
    "(?=…) (?!…)",
    l("followed / not followed by", "suivi / non suivi de", "gefolgt / nicht gefolgt von"),
  ],
  [
    "(?<=…) (?<!…)",
    l("preceded / not preceded by", "précédé / non précédé de", "nach / nicht nach"),
  ],
  ["\\1 \\k<name>", l("backreference", "référence arrière", "Rückverweis")],
  [
    "\\p{L} \\p{Lu} \\p{N}",
    l(
      "Unicode letter, uppercase, number (u flag)",
      "lettre, majuscule, nombre Unicode (drapeau u)",
      "Unicode-Buchstabe, Großbuchstabe, Zahl (Flag u)",
    ),
  ],
];

export default function Regex() {
  const pattern = useToolState("pattern", "");
  const flags = useToolState("flags", "g");
  const text = useToolState("text", "");
  const result = useComputed(() => testRegex(pattern.value, flags.value, text.value, LIMIT));
  const r = result.value;

  return (
    <>
      <div class="regex-pattern">
        <span class="regex-slash mono" aria-hidden="true">
          /
        </span>
        <input
          class="input mono"
          value={pattern.value}
          placeholder={tr(T.patternPh)}
          aria-label={tr(T.pattern)}
          aria-invalid={!r.ok}
          spellcheck={false}
          onInput={(e) => {
            pattern.value = e.currentTarget.value;
          }}
        />
        <span class="regex-slash mono" aria-hidden="true">
          /{flags.value}
        </span>
      </div>
      <div class="row">
        <FlagToggles
          flags={flags.value}
          onChange={(f) => {
            flags.value = f;
          }}
        />
      </div>
      <div class="row">
        <span class="muted small">{tr(T.presets)}</span>
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            onClick={() => {
              pattern.value = p.pattern;
              flags.value = p.flags;
              if (!text.value.trim() || PRESETS.some((q) => q.sample === text.value))
                text.value = p.sample;
            }}
          >
            {tr(PRESET_LABELS[p.id])}
          </Button>
        ))}
      </div>
      {!r.ok && <RegexError message={r.message} hint={r.hint} />}
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.textPh)}
        rows={8}
      />
      {r.ok && pattern.value && (
        <>
          <Stats
            items={[
              { label: tr(T.matches), value: `${fmt(r.matches.length)}${r.truncated ? "+" : ""}` },
              { label: tr(T.groups), value: fmt(r.groupNames.length) },
            ]}
          />
          <Output label={tr(T.literal)} value={toLiteral(pattern.value, flags.value)} />
          {text.value && (
            <Panel title={tr(T.highlighted)}>
              <Highlight
                text={text.value}
                ranges={r.matches.map((m, i) => ({
                  start: m.index,
                  end: m.end,
                  title: `#${i + 1}`,
                }))}
              />
            </Panel>
          )}
          {r.matches.length === 0 && text.value && <p class="muted">{tr(T.none)}</p>}
          {r.matches.length > 0 && (
            <div class="table-wrap regex-table">
              <table class="table">
                <thead>
                  <tr>
                    <th class="num">#</th>
                    <th class="num">{tr(T.position)}</th>
                    <th>{tr(T.match)}</th>
                    {r.groupNames.length > 0 && <th>{tr(T.groups)}</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.matches.map((m, i) => (
                    <tr key={m.index * 31 + i}>
                      <td class="num">{i + 1}</td>
                      <td class="num mono">
                        {m.index}–{m.end}
                      </td>
                      <td class="mono regex-cell">
                        {m.text || <span class="muted">{tr(T.empty)}</span>}
                      </td>
                      {r.groupNames.length > 0 && (
                        <td>
                          <dl class="regex-groups">
                            {m.groups.map((g) => (
                              <div key={g.n}>
                                <dt class="mono">{g.name ? `$${g.n} · ${g.name}` : `$${g.n}`}</dt>
                                <dd class="mono regex-cell">
                                  {g.value === undefined ? (
                                    <span class="muted">{tr(T.unset)}</span>
                                  ) : (
                                    g.value || <span class="muted">{tr(T.empty)}</span>
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {r.truncated && <p class="muted small">{tr(T.truncated).replace("{n}", fmt(LIMIT))}</p>}
        </>
      )}
      <details class="regex-cheats">
        <summary>{tr(T.cheats)}</summary>
        <table class="table">
          <tbody>
            {CHEATS.map(([token, desc]) => (
              <tr key={token}>
                <td class="mono">{token}</td>
                <td>{tr(desc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
