/**
 * JSON → TypeScript types and a Zod schema. The shape is inferred from the
 * sample: array items are merged (a key missing from some items becomes
 * optional, mixed items become a union), identical object shapes share one
 * named type.
 */
import { infer, type Named, nameShapes, pascal, type Shape } from "../_infer";

export { infer, merge, pascal, type Shape, singular } from "../_infer";

export interface Options {
  rootName: string;
  style: "interface" | "type";
  readonly: boolean;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

function key(k: string): string {
  return IDENT.test(k) ? k : JSON.stringify(k);
}

/** TypeScript declarations for a JSON value. */
export function toTypeScript(value: unknown, o: Options): string {
  const root = infer(value, o.rootName);
  const { names, pre } = nameShapes(root, o.rootName);
  const ro = o.readonly ? "readonly " : "";
  const expr = (s: Shape): string => {
    switch (s.k) {
      case "object":
        return names.get(s) ?? "unknown";
      case "array": {
        const inner = expr(s.item);
        return `${ro}${s.item.k === "union" ? `(${inner})` : inner}[]`;
      }
      case "union":
        return s.options.map(expr).join(" | ");
      default:
        return s.k;
    }
  };
  const body = (s: Named["shape"]) =>
    s.fields.size
      ? `{\n${[...s.fields]
          .map(([k, f]) => `  ${ro}${key(k)}${f.optional ? "?" : ""}: ${expr(f.shape)};`)
          .join("\n")}\n}`
      : "Record<string, unknown>";
  const blocks = pre.map(({ name, shape }) =>
    o.style === "interface" && shape.fields.size
      ? `export interface ${name} ${body(shape)}`
      : `export type ${name} = ${body(shape)};`,
  );
  const rootName = pascal(o.rootName);
  if (root.k !== "object") blocks.unshift(`export type ${rootName} = ${expr(root)};`);
  return `${blocks.join("\n\n")}\n`;
}

/** A Zod schema (dependencies first) and its inferred types. */
export function toZod(value: unknown, o: Options): string {
  const root = infer(value, o.rootName);
  const { names, post } = nameShapes(root, o.rootName);
  const ro = o.readonly ? ".readonly()" : "";
  const expr = (s: Shape): string => {
    switch (s.k) {
      case "object":
        return `${names.get(s) ?? "Unknown"}Schema`;
      case "array":
        return `z.array(${expr(s.item)})${ro}`;
      case "union": {
        const rest = s.options.filter((x) => x.k !== "null");
        if (rest.length === 1 && rest[0]) return `${expr(rest[0])}.nullable()`;
        const u = `z.union([${rest.map(expr).join(", ")}])`;
        return rest.length < s.options.length ? `${u}.nullable()` : u;
      }
      case "unknown":
        return "z.unknown()";
      default:
        return `z.${s.k}()`;
    }
  };
  const lines = ['import { z } from "zod";', ""];
  for (const { name, shape } of post) {
    const fields = [...shape.fields]
      .map(([k, f]) => `  ${key(k)}: ${expr(f.shape)}${f.optional ? ".optional()" : ""},`)
      .join("\n");
    lines.push(
      `export const ${name}Schema = z.object({${fields ? `\n${fields}\n` : ""}})${ro};`,
      `export type ${name} = z.infer<typeof ${name}Schema>;`,
      "",
    );
  }
  if (root.k !== "object") {
    const name = pascal(o.rootName);
    lines.push(
      `export const ${name}Schema = ${expr(root)};`,
      `export type ${name} = z.infer<typeof ${name}Schema>;`,
      "",
    );
  }
  return lines.join("\n");
}
