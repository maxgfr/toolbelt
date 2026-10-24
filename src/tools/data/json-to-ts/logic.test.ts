import { describe, expect, it } from "bun:test";
import { infer, merge, pascal, singular, toTypeScript, toZod } from "./logic";

const opts = { rootName: "Root", style: "interface" as const, readonly: false };

describe("json-to-ts", () => {
  it("names things", () => {
    expect(singular("categories")).toBe("category");
    expect(singular("boxes")).toBe("box");
    expect(singular("users")).toBe("user");
    expect(singular("data")).toBe("dataItem");
    expect(singular("status")).toBe("statusItem");
    expect(pascal("user_profile-id")).toBe("UserProfileId");
    expect(pascal("2fa")).toBe("T2fa");
    expect(pascal("€")).toBe("Item");
  });

  it("writes interfaces for nested objects", () => {
    const ts = toTypeScript(
      { id: 1, name: "Zoé", address: { city: "Lyon", "zip-code": "69001" }, tags: ["a"] },
      opts,
    );
    expect(ts).toBe(
      [
        "export interface Root {",
        "  id: number;",
        "  name: string;",
        "  address: Address;",
        "  tags: string[];",
        "}",
        "",
        "export interface Address {",
        "  city: string;",
        '  "zip-code": string;',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("merges array items: optional fields, nullable values, unions", () => {
    const ts = toTypeScript(
      {
        users: [
          { id: 1, email: "a@b.c", score: null },
          { id: 2, score: 3.5 },
        ],
        mixed: [1, "two", null],
        empty: [],
      },
      opts,
    );
    expect(ts).toContain("users: User[];");
    expect(ts).toContain("mixed: (number | string | null)[];");
    expect(ts).toContain("empty: unknown[];");
    expect(ts).toContain(
      "export interface User {\n  id: number;\n  email?: string;\n  score: number | null;\n}",
    );
  });

  it("supports type aliases, readonly and non-object roots", () => {
    const t = toTypeScript([{ a: [1] }], { rootName: "list", style: "type", readonly: true });
    expect(t).toBe(
      "export type List = readonly ListItem[];\n\nexport type ListItem = {\n  readonly a: readonly number[];\n};\n",
    );
    expect(toTypeScript("x", opts)).toBe("export type Root = string;\n");
    expect(toTypeScript({}, opts)).toBe("export type Root = Record<string, unknown>;\n");
  });

  it("shares one name between identical shapes and avoids clashes", () => {
    const ts = toTypeScript(
      { from: { lat: 1, lng: 2 }, to: { lat: 3, lng: 4 }, root: { x: 1 } },
      opts,
    );
    expect(ts).toContain("from: From;");
    expect(ts).toContain("to: From;");
    expect(ts).toContain("root: Root2;");
    expect(ts.match(/export interface/g)?.length).toBe(3);
  });

  it("writes a Zod schema, dependencies first", () => {
    const z = toZod({ user: { name: "a", nick: null }, items: [{ n: 1 }, {}] }, opts);
    expect(z).toBe(
      [
        'import { z } from "zod";',
        "",
        "export const UserSchema = z.object({",
        "  name: z.string(),",
        "  nick: z.null(),",
        "});",
        "export type User = z.infer<typeof UserSchema>;",
        "",
        "export const ItemSchema = z.object({",
        "  n: z.number().optional(),",
        "});",
        "export type Item = z.infer<typeof ItemSchema>;",
        "",
        "export const RootSchema = z.object({",
        "  user: UserSchema,",
        "  items: z.array(ItemSchema),",
        "});",
        "export type Root = z.infer<typeof RootSchema>;",
        "",
      ].join("\n"),
    );
    expect(toZod([1, "a", null], opts)).toContain(
      "export const RootSchema = z.array(z.union([z.number(), z.string()]).nullable());",
    );
  });

  it("merges shapes", () => {
    expect(merge(infer(1, "x"), infer(2, "x"))).toEqual({ k: "number" });
    expect(merge(infer([], "x"), infer(["a"], "x"))).toEqual({
      k: "array",
      item: { k: "string" },
    });
  });
});
