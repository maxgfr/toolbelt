/**
 * Turning a parsed curl request into code: fetch, axios, Python requests, Go net/http, PHP
 * (ext-curl), wget and HTTPie. Generators are pure string builders; what a target cannot
 * express is returned as notes rather than written as comments.
 */
import { type L10n, l } from "../../../i18n";
import { shellQuote } from "../_shared";
import type { Body, CurlRequest, FormPart, Warning, WarningCode } from "./parse";

export { type CurlRequest, parseCurl, tokenize, type WarningCode } from "./parse";

export type Target = "fetch" | "axios" | "python" | "go" | "php" | "wget" | "httpie";

export const TARGETS: Target[] = ["fetch", "axios", "python", "go", "php", "wget", "httpie"];

export type NoteCode =
  | "insecure-unsupported"
  | "proxy-unsupported"
  | "multipart-unsupported"
  | "connect-timeout-unsupported"
  | "node-files";

export interface Generated {
  code: string;
  notes: NoteCode[];
}

/* --- Helpers ------------------------------------------------------------------------------- */

const q = (s: string) => JSON.stringify(s);

function indentLines(text: string, pad: string): string {
  return text
    .split("\n")
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join("\n");
}

/** A JS object key: bare when it is an identifier. */
function jsKey(k: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k);
}

function headerName(h: [string, string]): string {
  return h[0].toLowerCase();
}

function withoutHeaders(headers: [string, string][], ...names: string[]): [string, string][] {
  return headers.filter((h) => !names.includes(headerName(h)));
}

/** Drops a header only when it has exactly the value the target would send anyway. */
function withoutDefault(
  headers: [string, string][],
  name: string,
  value: RegExp,
): [string, string][] {
  return headers.filter((h) => !(headerName(h) === name && value.test(h[1].trim())));
}

function headersFor(req: CurlRequest): [string, string][] {
  // A multipart body sets its own Content-Type with the boundary.
  return req.body.kind === "multipart" ? withoutHeaders(req.headers, "content-type") : req.headers;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

/** Python literal for a JSON value. */
export function pyLiteral(v: unknown, indent = ""): string {
  const inner = `${indent}    `;
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "None";
  if (typeof v === "string") return q(v);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return `[\n${v.map((x) => `${inner}${pyLiteral(x, inner)},`).join("\n")}\n${indent}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>);
  if (!entries.length) return "{}";
  return `{\n${entries.map(([k, x]) => `${inner}${q(k)}: ${pyLiteral(x, inner)},`).join("\n")}\n${indent}}`;
}

function phpString(s: string): string {
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Go string literal: a raw `…` string for multi-line or quoted text when possible. */
function goString(s: string): string {
  if ((s.includes("\n") || s.includes('"')) && !/[`\r\\]/.test(s)) return `\`${s}\``;
  return q(s);
}

/* --- fetch & axios ----------------------------------------------------------------------- */

function jsFormLines(parts: FormPart[]): string[] {
  const lines = ["const form = new FormData();"];
  for (const p of parts) {
    if (p.file && !p.fileAsText)
      lines.push(
        `form.append(${q(p.name)}, await openAsBlob(${q(p.file)}${p.type ? `, { type: ${q(p.type)} }` : ""}), ${q(p.filename ?? fileName(p.file))});`,
      );
    else if (p.file) lines.push(`form.append(${q(p.name)}, await readFile(${q(p.file)}, "utf8"));`);
    else lines.push(`form.append(${q(p.name)}, ${q(p.value)});`);
  }
  return lines;
}

function jsImports(body: Body): string[] {
  const out: string[] = [];
  if (body.kind === "multipart") {
    if (body.parts.some((p) => p.file && !p.fileAsText))
      out.push('import { openAsBlob } from "node:fs";');
    if (body.parts.some((p) => p.fileAsText))
      out.push('import { readFile } from "node:fs/promises";');
  }
  if (body.kind === "file") out.push('import { readFile } from "node:fs/promises";');
  return out;
}

function jsHeaderObject(entries: [string, string][], pad: string): string {
  return `{\n${entries.map(([k, v]) => `${pad}  ${jsKey(k)}: ${v},`).join("\n")}\n${pad}}`;
}

export function toFetch(req: CurlRequest): Generated {
  const notes: NoteCode[] = [];
  const pre = jsImports(req.body);
  if (pre.length) notes.push("node-files");
  const lines: string[] = pre.length ? [...pre, ""] : [];
  if (req.body.kind === "multipart") lines.push(...jsFormLines(req.body.parts), "");
  const headers: [string, string][] = headersFor(req).map(([k, v]) => [k, q(v)]);
  if (req.auth)
    headers.push([
      "Authorization",
      `\`Basic \${btoa(${q(`${req.auth.user}:${req.auth.pass}`)})}\``,
    ]);
  const opts: string[] = [];
  if (req.method !== "GET") opts.push(`  method: ${q(req.method)},`);
  if (headers.length) opts.push(`  headers: ${jsHeaderObject(headers, "  ")},`);
  const b = req.body;
  if (b.kind === "json")
    opts.push(`  body: JSON.stringify(${indentLines(JSON.stringify(b.value, null, 2), "  ")}),`);
  else if (b.kind === "text" || b.kind === "urlencoded") opts.push(`  body: ${q(b.text)},`);
  else if (b.kind === "file") opts.push(`  body: await readFile(${q(b.path)}),`);
  else if (b.kind === "multipart") opts.push("  body: form,");
  if (req.timeout) opts.push(`  signal: AbortSignal.timeout(${Math.round(req.timeout * 1000)}),`);
  if (req.insecure) notes.push("insecure-unsupported");
  if (req.proxy) notes.push("proxy-unsupported");
  if (req.connectTimeout) notes.push("connect-timeout-unsupported");
  lines.push(
    opts.length
      ? `const response = await fetch(${q(req.url)}, {\n${opts.join("\n")}\n});`
      : `const response = await fetch(${q(req.url)});`,
  );
  lines.push(
    req.method === "HEAD"
      ? "console.log(response.status, Object.fromEntries(response.headers));"
      : "console.log(response.status, await response.text());",
  );
  return { code: lines.join("\n"), notes };
}

function axiosProxy(proxy: string): string | null {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(proxy) ? proxy : `http://${proxy}`);
    const parts = [
      `protocol: ${q(u.protocol.replace(":", ""))}`,
      `host: ${q(u.hostname)}`,
      `port: ${u.port || (u.protocol === "https:" ? 443 : 1080)}`,
    ];
    if (u.username)
      parts.push(
        `auth: { username: ${q(decodeURIComponent(u.username))}, password: ${q(decodeURIComponent(u.password))} }`,
      );
    return `{ ${parts.join(", ")} }`;
  } catch {
    return null;
  }
}

export function toAxios(req: CurlRequest): Generated {
  const notes: NoteCode[] = [];
  const pre = ['import axios from "axios";'];
  if (req.insecure) pre.push('import https from "node:https";');
  const files = jsImports(req.body);
  if (files.length) notes.push("node-files");
  const lines = [...pre, ...files, ""];
  if (req.body.kind === "multipart") lines.push(...jsFormLines(req.body.parts), "");
  const opts: string[] = [`  method: ${q(req.method.toLowerCase())},`, `  url: ${q(req.url)},`];
  const headers: [string, string][] = headersFor(req).map(([k, v]) => [k, q(v)]);
  if (headers.length) opts.push(`  headers: ${jsHeaderObject(headers, "  ")},`);
  if (req.auth)
    opts.push(`  auth: { username: ${q(req.auth.user)}, password: ${q(req.auth.pass)} },`);
  const b = req.body;
  if (b.kind === "json")
    opts.push(`  data: ${indentLines(JSON.stringify(b.value, null, 2), "  ")},`);
  else if (b.kind === "text" || b.kind === "urlencoded") opts.push(`  data: ${q(b.text)},`);
  else if (b.kind === "file") opts.push(`  data: await readFile(${q(b.path)}),`);
  else if (b.kind === "multipart") opts.push("  data: form,");
  if (req.timeout) opts.push(`  timeout: ${Math.round(req.timeout * 1000)},`);
  if (req.follow && req.maxRedirects !== null) opts.push(`  maxRedirects: ${req.maxRedirects},`);
  if (req.proxy) {
    const p = axiosProxy(req.proxy);
    if (p) opts.push(`  proxy: ${p},`);
    else notes.push("proxy-unsupported");
  }
  if (req.insecure) opts.push("  httpsAgent: new https.Agent({ rejectUnauthorized: false }),");
  if (req.connectTimeout) notes.push("connect-timeout-unsupported");
  lines.push(`const response = await axios({\n${opts.join("\n")}\n});`);
  lines.push(
    req.method === "HEAD"
      ? "console.log(response.status, response.headers);"
      : "console.log(response.status, response.data);",
  );
  return { code: lines.join("\n"), notes };
}

/* --- Python requests ------------------------------------------------------------------------ */

export function toPython(req: CurlRequest): Generated {
  const b = req.body;
  let headers = headersFor(req);
  const pre: string[] = [];
  const args: string[] = [q(req.url)];
  const after: string[] = [];
  if (b.kind === "json") {
    headers = withoutDefault(headers, "content-type", /^application\/json$/i);
    pre.push(`json_data = ${pyLiteral(b.value)}`);
  } else if (b.kind === "urlencoded") {
    headers = withoutDefault(headers, "content-type", /^application\/x-www-form-urlencoded$/i);
    const keys = b.pairs.map(([k]) => k);
    const value =
      new Set(keys).size === keys.length
        ? pyLiteral(Object.fromEntries(b.pairs))
        : `[\n${b.pairs.map(([k, v]) => `    (${q(k)}, ${q(v)}),`).join("\n")}\n]`;
    pre.push(`data = ${value}`);
  } else if (b.kind === "text") pre.push(`data = ${q(b.text)}`);
  else if (b.kind === "multipart") {
    const fields = b.parts.filter((p) => !p.file || p.fileAsText);
    const files = b.parts.filter((p) => p.file && !p.fileAsText);
    if (fields.length)
      pre.push(
        `data = {\n${fields.map((p) => `    ${q(p.name)}: ${p.file ? `open(${q(p.file)}).read()` : q(p.value)},`).join("\n")}\n}`,
      );
    if (files.length)
      pre.push(
        `files = {\n${files
          .map((p) => {
            const name = p.filename ?? fileName(p.file ?? "");
            const handle = `open(${q(p.file ?? "")}, "rb")`;
            return `    ${q(p.name)}: (${q(name)}, ${handle}${p.type ? `, ${q(p.type)}` : ""}),`;
          })
          .join("\n")}\n}`,
      );
  }
  if (headers.length)
    pre.unshift(`headers = {\n${headers.map(([k, v]) => `    ${q(k)}: ${q(v)},`).join("\n")}\n}`);

  if (headers.length) args.push("headers=headers");
  if (b.kind === "json") args.push("json=json_data");
  else if (b.kind === "urlencoded" || b.kind === "text") args.push("data=data");
  else if (b.kind === "file") args.push(`data=open(${q(b.path)}, "rb")`);
  else if (b.kind === "multipart") {
    if (b.parts.some((p) => !p.file || p.fileAsText)) args.push("data=data");
    if (b.parts.some((p) => p.file && !p.fileAsText)) args.push("files=files");
  }
  if (req.auth) args.push(`auth=(${q(req.auth.user)}, ${q(req.auth.pass)})`);
  if (req.timeout && req.connectTimeout)
    args.push(`timeout=(${req.connectTimeout}, ${req.timeout})`);
  else if (req.timeout || req.connectTimeout)
    args.push(`timeout=${req.timeout ?? req.connectTimeout}`);
  if (req.proxy) args.push(`proxies={"http": ${q(req.proxy)}, "https": ${q(req.proxy)}}`);
  if (req.insecure) args.push("verify=False");
  if (req.method === "HEAD" && req.follow) args.push("allow_redirects=True");

  const simple = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  const call = simple.includes(req.method)
    ? `requests.${req.method.toLowerCase()}(`
    : `requests.request(${q(req.method)}, `;
  const oneLine = `response = ${call}${args.join(", ")})`;
  const callText =
    oneLine.length <= 88
      ? oneLine
      : `response = ${call}\n${args.map((a) => `    ${a},`).join("\n")}\n)`;
  if (req.method === "HEAD") after.push("print(response.status_code)", "print(response.headers)");
  else after.push("print(response.status_code)", "print(response.text)");
  const lines = ["import requests", ""];
  if (pre.length) lines.push(...pre.flatMap((p) => [p, ""]));
  lines.push(callText, ...after);
  return { code: lines.join("\n"), notes: [] };
}

/* --- Go -------------------------------------------------------------------------------------- */

export function toGo(req: CurlRequest): Generated {
  const imports = new Set(["fmt", "io", "net/http"]);
  const body: string[] = [];
  const b = req.body;
  let reader = "nil";
  const check = ["if err != nil {", "\tpanic(err)", "}"];
  if (b.kind === "json" || b.kind === "text" || b.kind === "urlencoded") {
    imports.add("strings");
    reader = `strings.NewReader(${goString(b.text)})`;
  } else if (b.kind === "file") {
    imports.add("os");
    body.push(`file, err := os.Open(${q(b.path)})`, ...check, "defer file.Close()", "");
    reader = "file";
  } else if (b.kind === "multipart") {
    imports.add("bytes");
    imports.add("mime/multipart");
    body.push("var form bytes.Buffer", "writer := multipart.NewWriter(&form)");
    for (const p of b.parts) {
      if (!p.file) {
        body.push(`writer.WriteField(${q(p.name)}, ${q(p.value)})`);
        continue;
      }
      imports.add("os");
      const create = p.fileAsText
        ? `writer.CreateFormField(${q(p.name)})`
        : `writer.CreateFormFile(${q(p.name)}, ${q(p.filename ?? fileName(p.file))})`;
      body.push(
        "{",
        `\tf, err := os.Open(${q(p.file)})`,
        ...check.map((l) => `\t${l}`),
        `\tpart, err := ${create}`,
        ...check.map((l) => `\t${l}`),
        "\tio.Copy(part, f)",
        "\tf.Close()",
        "}",
      );
    }
    body.push("writer.Close()", "");
    reader = "&form";
  }
  body.push(`req, err := http.NewRequest(${q(req.method)}, ${q(req.url)}, ${reader})`, ...check);
  for (const [k, v] of headersFor(req)) {
    if (k.toLowerCase() === "host") body.push(`req.Host = ${q(v)}`);
    else body.push(`req.Header.Add(${q(k)}, ${q(v)})`);
  }
  if (b.kind === "multipart")
    body.push('req.Header.Set("Content-Type", writer.FormDataContentType())');
  if (req.auth) body.push(`req.SetBasicAuth(${q(req.auth.user)}, ${q(req.auth.pass)})`);
  body.push("");

  const transport: string[] = [];
  if (req.insecure) {
    imports.add("crypto/tls");
    transport.push("\tTLSClientConfig: &tls.Config{InsecureSkipVerify: true},");
  }
  if (req.proxy) {
    imports.add("net/url");
    body.push(`proxyURL, err := url.Parse(${q(req.proxy)})`, ...check);
    transport.push("\tProxy: http.ProxyURL(proxyURL),");
  }
  if (transport.length) body.push("transport := &http.Transport{", ...transport, "}");
  const client: string[] = [];
  if (transport.length) client.push("\tTransport: transport,");
  if (req.timeout) {
    imports.add("time");
    client.push(`\tTimeout: ${Math.round(req.timeout * 1000)} * time.Millisecond,`);
  }
  if (client.length) body.push("client := &http.Client{", ...client, "}");
  else body.push("client := &http.Client{}");
  body.push(
    "resp, err := client.Do(req)",
    ...check,
    "defer resp.Body.Close()",
    "",
    "data, err := io.ReadAll(resp.Body)",
    ...check,
    "fmt.Println(resp.Status)",
    "fmt.Println(string(data))",
  );
  const notes: NoteCode[] = req.connectTimeout ? ["connect-timeout-unsupported"] : [];
  const code = [
    "package main",
    "",
    "import (",
    ...[...imports].sort().map((i) => `\t${q(i)}`),
    ")",
    "",
    "func main() {",
    // Lines of a raw string literal are not indented: that would change its content.
    ...body.map((l) => (l ? `\t${l}` : "")),
    "}",
  ].join("\n");
  return { code, notes };
}

/* --- PHP -------------------------------------------------------------------------------------- */

export function toPhp(req: CurlRequest): Generated {
  const opts: string[] = [`CURLOPT_URL => ${phpString(req.url)}`, "CURLOPT_RETURNTRANSFER => true"];
  const b = req.body;
  if (req.method === "HEAD") opts.push("CURLOPT_NOBODY => true");
  else if (req.method === "POST" && b.kind === "none") opts.push("CURLOPT_POST => true");
  else if (req.method !== "GET" && req.method !== "POST")
    opts.push(`CURLOPT_CUSTOMREQUEST => ${phpString(req.method)}`);
  const headers = headersFor(req);
  if (headers.length)
    opts.push(
      `CURLOPT_HTTPHEADER => [\n${headers.map(([k, v]) => `        ${phpString(v ? `${k}: ${v}` : `${k};`)},`).join("\n")}\n    ]`,
    );
  if (b.kind === "json" || b.kind === "text" || b.kind === "urlencoded")
    opts.push(`CURLOPT_POSTFIELDS => ${phpString(b.text)}`);
  else if (b.kind === "file")
    opts.push(`CURLOPT_POSTFIELDS => file_get_contents(${phpString(b.path)})`);
  else if (b.kind === "multipart")
    opts.push(
      `CURLOPT_POSTFIELDS => [\n${b.parts
        .map((p) => {
          let v = phpString(p.value);
          if (p.file && p.fileAsText) v = `file_get_contents(${phpString(p.file)})`;
          else if (p.file) {
            const args = [phpString(p.file)];
            if (p.type || p.filename) args.push(p.type ? phpString(p.type) : "''");
            if (p.filename) args.push(phpString(p.filename));
            v = `new CURLFile(${args.join(", ")})`;
          }
          return `        ${phpString(p.name)} => ${v},`;
        })
        .join("\n")}\n    ]`,
    );
  if (req.auth) opts.push(`CURLOPT_USERPWD => ${phpString(`${req.auth.user}:${req.auth.pass}`)}`);
  if (req.follow) opts.push("CURLOPT_FOLLOWLOCATION => true");
  if (req.follow && req.maxRedirects !== null)
    opts.push(`CURLOPT_MAXREDIRS => ${req.maxRedirects}`);
  if (req.insecure) opts.push("CURLOPT_SSL_VERIFYPEER => false", "CURLOPT_SSL_VERIFYHOST => 0");
  if (req.compressed) opts.push("CURLOPT_ENCODING => ''");
  if (req.timeout)
    opts.push(
      Number.isInteger(req.timeout)
        ? `CURLOPT_TIMEOUT => ${req.timeout}`
        : `CURLOPT_TIMEOUT_MS => ${Math.round(req.timeout * 1000)}`,
    );
  if (req.connectTimeout)
    opts.push(
      Number.isInteger(req.connectTimeout)
        ? `CURLOPT_CONNECTTIMEOUT => ${req.connectTimeout}`
        : `CURLOPT_CONNECTTIMEOUT_MS => ${Math.round(req.connectTimeout * 1000)}`,
    );
  if (req.proxy) opts.push(`CURLOPT_PROXY => ${phpString(req.proxy)}`);
  const code = [
    "<?php",
    "",
    "$ch = curl_init();",
    "curl_setopt_array($ch, [",
    ...opts.map((o) => `    ${o},`),
    "]);",
    "",
    "$response = curl_exec($ch);",
    "if ($response === false) {",
    "    echo 'Error: ' . curl_error($ch);",
    "} else {",
    "    echo $response;",
    "}",
    "curl_close($ch);",
  ].join("\n");
  return { code, notes: [] };
}

/* --- wget ------------------------------------------------------------------------------------- */

export function toWget(req: CurlRequest): Generated {
  const notes: NoteCode[] = [];
  const args: string[] = ["wget", "-qO-"];
  const b = req.body;
  const hasBody = b.kind !== "none" && b.kind !== "multipart";
  if (b.kind === "multipart") notes.push("multipart-unsupported");
  if (req.method === "POST" && hasBody) {
    args.push(
      b.kind === "file"
        ? `--post-file=${shellQuote(b.path)}`
        : `--post-data=${shellQuote("text" in b ? b.text : "")}`,
    );
  } else {
    if (req.method !== "GET") args.push(`--method=${req.method}`);
    if (hasBody)
      args.push(
        b.kind === "file"
          ? `--body-file=${shellQuote(b.path)}`
          : `--body-data=${shellQuote("text" in b ? b.text : "")}`,
      );
  }
  for (const [k, v] of headersFor(req)) args.push(`--header=${shellQuote(`${k}: ${v}`)}`);
  if (req.auth)
    args.push(
      `--user=${shellQuote(req.auth.user)}`,
      `--password=${shellQuote(req.auth.pass)}`,
      "--auth-no-challenge",
    );
  if (req.follow && req.maxRedirects !== null) args.push(`--max-redirect=${req.maxRedirects}`);
  if (req.insecure) args.push("--no-check-certificate");
  if (req.compressed) args.push("--compression=auto");
  if (req.timeout) args.push(`--timeout=${req.timeout}`);
  if (req.connectTimeout) args.push(`--connect-timeout=${req.connectTimeout}`);
  if (req.proxy)
    args.push(
      "-e use_proxy=yes",
      `-e ${shellQuote(`http_proxy=${req.proxy}`)}`,
      `-e ${shellQuote(`https_proxy=${req.proxy}`)}`,
    );
  args.push(shellQuote(req.url));
  return { code: joinShell(args), notes };
}

function joinShell(args: string[]): string {
  const line = args.join(" ");
  if (line.length <= 80) return line;
  const [first, ...rest] = args;
  return [first, ...rest.map((a) => `  ${a}`)].join(" \\\n");
}

/* --- HTTPie ------------------------------------------------------------------------------------- */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function toHttpie(req: CurlRequest): Generated {
  const b = req.body;
  const opts: string[] = ["http"];
  const items: string[] = [];
  let headers = headersFor(req);
  let stdin: string | null = null;
  if (b.kind === "json" && isPlainObject(b.value)) {
    headers = withoutDefault(headers, "content-type", /^application\/json$/i);
    headers = withoutDefault(headers, "accept", /^application\/json$/i);
    for (const [k, v] of Object.entries(b.value))
      items.push(
        typeof v === "string" ? shellQuote(`${k}=${v}`) : shellQuote(`${k}:=${JSON.stringify(v)}`),
      );
  } else if (b.kind === "urlencoded") {
    headers = withoutDefault(headers, "content-type", /^application\/x-www-form-urlencoded$/i);
    opts.push("--form");
    for (const [k, v] of b.pairs) items.push(shellQuote(`${k}=${v}`));
  } else if (b.kind === "multipart") {
    opts.push("--multipart");
    for (const p of b.parts) {
      if (p.file && !p.fileAsText)
        items.push(shellQuote(`${p.name}@${p.file}${p.type ? `;type=${p.type}` : ""}`));
      else if (p.file) items.push(shellQuote(`${p.name}=@${p.file}`));
      else items.push(shellQuote(`${p.name}=${p.value}`));
    }
  } else if (b.kind === "json" || b.kind === "text") opts.push(`--raw=${shellQuote(b.text)}`);
  else if (b.kind === "file") stdin = b.path;
  if (req.follow) opts.push("--follow");
  if (req.follow && req.maxRedirects !== null) opts.push(`--max-redirects=${req.maxRedirects}`);
  if (req.insecure) opts.push("--verify=no");
  if (req.timeout) opts.push(`--timeout=${req.timeout}`);
  if (req.proxy)
    opts.push(
      `--proxy=${shellQuote(`http:${req.proxy}`)}`,
      `--proxy=${shellQuote(`https:${req.proxy}`)}`,
    );
  if (req.auth) opts.push(`-a ${shellQuote(`${req.auth.user}:${req.auth.pass}`)}`);
  const notes: NoteCode[] = req.connectTimeout ? ["connect-timeout-unsupported"] : [];
  const hdr = headers.map(([k, v]) => shellQuote(v ? `${k}:${v}` : `${k};`));
  const args = [...opts, req.method, shellQuote(req.url), ...hdr, ...items];
  if (stdin) args.push(`< ${shellQuote(stdin)}`);
  return { code: joinShell(args), notes };
}

export const GENERATORS: Record<Target, (req: CurlRequest) => Generated> = {
  fetch: toFetch,
  axios: toAxios,
  python: toPython,
  go: toGo,
  php: toPhp,
  wget: toWget,
  httpie: toHttpie,
};

/* --- Messages ------------------------------------------------------------------ */

/** Why a command could not be read (the "empty" case shows nothing). */
export const PARSE_ERRORS: Record<"quote" | "not-curl" | "no-url", L10n> = {
  quote: l(
    "A quote is not closed.",
    "Un guillemet n'est pas fermé.",
    "Ein Anführungszeichen ist nicht geschlossen.",
  ),
  "not-curl": l(
    "The command must start with curl.",
    "La commande doit commencer par curl.",
    "Der Befehl muss mit curl beginnen.",
  ),
  "no-url": l(
    "No URL found in the command.",
    "Aucune URL trouvée dans la commande.",
    "Keine URL im Befehl gefunden.",
  ),
};

/** What a parse warning means; `{d}` stands for its detail. */
export const WARNING_MESSAGES: Record<WarningCode, L10n> = {
  "unknown-option": l(
    "Unknown option ignored: {d}",
    "Option inconnue ignorée : {d}",
    "Unbekannte Option ignoriert: {d}",
  ),
  "unsupported-option": l(
    "Option not converted: {d}",
    "Option non convertie : {d}",
    "Option nicht umgewandelt: {d}",
  ),
  "missing-arg": l(
    "Option without its value: {d}",
    "Option sans sa valeur : {d}",
    "Option ohne Wert: {d}",
  ),
  "file-data": l(
    "Reads the local file {d}: the code refers to it by path.",
    "Lit le fichier local {d} : le code y fait référence par son chemin.",
    "Liest die lokale Datei {d}: Der Code verweist über ihren Pfad darauf.",
  ),
  "multiple-urls": l(
    "Only the first URL is used; ignored: {d}",
    "Seule la première URL est utilisée ; ignorées : {d}",
    "Nur die erste URL wird verwendet; ignoriert: {d}",
  ),
  "no-scheme": l(
    "No scheme in the URL: http:// assumed, like curl.",
    "Pas de schéma dans l'URL : http:// supposé, comme curl.",
    "Kein Schema in der URL: http:// angenommen, wie bei curl.",
  ),
  "cookie-file": l(
    "-b {d} reads a cookie file: not converted.",
    "-b {d} lit un fichier de cookies : non converti.",
    "-b {d} liest eine Cookie-Datei: nicht umgewandelt.",
  ),
  "no-password": l(
    "-u without a password: curl would prompt for it; an empty one is used.",
    "-u sans mot de passe : curl le demanderait ; un mot de passe vide est utilisé.",
    "-u ohne Passwort: curl würde danach fragen; es wird ein leeres verwendet.",
  ),
};

/** What a target could not express. */
export const NOTE_MESSAGES: Record<NoteCode, L10n> = {
  "insecure-unsupported": l(
    "fetch cannot skip certificate checks (-k); in Node, use NODE_TLS_REJECT_UNAUTHORIZED=0 only for testing.",
    "fetch ne peut pas ignorer la vérification des certificats (-k) ; en Node, NODE_TLS_REJECT_UNAUTHORIZED=0 seulement pour tester.",
    "fetch kann die Zertifikatsprüfung nicht abschalten (-k); in Node NODE_TLS_REJECT_UNAUTHORIZED=0 nur zum Testen verwenden.",
  ),
  "proxy-unsupported": l(
    "The proxy (-x) is not set: fetch has no proxy option.",
    "Le proxy (-x) n'est pas réglé : fetch n'a pas d'option de proxy.",
    "Der Proxy (-x) ist nicht gesetzt: fetch hat keine Proxy-Option.",
  ),
  "multipart-unsupported": l(
    "wget cannot send multipart forms (-F): the body is left out.",
    "wget ne sait pas envoyer de formulaires multipart (-F) : le corps est omis.",
    "wget kann keine Multipart-Formulare senden (-F): Der Body wird weggelassen.",
  ),
  "connect-timeout-unsupported": l(
    "--connect-timeout has no direct equivalent here and is left out.",
    "--connect-timeout n'a pas d'équivalent direct ici et est omis.",
    "--connect-timeout hat hier keine direkte Entsprechung und wird weggelassen.",
  ),
  "node-files": l(
    "Reading local files needs Node.js (node:fs).",
    "La lecture de fichiers locaux nécessite Node.js (node:fs).",
    "Lokale Dateien zu lesen erfordert Node.js (node:fs).",
  ),
};

/** A parse warning's message in every language, with its detail filled in. */
export function warningMessage(w: Warning): L10n {
  const m = WARNING_MESSAGES[w.code];
  const d = w.detail ?? "";
  return { en: m.en.replace("{d}", d), fr: m.fr.replace("{d}", d), de: m.de.replace("{d}", d) };
}
