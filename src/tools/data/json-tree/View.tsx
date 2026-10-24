import { type Signal, useComputed, useSignal, useSignalEffect } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, Output, Panel, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { formatPath, type Path } from "../_shared";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import {
  entries,
  expandAll,
  getAt,
  isContainer,
  jsonPointer,
  type NodeType,
  pathKey,
  type SearchResult,
  scalarText,
  search,
  size,
  splitMatches,
  treeStats,
  typeOf,
} from "./logic";

const T = {
  input: l("JSON", "JSON"),
  placeholder: l("Paste JSON or drop a .json file…", "Colle du JSON ou dépose un fichier .json…"),
  search: l("Search keys and values", "Chercher dans les clés et les valeurs"),
  onlyMatches: l("Only matches", "Seulement les résultats"),
  expand: l("Expand all", "Tout déplier"),
  collapse: l("Collapse all", "Tout replier"),
  open: l("Expand", "Déplier"),
  close: l("Collapse", "Replier"),
  matches: l("{n} matches", "{n} résultats"),
  oneMatch: l("1 match", "1 résultat"),
  noMatch: l("No match", "Aucun résultat"),
  capped: l("(first {n})", "({n} premiers)"),
  keys: l("{n} keys", "{n} clés"),
  oneKey: l("1 key", "1 clé"),
  items: l("{n} items", "{n} éléments"),
  oneItem: l("1 item", "1 élément"),
  more: l("Show {n} more ({left} left)", "Afficher {n} de plus (reste {left})"),
  nodes: l("Nodes", "Nœuds"),
  depth: l("Depth", "Profondeur"),
  selected: l("Selected node", "Nœud sélectionné"),
  pick: l(
    "Click a node to see its path and value.",
    "Clique sur un nœud pour voir son chemin et sa valeur.",
  ),
  jsonPath: l("JSONPath", "JSONPath"),
  pointer: l("JSON Pointer", "JSON Pointer"),
  value: l("Value", "Valeur"),
  cut: l(
    "Showing the first {n} characters; “Copy all” gets everything.",
    "Affichage des {n} premiers caractères ; « Tout copier » prend tout.",
  ),
  copyAll: l("Copy all", "Tout copier"),
  root: l("root", "racine"),
  tree: l("JSON tree", "Arbre JSON"),
  types: {
    object: l("object", "objet"),
    array: l("array", "tableau"),
    string: l("string", "chaîne"),
    number: l("number", "nombre"),
    boolean: l("boolean", "booléen"),
    null: l("null", "null"),
  } satisfies Record<NodeType, L10n>,
};

const PAGE = 200;
const VALUE_MAX = 200_000;

interface Ctx {
  expanded: Signal<Set<string>>;
  limits: Signal<Map<string, number>>;
  selected: Signal<string | null>;
  query: string;
  found: SearchResult | null;
  only: boolean;
  onSelect: (path: Path) => void;
}

function Marked({ text, q }: { text: string; q: string }) {
  const parts = splitMatches(text, q);
  if (parts.length === 1) return <>{text}</>;
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

function countText(v: unknown): string {
  const n = size(v);
  if (Array.isArray(v)) return n === 1 ? tr(T.oneItem) : tr(T.items).replace("{n}", fmt(n));
  return n === 1 ? tr(T.oneKey) : tr(T.keys).replace("{n}", fmt(n));
}

function TreeNode({
  name,
  value,
  path,
  ctx,
}: {
  name: string | number | null;
  value: unknown;
  path: Path;
  ctx: Ctx;
}) {
  const key = pathKey(path);
  const type = typeOf(value);
  const container = isContainer(value);
  const open = container && ctx.expanded.value.has(key);
  const isHit = !!ctx.found?.hits.has(key);
  const selected = ctx.selected.value === key;
  const toggle = () => {
    const next = new Set(ctx.expanded.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    ctx.expanded.value = next;
  };

  let kids: [string | number, unknown][] = [];
  let left = 0;
  if (open) {
    kids = entries(value);
    if (ctx.found && ctx.only && !isHit)
      kids = kids.filter(([k]) => {
        const ck = pathKey([...path, k]);
        return ctx.found?.hits.has(ck) || ctx.found?.ancestors.has(ck);
      });
    const limit = ctx.limits.value.get(key) ?? PAGE;
    left = Math.max(0, kids.length - limit);
    kids = kids.slice(0, limit);
  }

  return (
    <li>
      <div class={`json-tree-row ${selected ? "on" : ""} ${isHit ? "hit" : ""}`}>
        {container ? (
          <button
            type="button"
            class={`json-tree-caret ${open ? "open" : ""}`}
            aria-label={tr(open ? T.close : T.open)}
            aria-expanded={open}
            onClick={toggle}
          >
            ▸
          </button>
        ) : (
          <span class="json-tree-caret" aria-hidden="true" />
        )}
        <button
          type="button"
          class="json-tree-label mono"
          aria-pressed={selected}
          onClick={() => ctx.onSelect(path)}
          onDblClick={container ? toggle : undefined}
        >
          {name === null ? (
            <span class="json-tree-key muted">{tr(T.root)}</span>
          ) : (
            <span class={typeof name === "number" ? "json-tree-index" : "json-tree-key"}>
              <Marked text={String(name)} q={ctx.query} />
            </span>
          )}
          <span class="json-tree-colon">:</span>
          {container ? (
            <span class="json-tree-count muted">
              {type === "array" ? "[ ]" : "{ }"} {countText(value)}
            </span>
          ) : (
            <span class={`json-tree-val json-tree-${type}`}>
              <Marked text={scalarText(value)} q={ctx.query} />
            </span>
          )}
          <span class={`json-tree-type json-tree-type-${type}`}>{tr(T.types[type])}</span>
        </button>
      </div>
      {open && (
        <ul>
          {kids.map(([k, v]) => (
            <TreeNode key={String(k)} name={k} value={v} path={[...path, k]} ctx={ctx} />
          ))}
          {left > 0 && (
            <li class="json-tree-more">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const m = new Map(ctx.limits.value);
                  m.set(key, (m.get(key) ?? PAGE) + PAGE * 5);
                  ctx.limits.value = m;
                }}
              >
                {tr(T.more)
                  .replace("{n}", fmt(Math.min(left, PAGE * 5)))
                  .replace("{left}", fmt(left))}
              </Button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export default function JsonTree() {
  const input = useToolState("input", "");
  const query = useToolState("query", "");
  const only = useToolState("only", true);
  const expanded = useSignal<Set<string>>(new Set([pathKey([])]));
  const limits = useSignal<Map<string, number>>(new Map());
  const selected = useSignal<string | null>(null);

  const parsed = useComputed(() => (input.value.trim() ? parseJson(input.value) : null));
  const found = useComputed(() => {
    const p = parsed.value;
    return p?.ok && query.value.trim() ? search(p.value, query.value) : null;
  });
  const stats = useComputed(() => {
    const p = parsed.value;
    return p?.ok ? treeStats(p.value) : null;
  });

  // A new document: start from the root, opened.
  useSignalEffect(() => {
    parsed.value;
    expanded.value = new Set([pathKey([])]);
    limits.value = new Map();
    selected.value = null;
  });
  // A new search: open the way to every match.
  useSignalEffect(() => {
    const f = found.value;
    if (!f?.ancestors.size) return;
    const next = new Set(expanded.peek());
    for (const a of f.ancestors) next.add(a);
    expanded.value = next;
  });

  const p = parsed.value;
  const f = found.value;
  const selPath = selected.value ? (JSON.parse(selected.value) as Path) : null;
  const selValue = p?.ok && selPath ? getAt(p.value, selPath) : undefined;
  const selText = selPath && selValue !== undefined ? JSON.stringify(selValue, null, 2) : "";

  const ctx: Ctx | null = p?.ok
    ? {
        expanded,
        limits,
        selected,
        query: query.value,
        found: f,
        only: only.value,
        onSelect: (path) => {
          selected.value = pathKey(path);
        },
      }
    : null;

  return (
    <>
      <TextBox
        label={tr(T.input)}
        value={input.value}
        onInput={(v) => {
          input.value = v;
        }}
        placeholder={tr(T.placeholder)}
        accept=".json,application/json,text/plain"
        rows={8}
        wrap={false}
        invalid={p ? !p.ok : false}
        note={p && !p.ok ? <ParseNote error={p} /> : null}
      />
      {ctx && p?.ok && (
        <>
          <div class="row">
            <input
              class="input json-tree-search"
              type="search"
              value={query.value}
              placeholder={tr(T.search)}
              aria-label={tr(T.search)}
              spellcheck={false}
              onInput={(e) => {
                query.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
            {f && (
              <span class={f.count ? "muted small" : "data-warn small"}>
                {f.count === 0
                  ? tr(T.noMatch)
                  : f.count === 1
                    ? tr(T.oneMatch)
                    : tr(T.matches).replace("{n}", fmt(f.count))}
                {f.capped ? ` ${tr(T.capped).replace("{n}", fmt(f.count))}` : ""}
              </span>
            )}
            <Toggle
              checked={only.value}
              onChange={(v) => {
                only.value = v;
              }}
              label={tr(T.onlyMatches)}
            />
            <span class="spacer" />
            <Button
              size="sm"
              onClick={() => {
                expanded.value = expandAll(p.value);
              }}
            >
              {tr(T.expand)}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                expanded.value = new Set([pathKey([])]);
              }}
            >
              {tr(T.collapse)}
            </Button>
          </div>
          <div class="json-tree-layout">
            <div class="panel json-tree-panel">
              <ul class="json-tree" aria-label={tr(T.tree)}>
                <TreeNode name={null} value={p.value} path={[]} ctx={ctx} />
              </ul>
            </div>
            <Panel title={tr(T.selected)} class="json-tree-side">
              {selPath && selValue !== undefined ? (
                <div class="stack">
                  <Output label={tr(T.jsonPath)} value={formatPath(selPath)} />
                  <Output label={tr(T.pointer)} value={jsonPointer(selPath)} />
                  <TextBox
                    label={`${tr(T.value)} · ${tr(T.types[typeOf(selValue)])}`}
                    value={selText.length > VALUE_MAX ? selText.slice(0, VALUE_MAX) : selText}
                    readOnly
                    rows={12}
                    wrap={false}
                    actions={
                      selText.length > VALUE_MAX ? (
                        <CopyButton text={selText} label={tr(T.copyAll)} />
                      ) : null
                    }
                    note={
                      selText.length > VALUE_MAX ? (
                        <span class="muted">{tr(T.cut).replace("{n}", fmt(VALUE_MAX))}</span>
                      ) : null
                    }
                  />
                </div>
              ) : (
                <p class="muted">{tr(T.pick)}</p>
              )}
            </Panel>
          </div>
          {stats.value && (
            <Stats
              items={[
                { label: tr(T.nodes), value: fmt(stats.value.nodes) },
                { label: tr(T.depth), value: fmt(stats.value.depth) },
              ]}
            />
          )}
        </>
      )}
    </>
  );
}
