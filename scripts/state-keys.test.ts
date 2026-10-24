import { describe, expect, test } from "bun:test";
import { describeKey, findCalls, stateKeyMap } from "./state-keys";

describe("findCalls", () => {
  test("keys, generics, defaults and options, across lines and nested brackets", () => {
    const src = `
      import { useToolState } from "../../../app/state";
      const a = useToolState("text", "");
      const b = useToolState<Mode>("mode", "x");
      const c = useToolState("list", [{ a: "1, 2" }, { b: (x) => x }]);
      const d = useToolState("secret", "", { persist: false, share: false });
      const e = useToolState(
        "n",
        10,
      );
    `;
    const calls = findCalls(src);
    expect(calls.map((c) => c.key)).toEqual(["text", "mode", "list", "secret", "n"]);
    expect(calls[1]?.generic).toBe("Mode");
    expect(calls[2]?.initial).toBe('[{ a: "1, 2" }, { b: (x) => x }]');
    expect(calls[3]?.opts).toContain("share: false");
    expect(calls[4]?.initial).toBe("10");
  });
});

describe("describe", () => {
  const none = new Map<string, [string, string]>();
  const load = async () => ({ DEFAULTS: { trim: true, unit: "px" } });
  test("literals", async () => {
    expect(
      await describeKey(
        { key: "k", generic: undefined, initial: '"a"', opts: undefined },
        none,
        load,
      ),
    ).toEqual({
      key: "k",
      type: "string",
      default: "a",
    });
    expect(
      (
        await describeKey(
          { key: "k", generic: undefined, initial: "0o644", opts: undefined },
          none,
          load,
        )
      ).default,
    ).toBe(420);
    expect(
      (
        await describeKey(
          { key: "k", generic: undefined, initial: "[]", opts: undefined },
          none,
          load,
        )
      ).type,
    ).toBe("array");
  });

  test("constants imported from the tool's modules are evaluated", async () => {
    const imports = new Map<string, [string, string]>([["DEFAULTS", ["./logic", "DEFAULTS"]]]);
    const k = await describeKey(
      { key: "trim", generic: undefined, initial: "DEFAULTS.trim", opts: undefined },
      imports,
      load,
    );
    expect(k).toEqual({ key: "trim", type: "boolean", default: true });
  });

  test("runtime defaults keep their source", async () => {
    const k = await describeKey(
      { key: "z", generic: undefined, initial: "localZone()", opts: undefined },
      none,
      load,
    );
    expect(k).toEqual({ key: "z", type: "string", expr: "localZone()" });
  });
});

describe("stateKeyMap", () => {
  test("reads every view; secrets are left out", async () => {
    const map = await stateKeyMap();
    expect(Object.keys(map).length).toBeGreaterThanOrEqual(139);
    expect(map.json?.map((k) => k.key)).toEqual(["input", "indent", "sort"]);
    expect(map.jwt).toEqual([]);
    expect(map.chmod?.find((k) => k.key === "mode")).toEqual({
      key: "mode",
      type: "number",
      default: 420,
    });
  });
});
