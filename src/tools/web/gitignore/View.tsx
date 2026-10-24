import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Panel, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import { buildGitignore, countPatterns, searchTemplates } from "./logic";
import type { TemplateGroup } from "./templates";

const T = {
  search: l(
    "Filter templates: node, python, intellij…",
    "Filtrer les modèles : node, python, intellij…",
  ),
  templates: l("Templates", "Modèles"),
  clear: l("Clear selection", "Tout désélectionner"),
  selected: l("{n} selected", "{n} sélectionné(s)"),
  none: l("No template matches.", "Aucun modèle ne correspond."),
  custom: l("Your own patterns", "Tes propres motifs"),
  customTitle: l("Custom", "Personnalisé"),
  customPh: l(
    "One pattern per line, e.g. secrets/ or *.local",
    "Un motif par ligne, par ex. secrets/ ou *.local",
  ),
  output: l(".gitignore", ".gitignore"),
  empty: l(
    "Pick one or more templates: they are merged, with duplicates removed.",
    "Choisis un ou plusieurs modèles : ils sont fusionnés, sans doublons.",
  ),
  patterns: l("{n} patterns", "{n} motifs"),
};

const GROUPS: { id: TemplateGroup; label: L10n }[] = [
  { id: "language", label: l("Languages", "Langages") },
  { id: "framework", label: l("Frameworks & platforms", "Frameworks et plateformes") },
  { id: "tool", label: l("Tools", "Outils") },
  { id: "os", label: l("Operating systems", "Systèmes d'exploitation") },
  { id: "editor", label: l("Editors & IDEs", "Éditeurs et IDE") },
];

export default function Gitignore() {
  const selected = useToolState<string[]>("selected", ["node", "macos", "vscode"]);
  const query = useToolState("q", "");
  const custom = useToolState("custom", "");
  const output = useComputed(() => buildGitignore(selected.value, custom.value, tr(T.customTitle)));
  const matches = useComputed(() => searchTemplates(query.value));

  const toggle = (id: string) => {
    const s = selected.value;
    selected.value = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
  };

  return (
    <>
      <Panel
        title={tr(T.templates)}
        actions={
          selected.value.length > 0 && (
            <>
              <span class="muted small">
                {tr(T.selected).replace("{n}", fmt(selected.value.length))}
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon="close"
                onClick={() => {
                  selected.value = [];
                }}
              >
                {tr(T.clear)}
              </Button>
            </>
          )
        }
      >
        <SearchBox
          value={query.value}
          onInput={(v) => {
            query.value = v;
          }}
          placeholder={tr(T.search)}
        />
        {matches.value.length === 0 && <Empty>{tr(T.none)}</Empty>}
        {GROUPS.map((g) => {
          const items = matches.value.filter((t) => t.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id} class="gitignore-group">
              <span class="field-label">{tr(g.label)}</span>
              <div class="gitignore-chips">
                {items.map((t) => {
                  const on = selected.value.includes(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      class={`gitignore-chip ${on ? "on" : ""}`}
                      aria-pressed={on}
                      onClick={() => toggle(t.id)}
                    >
                      {on ? "✓ " : ""}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Panel>
      <div class="grid-2">
        <TextBox
          label={tr(T.custom)}
          value={custom.value}
          onInput={(v) => {
            custom.value = v;
          }}
          placeholder={tr(T.customPh)}
          rows={18}
          wrap={false}
        />
        <TextBox
          label={`${tr(T.output)} · ${tr(T.patterns).replace("{n}", fmt(countPatterns(output.value)))}`}
          value={output.value}
          readOnly
          rows={18}
          wrap={false}
          downloadName=".gitignore"
          note={!output.value && <span class="muted">{tr(T.empty)}</span>}
        />
      </div>
    </>
  );
}
