import { useComputed, useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import {
  Button,
  ErrorNote,
  Field,
  IconButton,
  Output,
  Panel,
  Segmented,
  TextBox,
} from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { attempt } from "../_shared";
import { jsonToQuery, type Param, parseUrl, queryToJson, withParams } from "./logic";

type QsDir = "toJson" | "toQuery";

const T = {
  url: l("URL", "URL", "URL"),
  placeholder: l(
    "https://user@example.com:8080/path/page?q=search&lang=en#section",
    "https://user@example.com:8080/chemin/page?q=recherche&lang=fr#section",
    "https://user@example.com:8080/pfad/seite?q=suche&lang=de#abschnitt",
  ),
  assumed: l(
    "No scheme: read as https://",
    "Pas de schéma : lu comme https://",
    "Kein Schema: als https:// gelesen",
  ),
  relative: l(
    "Relative URL: only the path, query and fragment.",
    "URL relative : seulement le chemin, la requête et le fragment.",
    "Relative URL: nur Pfad, Query und Fragment.",
  ),
  parts: l("Parts", "Morceaux", "Bestandteile"),
  protocol: l("Scheme", "Schéma", "Schema"),
  username: l("User", "Utilisateur", "Benutzer"),
  password: l("Password", "Mot de passe", "Passwort"),
  host: l("Host", "Hôte", "Host"),
  port: l("Port", "Port", "Port"),
  path: l("Path", "Chemin", "Pfad"),
  segments: l("Segments", "Segments", "Segmente"),
  query: l("Query", "Requête", "Query"),
  hash: l("Fragment", "Fragment", "Fragment"),
  origin: l("Origin", "Origine", "Origin"),
  params: l("Query parameters", "Paramètres de requête", "Query-Parameter"),
  key: l("Key", "Clé", "Schlüssel"),
  value: l("Value", "Valeur", "Wert"),
  add: l("Add a parameter", "Ajouter un paramètre", "Parameter hinzufügen"),
  remove: l("Remove", "Supprimer", "Entfernen"),
  sort: l("Sort by key", "Trier par clé", "Nach Schlüssel sortieren"),
  noParams: l("No query parameters.", "Aucun paramètre de requête.", "Keine Query-Parameter."),
  qsTitle: l("Query string ↔ JSON", "Query string ↔ JSON", "Query-String ↔ JSON"),
  toJson: l("Query → JSON", "Requête → JSON", "Query → JSON"),
  toQuery: l("JSON → query", "JSON → requête", "JSON → Query"),
  qsIn: l("Query string", "Query string", "Query-String"),
  jsonIn: l("JSON", "JSON", "JSON"),
  phQs: l(
    "a=1&a=2&user[name]=Ann or a full URL",
    "a=1&a=2&user[name]=Ann ou une URL complète",
    "a=1&a=2&user[name]=Ann oder eine vollständige URL",
  ),
  phJson: l(
    '{"q": "search", "tags": ["a", "b"]}',
    '{"q": "recherche", "tags": ["a", "b"]}',
    '{"q": "suche", "tags": ["a", "b"]}',
  ),
  fromUrl: l("Take this URL's query", "Prendre la requête de l'URL", "Query dieser URL übernehmen"),
  result: l("Result", "Résultat", "Ergebnis"),
};

export default function UrlParser() {
  const url = useToolState("url", "");
  const qsDir = useToolState<QsDir>("qsDir", "toJson");
  const qsInput = useToolState("qsInput", "");
  const blanks = useSignal(0);

  const parsed = useComputed(() => (url.value.trim() ? attempt(() => parseUrl(url.value)) : null));
  const qs = useComputed(() => {
    if (!qsInput.value.trim()) return null;
    return attempt(() =>
      qsDir.value === "toJson"
        ? JSON.stringify(queryToJson(qsInput.value), null, 2)
        : jsonToQuery(qsInput.value),
    );
  });

  const p = parsed.value;
  const u = p?.ok ? p.value : null;
  const params: Param[] = u ? u.params : [];
  const rows: Param[] = [...params, ...Array.from({ length: blanks.value }, (): Param => ["", ""])];

  function setParams(next: Param[]) {
    const r = attempt(() => withParams(url.value, next));
    if (r.ok) url.value = r.value;
  }
  function edit(i: number, side: 0 | 1, v: string) {
    const next = rows.map((r) => [...r] as Param);
    const row = next[i];
    if (!row) return;
    row[side] = v;
    // A blank row that got content becomes a real parameter.
    if (i >= params.length && v) blanks.value = Math.max(0, blanks.value - 1);
    setParams(next);
  }

  const q = qs.value;
  return (
    <>
      <Field label={tr(T.url)}>
        <input
          class="input mono"
          value={url.value}
          placeholder={tr(T.placeholder)}
          spellcheck={false}
          aria-invalid={p ? !p.ok : false}
          onInput={(e) => {
            url.value = (e.currentTarget as HTMLInputElement).value;
            blanks.value = 0;
          }}
        />
      </Field>
      {p && !p.ok && <ErrorNote error={tr(p.error)} />}
      {u?.assumedScheme && <p class="small muted">{tr(T.assumed)}</p>}
      {u?.relative && <p class="small muted">{tr(T.relative)}</p>}

      {u && (
        <div class="grid-2">
          <Panel title={tr(T.parts)}>
            <div class="stack url-parser-parts">
              {!u.relative && <Output label={tr(T.protocol)} value={u.protocol} />}
              {(u.username || u.password) && <Output label={tr(T.username)} value={u.username} />}
              {u.password && <Output label={tr(T.password)} value={u.password} />}
              {!u.relative && <Output label={tr(T.host)} value={u.hostname} />}
              {!u.relative && <Output label={tr(T.port)} value={u.port} />}
              <Output label={tr(T.path)} value={u.pathname} />
              {u.segments.length > 1 && (
                <div class="url-parser-segments small">
                  <span class="muted">{tr(T.segments)}</span>
                  {u.segments.map((s, i) => (
                    <code key={i}>{s}</code>
                  ))}
                </div>
              )}
              <Output label={tr(T.query)} value={u.search} />
              <Output label={tr(T.hash)} value={u.hash} />
              {u.origin && <Output label={tr(T.origin)} value={u.origin} />}
            </div>
          </Panel>
          <Panel
            title={`${tr(T.params)} (${fmt(params.length)})`}
            actions={
              params.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setParams([...params].sort((a, b) => a[0].localeCompare(b[0])))}
                >
                  {tr(T.sort)}
                </Button>
              )
            }
          >
            {rows.length ? (
              <div class="table-wrap">
                <table class="table url-parser-params">
                  <thead>
                    <tr>
                      <th>{tr(T.key)}</th>
                      <th>{tr(T.value)}</th>
                      <th aria-label={tr(T.remove)} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([k, v], i) => (
                      <tr key={i}>
                        <td>
                          <input
                            class="input mono"
                            value={k}
                            aria-label={tr(T.key)}
                            spellcheck={false}
                            onInput={(e) => edit(i, 0, (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td>
                          <input
                            class="input mono"
                            value={v}
                            aria-label={tr(T.value)}
                            spellcheck={false}
                            onInput={(e) => edit(i, 1, (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td>
                          <IconButton
                            icon="trash"
                            label={tr(T.remove)}
                            onClick={() => {
                              if (i >= params.length) blanks.value = Math.max(0, blanks.value - 1);
                              else setParams(params.filter((_, j) => j !== i));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p class="muted small">{tr(T.noParams)}</p>
            )}
            <div class="row">
              <Button
                size="sm"
                icon="plus"
                onClick={() => {
                  blanks.value++;
                }}
              >
                {tr(T.add)}
              </Button>
            </div>
          </Panel>
        </div>
      )}

      <Panel title={tr(T.qsTitle)}>
        <div class="row">
          <Segmented<QsDir>
            value={qsDir.value}
            onChange={(v) => {
              qsDir.value = v;
            }}
            options={[
              { value: "toJson", label: tr(T.toJson) },
              { value: "toQuery", label: tr(T.toQuery) },
            ]}
          />
          <span class="spacer" />
          {u && qsDir.value === "toJson" && u.search && (
            <Button
              size="sm"
              onClick={() => {
                qsInput.value = u.search;
              }}
            >
              {tr(T.fromUrl)}
            </Button>
          )}
        </div>
        <div class="grid-2">
          <TextBox
            label={tr(qsDir.value === "toJson" ? T.qsIn : T.jsonIn)}
            value={qsInput.value}
            onInput={(v) => {
              qsInput.value = v;
            }}
            placeholder={tr(qsDir.value === "toJson" ? T.phQs : T.phJson)}
            rows={8}
            invalid={q ? !q.ok : false}
            note={q && !q.ok && <span class="error">{tr(q.error)}</span>}
          />
          <TextBox
            label={tr(T.result)}
            value={q?.ok ? q.value : ""}
            readOnly
            rows={8}
            {...(qsDir.value === "toJson" ? { downloadName: "query.json" } : {})}
          />
        </div>
      </Panel>
    </>
  );
}
