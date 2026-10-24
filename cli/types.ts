/** The shapes every command is declared with (see cli/commands/*.ts). */
import type { L10n } from "../src/i18n";
import type { CategoryId } from "../src/tools/types";

export type OptionType = "boolean" | "string" | "number" | "list";

export interface OptionSpec {
  /** Long name, used as `--name` (kebab-case). */
  name: string;
  /** One-letter alias, used as `-x`. */
  alias?: string;
  type: OptionType;
  /** One line for `help`. */
  desc: string;
  /** Shown in `help` only (the command applies its own default). */
  default?: string | number | boolean;
  /** Allowed values (checked before the command runs). */
  values?: readonly string[];
  /** Placeholder in help, e.g. "<n>". */
  arg?: string;
}

export interface Example {
  cmd: string;
  desc?: string;
}

export type OptValue = string | number | boolean | string[] | undefined;

export interface Ctx {
  /** The command's own name. */
  command: string;
  /** Positional arguments, after the command name. */
  args: string[];
  /** Parsed options (by long name), validated against the command's specs. */
  opts: Record<string, OptValue>;
  /** `--json` was given. */
  json: boolean;
  lang: "en" | "fr" | "de";
  /** The current time (fixed in tests). */
  now: Date;
  /** Environment variables (TOOLBELT_PASSWORD…). */
  env: Record<string, string | undefined>;
  /** The command's input as text: the positional arguments, else `--file`, else stdin. */
  text(o?: { required?: boolean; join?: string }): Promise<string>;
  /** Same as `text()`, as bytes (files and stdin are read as raw bytes). */
  bytes(o?: { required?: boolean }): Promise<Uint8Array>;
  /** Reads a file, relative to the working directory (`-` is stdin). */
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  /** Typed option getters, with a default. */
  str(name: string, fallback: string): string;
  str(name: string): string | undefined;
  num(name: string, fallback: number): number;
  num(name: string): number | undefined;
  bool(name: string, fallback?: boolean): boolean;
  list(name: string): string[];
}

/** What a command returns: plain text, and/or a structured value for `--json`, and/or bytes. */
export type Output =
  | string
  | {
      /** Printed by default (a trailing newline is added if missing). */
      text?: string;
      /** Printed with `--json` (pretty JSON). Without it, `--json` prints `{ "result": text }`. */
      json?: unknown;
      /** Raw output (binary files): written as is to stdout or `--out`. */
      bytes?: Uint8Array;
      /** Non-zero exit with this output still printed (e.g. "no match", "invalid"). */
      code?: number;
      /** Printed to stderr as `warning: …` lines (not with `--json`, where they belong in `json`). */
      warnings?: string[];
    };

export interface CommandSpec {
  /** Command name: the tool id for tool commands. */
  name: string;
  /** The toolbelt tool this command runs (for `info`, `link` and the site URL). */
  tool?: string;
  aliases?: string[];
  /** One line, in English. */
  summary: string;
  /** e.g. "toolbelt base64 [text] [--decode] [--url-safe]". */
  usage: string;
  options?: OptionSpec[];
  /** At least one; shown in `help <command>` and in references/commands.md. */
  examples: Example[];
  /** Extra notes for `help <command>` (one paragraph). */
  notes?: string;
  /** The tool needs a browser (canvas, camera, microphone, audio, live timer…). */
  browserOnly?: boolean;
  /** Why it is browser-only (one short clause). */
  browserReason?: string;
  run?: (ctx: Ctx) => Promise<Output> | Output;
}

export interface CommandGroup {
  category: CategoryId | "meta";
  commands: CommandSpec[];
}

/** An error the user can fix: printed as `error: <message>` with a non-zero exit. */
export class CliError extends Error {
  readonly code: number;
  readonly text: L10n | undefined;
  constructor(message: string | L10n, code = 1) {
    super(typeof message === "string" ? message : message.en);
    this.code = code;
    this.text = typeof message === "string" ? undefined : message;
  }
}

/** A mistake in how the command was called (unknown option, bad value): exit code 2. */
export class UsageError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}
