import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Output, Panel, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { FlagToggles, Highlight, RegexError } from "../_ui";
import { PRESETS, type PresetId, testRegex, toLiteral } from "./logic";

const LIMIT = 1000;

const T = {
  pattern: l("Pattern", "Motif"),
  patternPh: l("e.g. (\\w+)@(\\w+)\\.com", "par ex. (\\w+)@(\\w+)\\.com"),
  presets: l("Examples", "Exemples"),
  text: l("Test text", "Texte de test"),
  textPh: l("Paste the text to test the pattern on…", "Colle le texte sur lequel tester le motif…"),
  matches: l("Matches", "Correspondances"),
  groups: l("Groups", "Groupes"),
  highlighted: l("Highlighted matches", "Correspondances surlignées"),
  table: l("Match details", "Détail des correspondances"),
  position: l("Position", "Position"),
  match: l("Match", "Correspondance"),
  none: l("No match.", "Aucune correspondance."),
  empty: l("(empty)", "(vide)"),
  unset: l("not matched", "non capturé"),
  truncated: l(
    "Only the first {n} matches are shown.",
    "Seules les {n} premières correspondances sont affichées.",
  ),
  literal: l("JavaScript", "JavaScript"),
  cheats: l("Cheat sheet", "Aide-mémoire"),
};

const PRESET_LABELS: Record<PresetId, L10n> = {
  email: l("Email", "E-mail"),
  url: l("URL", "URL"),
  ipv4: l("IPv4", "IPv4"),
  date: l("Date (YYYY-MM-DD)", "Date (AAAA-MM-JJ)"),
  uuid: l("UUID", "UUID"),
  hex: l("Hex color", "Couleur hex"),
  time: l("Time (HH:MM)", "Heure (HH:MM)"),
};

const CHEATS: [string, L10n][] = [
  [".", l("any character except newline", "n'importe quel caractère sauf retour à la ligne")],
  ["\\d \\w \\s", l("digit, word character, whitespace", "chiffre, caractère de mot, espace")],
  ["\\D \\W \\S", l("not a digit, word character, whitespace", "tout sauf chiffre, mot, espace")],
  ["\\b", l("word boundary", "limite de mot")],
  ["^ $", l("start / end (of line with m)", "début / fin (de ligne avec m)")],
  ["[abc] [^abc] [a-z]", l("one of, none of, range", "un parmi, aucun de, intervalle")],
  ["* + ?", l("0 or more, 1 or more, 0 or 1", "0 ou plus, 1 ou plus, 0 ou 1")],
  ["{n} {n,} {n,m}", l("exactly n, at least n, n to m", "exactement n, au moins n, de n à m")],
  ["*? +?", l("lazy: as few as possible", "paresseux : le moins possible")],
  ["(…) (?:…)", l("capturing / non-capturing group", "groupe capturant / non capturant")],
  ["(?<name>…)", l("named group", "groupe nommé")],
  ["a|b", l("a or b", "a ou b")],
  ["(?=…) (?!…)", l("followed / not followed by", "suivi / non suivi de")],
  ["(?<=…) (?<!…)", l("preceded / not preceded by", "précédé / non précédé de")],
  ["\\1 \\k<name>", l("backreference", "référence arrière")],
  [
    "\\p{L} \\p{Lu} \\p{N}",
    l(
      "Unicode letter, uppercase, number (u flag)",
      "lettre, majuscule, nombre Unicode (drapeau u)",
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
