/**
 * JSON Schema (draft 2020-12): infer a schema from a JSON sample, and validate a document
 * against a schema. The validator covers the common keywords (type, enum, const, properties,
 * required, additionalProperties, patternProperties, items, prefixItems, min/max of every kind,
 * pattern, uniqueItems, allOf/anyOf/oneOf/not, if/then/else, a few formats, and $ref inside the
 * same document); unknown keywords are ignored, like the spec asks.
 */
import { type L10n, l, tr } from "../../../i18n";
import { infer, type Shape, stringFormat } from "../_infer";
import { isPlainObject, type Path } from "../_shared";

export const DRAFT = "https://json-schema.org/draft/2020-12/schema";

export interface InferSchemaOptions {
  /** Add "format" for strings that all look like dates, emails, URIs… */
  formats: boolean;
  /** additionalProperties: false on every object. */
  strict: boolean;
}

type Schema = Record<string, unknown>;

function shapeSchema(s: Shape, o: InferSchemaOptions): Schema {
  switch (s.k) {
    case "string":
      return s.format ? { type: "string", format: s.format } : { type: "string" };
    case "integer":
    case "number":
    case "boolean":
    case "null":
      return { type: s.k };
    case "unknown":
      return {};
    case "array": {
      const items = shapeSchema(s.item, o);
      return Object.keys(items).length ? { type: "array", items } : { type: "array" };
    }
    case "object": {
      const properties: Schema = {};
      const required: string[] = [];
      for (const [k, f] of s.fields) {
        Object.defineProperty(properties, k, {
          value: shapeSchema(f.shape, o),
          enumerable: true,
          writable: true,
          configurable: true,
        });
        if (!f.optional) required.push(k);
      }
      const out: Schema = { type: "object", properties };
      if (required.length) out.required = required;
      if (o.strict) out.additionalProperties = false;
      return out;
    }
    case "union": {
      const parts = s.options.map((x) => shapeSchema(x, o));
      // Plain types merge into one "type" list: {"type": ["string", "null"]}.
      const simple = parts.every(
        (p) => Object.keys(p).length === 1 || (p.type === "string" && Object.keys(p).length === 2),
      );
      const formats = parts.filter((p) => p.format);
      if (simple && formats.length <= 1) {
        const out: Schema = { type: parts.map((p) => p.type) };
        if (formats[0]) out.format = formats[0].format;
        return out;
      }
      return { anyOf: parts };
    }
  }
}

/** A draft 2020-12 schema describing the sample (keys missing from some array items are optional). */
export function inferSchema(value: unknown, o: InferSchemaOptions): Schema {
  const shape = infer(value, "root", { ints: true, formats: o.formats });
  return { $schema: DRAFT, ...shapeSchema(shape, o) };
}

/* --- Validation ----------------------------------------------------------- */

export type ErrorCode =
  | "type"
  | "enum"
  | "const"
  | "required"
  | "additional"
  | "minimum"
  | "maximum"
  | "exclusiveMinimum"
  | "exclusiveMaximum"
  | "multipleOf"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "format"
  | "minItems"
  | "maxItems"
  | "uniqueItems"
  | "minProperties"
  | "maxProperties"
  | "anyOf"
  | "oneOf"
  | "not"
  | "false"
  | "ref"
  | "badPattern"
  | "depth";

export interface SchemaError {
  path: Path;
  code: ErrorCode;
  /** What the schema asked for (a type list, a limit, a pattern, a key…). */
  expected?: string;
  /** What the document has. */
  actual?: string;
}

export function jsonType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

/** Deep equality of JSON values (key order does not matter). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => jsonEqual(x, b[i]));
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => Object.hasOwn(b, k) && jsonEqual(a[k], b[k]));
  }
  return false;
}

const FORMAT_CHECK: Record<string, (s: string) => boolean> = {
  "date-time": (s) => stringFormat(s) === "date-time" && !Number.isNaN(Date.parse(s)),
  date: (s) => stringFormat(s) === "date",
  time: (s) => /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?$/.test(s),
  email: (s) => stringFormat(s) === "email",
  uuid: (s) => stringFormat(s) === "uuid",
  uri: (s) => /^[a-z][a-z0-9+.-]*:\S*$/i.test(s),
  ipv4: (s) => stringFormat(s) === "ipv4",
};

/** Resolves "#", "#/$defs/x" or any JSON pointer inside the root schema. */
function resolveRef(root: unknown, ref: string): unknown {
  if (ref === "#") return root;
  if (!ref.startsWith("#/")) return undefined;
  let cur: unknown = root;
  for (const raw of ref.slice(2).split("/")) {
    const part = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(cur)) cur = cur[Number(part)];
    else if (isPlainObject(cur) && Object.hasOwn(cur, part)) cur = cur[part];
    else return undefined;
  }
  return cur;
}

export interface ValidateOptions {
  /** Check "format" (date-time, date, time, email, uri, uuid, ipv4). Default true. */
  formats?: boolean;
  /** Stop after this many errors. Default 200. */
  max?: number;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** Every way `doc` breaks `schema`, with the path of the value concerned. Empty when valid. */
export function validate(doc: unknown, schema: unknown, o: ValidateOptions = {}): SchemaError[] {
  const formats = o.formats ?? true;
  const max = o.max ?? 200;
  const regexes = new Map<string, RegExp | null>();
  const regex = (p: string) => {
    if (!regexes.has(p)) {
      try {
        regexes.set(p, new RegExp(p, "u"));
      } catch {
        regexes.set(p, null);
      }
    }
    return regexes.get(p) ?? null;
  };

  const check = (v: unknown, s: unknown, path: Path, depth: number, out: SchemaError[]): void => {
    if (out.length >= max) return;
    if (s === true || s === undefined) return;
    if (s === false) {
      out.push({ path, code: "false" });
      return;
    }
    if (!isPlainObject(s)) return;
    if (depth > 64) {
      out.push({ path, code: "depth" });
      return;
    }
    const err = (code: ErrorCode, expected?: unknown, actual?: unknown) => {
      const e: SchemaError = { path, code };
      if (expected !== undefined) e.expected = str(expected);
      if (actual !== undefined) e.actual = str(actual);
      out.push(e);
    };
    /** The errors of `v` against a sub-schema, without reporting them. */
    const passes = (sub: unknown) => {
      const tmp: SchemaError[] = [];
      check(v, sub, path, depth + 1, tmp);
      return tmp;
    };

    if (typeof s.$ref === "string") {
      const target = resolveRef(schema, s.$ref);
      if (target === undefined) err("ref", s.$ref);
      else check(v, target, path, depth + 1, out);
    }

    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      const t = jsonType(v);
      const ok = types.some((x) => x === t || (x === "number" && t === "integer"));
      if (!ok) {
        err("type", types.join(" | "), t);
        return; // Further checks would only repeat the problem.
      }
    }
    if (Array.isArray(s.enum) && !s.enum.some((x) => jsonEqual(x, v)))
      err("enum", s.enum.map((x) => JSON.stringify(x)).join(", "), JSON.stringify(v));
    if ("const" in s && !jsonEqual(s.const, v))
      err("const", JSON.stringify(s.const), JSON.stringify(v));

    if (typeof v === "number") {
      if (num(s.minimum) && v < s.minimum) err("minimum", s.minimum, v);
      if (num(s.maximum) && v > s.maximum) err("maximum", s.maximum, v);
      if (num(s.exclusiveMinimum) && v <= s.exclusiveMinimum)
        err("exclusiveMinimum", s.exclusiveMinimum, v);
      if (num(s.exclusiveMaximum) && v >= s.exclusiveMaximum)
        err("exclusiveMaximum", s.exclusiveMaximum, v);
      if (num(s.multipleOf) && s.multipleOf > 0) {
        const r = v / s.multipleOf;
        if (Math.abs(r - Math.round(r)) > 1e-9) err("multipleOf", s.multipleOf, v);
      }
    }

    if (typeof v === "string") {
      const len = [...v].length;
      if (num(s.minLength) && len < s.minLength) err("minLength", s.minLength, len);
      if (num(s.maxLength) && len > s.maxLength) err("maxLength", s.maxLength, len);
      if (typeof s.pattern === "string") {
        const re = regex(s.pattern);
        if (!re) err("badPattern", s.pattern);
        else if (!re.test(v)) err("pattern", s.pattern, v);
      }
      if (formats && typeof s.format === "string") {
        const f = FORMAT_CHECK[s.format];
        if (f && !f(v)) err("format", s.format, v);
      }
    }

    if (Array.isArray(v)) {
      if (num(s.minItems) && v.length < s.minItems) err("minItems", s.minItems, v.length);
      if (num(s.maxItems) && v.length > s.maxItems) err("maxItems", s.maxItems, v.length);
      if (s.uniqueItems === true) {
        outer: for (let i = 0; i < v.length; i++)
          for (let j = 0; j < i; j++)
            if (jsonEqual(v[i], v[j])) {
              err("uniqueItems", undefined, `${j}, ${i}`);
              break outer;
            }
      }
      const prefix = Array.isArray(s.prefixItems) ? s.prefixItems : [];
      v.forEach((item, i) => {
        const sub = i < prefix.length ? prefix[i] : s.items;
        if (sub !== undefined) check(item, sub, [...path, i], depth + 1, out);
      });
    }

    if (isPlainObject(v)) {
      const keys = Object.keys(v);
      if (num(s.minProperties) && keys.length < s.minProperties)
        err("minProperties", s.minProperties, keys.length);
      if (num(s.maxProperties) && keys.length > s.maxProperties)
        err("maxProperties", s.maxProperties, keys.length);
      if (Array.isArray(s.required))
        for (const k of s.required)
          if (typeof k === "string" && !Object.hasOwn(v, k)) err("required", k);
      const props = isPlainObject(s.properties) ? s.properties : {};
      const patterns = isPlainObject(s.patternProperties)
        ? Object.entries(s.patternProperties)
        : [];
      for (const k of keys) {
        let matched = false;
        if (Object.hasOwn(props, k)) {
          matched = true;
          check(v[k], props[k], [...path, k], depth + 1, out);
        }
        for (const [p, sub] of patterns) {
          const re = regex(p);
          if (re?.test(k)) {
            matched = true;
            check(v[k], sub, [...path, k], depth + 1, out);
          }
        }
        if (!matched && s.additionalProperties !== undefined) {
          if (s.additionalProperties === false)
            out.push({ path: [...path, k], code: "additional", expected: k });
          else check(v[k], s.additionalProperties, [...path, k], depth + 1, out);
        }
      }
    }

    if (Array.isArray(s.allOf)) for (const sub of s.allOf) check(v, sub, path, depth + 1, out);
    if (Array.isArray(s.anyOf) && !s.anyOf.some((sub) => !passes(sub).length))
      err("anyOf", s.anyOf.length);
    if (Array.isArray(s.oneOf)) {
      const n = s.oneOf.filter((sub) => !passes(sub).length).length;
      if (n !== 1) err("oneOf", s.oneOf.length, n);
    }
    if (s.not !== undefined && !passes(s.not).length) err("not");
    if (s.if !== undefined) {
      const ok = !passes(s.if).length;
      const branch = ok ? s.then : s.else;
      if (branch !== undefined) check(v, branch, path, depth + 1, out);
    }
  };

  const out: SchemaError[] = [];
  check(doc, schema, [], 0, out);
  return out.slice(0, max);
}

/** Whether a parsed value can be a schema (an object or a boolean). */
export function isSchema(v: unknown): boolean {
  return typeof v === "boolean" || isPlainObject(v);
}

/* --- Messages ------------------------------------------------------------- */

const ERRORS = {
  type: l(
    "Expected {expected}, got {actual}.",
    "{expected} attendu, {actual} trouvé.",
    "{expected} erwartet, {actual} erhalten.",
  ),
  enum: l(
    "{actual} is not one of {expected}.",
    "{actual} ne fait pas partie de {expected}.",
    "{actual} ist keiner der Werte {expected}.",
  ),
  const: l(
    "Must be {expected}, got {actual}.",
    "Doit valoir {expected}, vaut {actual}.",
    "Muss {expected} sein, ist {actual}.",
  ),
  required: l(
    "Missing required key “{expected}”.",
    "Clé requise « {expected} » manquante.",
    "Erforderlicher Schlüssel „{expected}“ fehlt.",
  ),
  additional: l(
    "Key “{expected}” is not allowed.",
    "La clé « {expected} » n'est pas autorisée.",
    "Schlüssel „{expected}“ ist nicht erlaubt.",
  ),
  minimum: l(
    "{actual} is less than the minimum {expected}.",
    "{actual} est inférieur au minimum {expected}.",
    "{actual} ist kleiner als das Minimum {expected}.",
  ),
  maximum: l(
    "{actual} is more than the maximum {expected}.",
    "{actual} dépasse le maximum {expected}.",
    "{actual} ist größer als das Maximum {expected}.",
  ),
  exclusiveMinimum: l(
    "{actual} must be more than {expected}.",
    "{actual} doit être supérieur à {expected}.",
    "{actual} muss größer als {expected} sein.",
  ),
  exclusiveMaximum: l(
    "{actual} must be less than {expected}.",
    "{actual} doit être inférieur à {expected}.",
    "{actual} muss kleiner als {expected} sein.",
  ),
  multipleOf: l(
    "{actual} is not a multiple of {expected}.",
    "{actual} n'est pas un multiple de {expected}.",
    "{actual} ist kein Vielfaches von {expected}.",
  ),
  minLength: l(
    "Too short: {actual} characters, at least {expected}.",
    "Trop court : {actual} caractères, au moins {expected}.",
    "Zu kurz: {actual} Zeichen, mindestens {expected}.",
  ),
  maxLength: l(
    "Too long: {actual} characters, at most {expected}.",
    "Trop long : {actual} caractères, au plus {expected}.",
    "Zu lang: {actual} Zeichen, höchstens {expected}.",
  ),
  pattern: l(
    "Does not match the pattern {expected}.",
    "Ne correspond pas au motif {expected}.",
    "Entspricht nicht dem Muster {expected}.",
  ),
  format: l("Not a valid {expected}.", "{expected} invalide.", "Ungültiges Format: {expected}."),
  minItems: l(
    "{actual} items, at least {expected}.",
    "{actual} éléments, au moins {expected}.",
    "{actual} Elemente, mindestens {expected}.",
  ),
  maxItems: l(
    "{actual} items, at most {expected}.",
    "{actual} éléments, au plus {expected}.",
    "{actual} Elemente, höchstens {expected}.",
  ),
  uniqueItems: l(
    "Items {actual} are equal.",
    "Les éléments {actual} sont identiques.",
    "Die Elemente {actual} sind gleich.",
  ),
  minProperties: l(
    "{actual} keys, at least {expected}.",
    "{actual} clés, au moins {expected}.",
    "{actual} Schlüssel, mindestens {expected}.",
  ),
  maxProperties: l(
    "{actual} keys, at most {expected}.",
    "{actual} clés, au plus {expected}.",
    "{actual} Schlüssel, höchstens {expected}.",
  ),
  anyOf: l(
    "Matches none of the {expected} anyOf schemas.",
    "Ne correspond à aucun des {expected} schémas anyOf.",
    "Entspricht keinem der {expected} anyOf-Schemas.",
  ),
  oneOf: l(
    "Must match exactly one of the {expected} oneOf schemas, matches {actual}.",
    "Doit correspondre à exactement un des {expected} schémas oneOf, en respecte {actual}.",
    "Muss genau einem der {expected} oneOf-Schemas entsprechen, entspricht {actual}.",
  ),
  not: l(
    "Must not match the “not” schema.",
    "Ne doit pas correspondre au schéma « not ».",
    "Darf dem „not“-Schema nicht entsprechen.",
  ),
  false: l(
    "Not allowed here (schema false).",
    "Interdit ici (schéma false).",
    "Hier nicht erlaubt (Schema false).",
  ),
  ref: l(
    "Cannot resolve $ref {expected}.",
    "Impossible de résoudre le $ref {expected}.",
    "$ref {expected} kann nicht aufgelöst werden.",
  ),
  badPattern: l(
    "The schema's pattern {expected} is not a valid regex.",
    "Le motif {expected} du schéma n'est pas une regex valide.",
    "Das Muster {expected} des Schemas ist keine gültige Regex.",
  ),
  depth: l(
    "Too deeply nested (a $ref loop?).",
    "Imbrication trop profonde (une boucle de $ref ?).",
    "Zu tief verschachtelt (eine $ref-Schleife?).",
  ),
} satisfies Record<ErrorCode, L10n>;

/** A validation error as a sentence, in the current language (without its path). */
export function schemaErrorMessage(e: SchemaError): string {
  return tr(ERRORS[e.code])
    .replace("{expected}", e.expected ?? "")
    .replace("{actual}", e.actual ?? "");
}
