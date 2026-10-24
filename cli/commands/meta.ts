/** The commands about toolbelt itself: help, list, search, info, link, version. */

import type { StateKey } from "../../scripts/state-keys";
import { decodeShare, encodeShare, MAX_LINK, toBase64Url } from "../../src/app/share";
import { table } from "../format";
import { STATE_KEYS } from "../gen/state-keys";
import { CATEGORIES, categoryOf, findTool, searchTools, TOOLS, t, toolUrl } from "../meta";
import { CliError, type CommandGroup, type Ctx, UsageError } from "../types";

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

async function registry() {
  return import("../registry");
}

function requireTool(id: string | undefined) {
  if (!id) throw new UsageError("missing tool id (see: toolbelt list)");
  const tool = findTool(id.toLowerCase());
  if (!tool) {
    const close = searchTools(id)
      .slice(0, 5)
      .map((x) => x.id);
    throw new CliError(
      `unknown tool "${id}"${close.length ? `. Did you mean: ${close.join(", ")}?` : ""} (see: toolbelt list)`,
    );
  }
  return tool;
}

/** A value from `--set key=value`, typed after the key's default. */
export function coerce(raw: string, key: StateKey | undefined): unknown {
  const type = key?.type ?? "json";
  if (type === "string") return raw;
  if (type === "number") {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n))
      throw new UsageError(`${key?.key} expects a number, got "${raw}"`);
    return n;
  }
  if (type === "boolean") {
    if (/^(true|1|yes|on)$/i.test(raw)) return true;
    if (/^(false|0|no|off)$/i.test(raw)) return false;
    throw new UsageError(`${key?.key} expects true or false, got "${raw}"`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    if (type === "array" || type === "object")
      throw new UsageError(`${key?.key} expects JSON (${type}), got "${raw}"`);
    return raw;
  }
}

function splitSet(s: string, flag: string): [string, string] {
  const eq = s.indexOf("=");
  if (eq <= 0) throw new UsageError(`${flag} expects key=value, got "${s}"`);
  return [s.slice(0, eq), s.slice(eq + 1)];
}

/** Compresses like the site (deflate-raw, base64url); falls back to zlib where CompressionStream lacks deflate-raw. */
export async function encodeState(state: Record<string, unknown>): Promise<string> {
  try {
    return await encodeShare(state);
  } catch {
    const { deflateRawSync } = await import("node:zlib");
    return toBase64Url(
      new Uint8Array(deflateRawSync(new TextEncoder().encode(JSON.stringify(state)))),
    );
  }
}

export async function buildLink(toolId: string, state: Record<string, unknown>): Promise<string> {
  const base = toolUrl(toolId);
  if (!Object.keys(state).length) return base;
  const url = `${base}?s=${await encodeState(state)}`;
  if (url.length > MAX_LINK)
    throw new CliError(
      `the link would be ${url.length} characters long (limit ${MAX_LINK}): the input is too large to share`,
    );
  return url;
}

/** Reads the state carried by a share link (for checks and tests). */
export async function readLink(url: string): Promise<Record<string, unknown> | null> {
  const s = url.match(/[?&]s=([^&]+)/)?.[1];
  return s ? decodeShare(s) : {};
}

function keysLine(id: string): string {
  const keys = STATE_KEYS[id] ?? [];
  if (!keys.length) return "(none)";
  return keys.map((k) => `${k.key} (${k.type})`).join(", ");
}

function describeDefault(k: StateKey): string {
  if (k.expr) return `computed: ${k.expr}`;
  const s = JSON.stringify(k.default) ?? "";
  return s.length > 50 ? `${s.slice(0, 47)}...` : s;
}

async function link(ctx: Ctx) {
  const tool = requireTool(ctx.args[0]);
  if (ctx.args.length > 1)
    throw new UsageError(`unexpected argument "${ctx.args[1]}" (values go in --set key=value)`);
  const keys = STATE_KEYS[tool.id] ?? [];
  const byKey = new Map(keys.map((k) => [k.key, k]));
  const check = (key: string) => {
    if (keys.length && !byKey.has(key))
      throw new UsageError(
        `"${key}" is not a state key of ${tool.id}. Keys: ${keys.map((k) => k.key).join(", ") || "(none)"}`,
      );
  };
  const state: Record<string, unknown> = {};
  const raw = ctx.str("state");
  if (raw !== undefined) {
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      throw new UsageError("--state must be a JSON object");
    }
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new UsageError("--state must be a JSON object");
    for (const [k, val] of Object.entries(v)) {
      check(k);
      state[k] = val;
    }
  }
  for (const s of ctx.list("set")) {
    const [k, v] = splitSet(s, "--set");
    check(k);
    state[k] = coerce(v, byKey.get(k));
  }
  for (const s of ctx.list("set-file")) {
    const [k, path] = splitSet(s, "--set-file");
    check(k);
    state[k] = coerce(await ctx.readTextFile(path), byKey.get(k));
  }
  const url = await buildLink(tool.id, state);
  return { text: url, json: { tool: tool.id, url, state } };
}

async function info(ctx: Ctx) {
  const tool = requireTool(ctx.args[0]);
  const { commandForTool } = await registry();
  const cmd = commandForTool(tool.id);
  const cli = !!cmd?.run;
  const cat = categoryOf(tool.id);
  const keys = STATE_KEYS[tool.id] ?? [];
  const lines = [
    `${t(tool.title)} (${tool.id})`,
    t(tool.desc),
    "",
    `Category: ${cat ? t(cat.title) : tool.category}`,
    `URL:      ${toolUrl(tool.id)}`,
    cli
      ? `CLI:      yes, toolbelt ${cmd?.name} (see: toolbelt help ${cmd?.name})`
      : `CLI:      no, browser only${cmd?.browserReason ? ` (${cmd.browserReason})` : ""}`,
    `Link keys: ${keysLine(tool.id)}`,
  ];
  if (cmd?.examples[0]) lines.push(`Example:  ${cmd.examples[0].cmd}`);
  return {
    text: lines.join("\n"),
    json: {
      id: tool.id,
      title: t(tool.title),
      description: t(tool.desc),
      category: tool.category,
      url: toolUrl(tool.id),
      cli,
      command: cli ? cmd?.name : null,
      usage: cmd?.usage ?? null,
      browserReason: cli ? null : (cmd?.browserReason ?? null),
      stateKeys: keys.map((k) => ({
        key: k.key,
        type: k.type,
        default: k.expr ? null : k.default,
      })),
    },
  };
}

async function list(ctx: Ctx) {
  const cat = ctx.str("category");
  const { commandForTool } = await registry();
  const tools = TOOLS.filter((x) => !cat || x.category === cat);
  const rows = tools.map((x) => {
    const c = commandForTool(x.id);
    return { id: x.id, category: x.category, title: t(x.title), cli: !!c?.run, url: toolUrl(x.id) };
  });
  return {
    text: table(
      rows.map((r) => [r.id, r.category, r.cli ? "cli" : "browser", r.title]),
      ["TOOL", "CATEGORY", "RUNS", "TITLE"],
    ),
    json: rows,
  };
}

async function search(ctx: Ctx) {
  const q = ctx.args.join(" ").trim();
  if (!q) throw new UsageError("missing search words, e.g. toolbelt search json yaml");
  const { commandForTool } = await registry();
  const found = searchTools(q);
  const rows = found.map((x) => ({
    id: x.id,
    title: t(x.title),
    description: t(x.desc),
    cli: !!commandForTool(x.id)?.run,
    url: toolUrl(x.id),
  }));
  if (!rows.length) return { text: `No tool matches "${q}".`, json: [], code: 1 };
  return {
    text: table(rows.map((r) => [r.id, r.cli ? "cli" : "browser", r.title])),
    json: rows,
  };
}

async function help(ctx: Ctx) {
  const { helpText, commandHelp } = await import("../run");
  const name = ctx.args[0];
  if (!name) return helpText();
  const { findCommand } = await registry();
  const spec = findCommand(name);
  if (!spec) throw new UsageError(`unknown command "${name}" (see: toolbelt help)`);
  return commandHelp(spec);
}

async function version() {
  const { VERSION } = await import("../version");
  return VERSION;
}

export const group: CommandGroup = {
  category: "meta",
  commands: [
    {
      name: "help",
      summary: "Show every command, or one command's usage, options and examples.",
      usage: "toolbelt help [command]",
      examples: [{ cmd: "toolbelt help" }, { cmd: "toolbelt help diff" }],
      run: help,
    },
    {
      name: "list",
      summary: "List the tools (id, category, whether the CLI runs it, title).",
      usage: "toolbelt list [--category <id>] [--json]",
      options: [
        {
          name: "category",
          alias: "c",
          type: "string",
          values: CATEGORY_IDS,
          desc: "Only this category.",
        },
      ],
      examples: [
        { cmd: "toolbelt list" },
        { cmd: "toolbelt list --category encode --json", desc: "Encoding tools, as JSON." },
      ],
      run: list,
    },
    {
      name: "search",
      summary:
        "Find tools by words (titles, descriptions and keywords in English, French and German).",
      usage: "toolbelt search <words>",
      examples: [{ cmd: "toolbelt search json yaml" }, { cmd: "toolbelt search mot de passe" }],
      run: search,
    },
    {
      name: "info",
      summary:
        "A tool's title, description, URL, whether the CLI runs it, and its share-link keys.",
      usage: "toolbelt info <tool>",
      examples: [{ cmd: "toolbelt info jwt" }, { cmd: "toolbelt info tuner --json" }],
      run: info,
    },
    {
      name: "link",
      summary:
        "A link to a tool on the site with its input prefilled (the state is in the #fragment, never sent).",
      usage:
        "toolbelt link <tool> [--set key=value ...] [--set-file key=path ...] [--state '<json>']",
      options: [
        {
          name: "set",
          alias: "s",
          type: "list",
          arg: "<key=value>",
          desc: "Set one state key (repeatable).",
        },
        {
          name: "set-file",
          type: "list",
          arg: "<key=path>",
          desc: "Set one state key to a file's content (repeatable).",
        },
        {
          name: "state",
          type: "string",
          arg: "<json>",
          desc: "Several keys at once, as a JSON object.",
        },
      ],
      notes:
        "Values are typed after each key's default (numbers, true/false, JSON for arrays and objects). " +
        "`toolbelt info <tool>` lists a tool's keys; references/commands.md lists them all.",
      examples: [
        { cmd: "toolbelt link json --set input='{\"a\":1}' --set indent=4" },
        { cmd: "toolbelt link diff --set-file a=old.txt --set-file b=new.txt" },
        { cmd: "toolbelt link color --set color='#ff6600'" },
      ],
      run: link,
    },
    {
      name: "version",
      summary: "Print the toolbelt version.",
      usage: "toolbelt version",
      examples: [{ cmd: "toolbelt version" }],
      run: version,
    },
  ],
};

/** For references/commands.md: every tool's link keys, as a Markdown table. */
export function stateKeysMarkdown(): string {
  const lines = ["| Tool | Keys (type = default) |", "| --- | --- |"];
  for (const tool of TOOLS) {
    const keys = STATE_KEYS[tool.id] ?? [];
    const cells = keys.map(
      (k) => `\`${k.key}\` (${k.type}${k.expr ? ", computed" : ` = ${describeDefault(k)}`})`,
    );
    lines.push(`| ${tool.id} | ${(cells.join(", ") || "(none)").replace(/\|/g, "\\|")} |`);
  }
  return lines.join("\n");
}
