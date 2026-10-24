/** Command-line parsing: `--name value`, `--name=value`, `-x value`, `--flag`, `--no-flag`, `--`. */
import { type OptionSpec, type OptValue, UsageError } from "./types";

/** Options every command accepts. */
export const GLOBAL_OPTIONS: OptionSpec[] = [
  { name: "json", type: "boolean", desc: "Structured output (JSON)." },
  {
    name: "file",
    alias: "f",
    type: "string",
    arg: "<path>",
    desc: "Read the input from a file (`-` for stdin).",
  },
  {
    name: "out",
    alias: "o",
    type: "string",
    arg: "<path>",
    desc: "Write the output to a file instead of stdout.",
  },
  {
    name: "lang",
    type: "string",
    values: ["en", "fr", "de"],
    arg: "<en|fr|de>",
    desc: "Language of localized messages (default: LANG, else English).",
  },
  { name: "help", alias: "h", type: "boolean", desc: "Show help for the command." },
];

export interface Parsed {
  args: string[];
  opts: Record<string, OptValue>;
}

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** A token that is a value, not an option: plain words and negative numbers. */
function isValue(tok: string): boolean {
  return !tok.startsWith("-") || tok === "-" || /^-\d|^-\.\d/.test(tok);
}

export function parseArgs(argv: string[], specs: OptionSpec[]): Parsed {
  const byName = new Map<string, OptionSpec>();
  const byAlias = new Map<string, OptionSpec>();
  for (const s of specs) {
    byName.set(s.name, s);
    if (s.alias) byAlias.set(s.alias, s);
  }
  const args: string[] = [];
  const opts: Record<string, OptValue> = {};

  const set = (spec: OptionSpec, raw: string | boolean, shown: string) => {
    if (spec.type === "boolean") {
      if (typeof raw === "boolean") opts[spec.name] = raw;
      else if (/^(true|yes|1|on)$/i.test(raw)) opts[spec.name] = true;
      else if (/^(false|no|0|off)$/i.test(raw)) opts[spec.name] = false;
      else throw new UsageError(`${shown} takes no value (or true/false), got "${raw}"`);
      return;
    }
    const value = String(raw);
    if (spec.values && !spec.values.includes(value))
      throw new UsageError(`${shown} must be one of: ${spec.values.join(", ")} (got "${value}")`);
    if (spec.type === "number") {
      const n = Number(value.replace(/_/g, ""));
      if (value.trim() === "" || !Number.isFinite(n))
        throw new UsageError(`${shown} expects a number, got "${value}"`);
      opts[spec.name] = n;
    } else if (spec.type === "list") {
      const prev = opts[spec.name];
      opts[spec.name] = [...(Array.isArray(prev) ? prev : []), value];
    } else opts[spec.name] = value;
  };

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i] as string;
    if (tok === "--") {
      args.push(...argv.slice(i + 1));
      break;
    }
    if (isValue(tok)) {
      args.push(tok);
      continue;
    }
    let spec: OptionSpec | undefined;
    let inline: string | undefined;
    let shown = tok;
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const name = camelToKebab(eq === -1 ? tok.slice(2) : tok.slice(2, eq));
      inline = eq === -1 ? undefined : tok.slice(eq + 1);
      shown = `--${name}`;
      spec = byName.get(name);
      if (!spec && name.startsWith("no-") && inline === undefined) {
        const neg = byName.get(name.slice(3));
        if (neg?.type === "boolean") {
          opts[neg.name] = false;
          continue;
        }
      }
    } else {
      const letter = tok.slice(1, 2);
      spec = byAlias.get(letter);
      shown = `-${letter}`;
      if (tok.length > 2) inline = tok.slice(tok[2] === "=" ? 3 : 2);
    }
    if (!spec) {
      const names = specs.map((s) => `--${s.name}`).join(", ");
      throw new UsageError(`unknown option ${shown} (options: ${names})`);
    }
    if (spec.type === "boolean") {
      set(spec, inline ?? true, shown);
      continue;
    }
    if (inline !== undefined) {
      set(spec, inline, shown);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined) throw new UsageError(`${shown} needs a value`);
    set(spec, next, shown);
    i++;
  }
  return { args, opts };
}
