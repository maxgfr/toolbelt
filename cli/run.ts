/**
 * The CLI, as a function: `run(argv, io)` parses, dispatches to a command and returns what to
 * print and the exit code. cli/main.ts wires it to the process; the tests call it directly.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { detectLang, type L10n, lang } from "../src/i18n";
import { GLOBAL_OPTIONS, parseArgs } from "./args";
import { toJson } from "./format";
import { findTool, toolUrl } from "./meta";
import { COMMANDS, findCommand, suggest } from "./registry";
import {
  CliError,
  type CommandSpec,
  type Ctx,
  type OptValue,
  type Output,
  UsageError,
} from "./types";

export interface Io {
  /** Standard input: its content, or a reader (called at most once, only when needed). */
  stdin?: string | Uint8Array | null | (() => Promise<Uint8Array | null>);
  env?: Record<string, string | undefined>;
  cwd?: string;
  now?: Date;
  /** Writes `--out` files (defaults to node:fs). */
  writeFile?: (path: string, data: Uint8Array) => Promise<void>;
}

export interface RunResult {
  code: number;
  /** Text output (UTF-8). Binary output is in `bytes`. */
  stdout: string;
  stderr: string;
  bytes?: Uint8Array;
}

type Lang = "en" | "fr" | "de";

/** `--lang`, else TOOLBELT_LANG, LC_ALL, LC_MESSAGES, LANG; English otherwise. */
export function resolveLang(opt: OptValue, env: Record<string, string | undefined>): Lang {
  if (opt === "fr" || opt === "de" || opt === "en") return opt;
  for (const k of ["TOOLBELT_LANG", "LC_ALL", "LC_MESSAGES", "LANG"]) {
    const v = env[k];
    if (v) return detectLang([v]);
  }
  return "en";
}

function isL10n(v: unknown): v is L10n {
  return !!v && typeof v === "object" && typeof (v as L10n).en === "string";
}

/** The message of any thrown value, in the current language when it carries translations. */
export function errorMessage(err: unknown, l: Lang): string {
  const text = (err as { text?: unknown } | null)?.text;
  if (isL10n(text)) return text[l] ?? text.en;
  if (isL10n(err)) return err[l] ?? err.en;
  return err instanceof Error ? err.message : String(err);
}

const decoder = new TextDecoder();

async function stdinBytes(io: Io): Promise<Uint8Array | null> {
  const s = io.stdin;
  if (s == null) return null;
  if (typeof s === "string") return new TextEncoder().encode(s);
  if (s instanceof Uint8Array) return s;
  return s();
}

function makeCtx(
  spec: CommandSpec,
  args: string[],
  opts: Record<string, OptValue>,
  io: Io,
  l: Lang,
): Ctx {
  const cwd = io.cwd ?? process.cwd();
  let stdinCache: Promise<Uint8Array | null> | undefined;
  const stdin = () => {
    stdinCache ??= stdinBytes(io);
    return stdinCache;
  };
  const readAny = async (path: string): Promise<Uint8Array> => {
    if (path === "-") {
      const b = await stdin();
      if (!b) throw new UsageError("no input on stdin");
      return b;
    }
    try {
      return new Uint8Array(await readFile(resolve(cwd, path)));
    } catch (err) {
      const code = (err as { code?: string }).code;
      throw new CliError(
        code === "ENOENT"
          ? `file not found: ${path}`
          : code === "EISDIR"
            ? `${path} is a directory`
            : `cannot read ${path}: ${errorMessage(err, "en")}`,
      );
    }
  };
  const missing = () =>
    new UsageError(
      `missing input: pass it as an argument, with --file <path>, or on stdin (see: toolbelt help ${spec.name})`,
    );
  const input = async (required: boolean, join: string): Promise<Uint8Array | null> => {
    if (args.length) return new TextEncoder().encode(args.join(join));
    if (typeof opts.file === "string") return readAny(opts.file);
    const b = await stdin();
    if (b) return b;
    if (required) throw missing();
    return null;
  };
  function str(name: string, fallback?: string): string | undefined {
    const v = opts[name];
    return typeof v === "string" ? v : fallback;
  }
  function num(name: string, fallback?: number): number | undefined {
    const v = opts[name];
    return typeof v === "number" ? v : fallback;
  }
  return {
    command: spec.name,
    args,
    opts,
    json: opts.json === true,
    lang: l,
    now: io.now ?? new Date(),
    env: io.env ?? process.env,
    async text(o = {}) {
      const b = await input(o.required ?? true, o.join ?? " ");
      return b ? decoder.decode(b) : "";
    },
    async bytes(o = {}) {
      return (await input(o.required ?? true, " ")) ?? new Uint8Array();
    },
    readFile: readAny,
    readTextFile: async (path) => decoder.decode(await readAny(path)),
    str: str as Ctx["str"],
    num: num as Ctx["num"],
    bool: (name, fallback = false) => {
      const v = opts[name];
      return typeof v === "boolean" ? v : fallback;
    },
    list: (name) => {
      const v = opts[name];
      return Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    },
  };
}

function browserOnly(spec: CommandSpec, json: boolean): Output {
  const tool = findTool(spec.tool ?? spec.name);
  const url = toolUrl(spec.tool ?? spec.name);
  const title = tool?.title.en ?? spec.name;
  const why = spec.browserReason ? ` (${spec.browserReason})` : "";
  return {
    text: `${title} runs in the browser only${why}.\nOpen it at: ${url}`,
    json: json
      ? { tool: spec.tool ?? spec.name, browserOnly: true, reason: spec.browserReason, url }
      : undefined,
  };
}

/** Runs one command line (without the program name). */
export async function run(argv: string[], io: Io = {}): Promise<RunResult> {
  const env = io.env ?? process.env;
  // The language can be given anywhere on the line; read it first so every message follows it.
  const langAt = argv.findIndex((a) => a === "--lang" || a.startsWith("--lang="));
  const langOpt = langAt === -1 ? undefined : (argv[langAt]?.split("=")[1] ?? argv[langAt + 1]);
  let l = resolveLang(langOpt, env);
  lang.value = l;
  let out = "";
  let err = "";
  try {
    const first = argv[0];
    if (first === undefined || first === "--help" || first === "-h")
      return { code: 0, stdout: await helpText(), stderr: "" };
    if (first === "--version" || first === "-v")
      return { code: 0, stdout: `${await version()}\n`, stderr: "" };
    const spec = findCommand(first);
    if (!spec) {
      const close = suggest(first);
      throw new UsageError(
        `unknown command "${first}"${close.length ? `. Did you mean: ${close.join(", ")}?` : ""} (see: toolbelt help)`,
      );
    }
    const { args, opts } = parseArgs(argv.slice(1), [...GLOBAL_OPTIONS, ...(spec.options ?? [])]);
    l = resolveLang(opts.lang, env);
    lang.value = l;
    if (opts.help === true) return { code: 0, stdout: commandHelp(spec), stderr: "" };
    const ctx = makeCtx(spec, args, opts, io, l);
    const res: Output = spec.run ? await spec.run(ctx) : browserOnly(spec, ctx.json);
    const o = typeof res === "string" ? { text: res } : res;
    const code = o.code ?? 0;
    if (!ctx.json && o.warnings?.length) err = o.warnings.map((w) => `warning: ${w}\n`).join("");
    let bytes: Uint8Array | undefined;
    if (ctx.json && (o.json !== undefined || o.text !== undefined))
      out = `${toJson(o.json !== undefined ? o.json : { result: o.text })}\n`;
    else if (o.bytes) bytes = o.bytes;
    else if (o.text !== undefined)
      out = o.text.endsWith("\n") || o.text === "" ? o.text : `${o.text}\n`;
    const target = typeof opts.out === "string" ? opts.out : undefined;
    if (target) {
      const data = bytes ?? new TextEncoder().encode(out);
      const write =
        io.writeFile ??
        (async (p: string, d: Uint8Array) => (await import("node:fs/promises")).writeFile(p, d));
      await write(resolve(io.cwd ?? process.cwd(), target), data);
      return { code, stdout: "", stderr: err };
    }
    return bytes ? { code, stdout: "", stderr: err, bytes } : { code, stdout: out, stderr: err };
  } catch (e) {
    const code = e instanceof CliError ? e.code : 1;
    err = `error: ${errorMessage(e, l)}\n`;
    return { code, stdout: out, stderr: err };
  } finally {
    lang.value = "en";
  }
}

async function version(): Promise<string> {
  const { VERSION } = await import("./version");
  return VERSION;
}

const GLOBAL_LINE =
  "Global options: --json, --file/-f <path>, --out/-o <path>, --lang <en|fr|de>, --help";

/** `toolbelt help`: every command, by category. */
export async function helpText(): Promise<string> {
  const { GROUPS, categoryTitle } = await import("./registry");
  const lines = [
    `toolbelt ${await version()}: ${COMMANDS.filter((c) => c.tool).length} everyday tools from https://maxgfr.github.io/toolbelt/, offline.`,
    "Nothing is sent anywhere: every command runs locally.",
    "",
    "Usage: toolbelt <command> [input] [options]",
    "Input: an argument, --file <path>, or stdin. Output: plain text, or JSON with --json.",
    "",
  ];
  for (const g of GROUPS) {
    lines.push(`${categoryTitle(g.category)}:`);
    const w = Math.max(...g.commands.map((c) => c.name.length));
    for (const c of g.commands)
      lines.push(`  ${c.name.padEnd(w)}  ${c.summary}${c.browserOnly ? " [browser only]" : ""}`);
    lines.push("");
  }
  lines.push(GLOBAL_LINE, "More: toolbelt help <command>");
  return `${lines.join("\n")}\n`;
}

/** `toolbelt help <command>`. */
export function commandHelp(spec: CommandSpec): string {
  const lines = [`toolbelt ${spec.name}: ${spec.summary}`, "", `Usage: ${spec.usage}`];
  if (spec.aliases?.length) lines.push(`Aliases: ${spec.aliases.join(", ")}`);
  if (spec.browserOnly)
    lines.push(
      "",
      `Runs in the browser only${spec.browserReason ? ` (${spec.browserReason})` : ""}: the command prints the tool's link.`,
    );
  const opts = spec.options ?? [];
  if (opts.length) {
    lines.push("", "Options:");
    const label = (o: (typeof opts)[number]) =>
      `${o.alias ? `-${o.alias}, ` : "    "}--${o.name}${o.type === "boolean" ? "" : ` ${o.arg ?? (o.values ? `<${o.values.join("|")}>` : o.type === "number" ? "<n>" : "<value>")}`}`;
    const w = Math.max(...opts.map((o) => label(o).length));
    for (const o of opts) {
      const def = o.default !== undefined ? ` (default: ${o.default})` : "";
      lines.push(`  ${label(o).padEnd(w)}  ${o.desc}${def}`);
    }
  }
  lines.push("", GLOBAL_LINE);
  if (spec.notes) lines.push("", spec.notes);
  lines.push("", "Examples:");
  for (const e of spec.examples) {
    lines.push(`  ${e.cmd}`);
    if (e.desc) lines.push(`      ${e.desc}`);
  }
  if (spec.tool) lines.push("", `In the browser: ${toolUrl(spec.tool)}`);
  return `${lines.join("\n")}\n`;
}
