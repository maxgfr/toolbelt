/**
 * Reading a curl command: a shell-like tokenizer (quotes, $'…', escapes, line continuations
 * for sh, cmd and PowerShell) and the curl options that matter for an equivalent request.
 * Nothing is ever sent: this only builds a description of the request.
 */

export type TokenizeResult = { ok: true; tokens: string[] } | { ok: false; error: "quote" };

const ANSI: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  a: "\x07",
  b: "\b",
  e: "\x1b",
  E: "\x1b",
  f: "\f",
  v: "\v",
  "\\": "\\",
  "'": "'",
  '"': '"',
  "?": "?",
};

/** Splits a command line like a POSIX shell would (no expansion of variables or globs). */
export function tokenize(input: string): TokenizeResult {
  const s = input.replace(/\r\n?/g, "\n");
  const tokens: string[] = [];
  let cur = "";
  let has = false;
  let i = 0;
  const push = () => {
    if (has) tokens.push(cur);
    cur = "";
    has = false;
  };
  while (i < s.length) {
    const c = s[i] as string;
    // Line continuations: \ (sh), ^ (cmd), ` (PowerShell) at the end of a line.
    if ((c === "\\" || c === "^" || c === "`") && s[i + 1] === "\n") {
      i += 2;
      continue;
    }
    if (c === " " || c === "\t" || c === "\n") {
      push();
      i++;
      continue;
    }
    if (c === "#" && !has) {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if (c === "\\") {
      if (i + 1 < s.length) cur += s[i + 1];
      has = true;
      i += 2;
      continue;
    }
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      if (end < 0) return { ok: false, error: "quote" };
      cur += s.slice(i + 1, end);
      has = true;
      i = end + 1;
      continue;
    }
    if (c === "$" && s[i + 1] === "'") {
      i += 2;
      let closed = false;
      while (i < s.length) {
        const d = s[i] as string;
        if (d === "'") {
          closed = true;
          i++;
          break;
        }
        if (d === "\\" && i + 1 < s.length) {
          const e = s[i + 1] as string;
          if (e === "x") {
            const hex = /^[0-9a-fA-F]{1,2}/.exec(s.slice(i + 2))?.[0] ?? "";
            cur += hex ? String.fromCharCode(Number.parseInt(hex, 16)) : "\\x";
            i += 2 + hex.length;
          } else if (e === "u" || e === "U") {
            const hex =
              new RegExp(`^[0-9a-fA-F]{1,${e === "u" ? 4 : 8}}`).exec(s.slice(i + 2))?.[0] ?? "";
            const cp = hex ? Number.parseInt(hex, 16) : -1;
            cur += cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : `\\${e}`;
            i += 2 + hex.length;
          } else if (/[0-7]/.test(e)) {
            const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1))?.[0] ?? "0";
            cur += String.fromCharCode(Number.parseInt(oct, 8));
            i += 1 + oct.length;
          } else {
            cur += ANSI[e] ?? `\\${e}`;
            i += 2;
          }
          continue;
        }
        cur += d;
        i++;
      }
      if (!closed) return { ok: false, error: "quote" };
      has = true;
      continue;
    }
    if (c === '"') {
      i++;
      let closed = false;
      while (i < s.length) {
        const d = s[i] as string;
        if (d === '"') {
          closed = true;
          i++;
          break;
        }
        if (d === "\\" && i + 1 < s.length) {
          const e = s[i + 1] as string;
          if (e === "\n") i += 2;
          else if ('"\\$`'.includes(e)) {
            cur += e;
            i += 2;
          } else {
            cur += d;
            i++;
          }
          continue;
        }
        cur += d;
        i++;
      }
      if (!closed) return { ok: false, error: "quote" };
      has = true;
      continue;
    }
    cur += c;
    has = true;
    i++;
  }
  push();
  return { ok: true, tokens };
}

/* --- Options ---------------------------------------------------------------------- */

type Effect = "use" | "ignore" | "unsupported";

interface OptionDef {
  arg: boolean;
  effect: Effect;
}

const SHORT: Record<string, string> = {
  X: "request",
  H: "header",
  d: "data",
  F: "form",
  u: "user",
  b: "cookie",
  A: "user-agent",
  e: "referer",
  L: "location",
  k: "insecure",
  I: "head",
  G: "get",
  m: "max-time",
  x: "proxy",
  o: "output",
  O: "remote-name",
  T: "upload-file",
  c: "cookie-jar",
  E: "cert",
  r: "range",
  s: "silent",
  S: "show-error",
  v: "verbose",
  i: "include",
  f: "fail",
  g: "globoff",
  N: "no-buffer",
  "#": "progress-bar",
  "4": "ipv4",
  "6": "ipv6",
  "0": "http1.0",
  w: "write-out",
  D: "dump-header",
  U: "proxy-user",
  K: "config",
  J: "remote-header-name",
  j: "junk-session-cookies",
  q: "disable",
  Z: "parallel",
  z: "time-cond",
  C: "continue-at",
  Y: "speed-limit",
  y: "speed-time",
};

const USE_ARG = [
  "request",
  "header",
  "data",
  "data-ascii",
  "data-raw",
  "data-binary",
  "data-urlencode",
  "json",
  "form",
  "form-string",
  "user",
  "cookie",
  "user-agent",
  "referer",
  "url",
  "max-time",
  "connect-timeout",
  "proxy",
  "range",
  "oauth2-bearer",
  "url-query",
  "max-redirs",
];
const USE_FLAG = ["location", "insecure", "compressed", "head", "get", "basic", "location-trusted"];
const IGNORE_ARG = [
  "retry",
  "retry-delay",
  "retry-max-time",
  "keepalive-time",
  "expect100-timeout",
];
const IGNORE_FLAG = [
  "silent",
  "show-error",
  "verbose",
  "include",
  "fail",
  "fail-with-body",
  "globoff",
  "no-buffer",
  "progress-bar",
  "no-progress-meter",
  "ipv4",
  "ipv6",
  "http1.1",
  "http2",
  "tcp-nodelay",
  "styled-output",
  "disable",
  "create-dirs",
  "no-keepalive",
  "retry-all-errors",
  "retry-connrefused",
  "ssl-reqd",
  "tlsv1.2",
  "tlsv1.3",
  "tr-encoding",
  "path-as-is",
  "raw",
  "no-sessionid",
  "no-alpn",
  "no-npn",
  "parallel",
];
const UNSUPPORTED_ARG = [
  "output",
  "upload-file",
  "cookie-jar",
  "cert",
  "key",
  "cacert",
  "capath",
  "resolve",
  "connect-to",
  "interface",
  "limit-rate",
  "write-out",
  "dump-header",
  "unix-socket",
  "abstract-unix-socket",
  "aws-sigv4",
  "proxy-user",
  "config",
  "trace",
  "trace-ascii",
  "local-port",
  "ciphers",
  "pinnedpubkey",
  "socks5",
  "socks5-hostname",
  "preproxy",
  "noproxy",
  "cert-type",
  "key-type",
  "pass",
  "time-cond",
  "continue-at",
  "speed-limit",
  "speed-time",
  "variable",
  "tls-max",
  "dns-servers",
  "header-file",
];
const UNSUPPORTED_FLAG = [
  "remote-name",
  "remote-header-name",
  "digest",
  "ntlm",
  "negotiate",
  "anyauth",
  "http1.0",
  "http2-prior-knowledge",
  "http3",
  "http3-only",
  "junk-session-cookies",
  "post301",
  "post302",
  "post303",
  "next",
  "remote-name-all",
];

const OPTIONS = new Map<string, OptionDef>();
for (const n of USE_ARG) OPTIONS.set(n, { arg: true, effect: "use" });
for (const n of USE_FLAG) OPTIONS.set(n, { arg: false, effect: "use" });
for (const n of IGNORE_ARG) OPTIONS.set(n, { arg: true, effect: "ignore" });
for (const n of IGNORE_FLAG) OPTIONS.set(n, { arg: false, effect: "ignore" });
for (const n of UNSUPPORTED_ARG) OPTIONS.set(n, { arg: true, effect: "unsupported" });
for (const n of UNSUPPORTED_FLAG) OPTIONS.set(n, { arg: false, effect: "unsupported" });

/* --- Request model -------------------------------------------------------------------- */

export interface FormPart {
  name: string;
  value: string;
  /** Set for name=@file (a file upload) or name=<file (the file's text as the value). */
  file?: string;
  fileAsText?: boolean;
  type?: string;
  filename?: string;
}

export type Body =
  | { kind: "none" }
  | { kind: "text"; text: string }
  | { kind: "json"; text: string; value: unknown }
  | { kind: "urlencoded"; text: string; pairs: [string, string][] }
  | { kind: "file"; path: string }
  | { kind: "multipart"; parts: FormPart[] };

export type WarningCode =
  | "unknown-option"
  | "unsupported-option"
  | "missing-arg"
  | "file-data"
  | "multiple-urls"
  | "no-scheme"
  | "cookie-file"
  | "no-password";

export interface Warning {
  code: WarningCode;
  detail?: string;
}

export interface CurlRequest {
  url: string;
  method: string;
  headers: [string, string][];
  body: Body;
  auth: { user: string; pass: string } | null;
  follow: boolean;
  maxRedirects: number | null;
  insecure: boolean;
  compressed: boolean;
  timeout: number | null;
  connectTimeout: number | null;
  proxy: string | null;
  warnings: Warning[];
}

export type ParseResult =
  | { ok: true; request: CurlRequest }
  | { ok: false; error: "empty" | "quote" | "not-curl" | "no-url" };

type DataKind = "data" | "data-ascii" | "data-raw" | "data-binary" | "data-urlencode" | "json";

function hasHeader(headers: [string, string][], name: string): boolean {
  const n = name.toLowerCase();
  return headers.some(([k]) => k.toLowerCase() === n);
}

/** Decodes form-urlencoded text into pairs, or null if it does not look like one. */
export function parseUrlencoded(text: string): [string, string][] | null {
  if (!text || /\s/.test(text.replace(/\+/g, ""))) return null;
  const out: [string, string][] = [];
  for (const part of text.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    try {
      const dec = (x: string) => decodeURIComponent(x.replace(/\+/g, " "));
      out.push([dec(part.slice(0, eq)), dec(part.slice(eq + 1))]);
    } catch {
      return null;
    }
  }
  return out.length ? out : null;
}

function encodeData(spec: string, warnings: Warning[]): string {
  // --data-urlencode forms: content, =content, name=content, @file, name@file.
  const eq = spec.indexOf("=");
  const at = spec.indexOf("@");
  if (at >= 0 && (eq < 0 || at < eq)) {
    const name = spec.slice(0, at);
    const file = spec.slice(at + 1);
    warnings.push({ code: "file-data", detail: file });
    return `${name ? `${encodeURIComponent(name)}=` : ""}<${file}>`;
  }
  if (eq < 0) return encodeURIComponent(spec);
  const name = spec.slice(0, eq);
  const value = encodeURIComponent(spec.slice(eq + 1));
  return name ? `${name}=${value}` : value;
}

function parseFormPart(spec: string, literal: boolean): FormPart | null {
  const eq = spec.indexOf("=");
  if (eq <= 0) return null;
  const name = spec.slice(0, eq);
  let rest = spec.slice(eq + 1);
  if (literal) return { name, value: rest };
  const part: FormPart = { name, value: rest };
  // ;type=… and ;filename=… attributes after a file.
  if (rest.startsWith("@") || rest.startsWith("<")) {
    const attrs = rest.slice(1).split(";");
    const file = attrs.shift() ?? "";
    for (const a of attrs) {
      const [k = "", v = ""] = a.split("=");
      if (k.trim() === "type") part.type = v.trim();
      if (k.trim() === "filename") part.filename = v.trim().replace(/^"|"$/g, "");
    }
    part.file = file;
    if (rest.startsWith("<")) part.fileAsText = true;
    part.value = "";
    return part;
  }
  const typeAttr = /;type=([^;]+)$/.exec(rest);
  if (typeAttr) {
    part.type = typeAttr[1] ?? "";
    rest = rest.slice(0, typeAttr.index);
    part.value = rest.replace(/^"|"$/g, "");
  }
  return part;
}

/** Parses a curl command into a request description. */
export function parseCurl(input: string): ParseResult {
  if (!input.trim()) return { ok: false, error: "empty" };
  const t = tokenize(input);
  if (!t.ok) return { ok: false, error: "quote" };
  let tokens = t.tokens;
  if (tokens[0] === "$") tokens = tokens.slice(1);
  if (!tokens.length) return { ok: false, error: "empty" };
  const prog = (tokens[0] ?? "").toLowerCase().replace(/^.*[\\/]/, "");
  if (prog !== "curl" && prog !== "curl.exe") return { ok: false, error: "not-curl" };

  const warnings: Warning[] = [];
  const headers: [string, string][] = [];
  const data: { kind: DataKind; value: string }[] = [];
  const form: FormPart[] = [];
  const urls: string[] = [];
  const query: string[] = [];
  let method: string | null = null;
  let head = false;
  let get = false;
  let user: string | null = null;
  let follow = false;
  let maxRedirects: number | null = null;
  let insecure = false;
  let compressed = false;
  let timeout: number | null = null;
  let connectTimeout: number | null = null;
  let proxy: string | null = null;

  const apply = (name: string, value: string) => {
    switch (name) {
      case "request":
        method = value;
        break;
      case "header": {
        const colon = value.indexOf(":");
        if (colon > 0) {
          const v = value.slice(colon + 1).trim();
          if (v) headers.push([value.slice(0, colon).trim(), v]);
        } else if (value.endsWith(";")) headers.push([value.slice(0, -1).trim(), ""]);
        break;
      }
      case "data":
      case "data-ascii":
      case "data-raw":
      case "data-binary":
      case "data-urlencode":
      case "json":
        data.push({ kind: name, value });
        break;
      case "form":
      case "form-string": {
        const p = parseFormPart(value, name === "form-string");
        if (p) form.push(p);
        else warnings.push({ code: "unsupported-option", detail: `-F ${value}` });
        break;
      }
      case "user":
        user = value;
        break;
      case "cookie":
        if (value.includes("=")) headers.push(["Cookie", value]);
        else warnings.push({ code: "cookie-file", detail: value });
        break;
      case "user-agent":
        headers.push(["User-Agent", value]);
        break;
      case "referer":
        headers.push(["Referer", value.replace(/;auto$/, "")]);
        break;
      case "url":
        urls.push(value);
        break;
      case "max-time":
        timeout = Number(value) || null;
        break;
      case "connect-timeout":
        connectTimeout = Number(value) || null;
        break;
      case "proxy":
        proxy = value;
        break;
      case "range":
        headers.push(["Range", `bytes=${value}`]);
        break;
      case "oauth2-bearer":
        headers.push(["Authorization", `Bearer ${value}`]);
        break;
      case "url-query":
        query.push(value.startsWith("+") ? value.slice(1) : encodeData(value, warnings));
        break;
      case "max-redirs":
        maxRedirects = Number.isFinite(Number(value)) ? Number(value) : null;
        break;
      case "location":
      case "location-trusted":
        follow = true;
        break;
      case "insecure":
        insecure = true;
        break;
      case "compressed":
        compressed = true;
        break;
      case "head":
        head = true;
        break;
      case "get":
        get = true;
        break;
    }
  };

  const handle = (name: string, display: string, take: () => string | null): void => {
    const def = OPTIONS.get(name);
    if (!def) {
      warnings.push({ code: "unknown-option", detail: display });
      return;
    }
    let value = "";
    if (def.arg) {
      const v = take();
      if (v === null) {
        warnings.push({ code: "missing-arg", detail: display });
        return;
      }
      value = v;
    }
    if (def.effect === "unsupported")
      warnings.push({
        code: "unsupported-option",
        detail: def.arg ? `${display} ${value}` : display,
      });
    else if (def.effect === "use") apply(name, value);
  };

  let i = 1;
  let endOfOptions = false;
  const next = () => (i < tokens.length ? (tokens[i++] as string) : null);
  while (i < tokens.length) {
    const tok = tokens[i++] as string;
    if (endOfOptions || !tok.startsWith("-") || tok === "-") {
      urls.push(tok);
      continue;
    }
    if (tok === "--") {
      endOfOptions = true;
      continue;
    }
    if (tok.startsWith("--")) {
      let name = tok.slice(2);
      // --no-xxx turns a flag off; treat it as ignored when it is a known flag.
      if (
        name.startsWith("no-") &&
        OPTIONS.has(name.slice(3)) &&
        !OPTIONS.get(name.slice(3))?.arg
      ) {
        name = name.slice(3);
        if (name === "location") follow = false;
        else if (name === "insecure") insecure = false;
        else if (name === "compressed") compressed = false;
        continue;
      }
      handle(name, tok, next);
      continue;
    }
    // Short options, possibly combined (-sSL) or with an attached value (-XPOST).
    for (let j = 1; j < tok.length; j++) {
      const ch = tok[j] as string;
      const long = SHORT[ch];
      if (!long) {
        warnings.push({ code: "unknown-option", detail: `-${ch}` });
        continue;
      }
      const def = OPTIONS.get(long);
      if (def?.arg) {
        const attached = tok.slice(j + 1);
        handle(long, `-${ch}`, () => (attached ? attached : next()));
        break;
      }
      handle(long, `-${ch}`, () => null);
    }
  }

  if (!urls.length) return { ok: false, error: "no-url" };
  if (urls.length > 1) warnings.push({ code: "multiple-urls", detail: urls.slice(1).join(" ") });
  let url = urls[0] as string;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    warnings.push({ code: "no-scheme" });
    url = `http://${url}`;
  }

  // Body.
  let body: Body = { kind: "none" };
  const isJson = data.some((d) => d.kind === "json");
  if (form.length) {
    body = { kind: "multipart", parts: form };
    for (const p of form) if (p.file) warnings.push({ code: "file-data", detail: p.file });
  } else if (data.length) {
    const pieces: string[] = [];
    let soleFile: string | null = null;
    for (const d of data) {
      if (d.kind === "data-urlencode") {
        pieces.push(encodeData(d.value, warnings));
        continue;
      }
      if (d.kind !== "data-raw" && d.value.startsWith("@")) {
        const file = d.value.slice(1);
        warnings.push({ code: "file-data", detail: file });
        if (data.length === 1) soleFile = file;
        pieces.push(`<${file}>`);
        continue;
      }
      pieces.push(
        d.kind === "data" || d.kind === "data-ascii" ? d.value.replace(/[\r\n]/g, "") : d.value,
      );
    }
    const text = pieces.join(isJson ? "" : "&");
    if (get) {
      query.push(text);
    } else if (soleFile !== null) body = { kind: "file", path: soleFile };
    else body = { kind: "text", text };
  }
  if (isJson) {
    if (!hasHeader(headers, "content-type")) headers.push(["Content-Type", "application/json"]);
    if (!hasHeader(headers, "accept")) headers.push(["Accept", "application/json"]);
  } else if ((body.kind === "text" || body.kind === "file") && !hasHeader(headers, "content-type"))
    headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
  if (body.kind === "text") {
    const type = headers.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
    if (/json/i.test(type)) {
      try {
        body = { kind: "json", text: body.text, value: JSON.parse(body.text) };
      } catch {
        // Not valid JSON: kept as text.
      }
    } else if (/x-www-form-urlencoded/i.test(type)) {
      const pairs = parseUrlencoded(body.text);
      if (pairs) body = { kind: "urlencoded", text: body.text, pairs };
    }
  }
  if (query.length) url += (url.includes("?") ? "&" : "?") + query.join("&");

  let finalMethod: string = method ?? (head ? "HEAD" : body.kind !== "none" ? "POST" : "GET");
  if (get && !method) finalMethod = head ? "HEAD" : "GET";
  finalMethod = finalMethod.toUpperCase();

  let auth: CurlRequest["auth"] = null;
  if (user !== null) {
    const u = user as string;
    const colon = u.indexOf(":");
    if (colon < 0) warnings.push({ code: "no-password" });
    auth =
      colon < 0 ? { user: u, pass: "" } : { user: u.slice(0, colon), pass: u.slice(colon + 1) };
  }

  return {
    ok: true,
    request: {
      url,
      method: finalMethod,
      headers,
      body,
      auth,
      follow,
      maxRedirects,
      insecure,
      compressed,
      timeout,
      connectTimeout,
      proxy,
      warnings,
    },
  };
}
