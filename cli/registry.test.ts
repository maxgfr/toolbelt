import { describe, expect, test } from "bun:test";
import { GLOBAL_OPTIONS } from "./args";
import { STATE_KEYS } from "./gen/state-keys";
import { TOOLS } from "./meta";
import { COMMANDS, commandForTool, findCommand, GROUPS } from "./registry";

describe("registry", () => {
  test("every tool has exactly one command, in its own category", () => {
    for (const t of TOOLS) {
      const cmds = COMMANDS.filter((c) => c.tool === t.id);
      expect({ id: t.id, n: cmds.length }).toEqual({ id: t.id, n: 1 });
      expect(cmds[0]?.name).toBe(t.id);
      const group = GROUPS.find((g) => g.commands.includes(cmds[0] as never));
      expect({ id: t.id, category: group?.category }).toEqual({ id: t.id, category: t.category });
    }
  });

  test("names and aliases are unique", () => {
    const seen = new Map<string, string>();
    for (const c of COMMANDS)
      for (const n of [c.name, ...(c.aliases ?? [])]) {
        expect({ n, by: seen.get(n) }).toEqual({ n, by: undefined });
        seen.set(n, c.name);
      }
  });

  test("every command is documented and either runs or is browser-only", () => {
    const reserved = new Set(GLOBAL_OPTIONS.flatMap((o) => [o.name, o.alias].filter(Boolean)));
    for (const c of COMMANDS) {
      expect({ c: c.name, usage: c.usage.startsWith(`toolbelt ${c.name}`) }).toEqual({
        c: c.name,
        usage: true,
      });
      expect(c.examples.length).toBeGreaterThan(0);
      expect({ c: c.name, ok: !!c.run !== !!c.browserOnly }).toEqual({ c: c.name, ok: true });
      for (const o of c.options ?? []) {
        expect({
          c: c.name,
          o: o.name,
          reserved: reserved.has(o.name) || reserved.has(o.alias ?? ""),
        }).toEqual({
          c: c.name,
          o: o.name,
          reserved: false,
        });
      }
    }
  });

  test("lookups", () => {
    expect(findCommand("counter")?.name).toBe("counter");
    expect(findCommand("COUNTER")?.name).toBe("counter");
    expect(commandForTool("diff")?.name).toBe("diff");
  });

  test("the generated state keys cover every tool", () => {
    for (const t of TOOLS)
      expect({ id: t.id, has: t.id in STATE_KEYS }).toEqual({ id: t.id, has: true });
  });
});
