/**
 * JSON sample → types for Go, Rust, Kotlin, Java, C#, Python, Swift and Dart. The shape comes
 * from the shared inference (`_infer.ts`): array items are merged, keys missing from some items
 * become optional, `null` makes a value nullable, mixed values fall back to the language's
 * "any JSON" type (Python writes a real union). Nested objects get a type named after their key.
 */
import { infer, type Named, nameShapes, type ObjectShape, pascal, type Shape } from "../_infer";

export type Lang = "go" | "rust" | "kotlin" | "java" | "csharp" | "python" | "swift" | "dart";

export const LANGS: { value: Lang; label: string; ext: string }[] = [
  { value: "go", label: "Go", ext: "go" },
  { value: "rust", label: "Rust", ext: "rs" },
  { value: "kotlin", label: "Kotlin", ext: "kt" },
  { value: "java", label: "Java", ext: "java" },
  { value: "csharp", label: "C#", ext: "cs" },
  { value: "python", label: "Python", ext: "py" },
  { value: "swift", label: "Swift", ext: "swift" },
  { value: "dart", label: "Dart", ext: "dart" },
];

export interface CodeOptions {
  lang: Lang;
  rootName: string;
  /** Java: records (16+) or classes with getters and setters. */
  java: "record" | "pojo";
  /** Python: dataclasses or Pydantic v2 models. */
  python: "dataclass" | "pydantic";
}

/* --- Names ---------------------------------------------------------------- */

/** "firstName", "first_name", "HTTPServer" → their words (accents dropped). */
export function words(key: string): string[] {
  return (
    key
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .match(/[A-Za-z0-9]+/g) ?? []
  );
}

const cap = (w: string) => (w[0] ?? "").toUpperCase() + w.slice(1);

function digitSafe(id: string, prefix: string): string {
  if (!id) return prefix.replace(/_$/, "");
  return /^\d/.test(id) ? `${prefix}${id}` : id;
}

export function camel(key: string): string {
  const w = words(key);
  const id = w.map((x, i) => (i === 0 ? x.toLowerCase() : cap(x))).join("");
  return digitSafe(id, "field");
}

/** Go initialisms stay upper case: userId → UserID, apiUrl → APIURL. */
const INITIALISMS = new Set([
  "id",
  "url",
  "uri",
  "api",
  "http",
  "https",
  "json",
  "xml",
  "html",
  "sql",
  "uuid",
  "ip",
  "tcp",
  "udp",
  "ssh",
  "tls",
  "ttl",
  "cpu",
  "dns",
]);

export function pascalId(key: string, initialisms = false): string {
  const id = words(key)
    .map((x) => (initialisms && INITIALISMS.has(x.toLowerCase()) ? x.toUpperCase() : cap(x)))
    .join("");
  return digitSafe(id, "Field");
}

export function snake(key: string): string {
  const id = words(key)
    .map((x) => x.toLowerCase())
    .join("_");
  return digitSafe(id, "field_");
}

const RESERVED: Record<Lang, Set<string>> = {
  go: new Set(),
  rust: new Set(
    "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return static struct super trait true type unsafe use where while abstract become box do final macro override priv typeof unsized virtual yield try".split(
      " ",
    ),
  ),
  kotlin: new Set(
    "as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while".split(
      " ",
    ),
  ),
  java: new Set(
    "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record var yield".split(
      " ",
    ),
  ),
  csharp: new Set(["Equals", "GetHashCode", "GetType", "ToString", "EqualityContract"]),
  python: new Set(
    "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield model_config".split(
      " ",
    ),
  ),
  swift: new Set(
    "associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as Any catch false is nil super self Self throw throws true try".split(
      " ",
    ),
  ),
  dart: new Set(
    "abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for Function get hide if implements import in interface is late library mixin new null on operator part required rethrow return set show static super switch sync this throw true try typedef var void while with yield json".split(
      " ",
    ),
  ),
};

/** Type names a generated class must not take (built-ins of the language). */
const TAKEN: Record<Lang, string[]> = {
  go: ["Any", "Error"],
  rust: ["String", "Vec", "Option", "Result", "Box", "Value", "Map", "Self", "HashMap"],
  kotlin: [
    "String",
    "List",
    "Map",
    "Any",
    "Long",
    "Double",
    "Boolean",
    "Int",
    "JsonElement",
    "JsonObject",
    "Unit",
  ],
  java: [
    "String",
    "List",
    "Map",
    "Object",
    "Long",
    "Double",
    "Boolean",
    "Integer",
    "Record",
    "Override",
  ],
  csharp: ["String", "List", "Dictionary", "Object", "Type", "Attribute"],
  python: ["Any", "BaseModel", "Field", "ConfigDict", "dataclass"],
  swift: [
    "String",
    "Int",
    "Double",
    "Bool",
    "Data",
    "Date",
    "URL",
    "JSONValue",
    "Codable",
    "CodingKeys",
    "Array",
    "Dictionary",
    "Error",
  ],
  dart: ["String", "List", "Map", "Object", "Function", "Type", "Null", "Never", "Iterable"],
};

interface Prop {
  key: string;
  id: string;
  shape: Shape;
  optional: boolean;
  /** Optional or nullable. */
  nullable: boolean;
}

/** The fields of an object with unique identifiers in the language's convention. */
function props(shape: ObjectShape, conv: (k: string) => string, lang: Lang): Prop[] {
  const used = new Set<string>();
  const out: Prop[] = [];
  for (const [key, f] of shape.fields) {
    let base = conv(key) || "field";
    if (RESERVED[lang].has(base)) {
      if (lang === "rust") base = `r#${base}`;
      else if (lang === "kotlin" || lang === "swift") base = `\`${base}\``;
      else base = `${base}_`;
    }
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}${i}`;
    used.add(id);
    out.push({
      key,
      id,
      shape: f.shape,
      optional: f.optional,
      nullable: f.optional || isNullable(f.shape),
    });
  }
  return out;
}

/** The identifier without its escaping (r#type, `class`). */
function bare(id: string): string {
  return id.replace(/^r#/, "").replace(/^`(.*)`$/, "$1");
}

function isNullable(s: Shape): boolean {
  return s.k === "null" || (s.k === "union" && s.options.some((o) => o.k === "null"));
}

/** A shape without its null option (null alone, or unknown, is "any"). */
function core(s: Shape): Shape {
  if (s.k !== "union") return s;
  const rest = s.options.filter((o) => o.k !== "null");
  if (rest.length === 1 && rest[0]) return rest[0];
  return { k: "union", options: rest };
}

/* --- Type expressions ----------------------------------------------------- */

interface TypeMap {
  str: string;
  int: string;
  float: string;
  bool: string;
  any: string;
  map: string;
  list: (t: string) => string;
  /** A nullable version of a type (for list items and fields). */
  nullable: (t: string) => string;
  /** Real unions, when the language has them. */
  union?: (ts: string[]) => string;
}

interface Ctx {
  names: Map<Shape, string>;
  /** Things the code ended up using, for imports and helpers. */
  uses: Set<string>;
}

function typeExpr(s: Shape, m: TypeMap, c: Ctx): string {
  const nullable = isNullable(s);
  const t = baseExpr(core(s), m, c);
  return nullable ? m.nullable(t) : t;
}

function baseExpr(s: Shape, m: TypeMap, c: Ctx): string {
  switch (s.k) {
    case "string":
      return m.str;
    case "integer":
      return m.int;
    case "number":
      return m.float;
    case "boolean":
      return m.bool;
    case "array":
      c.uses.add("list");
      return m.list(typeExpr(s.item, m, c));
    case "object":
      if (!s.fields.size) {
        c.uses.add("map");
        return m.map;
      }
      return c.names.get(s) ?? m.any;
    case "union":
      if (m.union) return m.union(s.options.map((o) => baseExpr(o, m, c)));
      c.uses.add("any");
      return m.any;
    default:
      c.uses.add("any");
      return m.any;
  }
}

/** Pads every column but the last so they line up. */
function align(rows: string[][], indent: string): string[] {
  const widths: number[] = [];
  for (const r of rows)
    r.forEach((cell, i) => {
      if (i < r.length - 1) widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  return rows.map(
    (r) =>
      indent +
      r
        .map((cell, i) => (i < r.length - 1 ? cell.padEnd(widths[i] ?? 0) : cell))
        .join(" ")
        .trimEnd(),
  );
}

const q = (s: string) => JSON.stringify(s);

/* --- Generators ----------------------------------------------------------- */

interface Gen {
  ctx: Ctx;
  /** Named object shapes with fields, parents first. */
  pre: Named[];
  /** The same, dependencies first. */
  post: Named[];
  root: Shape;
  rootName: string;
}

function prepare(value: unknown, o: CodeOptions): Gen {
  const root = infer(value, o.rootName, { ints: true });
  const { names, pre, post } = nameShapes(root, o.rootName, TAKEN[o.lang]);
  const keep = (n: Named) => n.shape.fields.size > 0;
  return {
    ctx: { names, uses: new Set() },
    pre: pre.filter(keep),
    post: post.filter(keep),
    root,
    rootName: pascal(o.rootName),
  };
}

/** The root alias line, when the root is not an object with fields. */
function rootAlias(g: Gen, m: TypeMap): string | null {
  if (g.root.k === "object" && g.root.fields.size) return null;
  return typeExpr(g.root, m, g.ctx);
}

const GO: TypeMap = {
  str: "string",
  int: "int64",
  float: "float64",
  bool: "bool",
  any: "any",
  map: "map[string]any",
  list: (t) => `[]${t}`,
  nullable: (t) => (/^(\[\]|map\[|any$|\*)/.test(t) ? t : `*${t}`),
};

function toGo(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const blocks: string[] = [];
  const alias = rootAlias(g, GO);
  if (alias) blocks.push(`type ${g.rootName} ${alias}`);
  for (const { name, shape } of g.pre) {
    const rows = props(shape, (k) => pascalId(k, true), "go").map((p) => {
      const tag = `${p.key}${p.optional ? ",omitempty" : ""}`.replace(/[`"\\]/g, (c) =>
        c === "`" ? "\\x60" : `\\${c}`,
      );
      const t = baseExpr(core(p.shape), GO, g.ctx);
      return [p.id, p.nullable ? GO.nullable(t) : t, `\`json:"${tag}"\``];
    });
    blocks.push(`type ${name} struct {\n${align(rows, "\t").join("\n")}\n}`);
  }
  return `package main\n\n${blocks.join("\n\n")}\n`;
}

const RUST: TypeMap = {
  str: "String",
  int: "i64",
  float: "f64",
  bool: "bool",
  any: "serde_json::Value",
  map: "serde_json::Map<String, serde_json::Value>",
  list: (t) => `Vec<${t}>`,
  nullable: (t) => `Option<${t}>`,
};

function toRust(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const blocks: string[] = [];
  const alias = rootAlias(g, RUST);
  if (alias) blocks.push(`pub type ${g.rootName} = ${alias};`);
  for (const { name, shape } of g.pre) {
    const lines: string[] = [];
    for (const p of props(shape, snake, "rust")) {
      if (bare(p.id) !== p.key) lines.push(`    #[serde(rename = ${q(p.key)})]`);
      if (p.optional) lines.push(`    #[serde(default, skip_serializing_if = "Option::is_none")]`);
      const t = baseExpr(core(p.shape), RUST, g.ctx);
      lines.push(`    pub ${p.id}: ${p.nullable ? RUST.nullable(t) : t},`);
    }
    blocks.push(
      `#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ${name} {\n${lines.join("\n")}\n}`,
    );
  }
  return `use serde::{Deserialize, Serialize};\n\n${blocks.join("\n\n")}\n`;
}

const KOTLIN: TypeMap = {
  str: "String",
  int: "Long",
  float: "Double",
  bool: "Boolean",
  any: "JsonElement",
  map: "JsonObject",
  list: (t) => `List<${t}>`,
  nullable: (t) => `${t}?`,
};

function toKotlin(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const blocks: string[] = [];
  const alias = rootAlias(g, KOTLIN);
  if (alias) blocks.push(`typealias ${g.rootName} = ${alias}`);
  let renamed = false;
  for (const { name, shape } of g.pre) {
    const lines: string[] = [];
    for (const p of props(shape, camel, "kotlin")) {
      const ann = bare(p.id) !== p.key ? `@SerialName(${q(p.key).replace(/\$/g, "\\$")}) ` : "";
      if (ann) renamed = true;
      const t = baseExpr(core(p.shape), KOTLIN, g.ctx);
      const type = p.nullable ? KOTLIN.nullable(t) : t;
      lines.push(`    ${ann}val ${p.id}: ${type}${p.optional ? " = null" : ""},`);
    }
    blocks.push(`@Serializable\ndata class ${name}(\n${lines.join("\n")}\n)`);
  }
  const imports = [
    renamed && "import kotlinx.serialization.SerialName",
    g.pre.length && "import kotlinx.serialization.Serializable",
    g.ctx.uses.has("any") && "import kotlinx.serialization.json.JsonElement",
    g.ctx.uses.has("map") && "import kotlinx.serialization.json.JsonObject",
  ].filter((x): x is string => !!x);
  return `${imports.length ? `${imports.join("\n")}\n\n` : ""}${blocks.join("\n\n")}\n`;
}

const BOX: Record<string, string> = { long: "Long", double: "Double", boolean: "Boolean" };
const JAVA: TypeMap = {
  str: "String",
  int: "long",
  float: "double",
  bool: "boolean",
  any: "Object",
  map: "Map<String, Object>",
  list: (t) => `List<${BOX[t] ?? t}>`,
  nullable: (t) => BOX[t] ?? t,
};

function toJava(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const blocks: string[] = [];
  const alias = rootAlias(g, JAVA);
  if (alias) blocks.push(`// ${g.rootName}: ${alias}`);
  let renamed = false;
  g.pre.forEach(({ name, shape }, i) => {
    const pub = i === 0 ? "public " : "";
    const ps = props(shape, camel, "java").map((p) => {
      const t = baseExpr(core(p.shape), JAVA, g.ctx);
      const ann = p.id !== p.key ? `@JsonProperty(${q(p.key)})` : "";
      if (ann) renamed = true;
      return { ...p, type: p.nullable ? JAVA.nullable(t) : t, ann };
    });
    if (o.java === "record") {
      const params = ps.map((p) => `    ${p.ann ? `${p.ann} ` : ""}${p.type} ${p.id}`);
      blocks.push(`${pub}record ${name}(\n${params.join(",\n")}\n) {}`);
      return;
    }
    const fields = ps.map((p) => `${p.ann ? `    ${p.ann}\n` : ""}    private ${p.type} ${p.id};`);
    const access = ps.map((p) => {
      const n = cap(p.id);
      return [
        `    public ${p.type} ${p.type === "boolean" ? "is" : "get"}${n}() {\n        return ${p.id};\n    }`,
        `    public void set${n}(${p.type} ${p.id}) {\n        this.${p.id} = ${p.id};\n    }`,
      ].join("\n\n");
    });
    blocks.push(`${pub}class ${name} {\n${fields.join("\n")}\n\n${access.join("\n\n")}\n}`);
  });
  const imports = [
    renamed && "import com.fasterxml.jackson.annotation.JsonProperty;",
    g.ctx.uses.has("list") && "import java.util.List;",
    g.ctx.uses.has("map") && "import java.util.Map;",
  ].filter((x): x is string => !!x);
  return `${imports.length ? `${imports.join("\n")}\n\n` : ""}${blocks.join("\n\n")}\n`;
}

const CSHARP: TypeMap = {
  str: "string",
  int: "long",
  float: "double",
  bool: "bool",
  any: "object",
  map: "Dictionary<string, object>",
  list: (t) => `List<${t}>`,
  nullable: (t) => (t.endsWith("?") ? t : `${t}?`),
};

function toCSharp(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const blocks: string[] = [];
  const alias = rootAlias(g, CSHARP);
  if (alias) blocks.push(`// ${g.rootName}: ${alias}`);
  for (const { name, shape } of g.pre) {
    const params = props(shape, (k) => pascalId(k), "csharp").map((p) => {
      const t = baseExpr(core(p.shape), CSHARP, g.ctx);
      const id = p.id === name ? `${p.id}Value` : p.id;
      return `    [property: JsonPropertyName(${q(p.key)})] ${p.nullable ? CSHARP.nullable(t) : t} ${id}`;
    });
    blocks.push(`public record ${name}(\n${params.join(",\n")}\n);`);
  }
  const imports = [
    (g.ctx.uses.has("list") || g.ctx.uses.has("map")) && "using System.Collections.Generic;",
    g.pre.length && "using System.Text.Json.Serialization;",
  ].filter((x): x is string => !!x);
  return `${imports.length ? `${imports.join("\n")}\n\n` : ""}${blocks.join("\n\n")}\n`;
}

const PYTHON: TypeMap = {
  str: "str",
  int: "int",
  float: "float",
  bool: "bool",
  any: "Any",
  map: "dict[str, Any]",
  list: (t) => `list[${t}]`,
  nullable: (t) => (t === "Any" || t.endsWith("| None") ? t : `${t} | None`),
  union: (ts) => ts.join(" | "),
};

function toPython(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const pyd = o.python === "pydantic";
  const blocks: string[] = [];
  let aliased = false;
  for (const { name, shape } of g.post) {
    let ps = props(shape, snake, "python");
    // A dataclass field with a default cannot come before one without.
    if (!pyd) ps = [...ps.filter((p) => !p.nullable), ...ps.filter((p) => p.nullable)];
    const lines = ps.map((p) => {
      const t = baseExpr(core(p.shape), PYTHON, g.ctx);
      const type = p.nullable ? PYTHON.nullable(t) : t;
      const renamed = p.id !== p.key;
      if (pyd && renamed) {
        aliased = true;
        const def = p.nullable ? "default=None, " : "";
        return `    ${p.id}: ${type} = Field(${def}alias=${q(p.key)})`;
      }
      const note = renamed ? `  # JSON key: ${q(p.key)}` : "";
      return `    ${p.id}: ${type}${p.nullable ? " = None" : ""}${note}`;
    });
    const head = pyd ? `class ${name}(BaseModel):` : `@dataclass\nclass ${name}:`;
    const config =
      pyd && ps.some((p) => p.id !== p.key)
        ? ["    model_config = ConfigDict(populate_by_name=True)", ""]
        : [];
    blocks.push([head, ...config, ...lines].join("\n"));
  }
  const alias = rootAlias(g, PYTHON);
  if (alias) blocks.push(`${g.rootName} = ${alias}`);
  const imports: string[] = [];
  if (!pyd && g.post.length) imports.push("from dataclasses import dataclass");
  if (g.ctx.uses.has("any") || g.ctx.uses.has("map")) imports.push("from typing import Any");
  if (pyd && g.post.length) {
    if (imports.length) imports.push("");
    imports.push(`from pydantic import BaseModel${aliased ? ", ConfigDict, Field" : ""}`);
  }
  return `${imports.length ? `${imports.join("\n")}\n\n\n` : ""}${blocks.join("\n\n\n")}\n`;
}

const SWIFT: TypeMap = {
  str: "String",
  int: "Int",
  float: "Double",
  bool: "Bool",
  any: "JSONValue",
  map: "[String: JSONValue]",
  list: (t) => `[${t}]`,
  nullable: (t) => `${t}?`,
};

const SWIFT_JSON_VALUE = `/// Any JSON value, for fields whose type varies.
enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
}`;

function toSwift(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const blocks: string[] = [];
  const alias = rootAlias(g, SWIFT);
  if (alias) blocks.push(`typealias ${g.rootName} = ${alias}`);
  for (const { name, shape } of g.pre) {
    const ps = props(shape, camel, "swift");
    const lines = ps.map((p) => {
      const t = baseExpr(core(p.shape), SWIFT, g.ctx);
      return `    let ${p.id}: ${p.nullable ? SWIFT.nullable(t) : t}`;
    });
    if (ps.some((p) => bare(p.id) !== p.key)) {
      lines.push("", "    enum CodingKeys: String, CodingKey {");
      for (const p of ps)
        lines.push(`        case ${p.id}${bare(p.id) !== p.key ? ` = ${q(p.key)}` : ""}`);
      lines.push("    }");
    }
    blocks.push(`struct ${name}: Codable {\n${lines.join("\n")}\n}`);
  }
  if (g.ctx.uses.has("any") || g.ctx.uses.has("map")) blocks.push(SWIFT_JSON_VALUE);
  return `import Foundation\n\n${blocks.join("\n\n")}\n`;
}

const DART: TypeMap = {
  str: "String",
  int: "int",
  float: "double",
  bool: "bool",
  any: "dynamic",
  map: "Map<String, dynamic>",
  list: (t) => `List<${t}>`,
  nullable: (t) => (t === "dynamic" || t.endsWith("?") ? t : `${t}?`),
};

function dartStr(s: string): string {
  return `'${s.replace(/[\\'$]/g, (c) => `\\${c}`).replace(/\n/g, "\\n")}'`;
}

/** A Dart expression that reads `src` (from decoded JSON) as the shape. */
function dartDecode(s: Shape, src: string, c: Ctx, depth: number): string {
  const nullable = isNullable(s);
  const k = core(s);
  const n = nullable ? "?" : "";
  const v = depth ? `e${depth}` : "e";
  switch (k.k) {
    case "string":
      return `${src} as String${n}`;
    case "boolean":
      return `${src} as bool${n}`;
    case "integer":
      return `${src} as int${n}`;
    case "number":
      return `(${src} as num${n})${n}.toDouble()`;
    case "array": {
      const item = dartDecode(k.item, v, c, depth + 1);
      const list = `(${src} as List<dynamic>${n})`;
      return item === v ? `${list}${n}.toList()` : `${list}${n}.map((${v}) => ${item}).toList()`;
    }
    case "object": {
      const name = k.fields.size ? c.names.get(k) : undefined;
      if (!name) return `${src} as Map<String, dynamic>${n}`;
      const d = `${name}.fromJson(${src} as Map<String, dynamic>)`;
      return nullable ? `${src} == null ? null : ${d}` : d;
    }
    default:
      return src;
  }
}

/** Whether writing the shape back to JSON needs a conversion (it holds a class). */
function dartNeedsEncode(s: Shape, c: Ctx): boolean {
  const k = core(s);
  if (k.k === "object") return k.fields.size > 0 && c.names.has(k);
  if (k.k === "array") return dartNeedsEncode(k.item, c);
  return false;
}

function dartEncode(s: Shape, expr: string, c: Ctx, depth: number): string {
  if (!dartNeedsEncode(s, c)) return expr;
  const n = isNullable(s) ? "?" : "";
  const k = core(s);
  const v = depth ? `e${depth}` : "e";
  if (k.k === "array")
    return `${expr}${n}.map((${v}) => ${dartEncode(k.item, v, c, depth + 1)}).toList()`;
  return `${expr}${n}.toJson()`;
}

function toDart(value: unknown, o: CodeOptions): string {
  const g = prepare(value, o);
  const blocks: string[] = [];
  const alias = rootAlias(g, DART);
  if (alias) blocks.push(`typedef ${g.rootName} = ${alias};`);
  for (const { name, shape } of g.pre) {
    const ps = props(shape, camel, "dart").map((p) => {
      const t = baseExpr(core(p.shape), DART, g.ctx);
      return { ...p, type: p.nullable ? DART.nullable(t) : t };
    });
    const fields = ps.map((p) => `  final ${p.type} ${p.id};`);
    const params = ps.map((p) => `${p.nullable ? "" : "required "}this.${p.id}`);
    const ctor =
      params.length > 2
        ? `  const ${name}({\n${params.map((x) => `    ${x},`).join("\n")}\n  });`
        : `  const ${name}({${params.join(", ")}});`;
    const from = ps.map(
      (p) =>
        `        ${p.id}: ${dartDecode(p.optional ? withNull(p.shape) : p.shape, `json[${dartStr(p.key)}]`, g.ctx, 0)},`,
    );
    const to = ps.map(
      (p) =>
        `        ${dartStr(p.key)}: ${dartEncode(p.optional ? withNull(p.shape) : p.shape, p.id, g.ctx, 0)},`,
    );
    blocks.push(
      [
        `class ${name} {`,
        ...fields,
        "",
        ctor,
        "",
        `  factory ${name}.fromJson(Map<String, dynamic> json) => ${name}(`,
        ...from,
        "      );",
        "",
        "  Map<String, dynamic> toJson() => {",
        ...to,
        "      };",
        "}",
      ].join("\n"),
    );
  }
  return `${blocks.join("\n\n")}\n`;
}

function withNull(s: Shape): Shape {
  return isNullable(s)
    ? s
    : { k: "union", options: [...(s.k === "union" ? s.options : [s]), { k: "null" }] };
}

const GENERATORS: Record<Lang, (value: unknown, o: CodeOptions) => string> = {
  go: toGo,
  rust: toRust,
  kotlin: toKotlin,
  java: toJava,
  csharp: toCSharp,
  python: toPython,
  swift: toSwift,
  dart: toDart,
};

/** Type declarations for a JSON value in the chosen language. */
export function toCode(value: unknown, o: CodeOptions): string {
  return GENERATORS[o.lang](value, o);
}
