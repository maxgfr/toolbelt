import { useComputed } from "@preact/signals";
import { Fragment } from "preact";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, copyText, Field, IconButton, Panel, toast } from "../../../app/ui";
import { fmt, type L10n, type Lang, l, lang, tr } from "../../../i18n";
import { EMOJI_DATA } from "./data";
import {
  buildIndex,
  codePoints,
  type Emoji,
  GROUP_IDS,
  type GroupId,
  parseCatalog,
  pushRecent,
  search,
  shortcode,
  TONE_SWATCHES,
  withTone,
} from "./logic";

const GROUPS = parseCatalog(EMOJI_DATA);
const INDEX = buildIndex(GROUPS);
const BY_EMOJI = new Map<string, Emoji>(GROUPS.flatMap((g) => g.items.map((e) => [e.e, e])));

const T = {
  search: l("Search", "Rechercher", "Suchen"),
  placeholder: l(
    "Name or keyword, in English, French or German: heart, chat, Rakete…",
    "Nom ou mot-clé, en français, anglais ou allemand : cœur, cat, Rakete…",
    "Name oder Stichwort, auf Deutsch, Englisch oder Französisch: Herz, cat, fusée…",
  ),
  tone: l("Skin tone", "Teinte de peau", "Hautfarbe"),
  tones: [
    l("Default", "Par défaut", "Standard"),
    l("Light", "Claire", "Hell"),
    l("Medium-light", "Moyennement claire", "Mittelhell"),
    l("Medium", "Légèrement mate", "Mittel"),
    l("Medium-dark", "Mate", "Mitteldunkel"),
    l("Dark", "Foncée", "Dunkel"),
  ],
  recent: l("Recently copied", "Copiés récemment", "Zuletzt kopiert"),
  clearRecent: l("Clear the recent list", "Vider la liste des récents", "Verlauf leeren"),
  categories: l("Categories", "Catégories", "Kategorien"),
  results: l("results", "résultats", "Ergebnisse"),
  noResult: l("No emoji matches.", "Aucun emoji ne correspond.", "Kein passendes Emoji."),
  copied: l("Copied", "Copié", "Kopiert"),
  copyFailed: l("Could not copy.", "Copie impossible.", "Kopieren nicht möglich."),
  hint: l(
    "Click an emoji to copy it. Some recent emojis may show as boxes if your system's font does not have them yet.",
    "Clique sur un emoji pour le copier. Certains emojis récents peuvent s'afficher comme des carrés si la police du système ne les a pas encore.",
    "Klicke auf ein Emoji, um es zu kopieren. Neuere Emojis erscheinen eventuell als Kästchen, wenn die Schrift deines Systems sie noch nicht kennt.",
  ),
  name: l("Name", "Nom", "Name"),
  codePoints: l("Code points", "Points de code", "Codepoints"),
  shortcode: l("Shortcode-like name", "Nom façon shortcode", "Name im Shortcode-Stil"),
  keywords: l("Keywords", "Mots-clés", "Stichwörter"),
  copyEmoji: l("Copy emoji", "Copier l'emoji", "Emoji kopieren"),
};

/** "In English", … for the names in the other languages. */
const IN_LANG: Record<Lang, L10n> = {
  en: l("In English", "En anglais", "Auf Englisch"),
  fr: l("In French", "En français", "Auf Französisch"),
  de: l("In German", "En allemand", "Auf Deutsch"),
};
const LANG_IDS: Lang[] = ["en", "fr", "de"];

const GROUP_NAMES: Record<GroupId, { icon: string; name: L10n }> = {
  smileys: {
    icon: "😀",
    name: l("Smileys & emotion", "Smileys et émotions", "Smileys & Emotionen"),
  },
  people: { icon: "👋", name: l("People & body", "Personnes et corps", "Menschen & Körper") },
  animals: { icon: "🐻", name: l("Animals & nature", "Animaux et nature", "Tiere & Natur") },
  food: { icon: "🍔", name: l("Food & drink", "Nourriture et boissons", "Essen & Trinken") },
  travel: { icon: "✈️", name: l("Travel & places", "Voyages et lieux", "Reisen & Orte") },
  activities: { icon: "⚽", name: l("Activities", "Activités", "Aktivitäten") },
  objects: { icon: "💡", name: l("Objects", "Objets", "Objekte") },
  symbols: { icon: "❤️", name: l("Symbols", "Symboles", "Symbole") },
  flags: { icon: "🏁", name: l("Flags", "Drapeaux", "Flaggen") },
};

export default function EmojiPicker() {
  const query = useToolState("q", "");
  const group = useToolState<string>("group", "smileys");
  const tone = useToolState("tone", 0);
  const recent = useToolState<string[]>("recent", [], { share: false });
  const selected = useToolState("selected", "");

  const activeGroup = useComputed<GroupId>(() =>
    (GROUP_IDS as readonly string[]).includes(group.value) ? (group.value as GroupId) : "smileys",
  );
  const results = useComputed(() => search(INDEX, query.value));
  const shown = useComputed(() =>
    query.value.trim()
      ? results.value
      : (GROUPS.find((g) => g.id === activeGroup.value)?.items ?? []),
  );
  const current = useComputed(() => BY_EMOJI.get(selected.value) ?? null);
  const t = Math.min(5, Math.max(0, Math.round(tone.value)));
  const name = (e: Emoji) => e[lang.value];
  const variant = (e: Emoji) => (e.tones ? withTone(e.e, t) : e.e);

  async function copy(text: string, base?: Emoji) {
    if (base) selected.value = base.e;
    if (!(await copyText(text))) {
      toast(tr(T.copyFailed), "error");
      return;
    }
    recent.value = pushRecent(Array.isArray(recent.value) ? recent.value : [], text);
    toast(`${tr(T.copied)} ${text}`, "success", 1400);
  }

  const cur = current.value;
  const curText = cur ? variant(cur) : "";

  return (
    <>
      <div class="row emoji-top">
        <Field label={tr(T.search)} class="emoji-search">
          <input
            class="input"
            type="search"
            value={query.value}
            placeholder={tr(T.placeholder)}
            onInput={(e) => {
              query.value = e.currentTarget.value;
            }}
          />
        </Field>
        {/* biome-ignore lint/a11y/useSemanticElements: same pattern as Group in _ui.tsx */}
        <div class="field" role="group" aria-label={tr(T.tone)}>
          <span class="field-label">{tr(T.tone)}</span>
          <div class="segmented emoji-tones">
            {TONE_SWATCHES.map((sw, i) => (
              <button
                type="button"
                key={sw}
                class={i === t ? "on" : ""}
                aria-pressed={i === t}
                aria-label={tr(T.tones[i] ?? T.tones[0] ?? T.tone)}
                title={tr(T.tones[i] ?? T.tones[0] ?? T.tone)}
                onClick={() => {
                  tone.value = i;
                }}
              >
                {sw}
              </button>
            ))}
          </div>
        </div>
      </div>

      {recent.value.length > 0 && (
        <Panel
          title={tr(T.recent)}
          actions={
            <IconButton
              icon="trash"
              label={tr(T.clearRecent)}
              onClick={() => {
                recent.value = [];
              }}
            />
          }
        >
          <div class="emoji-grid">
            {recent.value.map((e) => (
              <button
                type="button"
                key={e}
                class="emoji-cell"
                title={e}
                aria-label={e}
                onClick={() => copy(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </Panel>
      )}

      {!query.value.trim() && (
        <nav class="emoji-tabs" aria-label={tr(T.categories)}>
          {GROUP_IDS.map((id) => (
            <button
              type="button"
              key={id}
              class={id === activeGroup.value ? "on" : ""}
              aria-pressed={id === activeGroup.value}
              title={tr(GROUP_NAMES[id].name)}
              onClick={() => {
                group.value = id;
              }}
            >
              <span aria-hidden="true">{GROUP_NAMES[id].icon}</span>
              <span class="emoji-tab-name">{tr(GROUP_NAMES[id].name)}</span>
            </button>
          ))}
        </nav>
      )}

      <div class="emoji-layout">
        <section class="panel">
          <header class="panel-head">
            <h2>
              {query.value.trim()
                ? `${fmt(results.value.length)} ${tr(T.results)}`
                : tr(GROUP_NAMES[activeGroup.value].name)}
            </h2>
          </header>
          {shown.value.length === 0 ? (
            <p class="muted">{tr(T.noResult)}</p>
          ) : (
            <div class="emoji-grid">
              {shown.value.map((e) => {
                const v = variant(e);
                return (
                  <button
                    type="button"
                    key={e.e}
                    class={`emoji-cell ${cur?.e === e.e ? "on" : ""}`}
                    title={name(e)}
                    aria-label={name(e)}
                    onClick={() => copy(v, e)}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          )}
          <p class="muted small">{tr(T.hint)}</p>
        </section>

        {cur && (
          <section class="panel emoji-detail">
            <div class="emoji-big" aria-hidden="true">
              {curText}
            </div>
            <Button variant="primary" icon="copy" onClick={() => copy(curText, cur)}>
              {tr(T.copyEmoji)}
            </Button>
            <dl class="emoji-facts">
              <dt>{tr(T.name)}</dt>
              <dd>{name(cur)}</dd>
              {LANG_IDS.filter((id) => id !== lang.value && cur[id] !== name(cur)).map((id) => (
                <Fragment key={id}>
                  <dt>{tr(IN_LANG[id])}</dt>
                  <dd>{cur[id]}</dd>
                </Fragment>
              ))}
              <dt>{tr(T.codePoints)}</dt>
              <dd class="mono">
                {codePoints(curText)} <CopyButton text={codePoints(curText)} />
              </dd>
              <dt>{tr(T.shortcode)}</dt>
              <dd class="mono">
                {shortcode(cur.en)} <CopyButton text={shortcode(cur.en)} />
              </dd>
              {cur.keywords.length > 0 && (
                <>
                  <dt>{tr(T.keywords)}</dt>
                  <dd>{cur.keywords.join(", ")}</dd>
                </>
              )}
            </dl>
          </section>
        )}
      </div>
    </>
  );
}
