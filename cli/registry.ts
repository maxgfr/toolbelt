/** Every CLI command, by category: the single source for dispatch, help and references/commands.md. */
import { group as calc } from "./commands/calc";
import { group as convert } from "./commands/convert";
import { group as data } from "./commands/data";
import { group as design } from "./commands/design";
import { group as encode } from "./commands/encode";
import { group as image } from "./commands/image";
import { group as life } from "./commands/life";
import { group as meta } from "./commands/meta";
import { group as text } from "./commands/text";
import { group as web } from "./commands/web";
import { CATEGORIES, searchTools } from "./meta";
import type { CommandGroup, CommandSpec } from "./types";

export const GROUPS: CommandGroup[] = [
  meta,
  text,
  encode,
  data,
  convert,
  web,
  design,
  image,
  calc,
  life,
];

export const COMMANDS: CommandSpec[] = GROUPS.flatMap((g) => g.commands);

const BY_NAME = new Map<string, CommandSpec>();
for (const c of COMMANDS) for (const n of [c.name, ...(c.aliases ?? [])]) BY_NAME.set(n, c);

export function findCommand(name: string): CommandSpec | undefined {
  return BY_NAME.get(name.toLowerCase());
}

/** The command that runs a tool (by tool id). */
export function commandForTool(id: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.tool === id);
}

export function categoryTitle(id: CommandGroup["category"]): string {
  if (id === "meta") return "Toolbelt";
  return CATEGORIES.find((c) => c.id === id)?.title.en ?? id;
}

/** Up to 3 command names close to a mistyped one (prefix, then the site's tool search). */
export function suggest(name: string): string[] {
  const n = name.toLowerCase();
  const names = [...BY_NAME.keys()];
  const out = names.filter((x) => x.startsWith(n) || n.startsWith(x)).slice(0, 3);
  for (const t of searchTools(name)) {
    const c = commandForTool(t.id);
    if (c && !out.includes(c.name)) out.push(c.name);
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
}
