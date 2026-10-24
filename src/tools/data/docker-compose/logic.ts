/**
 * `docker run …` → docker-compose.yml. A shell-like tokenizer (quotes, escapes, line
 * continuations with \ ` or ^, comments, several commands separated by newlines, ; && ||),
 * then a docker run option parser (long and short flags, clustered short flags, --flag=value),
 * then a compose service per command. Flags with no compose equivalent are reported.
 */
import { Document, isMap, isScalar, isSeq } from "yaml";

/* --- Tokenizer ------------------------------------------------------------ */

export type Tokenized = { ok: true; commands: string[][] } | { ok: false; line: number };

/** Splits shell text into commands of words. Variables ($X) are kept as written. */
export function tokenize(src: string): Tokenized {
  const commands: string[][] = [];
  let words: string[] = [];
  let word: string | null = null;
  let line = 1;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  const s = src.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    const next = s[i + 1];
    // Line continuations: bash \, PowerShell `, cmd ^ (followed by spaces then a newline).
    if (c === "\\" || c === "`" || c === "^") {
      const m = /^[ \t]*\n/.exec(s.slice(i + 1));
      if (m) {
        i += m[0].length;
        line++;
        continue;
      }
    }
    if (c === "\n") {
      line++;
      endCommand();
    } else if (c === " " || c === "\t") endWord();
    else if (c === ";") endCommand();
    else if (c === "&" || c === "|") {
      if (next === c) i++;
      endCommand();
    } else if (c === "#" && word === null) {
      while (i + 1 < s.length && s[i + 1] !== "\n") i++;
    } else if (c === "'") {
      const end = s.indexOf("'", i + 1);
      if (end < 0) return { ok: false, line };
      const body = s.slice(i + 1, end);
      line += body.split("\n").length - 1;
      word = (word ?? "") + body;
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      let body = "";
      for (; j < s.length && s[j] !== '"'; j++) {
        const d = s[j] as string;
        if (d === "\\" && j + 1 < s.length) {
          const e = s[j + 1] as string;
          if (e === "\n") {
            j++;
            line++;
            continue;
          }
          if ('"\\$`'.includes(e)) {
            body += e;
            j++;
            continue;
          }
        }
        if (d === "\n") line++;
        body += d;
      }
      if (j >= s.length) return { ok: false, line };
      word = (word ?? "") + body;
      i = j;
    } else if (c === "\\" && next !== undefined) {
      word = (word ?? "") + next;
      i++;
    } else word = (word ?? "") + c;
  }
  endCommand();
  return { ok: true, commands };
}

/* --- docker run options --------------------------------------------------- */

/** Flags that take a value (long names; short aliases below). */
const WITH_VALUE = new Set(
  "add-host annotation attach blkio-weight blkio-weight-device cap-add cap-drop cgroup-parent cgroupns cidfile cpu-period cpu-quota cpu-rt-period cpu-rt-runtime cpu-shares cpus cpuset-cpus cpuset-mems detach-keys device device-cgroup-rule device-read-bps device-read-iops device-write-bps device-write-iops dns dns-option dns-opt dns-search domainname entrypoint env env-file expose gpus group-add health-cmd health-interval health-retries health-start-period health-start-interval health-timeout hostname ip ip6 ipc isolation kernel-memory label label-file link link-local-ip log-driver log-opt mac-address memory memory-reservation memory-swap memory-swappiness mount name network net network-alias net-alias oom-score-adj pid pids-limit platform publish pull restart runtime security-opt shm-size stop-signal stop-timeout storage-opt sysctl tmpfs ulimit user userns uts volume volume-driver volumes-from workdir".split(
    " ",
  ),
);

const SHORT: Record<string, string> = {
  a: "attach",
  c: "cpu-shares",
  d: "detach",
  e: "env",
  h: "hostname",
  i: "interactive",
  l: "label",
  m: "memory",
  p: "publish",
  P: "publish-all",
  t: "tty",
  u: "user",
  v: "volume",
  w: "workdir",
  q: "quiet",
};

/** Flags dropped on purpose (no compose meaning, or the default already). */
const IGNORED = new Set(["detach", "quiet", "sig-proxy", "help"]);

export interface Option {
  name: string;
  value: string | null;
}

export interface ParsedRun {
  options: Option[];
  image: string | null;
  args: string[];
  /** Flags this parser does not know (with the value it guessed they take). */
  unknown: string[];
}

/** Parses the words after `docker run`. */
export function parseRun(words: string[]): ParsedRun {
  const options: Option[] = [];
  const unknown: string[] = [];
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i] as string;
    if (w === "--") {
      i++;
      break;
    }
    if (!w.startsWith("-") || w === "-") break;
    if (w.startsWith("--")) {
      const eq = w.indexOf("=");
      const name = eq < 0 ? w.slice(2) : w.slice(2, eq);
      if (eq >= 0) {
        options.push({ name, value: w.slice(eq + 1) });
        if (!WITH_VALUE.has(name) && !KNOWN_BOOL.has(name)) unknown.push(`--${name}`);
        continue;
      }
      if (WITH_VALUE.has(name)) {
        options.push({ name, value: words[i + 1] ?? "" });
        i++;
      } else if (KNOWN_BOOL.has(name)) options.push({ name, value: null });
      else {
        unknown.push(`--${name}`);
        // Guess: it takes a value when one follows and an image is still left after it.
        const nextWord = words[i + 1];
        const takes = nextWord !== undefined && !nextWord.startsWith("-") && i + 2 < words.length;
        options.push({ name, value: takes ? nextWord : null });
        if (takes) i++;
      }
      continue;
    }
    // Short flags, possibly clustered: -it, -dp 80:80, -p8080:80, -e=A=1.
    for (let k = 1; k < w.length; k++) {
      const ch = w[k] as string;
      const name = SHORT[ch];
      if (!name) {
        unknown.push(`-${ch}`);
        continue;
      }
      if (WITH_VALUE.has(name)) {
        const rest = w.slice(k + 1).replace(/^=/, "");
        if (rest) options.push({ name, value: rest });
        else {
          options.push({ name, value: words[i + 1] ?? "" });
          i++;
        }
        break;
      }
      options.push({ name, value: null });
    }
  }
  const image = words[i] ?? null;
  return { options, image, args: words.slice(i + 1), unknown };
}

const KNOWN_BOOL = new Set([
  "detach",
  "interactive",
  "tty",
  "rm",
  "privileged",
  "init",
  "read-only",
  "publish-all",
  "no-healthcheck",
  "oom-kill-disable",
  "sig-proxy",
  "quiet",
  "help",
  "use-api-socket",
]);

/* --- Compose -------------------------------------------------------------- */

export type WarningCode = "unsupported" | "notRun" | "noImage" | "publishAll";

export interface Warning {
  code: WarningCode;
  /** The flag or the command concerned. */
  subject: string;
  service?: string;
}

export interface ComposeOptions {
  /** Comment written above a service started with --rm. */
  rmNote: string;
}

export type ComposeResult =
  | { ok: true; yaml: string; services: string[]; warnings: Warning[] }
  | { ok: false; line: number };

const DEFAULT_RM_NOTE =
  '--rm: compose keeps stopped containers; for one-off runs use "docker compose run --rm SERVICE".';

/** "ghcr.io/acme/web-app:1.2@sha256:…" → "web-app". */
export function serviceName(image: string): string {
  const last = image.split("@")[0]?.split("/").pop() ?? "";
  const base = last.split(":")[0] ?? "";
  return slug(base) || "app";
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[^a-z0-9]+|-+$/g, "");
}

/** Whether a volume source is a named volume (not a path). */
function isNamedVolume(src: string): boolean {
  return /^[A-Za-z0-9][\w.-]*$/.test(src);
}

const NETWORK_MODES = /^(host|bridge|none|default|container:.+|service:.+)$/;

type Obj = Record<string, unknown>;

function push(o: Obj, key: string, v: unknown) {
  const list = (o[key] as unknown[] | undefined) ?? [];
  list.push(v);
  o[key] = list;
}

function sub(o: Obj, key: string): Obj {
  const cur = o[key];
  if (cur && typeof cur === "object" && !Array.isArray(cur)) return cur as Obj;
  const fresh: Obj = {};
  o[key] = fresh;
  return fresh;
}

/** "nofile=1024:2048" → ["nofile", {soft: 1024, hard: 2048}]; "nproc=65535" → ["nproc", 65535]. */
function ulimit(v: string): [string, unknown] {
  const [name = "", limits = ""] = v.split("=");
  const [soft = "", hard] = limits.split(":");
  const n = (x: string) => (/^-?\d+$/.test(x) ? Number(x) : x);
  return [name, hard === undefined ? n(soft) : { soft: n(soft), hard: n(hard) }];
}

/** --mount type=bind,source=/a,target=/b,readonly → long volume syntax. */
function mount(v: string): Obj {
  const out: Obj = {};
  for (const part of v.split(",")) {
    const [k = "", ...rest] = part.split("=");
    const val = rest.join("=");
    const key = k.trim();
    if (key === "type") out.type = val;
    else if (key === "source" || key === "src") out.source = val;
    else if (key === "target" || key === "destination" || key === "dst") out.target = val;
    else if (key === "readonly" || key === "ro")
      out.read_only = val === "" || val === "true" || val === "1";
    else if (key === "bind-propagation") sub(out, "bind").propagation = val;
    else if (key === "volume-nocopy") sub(out, "volume").nocopy = val === "" || val === "true";
    else if (key === "tmpfs-size") sub(out, "tmpfs").size = /^\d+$/.test(val) ? Number(val) : val;
    else if (key) out[key.replace(/-/g, "_")] = val || true;
  }
  if (!out.type) out.type = "volume";
  return out;
}

function duration(v: string): string {
  return /^\d+$/.test(v) ? `${v}s` : v;
}

interface Built {
  name: string;
  service: Obj;
  rm: boolean;
  volumes: string[];
  networks: string[];
}

function buildService(run: ParsedRun, warn: (code: WarningCode, subject: string) => void): Built {
  const s: Obj = {};
  const named: string[] = [];
  const networks: string[] = [];
  let rm = false;
  let containerName: string | null = null;
  if (run.image) s.image = run.image;
  for (const { name, value } of run.options) {
    const v = value ?? "";
    switch (name) {
      case "name":
        containerName = v;
        s.container_name = v;
        break;
      case "publish":
        push(s, "ports", v);
        break;
      case "publish-all":
        warn("publishAll", "-P");
        break;
      case "volume": {
        push(s, "volumes", v);
        const src = v.split(":")[0] ?? "";
        const windowsPath = /^[A-Za-z]:[\\/]/.test(v);
        if (v.includes(":") && !windowsPath && isNamedVolume(src)) named.push(src);
        break;
      }
      case "mount": {
        const m = mount(v);
        push(s, "volumes", m);
        if (m.type === "volume" && typeof m.source === "string" && isNamedVolume(m.source))
          named.push(m.source);
        break;
      }
      case "tmpfs":
        push(s, "tmpfs", v);
        break;
      case "env":
        push(s, "environment", v);
        break;
      case "env-file":
        push(s, "env_file", v);
        break;
      case "label":
        push(s, "labels", v);
        break;
      case "restart":
        s.restart = v;
        break;
      case "network":
      case "net":
        if (NETWORK_MODES.test(v)) s.network_mode = v;
        else {
          push(s, "networks", v);
          networks.push(v);
        }
        break;
      case "network-alias":
      case "net-alias":
        warn("unsupported", `--${name}`);
        break;
      case "entrypoint":
        s.entrypoint = v;
        break;
      case "interactive":
        s.stdin_open = true;
        break;
      case "tty":
        s.tty = true;
        break;
      case "rm":
        rm = true;
        break;
      case "workdir":
        s.working_dir = v;
        break;
      case "user":
        s.user = v;
        break;
      case "hostname":
        s.hostname = v;
        break;
      case "domainname":
        s.domainname = v;
        break;
      case "privileged":
        s.privileged = true;
        break;
      case "init":
        s.init = true;
        break;
      case "read-only":
        s.read_only = true;
        break;
      case "cap-add":
        push(s, "cap_add", v);
        break;
      case "cap-drop":
        push(s, "cap_drop", v);
        break;
      case "device":
        push(s, "devices", v);
        break;
      case "dns":
        push(s, "dns", v);
        break;
      case "dns-search":
        push(s, "dns_search", v);
        break;
      case "dns-option":
      case "dns-opt":
        push(s, "dns_opt", v);
        break;
      case "add-host":
        push(s, "extra_hosts", v);
        break;
      case "expose":
        push(s, "expose", v);
        break;
      case "link":
        push(s, "links", v);
        break;
      case "volumes-from":
        push(s, "volumes_from", v);
        break;
      case "group-add":
        push(s, "group_add", v);
        break;
      case "security-opt":
        push(s, "security_opt", v);
        break;
      case "sysctl":
        push(s, "sysctls", v);
        break;
      case "ulimit": {
        const [k, lim] = ulimit(v);
        sub(s, "ulimits")[k] = lim;
        break;
      }
      case "memory":
        s.mem_limit = v;
        break;
      case "memory-reservation":
        s.mem_reservation = v;
        break;
      case "memory-swap":
        s.memswap_limit = v;
        break;
      case "cpus":
        s.cpus = /^\d+(\.\d+)?$/.test(v) ? Number(v) : v;
        break;
      case "cpu-shares":
        s.cpu_shares = /^\d+$/.test(v) ? Number(v) : v;
        break;
      case "cpuset-cpus":
        s.cpuset = v;
        break;
      case "pids-limit":
        s.pids_limit = /^-?\d+$/.test(v) ? Number(v) : v;
        break;
      case "shm-size":
        s.shm_size = v;
        break;
      case "oom-kill-disable":
        s.oom_kill_disable = true;
        break;
      case "platform":
        s.platform = v;
        break;
      case "pull":
        s.pull_policy = v;
        break;
      case "runtime":
        s.runtime = v;
        break;
      case "ipc":
        s.ipc = v;
        break;
      case "pid":
        s.pid = v;
        break;
      case "userns":
        s.userns_mode = v;
        break;
      case "uts":
        s.uts = v;
        break;
      case "mac-address":
        s.mac_address = v;
        break;
      case "stop-signal":
        s.stop_signal = v;
        break;
      case "stop-timeout":
        s.stop_grace_period = duration(v);
        break;
      case "storage-opt": {
        const [k = "", ...rest] = v.split("=");
        sub(s, "storage_opt")[k] = rest.join("=");
        break;
      }
      case "log-driver":
        sub(s, "logging").driver = v;
        break;
      case "log-opt": {
        const [k = "", ...rest] = v.split("=");
        sub(sub(s, "logging"), "options")[k] = rest.join("=");
        break;
      }
      case "health-cmd":
        sub(s, "healthcheck").test = ["CMD-SHELL", v];
        break;
      case "health-interval":
        sub(s, "healthcheck").interval = v;
        break;
      case "health-timeout":
        sub(s, "healthcheck").timeout = v;
        break;
      case "health-retries":
        sub(s, "healthcheck").retries = /^\d+$/.test(v) ? Number(v) : v;
        break;
      case "health-start-period":
        sub(s, "healthcheck").start_period = v;
        break;
      case "health-start-interval":
        sub(s, "healthcheck").start_interval = v;
        break;
      case "no-healthcheck":
        sub(s, "healthcheck").disable = true;
        break;
      case "gpus": {
        const count = v === "all" ? "all" : /^\d+$/.test(v) ? Number(v) : null;
        const dev: Obj = { driver: "nvidia" };
        if (count !== null) dev.count = count;
        else
          dev.device_ids = v
            .replace(/^"?device=/, "")
            .replace(/"$/, "")
            .split(",");
        dev.capabilities = ["gpu"];
        sub(sub(sub(s, "deploy"), "resources"), "reservations").devices = [dev];
        break;
      }
      case "annotation": {
        const [k = "", ...rest] = v.split("=");
        sub(s, "annotations")[k] = rest.join("=");
        break;
      }
      default:
        if (!IGNORED.has(name)) warn("unsupported", `--${name}`);
    }
  }
  if (run.args.length) s.command = run.args;
  const base = containerName ? slug(containerName) : "";
  return {
    name: base || serviceName(run.image ?? ""),
    service: s,
    rm,
    volumes: named,
    networks,
  };
}

const RUNNERS = new Set(["docker", "podman", "nerdctl"]);

/** The words after "docker run" / "docker container run" (after sudo, env), or null. */
export function runArgs(words: string[]): string[] | null {
  let i = 0;
  while (words[i] === "sudo" || /^[A-Za-z_]\w*=/.test(words[i] ?? "")) i++;
  if (!RUNNERS.has(words[i] ?? "")) return null;
  i++;
  if (words[i] === "container") i++;
  if (words[i] !== "run") return null;
  return words.slice(i + 1);
}

/** Converts one or more docker run commands to a compose file. */
export function toCompose(src: string, o: Partial<ComposeOptions> = {}): ComposeResult {
  const tk = tokenize(src);
  if (!tk.ok) return tk;
  const warnings: Warning[] = [];
  const services: Obj = {};
  const rmNames: string[] = [];
  const volumes = new Set<string>();
  const networks = new Set<string>();
  const used = new Set<string>();
  for (const words of tk.commands) {
    const args = runArgs(words);
    if (!args) {
      warnings.push({ code: "notRun", subject: words.join(" ").slice(0, 80) });
      continue;
    }
    const run = parseRun(args);
    const pending: Warning[] = run.unknown.map((f) => ({ code: "unsupported", subject: f }));
    if (!run.image) {
      warnings.push({ code: "noImage", subject: words.join(" ").slice(0, 80) });
      continue;
    }
    const built = buildService(run, (code, subject) => pending.push({ code, subject }));
    let name = built.name;
    for (let n = 2; used.has(name); n++) name = `${built.name}-${n}`;
    used.add(name);
    services[name] = built.service;
    if (built.rm) rmNames.push(name);
    for (const v of built.volumes) volumes.add(v);
    for (const n of built.networks) networks.add(n);
    // The same unknown flag is reported once per service.
    const seen = new Set<string>();
    for (const w of pending) {
      const key = `${w.code}:${w.subject}`;
      if (seen.has(key)) continue;
      seen.add(key);
      warnings.push({ ...w, service: name });
    }
  }
  const names = Object.keys(services);
  if (!names.length) return { ok: true, yaml: "", services: [], warnings };

  const root: Obj = { services };
  if (volumes.size) root.volumes = Object.fromEntries([...volumes].map((v) => [v, {}]));
  if (networks.size)
    root.networks = Object.fromEntries([...networks].map((n) => [n, { external: true }]));
  const doc = new Document(root);
  const svcMap = doc.get("services", true);
  if (isMap(svcMap))
    for (const pair of svcMap.items) {
      if (!isScalar(pair.key) || !rmNames.includes(String(pair.key.value))) continue;
      pair.key.commentBefore = ` ${(o.rmNote ?? DEFAULT_RM_NOTE).replace("SERVICE", String(pair.key.value))}`;
    }
  // Ports are quoted: unquoted "22:22" was a base-60 number in YAML 1.1.
  if (isMap(svcMap))
    for (const pair of svcMap.items) {
      const svc = pair.value;
      if (!isMap(svc)) continue;
      const ports = svc.get("ports", true);
      if (isSeq(ports))
        for (const item of ports.items) if (isScalar(item)) item.type = "QUOTE_DOUBLE";
    }
  return { ok: true, yaml: doc.toString({ lineWidth: 0 }), services: names, warnings };
}
