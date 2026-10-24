import { useComputed } from "@preact/signals";
import { Badge, type BadgeKind, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { CopyButton, Segmented, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, pick, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import type { HeaderCat, HeaderKind } from "./data";
import {
  checkSecurity,
  findingMessage,
  type Level,
  parseHeaders,
  searchHeaders,
  tally,
} from "./logic";

type Tab = "reference" | "check";

const T = {
  tabs: l("Mode", "Mode", "Modus"),
  reference: l("Reference", "Référence", "Referenz"),
  check: l(
    "Security headers checker",
    "Vérificateur d'en-têtes de sécurité",
    "Security-Header-Prüfung",
  ),
  search: l(
    "Search a header or a word…",
    "Chercher un en-tête ou un mot…",
    "Header oder Begriff suchen…",
  ),
  all: l("All", "Tous", "Alle"),
  request: l("Request", "Requête", "Anfrage"),
  response: l("Response", "Réponse", "Antwort"),
  both: l("Both", "Les deux", "Beide"),
  category: l("Category", "Catégorie", "Kategorie"),
  allCats: l("All categories", "Toutes les catégories", "Alle Kategorien"),
  deprecated: l("deprecated", "obsolète", "veraltet"),
  none: l("No header matches.", "Aucun en-tête ne correspond.", "Kein Header gefunden."),
  count: l("{n} headers", "{n} en-têtes", "{n} Header"),
  example: l("Example", "Exemple", "Beispiel"),
  raw: l("Response headers", "En-têtes de réponse", "Antwort-Header"),
  rawPh: l(
    "Paste the headers of a response, e.g. from curl -I https://example.com or the Network tab of dev tools.",
    "Colle les en-têtes d'une réponse, par ex. de curl -I https://example.com ou de l'onglet Réseau des outils de développement.",
    "Füge die Header einer Antwort ein, z. B. aus curl -I https://example.com oder dem Netzwerk-Tab der Entwicklertools.",
  ),
  empty: l(
    "Paste response headers to check them. Nothing is sent anywhere.",
    "Colle des en-têtes de réponse pour les vérifier. Rien n'est envoyé nulle part.",
    "Füge Antwort-Header ein, um sie zu prüfen. Nichts wird irgendwohin gesendet.",
  ),
  ignored: l(
    "{n} line(s) ignored (not “name: value”).",
    "{n} ligne(s) ignorée(s) (pas « nom: valeur »).",
    "{n} Zeile(n) ignoriert (nicht „Name: Wert“).",
  ),
  lvBad: l("Problems", "Problèmes", "Probleme"),
  lvWarn: l("Warnings", "Avertissements", "Warnungen"),
  lvInfo: l("Notes", "Remarques", "Hinweise"),
  lvOk: l("Good", "Bons", "Gut"),
  bad: l("problem", "problème", "Problem"),
  warn: l("warning", "attention", "Warnung"),
  info: l("note", "remarque", "Hinweis"),
  ok: l("good", "bon", "gut"),
};

const KIND_L: Record<HeaderKind, L10n> = { request: T.request, response: T.response, both: T.both };

const CAT_L: Record<HeaderCat, L10n> = {
  security: l("Security", "Sécurité", "Sicherheit"),
  cors: l("CORS", "CORS", "CORS"),
  caching: l("Caching", "Cache", "Caching"),
  conditional: l("Conditional & ranges", "Conditionnels et plages", "Bedingt & Bereiche"),
  content: l("Content", "Contenu", "Inhalt"),
  auth: l("Authentication", "Authentification", "Authentifizierung"),
  cookies: l("Cookies", "Cookies", "Cookies"),
  connection: l("Connection & proxies", "Connexion et proxys", "Verbindung & Proxys"),
  context: l("Client & fetch context", "Contexte client et fetch", "Client- & Fetch-Kontext"),
  misc: l("Other", "Autres", "Sonstige"),
};

const LEVEL_KIND: Record<Level, BadgeKind> = { bad: "bad", warn: "warn", info: "info", ok: "ok" };
const LEVEL_L: Record<Level, L10n> = { bad: T.bad, warn: T.warn, info: T.info, ok: T.ok };

export default function HttpHeaders() {
  const tab = useToolState<Tab>("tab", "reference");
  const query = useToolState("q", "");
  const kind = useToolState<HeaderKind | "all">("kind", "all");
  const cat = useToolState<HeaderCat | "all">("cat", "all");
  const raw = useToolState("raw", "");
  const matches = useComputed(() => searchHeaders(query.value, kind.value, cat.value));
  const parsed = useComputed(() => parseHeaders(raw.value));
  const findings = useComputed(() => (raw.value.trim() ? checkSecurity(parsed.value) : []));
  const counts = tally(findings.value);

  return (
    <>
      <div class="row">
        <Segmented<Tab>
          label={tr(T.tabs)}
          value={tab.value}
          options={[
            { value: "reference", label: tr(T.reference) },
            { value: "check", label: tr(T.check) },
          ]}
          onChange={(v) => {
            tab.value = v;
          }}
        />
      </div>
      {tab.value === "reference" && (
        <>
          <SearchBox
            value={query.value}
            onInput={(v) => {
              query.value = v;
            }}
            placeholder={tr(T.search)}
          />
          <div class="row">
            <Segmented<HeaderKind | "all">
              value={kind.value}
              options={[
                { value: "all", label: tr(T.all) },
                { value: "request", label: tr(T.request) },
                { value: "response", label: tr(T.response) },
              ]}
              onChange={(v) => {
                kind.value = v;
              }}
            />
            <div class="http-headers-cat">
              <Select<HeaderCat | "all">
                label={tr(T.category)}
                value={cat.value}
                options={[
                  { value: "all", label: tr(T.allCats) },
                  ...(Object.keys(CAT_L) as HeaderCat[]).map((c) => ({
                    value: c,
                    label: tr(CAT_L[c]),
                  })),
                ]}
                onChange={(v) => {
                  cat.value = v;
                }}
              />
            </div>
            <span class="spacer" />
            <span class="muted small">{tr(T.count).replace("{n}", fmt(matches.value.length))}</span>
          </div>
          {matches.value.length === 0 && <Empty>{tr(T.none)}</Empty>}
          <ul class="http-headers-list">
            {matches.value.map((h) => (
              <li key={h.name} class="http-headers-item">
                <div class="http-headers-head">
                  <strong class="mono">{h.name}</strong>
                  <Badge kind="info">{tr(KIND_L[h.kind])}</Badge>
                  <span class="muted small">{tr(CAT_L[h.cat])}</span>
                  {h.deprecated && <Badge kind="warn">{tr(T.deprecated)}</Badge>}
                </div>
                <p class="small">{pick({ en: h.en, fr: h.fr, de: h.de })}</p>
                <div class="http-headers-example">
                  <code class="mono small">
                    {h.name}: {h.example}
                  </code>
                  <CopyButton text={`${h.name}: ${h.example}`} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {tab.value === "check" && (
        <>
          <TextBox
            label={tr(T.raw)}
            value={raw.value}
            onInput={(v) => {
              raw.value = v;
            }}
            placeholder={tr(T.rawPh)}
            rows={10}
            wrap={false}
          />
          {!raw.value.trim() ? (
            <p class="muted">{tr(T.empty)}</p>
          ) : (
            <>
              {parsed.value.status && <p class="mono small">{parsed.value.status}</p>}
              <Stats
                items={[
                  { label: tr(T.lvBad), value: fmt(counts.bad) },
                  { label: tr(T.lvWarn), value: fmt(counts.warn) },
                  { label: tr(T.lvInfo), value: fmt(counts.info) },
                  { label: tr(T.lvOk), value: fmt(counts.ok) },
                ]}
              />
              <ul class="http-headers-findings">
                {findings.value.map((f, i) => (
                  <li key={`${i}-${f.code}`} class={`http-headers-finding http-headers-${f.level}`}>
                    <Badge kind={LEVEL_KIND[f.level]}>{tr(LEVEL_L[f.level])}</Badge>
                    <div>
                      <strong class="mono small">{f.header}</strong>
                      <p class="small">{tr(findingMessage(f))}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {parsed.value.bad.length > 0 && (
                <p class="muted small">
                  {tr(T.ignored).replace("{n}", fmt(parsed.value.bad.length))}
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
