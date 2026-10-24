import { useComputed } from "@preact/signals";
import { Badge, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { CopyButton, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, pick, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import type { GroupId } from "./data";
import { groupTips, searchTips } from "./logic";

const T = {
  search: l(
    "I want to… (undo the last commit, rename a branch, find a bug…)",
    "Je veux… (annuler le dernier commit, renommer une branche, trouver un bug…)",
    "Ich will… (letzten Commit rückgängig machen, Branch umbenennen, Bug finden…)",
  ),
  group: l("Topic", "Thème", "Thema"),
  all: l("All topics", "Tous les thèmes", "Alle Themen"),
  danger: l("Destructive only", "Seulement les destructives", "Nur destruktive"),
  dangerBadge: l("destructive", "destructive", "destruktiv"),
  dangerTitle: l(
    "Can lose work or rewrite shared history",
    "Peut perdre du travail ou réécrire un historique partagé",
    "Kann Arbeit vernichten oder geteilten Verlauf umschreiben",
  ),
  none: l(
    "Nothing found. Try other words: undo, branch, stash, remote…",
    "Rien trouvé. Essaie d'autres mots : annuler, branche, remise, distant…",
    "Nichts gefunden. Probier andere Wörter: rückgängig, Branch, Stash, Remote…",
  ),
  count: l("{n} tips", "{n} astuces", "{n} Tipps"),
  placeholders: l(
    "Replace the <placeholders> with your own values.",
    "Remplace les <espaces réservés> par tes valeurs.",
    "Ersetze die <Platzhalter> durch deine eigenen Werte.",
  ),
};

const GROUP_L: Record<GroupId, L10n> = {
  setup: l("Setup", "Configuration", "Einrichtung"),
  commit: l("Staging & committing", "Indexer et commiter", "Stagen und committen"),
  inspect: l("History & search", "Historique et recherche", "Verlauf und Suche"),
  branches: l("Branches & merging", "Branches et fusion", "Branches und Mergen"),
  undo: l("Undo & recover", "Annuler et récupérer", "Rückgängig und wiederherstellen"),
  stash: l("Stash", "Remise (stash)", "Stash"),
  rebase: l("Rebase", "Rebase", "Rebase"),
  remote: l("Remotes", "Dépôts distants", "Remotes"),
  tags: l("Tags", "Tags", "Tags"),
  worktrees: l("Worktrees", "Worktrees", "Worktrees"),
  bisect: l("Bisect", "Bisect", "Bisect"),
  cleanup: l("Cleanup & maintenance", "Nettoyage et maintenance", "Aufräumen und Wartung"),
};

export default function GitCheatsheet() {
  const query = useToolState("q", "");
  const group = useToolState<GroupId | "all">("group", "all");
  const danger = useToolState("danger", false);
  const results = useComputed(() => searchTips(query.value, group.value, danger.value));
  // While searching, show the best matches first; otherwise, by topic.
  const searching = query.value.trim() !== "";
  const groups = useComputed(() => groupTips(results.value));

  const tip = (t: (typeof results.value)[number], showGroup: boolean) => (
    <li key={`${t.group}-${t.en}`} class="git-cheatsheet-item">
      <div class="git-cheatsheet-head">
        <strong>{pick({ en: t.en, fr: t.fr, de: t.de })}</strong>
        {t.danger && (
          <span title={tr(T.dangerTitle)}>
            <Badge kind="bad">{tr(T.dangerBadge)}</Badge>
          </span>
        )}
        {showGroup && <span class="muted small">{tr(GROUP_L[t.group])}</span>}
      </div>
      <div class="git-cheatsheet-cmd">
        <pre class="mono">{t.cmd}</pre>
        <CopyButton text={t.cmd} />
      </div>
      <p class="muted small">{pick({ en: t.noteEn, fr: t.noteFr, de: t.noteDe })}</p>
    </li>
  );

  return (
    <>
      <SearchBox
        value={query.value}
        onInput={(v) => {
          query.value = v;
        }}
        placeholder={tr(T.search)}
      />
      <div class="row">
        <div class="git-cheatsheet-select">
          <Select<GroupId | "all">
            label={tr(T.group)}
            value={group.value}
            options={[
              { value: "all", label: tr(T.all) },
              ...(Object.keys(GROUP_L) as GroupId[]).map((g) => ({
                value: g,
                label: tr(GROUP_L[g]),
              })),
            ]}
            onChange={(v) => {
              group.value = v;
            }}
          />
        </div>
        <Toggle
          checked={danger.value}
          onChange={(v) => {
            danger.value = v;
          }}
          label={tr(T.danger)}
        />
        <span class="spacer" />
        <span class="muted small">{tr(T.count).replace("{n}", fmt(results.value.length))}</span>
      </div>
      <p class="muted small">{tr(T.placeholders)}</p>
      {results.value.length === 0 && <Empty>{tr(T.none)}</Empty>}
      {searching ? (
        <ul class="git-cheatsheet-list">{results.value.map((t) => tip(t, true))}</ul>
      ) : (
        groups.value.map((g) => (
          <section key={g.group} class="stack">
            <h2 class="panel-title">{tr(GROUP_L[g.group])}</h2>
            <ul class="git-cheatsheet-list">{g.items.map((t) => tip(t, false))}</ul>
          </section>
        ))
      )}
    </>
  );
}
