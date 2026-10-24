import { useComputed } from "@preact/signals";
import { useState } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { CopyButton, FileDrop, Output, Panel } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import { GROUPS, searchMime, typesForExtension } from "./logic";

const T = {
  search: l(
    "Search an extension (.png, docx) or a type (image/webp)…",
    "Chercher une extension (.png, docx) ou un type (image/webp)…",
    "Endung (.png, docx) oder Typ (image/webp) suchen…",
  ),
  group: l("Kind", "Catégorie", "Kategorie"),
  all: l("All kinds", "Toutes", "Alle Kategorien"),
  type: l("MIME type", "Type MIME", "MIME-Typ"),
  extensions: l("Extensions", "Extensions", "Dateiendungen"),
  none: l("No type matches.", "Aucun type ne correspond.", "Kein Typ gefunden."),
  count: l("{n} types", "{n} types", "{n} Typen"),
  file: l("Check a file", "Examiner un fichier", "Datei prüfen"),
  drop: l(
    "Drop a file to see its type (the file is not read nor sent)",
    "Dépose un fichier pour voir son type (il n'est ni lu ni envoyé)",
    "Zieh eine Datei hierher, um ihren Typ zu sehen (sie wird weder gelesen noch gesendet)",
  ),
  name: l("File name", "Nom du fichier", "Dateiname"),
  browserSays: l("Type given by the browser", "Type donné par le navigateur", "Typ laut Browser"),
  tableSays: l("Type by extension", "Type d'après l'extension", "Typ laut Dateiendung"),
  unknown: l("unknown", "inconnu", "unbekannt"),
};

const GROUP_L: Record<(typeof GROUPS)[number], L10n> = {
  application: l(
    "application — binaries, documents, data",
    "application — binaires, documents, données",
    "application — Binärdateien, Dokumente, Daten",
  ),
  audio: l("audio", "audio", "audio"),
  font: l("font", "police", "font — Schriften"),
  image: l("image", "image", "image — Bilder"),
  message: l("message — e-mail, HTTP", "message — e-mail, HTTP", "message — E-Mail, HTTP"),
  model: l("model — 3D", "model — 3D", "model — 3D"),
  multipart: l(
    "multipart — forms, mixed bodies",
    "multipart — formulaires, corps mixtes",
    "multipart — Formulare, gemischte Bodys",
  ),
  text: l(
    "text — source code, markup",
    "text — code source, balisage",
    "text — Quellcode, Auszeichnung",
  ),
  video: l("video", "vidéo", "video"),
};

export default function Mime() {
  const query = useToolState("q", "");
  const group = useToolState("group", "");
  const [file, setFile] = useState<{ name: string; type: string } | null>(null);
  const results = useComputed(() => searchMime(query.value, group.value));
  const list = results.value;

  return (
    <>
      <div class="mime-controls">
        <SearchBox
          value={query.value}
          onInput={(v) => {
            query.value = v;
          }}
          placeholder={tr(T.search)}
        />
        <select
          class="input"
          aria-label={tr(T.group)}
          value={group.value}
          onChange={(e) => {
            group.value = (e.currentTarget as HTMLSelectElement).value;
          }}
        >
          <option value="">{tr(T.all)}</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {tr(GROUP_L[g])}
            </option>
          ))}
        </select>
      </div>

      <p class="muted small">{tr(T.count).replace("{n}", fmt(list.length))}</p>
      {list.length === 0 ? (
        <Empty>{tr(T.none)}</Empty>
      ) : (
        <div class="table-wrap mime-table">
          <table class="table">
            <thead>
              <tr>
                <th>{tr(T.type)}</th>
                <th>{tr(T.extensions)}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.type}>
                  <td class="mono mime-type">{e.type}</td>
                  <td class="mono">
                    {e.extensions.length ? (
                      e.extensions.map((x) => (
                        <button
                          type="button"
                          key={x}
                          class="mime-ext"
                          onClick={() => {
                            query.value = `.${x}`;
                          }}
                        >
                          .{x}
                        </button>
                      ))
                    ) : (
                      <span class="muted">—</span>
                    )}
                  </td>
                  <td class="num">
                    <CopyButton text={e.type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Panel title={tr(T.file)}>
        <FileDrop
          label={tr(T.drop)}
          onFiles={(files) => {
            const f = files[0];
            if (f) setFile({ name: f.name, type: f.type });
          }}
        />
        {file && (
          <div class="stack">
            <Output label={tr(T.name)} value={file.name} />
            <Output label={tr(T.browserSays)} value={file.type || tr(T.unknown)} />
            <Output
              label={tr(T.tableSays)}
              value={
                typesForExtension(file.name)
                  .map((e) => e.type)
                  .join(", ") || tr(T.unknown)
              }
            />
          </div>
        )}
      </Panel>
    </>
  );
}
