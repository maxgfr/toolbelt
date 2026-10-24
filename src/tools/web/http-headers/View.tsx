import { useComputed } from "@preact/signals";
import { Badge, type BadgeKind, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { CopyButton, Segmented, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, lang, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import type { HeaderCat, HeaderKind } from "./data";
import {
  checkSecurity,
  type FindingCode,
  type Level,
  parseHeaders,
  searchHeaders,
  tally,
} from "./logic";

type Tab = "reference" | "check";

const T = {
  tabs: l("Mode", "Mode"),
  reference: l("Reference", "Référence"),
  check: l("Security headers checker", "Vérificateur d'en-têtes de sécurité"),
  search: l("Search a header or a word…", "Chercher un en-tête ou un mot…"),
  all: l("All", "Tous"),
  request: l("Request", "Requête"),
  response: l("Response", "Réponse"),
  both: l("Both", "Les deux"),
  category: l("Category", "Catégorie"),
  allCats: l("All categories", "Toutes les catégories"),
  deprecated: l("deprecated", "obsolète"),
  none: l("No header matches.", "Aucun en-tête ne correspond."),
  count: l("{n} headers", "{n} en-têtes"),
  example: l("Example", "Exemple"),
  raw: l("Response headers", "En-têtes de réponse"),
  rawPh: l(
    "Paste the headers of a response, e.g. from curl -I https://example.com or the Network tab of dev tools.",
    "Colle les en-têtes d'une réponse, par ex. de curl -I https://example.com ou de l'onglet Réseau des outils de développement.",
  ),
  empty: l(
    "Paste response headers to check them. Nothing is sent anywhere.",
    "Colle des en-têtes de réponse pour les vérifier. Rien n'est envoyé nulle part.",
  ),
  ignored: l(
    "{n} line(s) ignored (not “name: value”).",
    "{n} ligne(s) ignorée(s) (pas « nom: valeur »).",
  ),
  lvBad: l("Problems", "Problèmes"),
  lvWarn: l("Warnings", "Avertissements"),
  lvInfo: l("Notes", "Remarques"),
  lvOk: l("Good", "Bons"),
  bad: l("problem", "problème"),
  warn: l("warning", "attention"),
  info: l("note", "remarque"),
  ok: l("good", "bon"),
};

const KIND_L: Record<HeaderKind, L10n> = { request: T.request, response: T.response, both: T.both };

const CAT_L: Record<HeaderCat, L10n> = {
  security: l("Security", "Sécurité"),
  cors: l("CORS", "CORS"),
  caching: l("Caching", "Cache"),
  conditional: l("Conditional & ranges", "Conditionnels et plages"),
  content: l("Content", "Contenu"),
  auth: l("Authentication", "Authentification"),
  cookies: l("Cookies", "Cookies"),
  connection: l("Connection & proxies", "Connexion et proxys"),
  context: l("Client & fetch context", "Contexte client et fetch"),
  misc: l("Other", "Autres"),
};

const LEVEL_KIND: Record<Level, BadgeKind> = { bad: "bad", warn: "warn", info: "info", ok: "ok" };
const LEVEL_L: Record<Level, L10n> = { bad: T.bad, warn: T.warn, info: T.info, ok: T.ok };

const MSG: Record<FindingCode, L10n> = {
  "hsts-missing": l(
    "Missing: browsers may load the site over plain HTTP. Add max-age=63072000; includeSubDomains.",
    "Absent : le site peut être chargé en HTTP simple. Ajoute max-age=63072000; includeSubDomains.",
  ),
  "hsts-invalid": l("No valid max-age: {d}", "Pas de max-age valide : {d}"),
  "hsts-short": l(
    "max-age={d} is under 6 months (15552000): use 1–2 years (31536000–63072000).",
    "max-age={d} est inférieur à 6 mois (15552000) : mets 1 à 2 ans (31536000–63072000).",
  ),
  "hsts-subdomains": l(
    "No includeSubDomains: subdomains are not covered.",
    "Pas d'includeSubDomains : les sous-domaines ne sont pas couverts.",
  ),
  "hsts-preload": l(
    "preload needs max-age ≥ 31536000 and includeSubDomains.",
    "preload exige max-age ≥ 31536000 et includeSubDomains.",
  ),
  "hsts-ok": l("HTTPS is enforced for a long time.", "HTTPS est imposé pour longtemps."),
  "csp-missing": l(
    "Missing: no Content Security Policy to limit XSS. Start with default-src 'self'.",
    "Absent : aucune politique de sécurité du contenu contre le XSS. Commence par default-src 'self'.",
  ),
  "csp-report-only": l(
    "Only a Report-Only policy: violations are reported, not blocked.",
    "Seulement une politique Report-Only : les violations sont signalées, pas bloquées.",
  ),
  "csp-unsafe-inline": l(
    "script-src allows 'unsafe-inline' without a nonce or hash: inline XSS is not blocked.",
    "script-src autorise 'unsafe-inline' sans nonce ni hash : le XSS en ligne n'est pas bloqué.",
  ),
  "csp-unsafe-eval": l(
    "script-src allows 'unsafe-eval' (eval, new Function).",
    "script-src autorise 'unsafe-eval' (eval, new Function).",
  ),
  "csp-wildcard": l(
    "Scripts may load from too broad a source: {d}",
    "Les scripts peuvent venir d'une source trop large : {d}",
  ),
  "csp-object-src": l(
    "Add object-src 'none' (plugins) unless default-src is 'none'.",
    "Ajoute object-src 'none' (plugins) sauf si default-src vaut 'none'.",
  ),
  "csp-base-uri": l(
    "No base-uri: an injected <base> tag could redirect relative URLs. Add base-uri 'self'.",
    "Pas de base-uri : une balise <base> injectée pourrait détourner les URL relatives. Ajoute base-uri 'self'.",
  ),
  "csp-ok": l("The policy restricts scripts well.", "La politique restreint bien les scripts."),
  "frame-csp": l(
    "Framing is controlled by CSP frame-ancestors.",
    "L'intégration en cadre est contrôlée par frame-ancestors de CSP.",
  ),
  "xfo-missing": l(
    "No X-Frame-Options nor CSP frame-ancestors: the page can be framed (clickjacking).",
    "Ni X-Frame-Options ni frame-ancestors de CSP : la page peut être intégrée (clickjacking).",
  ),
  "xfo-allow-from": l(
    "ALLOW-FROM is ignored by modern browsers; use CSP frame-ancestors.",
    "ALLOW-FROM est ignoré des navigateurs modernes ; utilise frame-ancestors de CSP.",
  ),
  "xfo-invalid": l(
    "Invalid value: {d} (use DENY or SAMEORIGIN).",
    "Valeur invalide : {d} (utilise DENY ou SAMEORIGIN).",
  ),
  "xfo-ok": l("Framing is restricted.", "L'intégration en cadre est restreinte."),
  "xcto-missing": l(
    "Missing: add nosniff so files are not run as another type.",
    "Absent : ajoute nosniff pour que les fichiers ne soient pas exécutés comme un autre type.",
  ),
  "xcto-invalid": l(
    "The only valid value is nosniff, not {d}.",
    "La seule valeur valide est nosniff, pas {d}.",
  ),
  "xcto-ok": l("MIME sniffing is off.", "La détection de type MIME est coupée."),
  "referrer-missing": l(
    "Missing: set strict-origin-when-cross-origin (or stricter) explicitly.",
    "Absent : fixe explicitement strict-origin-when-cross-origin (ou plus strict).",
  ),
  "referrer-unsafe": l(
    "{d} leaks full URLs (paths, query strings) to other sites.",
    "{d} divulgue les URL complètes (chemins, paramètres) aux autres sites.",
  ),
  "referrer-ok": l("Referrer leaks are limited.", "Les fuites de Referer sont limitées."),
  "pp-missing": l(
    "Missing: disable features you do not use, e.g. camera=(), microphone=(), geolocation=().",
    "Absent : coupe les fonctions inutilisées, par ex. camera=(), microphone=(), geolocation=().",
  ),
  "pp-ok": l("Browser features are restricted.", "Les fonctions du navigateur sont restreintes."),
  "fp-deprecated": l(
    "Feature-Policy is replaced by Permissions-Policy.",
    "Feature-Policy est remplacé par Permissions-Policy.",
  ),
  "coop-missing": l(
    "No Cross-Origin-Opener-Policy: same-origin isolates the page from other windows.",
    "Pas de Cross-Origin-Opener-Policy : same-origin isole la page des autres fenêtres.",
  ),
  "coop-ok": l(
    "The window is isolated from cross-origin openers.",
    "La fenêtre est isolée des ouvreurs d'autres origines.",
  ),
  "xxss-enabled": l(
    "The old XSS filter is turned on ({d}); it can create leaks. Send 0 or remove it.",
    "Le vieux filtre XSS est activé ({d}) ; il peut créer des fuites. Envoie 0 ou retire-le.",
  ),
  "xxss-ok": l("The old XSS filter is off.", "Le vieux filtre XSS est coupé."),
  "server-version": l("Reveals a version: {d}", "Révèle une version : {d}"),
  "powered-by": l(
    "Reveals the stack: {d}. Better removed.",
    "Révèle la pile technique : {d}. Mieux vaut le retirer.",
  ),
  "cors-credentials-wildcard": l(
    "Allow-Origin * with Allow-Credentials true is invalid and a sign of a risky CORS setup.",
    "Allow-Origin * avec Allow-Credentials true est invalide et signe d'une config CORS risquée.",
  ),
  "cors-null": l(
    "Allow-Origin null can be abused from sandboxed iframes and local files.",
    "Allow-Origin null peut être exploité depuis des iframes sandbox et des fichiers locaux.",
  ),
  "cors-wildcard": l(
    "Any site may read this response (fine for public data only).",
    "Tout site peut lire cette réponse (acceptable seulement pour des données publiques).",
  ),
  "cookie-secure": l(
    "Cookie {d} lacks Secure: it can travel over HTTP.",
    "Le cookie {d} n'a pas Secure : il peut passer en HTTP.",
  ),
  "cookie-httponly": l(
    "Cookie {d} lacks HttpOnly: JavaScript can read it (fine if intended).",
    "Le cookie {d} n'a pas HttpOnly : JavaScript peut le lire (normal si voulu).",
  ),
  "cookie-samesite": l(
    "Cookie {d} has no SameSite (browsers default to Lax).",
    "Le cookie {d} n'a pas SameSite (les navigateurs prennent Lax par défaut).",
  ),
  "cookie-samesite-none": l(
    "Cookie {d} uses SameSite=None without Secure: browsers reject it.",
    "Le cookie {d} utilise SameSite=None sans Secure : les navigateurs le rejettent.",
  ),
};

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
  const fr = lang.value === "fr";

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
                <p class="small">{fr ? h.fr : h.en}</p>
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
                      <p class="small">{tr(MSG[f.code]).replace("{d}", f.detail ?? "")}</p>
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
