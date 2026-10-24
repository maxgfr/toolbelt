/**
 * HTTP headers: searching the reference, and checking pasted response headers against the
 * usual security recommendations (HSTS, CSP, framing, nosniff, referrer, permissions, COOP,
 * cookies, CORS, version banners).
 */
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
