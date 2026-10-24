import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { formatPath, preview } from "../_shared";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { type Change, count, diffJson, report } from "./logic";

type Filter = "all" | Change["kind"];

const T = {
  a: l("Original JSON", "JSON d'origine", "Original-JSON"),
  b: l("Modified JSON", "JSON modifié", "Geändertes JSON"),
  phA: l("Paste the original JSON…", "Colle le JSON d'origine…", "Füge das Original-JSON ein…"),
  phB: l("Paste the modified JSON…", "Colle le JSON modifié…", "Füge das geänderte JSON ein…"),
  ignoreOrder: l(
    "Ignore array order",
    "Ignorer l'ordre des tableaux",
    "Array-Reihenfolge ignorieren",
  ),
  swap: l("Swap", "Inverser", "Tauschen"),
  copyReport: l("Copy report", "Copier le rapport", "Bericht kopieren"),
  all: l("All", "Tout", "Alle"),
  added: l("Added", "Ajouté", "Hinzugefügt"),
  removed: l("Removed", "Supprimé", "Entfernt"),
  changed: l("Changed", "Modifié", "Geändert"),
  kind: l("Change", "Changement", "Änderung"),
  path: l("Path", "Chemin", "Pfad"),
  value: l("Value", "Valeur", "Wert"),
  empty: l(
    "Paste two JSON documents to compare them.",
    "Colle deux documents JSON pour les comparer.",
    "Füge zwei JSON-Dokumente ein, um sie zu vergleichen.",
  ),
  same: l(
    "The two documents are equivalent (key order ignored).",
    "Les deux documents sont équivalents (ordre des clés ignoré).",
    "Die beiden Dokumente sind gleichwertig (Schlüsselreihenfolge ignoriert).",
  ),
  capped: l(
    "Showing the first {shown} changes of {total}.",
    "Affichage des {shown} premiers changements sur {total}.",
    "Die ersten {shown} von {total} Änderungen werden angezeigt.",
  ),
  valid: l("Valid JSON", "JSON valide", "Gültiges JSON"),
};

const MAX = 1000;
const LABEL = { added: T.added, removed: T.removed, changed: T.changed };

export default function JsonDiff() {
  const a = useToolState("a", "");
  const b = useToolState("b", "");
  const ignoreArrayOrder = useToolState("ignoreArrayOrder", false);
  const filter = useToolState<Filter>("filter", "all");

  const pa = useComputed(() => (a.value.trim() ? parseJson(a.value) : null));
  const pb = useComputed(() => (b.value.trim() ? parseJson(b.value) : null));
  const changes = useComputed(() => {
    const x = pa.value;
    const y = pb.value;
    if (!x?.ok || !y?.ok) return null;
    return diffJson(x.value, y.value, { ignoreArrayOrder: ignoreArrayOrder.value });
  });
  const ch = changes.value;
  const c = ch ? count(ch) : null;
  const shown = ch ? (filter.value === "all" ? ch : ch.filter((x) => x.kind === filter.value)) : [];
  const x = pa.value;
  const y = pb.value;

  return (
    <>
      <div class="grid-2">
        <TextBox
          label={tr(T.a)}
          value={a.value}
          onInput={(v) => {
            a.value = v;
          }}
          placeholder={tr(T.phA)}
          accept=".json,application/json,text/plain"
          rows={14}
          wrap={false}
          invalid={x ? !x.ok : false}
          note={x && <ParseNote error={x.ok ? null : x} ok={tr(T.valid)} />}
        />
        <TextBox
          label={tr(T.b)}
          value={b.value}
          onInput={(v) => {
            b.value = v;
          }}
          placeholder={tr(T.phB)}
          accept=".json,application/json,text/plain"
          rows={14}
          wrap={false}
          invalid={y ? !y.ok : false}
          note={y && <ParseNote error={y.ok ? null : y} ok={tr(T.valid)} />}
        />
      </div>
      <div class="row">
        <Toggle
          checked={ignoreArrayOrder.value}
          onChange={(v) => {
            ignoreArrayOrder.value = v;
          }}
          label={tr(T.ignoreOrder)}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="swap"
          onClick={() => {
            [a.value, b.value] = [b.value, a.value];
          }}
        >
          {tr(T.swap)}
        </Button>
        <span class="spacer" />
        {ch && ch.length > 0 && <CopyButton text={() => report(ch)} label={tr(T.copyReport)} />}
      </div>
      {!ch || !c ? (
        <p class="muted">{tr(T.empty)}</p>
      ) : ch.length === 0 ? (
        <p class="json-diff-same">{tr(T.same)}</p>
      ) : (
        <>
          <Segmented<Filter>
            value={filter.value}
            onChange={(v) => {
              filter.value = v;
            }}
            options={[
              { value: "all", label: `${tr(T.all)} · ${fmt(ch.length)}` },
              { value: "added", label: `+ ${tr(T.added)} · ${fmt(c.added)}` },
              { value: "removed", label: `− ${tr(T.removed)} · ${fmt(c.removed)}` },
              { value: "changed", label: `~ ${tr(T.changed)} · ${fmt(c.changed)}` },
            ]}
          />
          {shown.length > 0 && (
            <div class="table-wrap json-diff-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{tr(T.kind)}</th>
                    <th>{tr(T.path)}</th>
                    <th>{tr(T.value)}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, MAX).map((d, i) => (
                    <tr key={i} class={`json-diff-${d.kind}`}>
                      <td>
                        <span class={`json-diff-badge json-diff-badge-${d.kind}`}>
                          {tr(LABEL[d.kind])}
                        </span>
                      </td>
                      <td class="mono json-diff-path">{formatPath(d.path)}</td>
                      <td class="mono json-diff-val">
                        {d.kind === "added" ? (
                          <span class="json-diff-new">{preview(d.new, 300)}</span>
                        ) : d.kind === "removed" ? (
                          <span class="json-diff-old">{preview(d.old, 300)}</span>
                        ) : (
                          <>
                            <span class="json-diff-old">{preview(d.old, 300)}</span>
                            <span class="muted"> → </span>
                            <span class="json-diff-new">{preview(d.new, 300)}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shown.length > MAX && (
            <p class="muted small">
              {tr(T.capped).replace("{shown}", fmt(MAX)).replace("{total}", fmt(shown.length))}
            </p>
          )}
        </>
      )}
    </>
  );
}
