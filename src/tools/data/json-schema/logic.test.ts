import { describe, expect, it } from "bun:test";
import { DRAFT, inferSchema, jsonEqual, schemaErrorMessage, validate } from "./logic";

const opts = { formats: true, strict: false };

describe("json-schema: inference", () => {
  it("describes objects, required keys and integer vs number", () => {
    expect(inferSchema({ id: 1, price: 2.5, name: "a", ok: true, none: null }, opts)).toEqual({
      $schema: DRAFT,
      type: "object",
      properties: {
        id: { type: "integer" },
        price: { type: "number" },
        name: { type: "string" },
        ok: { type: "boolean" },
        none: { type: "null" },
      },
      required: ["id", "price", "name", "ok", "none"],
    });
  });

  it("merges array items: optional keys, nullable values, mixed types", () => {
    const s = inferSchema(
      {
        users: [
          { id: 1, email: "a@b.co", n: 1 },
          { id: 2, email: null, n: 1.5 },
          { id: 3, tag: "x" },
        ],
        mixed: [1, "a", { x: 1 }],
        empty: [],
      },
      opts,
    ) as Record<string, Record<string, Record<string, unknown>>>;
    const user = s.properties?.users?.items as Record<string, unknown>;
    expect(user.required).toEqual(["id"]);
    expect((user.properties as Record<string, unknown>).email).toEqual({
      type: ["string", "null"],
      format: "email",
    });
    expect((user.properties as Record<string, unknown>).n).toEqual({ type: "number" });
    const mixed = s.properties?.mixed?.items as Record<string, unknown> | undefined;
    expect(mixed?.anyOf).toHaveLength(3);
    expect(s.properties?.empty).toEqual({ type: "array" });
  });

  it("detects formats only when asked, and only when every sample agrees", () => {
    const sample = {
      at: "2024-05-01T10:00:00Z",
      day: "2024-05-01",
      url: "https://x.io/a",
      id: "0b5e0f4e-0d6f-4c1e-9f0a-1b2c3d4e5f60",
    };
    const s = inferSchema(sample, opts) as { properties: Record<string, { format?: string }> };
    expect(s.properties.at?.format).toBe("date-time");
    expect(s.properties.day?.format).toBe("date");
    expect(s.properties.url?.format).toBe("uri");
    expect(s.properties.id?.format).toBe("uuid");
    const off = inferSchema(sample, { formats: false, strict: false }) as typeof s;
    expect(off.properties.at?.format).toBeUndefined();
    const mixed = inferSchema(["a@b.co", "not an email"], opts) as { items: unknown };
    expect(mixed.items).toEqual({ type: "string" });
  });

  it("adds additionalProperties: false in strict mode, and handles scalar roots", () => {
    expect(inferSchema({ a: { b: 1 } }, { formats: false, strict: true })).toMatchObject({
      additionalProperties: false,
      properties: { a: { additionalProperties: false } },
    });
    expect(inferSchema("x", opts)).toEqual({ $schema: DRAFT, type: "string" });
    const proto = inferSchema(JSON.parse('{"__proto__": {"a": 1}}'), opts);
    expect(Object.hasOwn(proto.properties as object, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).a).toBeUndefined();
  });

  it("validates its own sample", () => {
    const doc = { users: [{ id: 1, tags: ["a"] }, { id: 2 }], when: "2024-01-01T00:00:00Z" };
    expect(validate(doc, inferSchema(doc, { formats: true, strict: true }))).toEqual([]);
  });
});

describe("json-schema: validation", () => {
  const schema = {
    type: "object",
    required: ["id", "name"],
    additionalProperties: false,
    properties: {
      id: { type: "integer", minimum: 1 },
      name: { type: "string", minLength: 2, maxLength: 5, pattern: "^[a-z]+$" },
      role: { enum: ["admin", "user"] },
      kind: { const: "person" },
      tags: { type: "array", items: { type: "string" }, uniqueItems: true, maxItems: 3 },
      email: { type: "string", format: "email" },
      score: { type: "number", exclusiveMaximum: 10, multipleOf: 0.5 },
    },
  };

  it("accepts a valid document", () => {
    expect(validate({ id: 1, name: "ann", role: "user", tags: ["a"] }, schema)).toEqual([]);
  });

  it("reports each problem with its path", () => {
    const errs = validate(
      {
        id: 0,
        name: "Ann!!!",
        role: "root",
        kind: "robot",
        tags: ["a", "a", 3, "d"],
        email: "nope",
        score: 10.25,
        extra: true,
      },
      schema,
    );
    const got = errs.map((e) => [JSON.stringify(e.path), e.code]);
    expect(got).toEqual([
      ['["id"]', "minimum"],
      ['["name"]', "maxLength"],
      ['["name"]', "pattern"],
      ['["role"]', "enum"],
      ['["kind"]', "const"],
      ['["tags"]', "maxItems"],
      ['["tags"]', "uniqueItems"],
      ['["tags",2]', "type"],
      ['["email"]', "format"],
      ['["score"]', "exclusiveMaximum"],
      ['["score"]', "multipleOf"],
      ['["extra"]', "additional"],
    ]);
    expect(validate({}, schema).map((e) => e.expected)).toEqual(["id", "name"]);
  });

  it("checks types, with integer accepted as number", () => {
    expect(validate(1, { type: "number" })).toEqual([]);
    expect(validate(1.5, { type: "integer" })).toEqual([
      { path: [], code: "type", expected: "integer", actual: "number" },
    ]);
    expect(validate(null, { type: ["string", "null"] })).toEqual([]);
    expect(validate([], { type: "object" })[0]?.actual).toBe("array");
  });

  it("supports anyOf, oneOf, allOf, not and if/then/else", () => {
    const any = { anyOf: [{ type: "string" }, { type: "integer" }] };
    expect(validate("a", any)).toEqual([]);
    expect(validate(true, any)[0]?.code).toBe("anyOf");
    const one = { oneOf: [{ type: "number" }, { type: "integer" }] };
    expect(validate(1.5, one)).toEqual([]);
    expect(validate(1, one)[0]).toMatchObject({ code: "oneOf", actual: "2" });
    expect(validate(5, { allOf: [{ minimum: 1 }, { maximum: 3 }] })[0]?.code).toBe("maximum");
    expect(validate("x", { not: { type: "string" } })[0]?.code).toBe("not");
    const cond = {
      if: { properties: { country: { const: "FR" } } },
      // biome-ignore lint/suspicious/noThenProperty: "then" is a JSON Schema keyword
      then: { required: ["siret"] },
      else: { required: ["ein"] },
    };
    expect(validate({ country: "FR" }, cond)[0]?.expected).toBe("siret");
    expect(validate({ country: "US" }, cond)[0]?.expected).toBe("ein");
  });

  it("follows $ref to $defs, definitions and the root (recursion)", () => {
    const tree = {
      $defs: {
        node: {
          type: "object",
          properties: {
            kids: { type: "array", items: { $ref: "#/$defs/node" } },
            v: { type: "integer" },
          },
        },
      },
      $ref: "#/$defs/node",
    };
    expect(validate({ v: 1, kids: [{ v: 2, kids: [] }] }, tree)).toEqual([]);
    expect(validate({ kids: [{ kids: [{ v: "x" }] }] }, tree)[0]?.path).toEqual([
      "kids",
      0,
      "kids",
      0,
      "v",
    ]);
    expect(validate(1, { $ref: "#/definitions/missing" })[0]).toMatchObject({
      code: "ref",
      expected: "#/definitions/missing",
    });
    expect(validate(1, { $ref: "#" })[0]?.code).toBe("depth");
  });

  it("handles boolean schemas, prefixItems, patternProperties and bad patterns", () => {
    expect(validate(1, true)).toEqual([]);
    expect(validate(1, false)[0]?.code).toBe("false");
    const tuple = { prefixItems: [{ type: "string" }, { type: "integer" }], items: false };
    expect(validate(["a", 1], tuple)).toEqual([]);
    expect(validate(["a", 1, 2], tuple)[0]).toMatchObject({ path: [2], code: "false" });
    const pp = { patternProperties: { "^x-": { type: "string" } }, additionalProperties: false };
    expect(validate({ "x-a": "ok" }, pp)).toEqual([]);
    expect(validate({ "x-a": 1, b: 1 }, pp).map((e) => e.code)).toEqual(["type", "additional"]);
    expect(validate("a", { pattern: "(" })[0]?.code).toBe("badPattern");
  });

  it("counts characters, not UTF-16 units, and can skip formats", () => {
    expect(validate("😀😀", { maxLength: 2 })).toEqual([]);
    expect(validate("nope", { format: "email" }, { formats: false })).toEqual([]);
    expect(validate("2024-13-01", { format: "date" })[0]?.code).toBe("format");
  });

  it("caps the number of errors", () => {
    const doc = Array.from({ length: 50 }, () => "x");
    expect(validate(doc, { items: { type: "integer" } }, { max: 10 })).toHaveLength(10);
  });

  it("compares JSON values deeply", () => {
    expect(jsonEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(jsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(jsonEqual([1], { 0: 1 })).toBe(false);
    expect(jsonEqual({ a: undefined }, { b: undefined })).toBe(false);
  });
});

describe("schemaErrorMessage", () => {
  it("fills in what was expected and found", () => {
    const [e] = validate("x", { type: "integer" });
    expect(e && schemaErrorMessage(e)).toBe("Expected integer, got string.");
    const [r] = validate({}, { required: ["id"] });
    expect(r && schemaErrorMessage(r)).toBe("Missing required key “id”.");
  });
});
