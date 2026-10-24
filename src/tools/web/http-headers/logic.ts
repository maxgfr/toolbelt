/**
 * HTTP headers: searching the reference, and checking pasted response headers against the
 * usual security recommendations (HSTS, CSP, framing, nosniff, referrer, permissions, COOP,
 * cookies, CORS, version banners).
 */
import { type L10n, l } from "../../../i18n";
import { matchesQuery } from "../_shared";
import { HEADERS, type HeaderCat, type HeaderEntry, type HeaderKind } from "./data";

export function searchHeaders(
  query: string,
  kind: HeaderKind | "all" = "all",
  cat: HeaderCat | "all" = "all",
): HeaderEntry[] {
  return HEADERS.filter(
    (h) =>
      (kind === "all" || h.kind === kind || h.kind === "both") &&
      (cat === "all" || h.cat === cat) &&
      matchesQuery(query, h.name, h.en, h.fr, h.de, h.example, h.cat),
  );
}

/* --- Parsing --------------------------------------------------------------------- */

export interface ParsedHeaders {
  /** Lowercase name → every value, in order. */
  map: Map<string, string[]>;
  /** The status line, if pasted (HTTP/2 200). */
  status: string | null;
  /** Lines that are not "name: value". */
  bad: string[];
}

/**
 * Reads raw headers as printed by curl -I / -v ("< " prefixes), browser dev tools or a
 * server log. Continuation lines (starting with spaces) are joined to the previous header.
 */
export function parseHeaders(raw: string): ParsedHeaders {
  const map = new Map<string, string[]>();
  const bad: string[] = [];
  let status: string | null = null;
  let last: { name: string; idx: number } | null = null;
  for (const line0 of raw.split(/\r?\n/)) {
    const line = line0.replace(/^[<>]\s?/, "");
    if (!line.trim()) continue;
    if (/^HTTP\/\d(\.\d)?\s+\d{3}/i.test(line.trim())) {
      status = line.trim();
      continue;
    }
    if (/^[ \t]/.test(line) && last) {
      const vals = map.get(last.name);
      if (vals) vals[last.idx] = `${vals[last.idx] ?? ""} ${line.trim()}`;
      continue;
    }
    const m = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) {
      bad.push(line.trim());
      last = null;
      continue;
    }
    const name = (m[1] ?? "").toLowerCase();
    const vals = map.get(name) ?? [];
    vals.push((m[2] ?? "").trim());
    map.set(name, vals);
    last = { name, idx: vals.length - 1 };
  }
  return { map, status, bad };
}

/* --- Security check -------------------------------------------------------------------- */

export type Level = "ok" | "info" | "warn" | "bad";

export type FindingCode =
  | "hsts-missing"
  | "hsts-invalid"
  | "hsts-short"
  | "hsts-subdomains"
  | "hsts-preload"
  | "hsts-ok"
  | "csp-missing"
  | "csp-report-only"
  | "csp-unsafe-inline"
  | "csp-unsafe-eval"
  | "csp-wildcard"
  | "csp-object-src"
  | "csp-base-uri"
  | "csp-ok"
  | "frame-csp"
  | "xfo-missing"
  | "xfo-allow-from"
  | "xfo-invalid"
  | "xfo-ok"
  | "xcto-missing"
  | "xcto-invalid"
  | "xcto-ok"
  | "referrer-missing"
  | "referrer-unsafe"
  | "referrer-ok"
  | "pp-missing"
  | "pp-ok"
  | "fp-deprecated"
  | "coop-missing"
  | "coop-ok"
  | "xxss-enabled"
  | "xxss-ok"
  | "server-version"
  | "powered-by"
  | "cors-credentials-wildcard"
  | "cors-null"
  | "cors-wildcard"
  | "cookie-secure"
  | "cookie-httponly"
  | "cookie-samesite"
  | "cookie-samesite-none";

export interface Finding {
  header: string;
  level: Level;
  code: FindingCode;
  /** Extra detail: the offending value, cookie name, number of days… */
  detail?: string;
}

const HALF_YEAR = 15552000;
const YEAR = 31536000;

function directives(csp: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of csp.split(";")) {
    const [name, ...vals] = part.trim().split(/\s+/);
    if (name && !out.has(name.toLowerCase())) out.set(name.toLowerCase(), vals);
  }
  return out;
}

function checkCsp(csp: string, out: Finding[]): Map<string, string[]> {
  const d = directives(csp);
  const header = "Content-Security-Policy";
  const scripts = d.get("script-src") ?? d.get("default-src");
  let issues = 0;
  if (!scripts) {
    out.push({ header, level: "warn", code: "csp-wildcard", detail: "script-src" });
    issues++;
  } else {
    const lower = scripts.map((s) => s.toLowerCase());
    const strict = lower.some(
      (s) => s.startsWith("'nonce-") || /^'sha(256|384|512)-/.test(s) || s === "'strict-dynamic'",
    );
    if (lower.includes("'unsafe-inline'") && !strict) {
      out.push({ header, level: "warn", code: "csp-unsafe-inline" });
      issues++;
    }
    if (lower.includes("'unsafe-eval'")) {
      out.push({ header, level: "warn", code: "csp-unsafe-eval" });
      issues++;
    }
    const wide = lower.filter((s) => ["*", "http:", "https:", "data:"].includes(s));
    if (wide.length && !lower.includes("'strict-dynamic'")) {
      out.push({ header, level: "warn", code: "csp-wildcard", detail: wide.join(" ") });
      issues++;
    }
  }
  const objects = d.get("object-src") ?? d.get("default-src");
  if (!objects?.some((s) => s.toLowerCase() === "'none'")) {
    out.push({ header, level: "info", code: "csp-object-src" });
    issues++;
  }
  if (!d.has("base-uri")) {
    out.push({ header, level: "info", code: "csp-base-uri" });
    issues++;
  }
  if (!issues) out.push({ header, level: "ok", code: "csp-ok" });
  return d;
}

function cookieChecks(value: string, out: Finding[]): void {
  const [pair = "", ...attrs] = value.split(";").map((s) => s.trim());
  const name = pair.split("=")[0]?.trim() || "?";
  const has = (a: string) => attrs.some((x) => x.toLowerCase().split("=")[0]?.trim() === a);
  const sameSite = attrs
    .find((x) => /^samesite\s*=/i.test(x))
    ?.split("=")[1]
    ?.trim()
    .toLowerCase();
  const secure = has("secure") || name.startsWith("__Secure-") || name.startsWith("__Host-");
  const header = "Set-Cookie";
  if (sameSite === "none" && !has("secure"))
    out.push({ header, level: "bad", code: "cookie-samesite-none", detail: name });
  else if (!secure) out.push({ header, level: "warn", code: "cookie-secure", detail: name });
  if (!has("httponly")) out.push({ header, level: "info", code: "cookie-httponly", detail: name });
  if (!sameSite) out.push({ header, level: "info", code: "cookie-samesite", detail: name });
}

const ORDER: Record<Level, number> = { bad: 0, warn: 1, info: 2, ok: 3 };

/** Findings for pasted response headers, worst first. */
export function checkSecurity(h: ParsedHeaders): Finding[] {
  const out: Finding[] = [];
  const get = (n: string) => h.map.get(n);
  const first = (n: string) => get(n)?.[0];

  // HSTS
  const hsts = first("strict-transport-security");
  const H = "Strict-Transport-Security";
  if (hsts === undefined) out.push({ header: H, level: "bad", code: "hsts-missing" });
  else {
    const age = /max-age\s*=\s*"?(\d+)"?/i.exec(hsts);
    if (!age) out.push({ header: H, level: "bad", code: "hsts-invalid", detail: hsts });
    else {
      const secs = Number(age[1]);
      const sub = /includesubdomains/i.test(hsts);
      let issues = 0;
      if (secs < HALF_YEAR) {
        out.push({
          header: H,
          level: "warn",
          code: "hsts-short",
          detail: String(secs),
        });
        issues++;
      }
      if (!sub) {
        out.push({ header: H, level: "info", code: "hsts-subdomains" });
        issues++;
      }
      if (/preload/i.test(hsts) && (secs < YEAR || !sub)) {
        out.push({ header: H, level: "warn", code: "hsts-preload" });
        issues++;
      }
      if (!issues) out.push({ header: H, level: "ok", code: "hsts-ok" });
    }
  }

  // CSP
  const csp = get("content-security-policy");
  let cspDirectives = new Map<string, string[]>();
  if (!csp?.length) {
    if (get("content-security-policy-report-only"))
      out.push({ header: "Content-Security-Policy", level: "warn", code: "csp-report-only" });
    else out.push({ header: "Content-Security-Policy", level: "bad", code: "csp-missing" });
  } else cspDirectives = checkCsp(csp.join("; "), out);

  // Framing
  const xfo = first("x-frame-options");
  if (cspDirectives.has("frame-ancestors"))
    out.push({ header: "X-Frame-Options", level: "ok", code: "frame-csp" });
  else if (xfo === undefined)
    out.push({ header: "X-Frame-Options", level: "warn", code: "xfo-missing" });
  else if (/^\s*(deny|sameorigin)\s*$/i.test(xfo))
    out.push({ header: "X-Frame-Options", level: "ok", code: "xfo-ok" });
  else if (/^\s*allow-from/i.test(xfo))
    out.push({ header: "X-Frame-Options", level: "warn", code: "xfo-allow-from" });
  else out.push({ header: "X-Frame-Options", level: "bad", code: "xfo-invalid", detail: xfo });

  // nosniff
  const xcto = first("x-content-type-options");
  if (xcto === undefined)
    out.push({ header: "X-Content-Type-Options", level: "warn", code: "xcto-missing" });
  else if (xcto.trim().toLowerCase() !== "nosniff")
    out.push({
      header: "X-Content-Type-Options",
      level: "bad",
      code: "xcto-invalid",
      detail: xcto,
    });
  else out.push({ header: "X-Content-Type-Options", level: "ok", code: "xcto-ok" });

  // Referrer-Policy: the last valid token wins.
  const rp = get("referrer-policy");
  if (!rp?.length) out.push({ header: "Referrer-Policy", level: "warn", code: "referrer-missing" });
  else {
    const last =
      rp
        .join(",")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .pop() ?? "";
    if (last === "unsafe-url" || last === "no-referrer-when-downgrade")
      out.push({ header: "Referrer-Policy", level: "warn", code: "referrer-unsafe", detail: last });
    else out.push({ header: "Referrer-Policy", level: "ok", code: "referrer-ok" });
  }

  // Permissions-Policy
  if (get("permissions-policy"))
    out.push({ header: "Permissions-Policy", level: "ok", code: "pp-ok" });
  else out.push({ header: "Permissions-Policy", level: "warn", code: "pp-missing" });
  if (get("feature-policy"))
    out.push({ header: "Feature-Policy", level: "info", code: "fp-deprecated" });

  // COOP
  if (get("cross-origin-opener-policy"))
    out.push({ header: "Cross-Origin-Opener-Policy", level: "ok", code: "coop-ok" });
  else out.push({ header: "Cross-Origin-Opener-Policy", level: "info", code: "coop-missing" });

  // X-XSS-Protection
  const xxss = first("x-xss-protection");
  if (xxss !== undefined) {
    if (/^\s*1/.test(xxss))
      out.push({ header: "X-XSS-Protection", level: "warn", code: "xxss-enabled", detail: xxss });
    else out.push({ header: "X-XSS-Protection", level: "ok", code: "xxss-ok" });
  }

  // Banners
  const server = first("server");
  if (server && /\d/.test(server))
    out.push({ header: "Server", level: "info", code: "server-version", detail: server });
  for (const n of ["x-powered-by", "x-aspnet-version", "x-aspnetmvc-version"]) {
    const v = first(n);
    if (v !== undefined)
      out.push({
        header: n.replace(/(^|-)(\w)/g, (_, d: string, c: string) => d + c.toUpperCase()),
        level: "info",
        code: "powered-by",
        detail: v,
      });
  }

  // CORS
  const acao = first("access-control-allow-origin")?.trim();
  const acac = first("access-control-allow-credentials")?.trim().toLowerCase();
  if (acao === "*" && acac === "true")
    out.push({
      header: "Access-Control-Allow-Origin",
      level: "bad",
      code: "cors-credentials-wildcard",
    });
  else if (acao === "null")
    out.push({ header: "Access-Control-Allow-Origin", level: "warn", code: "cors-null" });
  else if (acao === "*")
    out.push({ header: "Access-Control-Allow-Origin", level: "info", code: "cors-wildcard" });

  // Cookies
  for (const c of get("set-cookie") ?? []) cookieChecks(c, out);

  return out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => ORDER[a.f.level] - ORDER[b.f.level] || a.i - b.i)
    .map((x) => x.f);
}

/** How many findings of each level. */
export function tally(findings: Finding[]): Record<Level, number> {
  const t: Record<Level, number> = { ok: 0, info: 0, warn: 0, bad: 0 };
  for (const f of findings) t[f.level]++;
  return t;
}

/** What each finding means and what to do; `{d}` stands for the finding's detail. */
export const FINDING_MESSAGES: Record<FindingCode, L10n> = {
  "hsts-missing": l(
    "Missing: browsers may load the site over plain HTTP. Add max-age=63072000; includeSubDomains.",
    "Absent : le site peut être chargé en HTTP simple. Ajoute max-age=63072000; includeSubDomains.",
    "Fehlt: Browser können die Website über einfaches HTTP laden. Ergänze max-age=63072000; includeSubDomains.",
  ),
  "hsts-invalid": l(
    "No valid max-age: {d}",
    "Pas de max-age valide : {d}",
    "Kein gültiges max-age: {d}",
  ),
  "hsts-short": l(
    "max-age={d} is under 6 months (15552000): use 1–2 years (31536000–63072000).",
    "max-age={d} est inférieur à 6 mois (15552000) : mets 1 à 2 ans (31536000–63072000).",
    "max-age={d} liegt unter 6 Monaten (15552000): nimm 1–2 Jahre (31536000–63072000).",
  ),
  "hsts-subdomains": l(
    "No includeSubDomains: subdomains are not covered.",
    "Pas d'includeSubDomains : les sous-domaines ne sont pas couverts.",
    "Kein includeSubDomains: Subdomains sind nicht abgedeckt.",
  ),
  "hsts-preload": l(
    "preload needs max-age ≥ 31536000 and includeSubDomains.",
    "preload exige max-age ≥ 31536000 et includeSubDomains.",
    "preload erfordert max-age ≥ 31536000 und includeSubDomains.",
  ),
  "hsts-ok": l(
    "HTTPS is enforced for a long time.",
    "HTTPS est imposé pour longtemps.",
    "HTTPS wird für lange Zeit erzwungen.",
  ),
  "csp-missing": l(
    "Missing: no Content Security Policy to limit XSS. Start with default-src 'self'.",
    "Absent : aucune politique de sécurité du contenu contre le XSS. Commence par default-src 'self'.",
    "Fehlt: keine Content Security Policy, die XSS eindämmt. Fang mit default-src 'self' an.",
  ),
  "csp-report-only": l(
    "Only a Report-Only policy: violations are reported, not blocked.",
    "Seulement une politique Report-Only : les violations sont signalées, pas bloquées.",
    "Nur eine Report-Only-Richtlinie: Verstöße werden gemeldet, nicht blockiert.",
  ),
  "csp-unsafe-inline": l(
    "script-src allows 'unsafe-inline' without a nonce or hash: inline XSS is not blocked.",
    "script-src autorise 'unsafe-inline' sans nonce ni hash : le XSS en ligne n'est pas bloqué.",
    "script-src erlaubt 'unsafe-inline' ohne Nonce oder Hash: Inline-XSS wird nicht blockiert.",
  ),
  "csp-unsafe-eval": l(
    "script-src allows 'unsafe-eval' (eval, new Function).",
    "script-src autorise 'unsafe-eval' (eval, new Function).",
    "script-src erlaubt 'unsafe-eval' (eval, new Function).",
  ),
  "csp-wildcard": l(
    "Scripts may load from too broad a source: {d}",
    "Les scripts peuvent venir d'une source trop large : {d}",
    "Skripte dürfen aus einer zu weit gefassten Quelle laden: {d}",
  ),
  "csp-object-src": l(
    "Add object-src 'none' (plugins) unless default-src is 'none'.",
    "Ajoute object-src 'none' (plugins) sauf si default-src vaut 'none'.",
    "Ergänze object-src 'none' (Plugins), außer default-src ist 'none'.",
  ),
  "csp-base-uri": l(
    "No base-uri: an injected <base> tag could redirect relative URLs. Add base-uri 'self'.",
    "Pas de base-uri : une balise <base> injectée pourrait détourner les URL relatives. Ajoute base-uri 'self'.",
    "Kein base-uri: Ein eingeschleustes <base>-Tag könnte relative URLs umleiten. Ergänze base-uri 'self'.",
  ),
  "csp-ok": l(
    "The policy restricts scripts well.",
    "La politique restreint bien les scripts.",
    "Die Richtlinie schränkt Skripte gut ein.",
  ),
  "frame-csp": l(
    "Framing is controlled by CSP frame-ancestors.",
    "L'intégration en cadre est contrôlée par frame-ancestors de CSP.",
    "Das Einbetten in Frames wird über frame-ancestors in CSP gesteuert.",
  ),
  "xfo-missing": l(
    "No X-Frame-Options nor CSP frame-ancestors: the page can be framed (clickjacking).",
    "Ni X-Frame-Options ni frame-ancestors de CSP : la page peut être intégrée (clickjacking).",
    "Weder X-Frame-Options noch frame-ancestors in CSP: Die Seite kann in Frames eingebettet werden (Clickjacking).",
  ),
  "xfo-allow-from": l(
    "ALLOW-FROM is ignored by modern browsers; use CSP frame-ancestors.",
    "ALLOW-FROM est ignoré des navigateurs modernes ; utilise frame-ancestors de CSP.",
    "ALLOW-FROM wird von modernen Browsern ignoriert; nimm frame-ancestors in CSP.",
  ),
  "xfo-invalid": l(
    "Invalid value: {d} (use DENY or SAMEORIGIN).",
    "Valeur invalide : {d} (utilise DENY ou SAMEORIGIN).",
    "Ungültiger Wert: {d} (nimm DENY oder SAMEORIGIN).",
  ),
  "xfo-ok": l(
    "Framing is restricted.",
    "L'intégration en cadre est restreinte.",
    "Das Einbetten in Frames ist eingeschränkt.",
  ),
  "xcto-missing": l(
    "Missing: add nosniff so files are not run as another type.",
    "Absent : ajoute nosniff pour que les fichiers ne soient pas exécutés comme un autre type.",
    "Fehlt: Ergänze nosniff, damit Dateien nicht als anderer Typ ausgeführt werden.",
  ),
  "xcto-invalid": l(
    "The only valid value is nosniff, not {d}.",
    "La seule valeur valide est nosniff, pas {d}.",
    "Der einzige gültige Wert ist nosniff, nicht {d}.",
  ),
  "xcto-ok": l(
    "MIME sniffing is off.",
    "La détection de type MIME est coupée.",
    "MIME-Sniffing ist abgeschaltet.",
  ),
  "referrer-missing": l(
    "Missing: set strict-origin-when-cross-origin (or stricter) explicitly.",
    "Absent : fixe explicitement strict-origin-when-cross-origin (ou plus strict).",
    "Fehlt: Setze strict-origin-when-cross-origin (oder strenger) ausdrücklich.",
  ),
  "referrer-unsafe": l(
    "{d} leaks full URLs (paths, query strings) to other sites.",
    "{d} divulgue les URL complètes (chemins, paramètres) aux autres sites.",
    "{d} gibt vollständige URLs (Pfade, Query-Strings) an andere Websites weiter.",
  ),
  "referrer-ok": l(
    "Referrer leaks are limited.",
    "Les fuites de Referer sont limitées.",
    "Referer-Lecks sind begrenzt.",
  ),
  "pp-missing": l(
    "Missing: disable features you do not use, e.g. camera=(), microphone=(), geolocation=().",
    "Absent : coupe les fonctions inutilisées, par ex. camera=(), microphone=(), geolocation=().",
    "Fehlt: Deaktiviere Funktionen, die du nicht nutzt, z. B. camera=(), microphone=(), geolocation=().",
  ),
  "pp-ok": l(
    "Browser features are restricted.",
    "Les fonctions du navigateur sont restreintes.",
    "Browserfunktionen sind eingeschränkt.",
  ),
  "fp-deprecated": l(
    "Feature-Policy is replaced by Permissions-Policy.",
    "Feature-Policy est remplacé par Permissions-Policy.",
    "Feature-Policy wurde durch Permissions-Policy ersetzt.",
  ),
  "coop-missing": l(
    "No Cross-Origin-Opener-Policy: same-origin isolates the page from other windows.",
    "Pas de Cross-Origin-Opener-Policy : same-origin isole la page des autres fenêtres.",
    "Keine Cross-Origin-Opener-Policy: same-origin isoliert die Seite von anderen Fenstern.",
  ),
  "coop-ok": l(
    "The window is isolated from cross-origin openers.",
    "La fenêtre est isolée des ouvreurs d'autres origines.",
    "Das Fenster ist von öffnenden Fenstern anderer Origins isoliert.",
  ),
  "xxss-enabled": l(
    "The old XSS filter is turned on ({d}); it can create leaks. Send 0 or remove it.",
    "Le vieux filtre XSS est activé ({d}) ; il peut créer des fuites. Envoie 0 ou retire-le.",
    "Der alte XSS-Filter ist eingeschaltet ({d}); er kann Lücken verursachen. Sende 0 oder entferne ihn.",
  ),
  "xxss-ok": l(
    "The old XSS filter is off.",
    "Le vieux filtre XSS est coupé.",
    "Der alte XSS-Filter ist ausgeschaltet.",
  ),
  "server-version": l(
    "Reveals a version: {d}",
    "Révèle une version : {d}",
    "Verrät eine Version: {d}",
  ),
  "powered-by": l(
    "Reveals the stack: {d}. Better removed.",
    "Révèle la pile technique : {d}. Mieux vaut le retirer.",
    "Verrät den Tech-Stack: {d}. Besser entfernen.",
  ),
  "cors-credentials-wildcard": l(
    "Allow-Origin * with Allow-Credentials true is invalid and a sign of a risky CORS setup.",
    "Allow-Origin * avec Allow-Credentials true est invalide et signe d'une config CORS risquée.",
    "Allow-Origin * mit Allow-Credentials true ist ungültig und ein Zeichen für eine riskante CORS-Konfiguration.",
  ),
  "cors-null": l(
    "Allow-Origin null can be abused from sandboxed iframes and local files.",
    "Allow-Origin null peut être exploité depuis des iframes sandbox et des fichiers locaux.",
    "Allow-Origin null kann aus Sandbox-iframes und lokalen Dateien missbraucht werden.",
  ),
  "cors-wildcard": l(
    "Any site may read this response (fine for public data only).",
    "Tout site peut lire cette réponse (acceptable seulement pour des données publiques).",
    "Jede Website darf diese Antwort lesen (nur für öffentliche Daten in Ordnung).",
  ),
  "cookie-secure": l(
    "Cookie {d} lacks Secure: it can travel over HTTP.",
    "Le cookie {d} n'a pas Secure : il peut passer en HTTP.",
    "Dem Cookie {d} fehlt Secure: Es kann über HTTP übertragen werden.",
  ),
  "cookie-httponly": l(
    "Cookie {d} lacks HttpOnly: JavaScript can read it (fine if intended).",
    "Le cookie {d} n'a pas HttpOnly : JavaScript peut le lire (normal si voulu).",
    "Dem Cookie {d} fehlt HttpOnly: JavaScript kann es lesen (in Ordnung, wenn gewollt).",
  ),
  "cookie-samesite": l(
    "Cookie {d} has no SameSite (browsers default to Lax).",
    "Le cookie {d} n'a pas SameSite (les navigateurs prennent Lax par défaut).",
    "Das Cookie {d} hat kein SameSite (Browser nehmen standardmäßig Lax).",
  ),
  "cookie-samesite-none": l(
    "Cookie {d} uses SameSite=None without Secure: browsers reject it.",
    "Le cookie {d} utilise SameSite=None sans Secure : les navigateurs le rejettent.",
    "Das Cookie {d} nutzt SameSite=None ohne Secure: Browser lehnen es ab.",
  ),
};

/** A finding's message in every language, with its detail filled in. */
export function findingMessage(f: Finding): L10n {
  const m = FINDING_MESSAGES[f.code];
  const d = f.detail ?? "";
  return { en: m.en.replace("{d}", d), fr: m.fr.replace("{d}", d), de: m.de.replace("{d}", d) };
}
