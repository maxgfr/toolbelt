/** Data & formats tools. Each command imports its tool's logic lazily, so only what runs gets loaded. */
import type { Located } from "../../src/tools/data/_shared";
import type { Delimiter } from "../../src/tools/data/csv/logic";
import { table } from "../format";
import { CliError, type CommandGroup, type Ctx, UsageError } from "../types";

/* --- Helpers --------------------------------------------------------------- */

function at(e: { line: number; column: number }): string {
  return `line ${e.line}, column ${e.column}`;
}

function invalid(what: string, e: Located): CliError {
  return new CliError(`invalid ${what} at ${at(e)}: ${e.message}`);
}

/** The input as text; an empty (or blank) input is a usage error. */
async function input(ctx: Ctx): Promise<string> {
  const text = await ctx.text();
  if (!text.trim()) throw new UsageError(`empty input (see: toolbelt help ${ctx.command})`);
  return text;
}

async function parseJsonOrFail(text: string, what = "JSON"): Promise<unknown> {
  const { parseJson } = await import("../../src/tools/data/json/logic");
  const p = parseJson(text);
  if (!p.ok) throw invalid(what, p);
  return p.value;
}

/**
 * Two inputs (old/new, schema/document): each one inline with its option, else the next
 * positional file. Returns the texts and the names to show.
 */
async function twoInputs(
  ctx: Ctx,
  names: [string, string],
  usage: string,
): Promise<[{ text: string; name: string }, { text: string; name: string }]> {
  const files = [...ctx.args];
  const side = async (name: string) => {
    const inline = ctx.str(name);
    if (inline !== undefined) return { text: inline, name };
    const f = files.shift();
    return f === undefined ? undefined : { text: await ctx.readTextFile(f), name: f };
  };
  const a = await side(names[0]);
  const b = await side(names[1]);
  if (!a || !b) throw new UsageError(usage);
  if (files.length) throw new UsageError(`unexpected argument "${files[0]}"`);
  return [a, b];
}

/** `--delimiter` names → the logic's delimiters. */
const DELIMITERS: Record<string, Delimiter> = {
  auto: "auto",
  ",": ",",
  comma: ",",
  ";": ";",
  semicolon: ";",
  tab: "\t",
  "\t": "\t",
  "|": "|",
  pipe: "|",
};

/** Quick look: does the text parse as JSON? */
async function isJson(text: string): Promise<boolean> {
  const { parseJson } = await import("../../src/tools/data/json/logic");
  return parseJson(text).ok;
}

/* --- Commands -------------------------------------------------------------- */

export const group: CommandGroup = {
  category: "data",
  commands: [
    {
      name: "json",
      tool: "json",
      summary: "Validate, format, minify or sort the keys of JSON (errors with line and column).",
      usage: "toolbelt json [text] [--indent 2|4|tab] [--minify] [--sort-keys] [--check]",
      options: [
        {
          name: "indent",
          type: "string",
          values: ["2", "4", "tab"],
          desc: "Indentation.",
          default: "2",
        },
        { name: "minify", alias: "m", type: "boolean", desc: "One line, no spaces." },
        { name: "sort-keys", alias: "s", type: "boolean", desc: "Sort object keys (recursively)." },
        {
          name: "check",
          type: "boolean",
          desc: "Only validate: print a summary instead of the document.",
        },
      ],
      examples: [
        { cmd: 'toolbelt json \'{"b":1,"a":[1,2]}\' --sort-keys' },
        { cmd: "toolbelt json --file data.json --minify" },
        {
          cmd: "toolbelt json --file data.json --check",
          desc: "Exit 1 with line:column if invalid.",
        },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const value = await parseJsonOrFail(text);
        const { formatJson, jsonInfo } = await import("../../src/tools/data/json/logic");
        const info = jsonInfo(value);
        if (ctx.bool("check"))
          return {
            text: `Valid JSON: ${info.objects} objects, ${info.arrays} arrays, ${info.keys} keys, depth ${info.depth}.`,
            json: { valid: true, ...info },
          };
        const indent = ctx.bool("minify") ? "min" : (ctx.str("indent", "2") as "2" | "4" | "tab");
        const out = formatJson(value, indent, ctx.bool("sort-keys"));
        return { text: out, json: { valid: true, ...info, output: out } };
      },
    },
    {
      name: "convert",
      tool: "convert",
      aliases: ["yaml"],
      summary: "Convert between JSON, YAML and TOML (input format detected, errors located).",
      usage:
        "toolbelt convert [text] [--from auto|json|yaml|toml] [--to json|yaml|toml] [--indent 2|4]",
      options: [
        {
          name: "from",
          type: "string",
          values: ["auto", "json", "yaml", "toml"],
          desc: "Input format.",
          default: "auto",
        },
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["json", "yaml", "toml"],
          desc: "Output format.",
          default: "yaml",
        },
        { name: "indent", type: "string", values: ["2", "4"], desc: "Indentation.", default: "2" },
      ],
      notes:
        "YAML with several documents (---) becomes a JSON array. TOML needs an object at the root and has no null (null keys are dropped).",
      examples: [
        { cmd: "toolbelt convert --file config.yaml --to json" },
        { cmd: "toolbelt convert --file Cargo.toml --to yaml" },
        { cmd: 'toolbelt convert \'{"name":"app","port":8080}\' --to toml' },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { parseInput, write } = await import("../../src/tools/data/convert/logic");
        const from = ctx.str("from", "auto") as "auto" | "json" | "yaml" | "toml";
        const to = ctx.str("to", "yaml") as "json" | "yaml" | "toml";
        const p = parseInput(text, from);
        if (!p.ok) throw invalid(from === "auto" ? "input" : from.toUpperCase(), p);
        const w = write(p.value, to, ctx.str("indent", "2") as "2" | "4");
        if (!w.ok)
          throw new CliError(
            w.error === "root"
              ? "TOML needs a table (an object) at the root, not a list or a single value."
              : `cannot write this as ${to.toUpperCase()}: ${w.error}`,
          );
        const warnings =
          w.warning === "nulls" ? ["TOML has no null: keys with a null value were left out."] : [];
        return { text: w.text, json: { from: p.format, to, output: w.text, warnings }, warnings };
      },
    },
    {
      name: "csv",
      tool: "csv",
      summary: "CSV to JSON, or JSON to CSV (direction detected; delimiter, header, typed cells).",
      usage:
        "toolbelt csv [text] [--to json|csv] [--delimiter auto|comma|semicolon|tab|pipe] [--no-header] [--shape objects|arrays] [--no-infer] [--minify]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["json", "csv"],
          desc: "Output format (default: CSV for JSON input, JSON otherwise).",
        },
        {
          name: "delimiter",
          alias: "d",
          type: "string",
          values: Object.keys(DELIMITERS).filter((k) => k !== "\t"),
          arg: "<auto|comma|semicolon|tab|pipe>",
          desc: "CSV delimiter (auto: detected when reading, comma when writing).",
          default: "auto",
        },
        {
          name: "header",
          type: "boolean",
          desc: "The first CSV row is a header (read) / write a header row. Use --no-header to turn off.",
          default: true,
        },
        {
          name: "shape",
          type: "string",
          values: ["objects", "arrays"],
          desc: "CSV → JSON rows as objects (keyed by header) or arrays.",
          default: "objects",
        },
        {
          name: "infer",
          type: "boolean",
          desc: "Type cells (numbers, booleans, null); --no-infer keeps text.",
          default: true,
        },
        { name: "minify", alias: "m", type: "boolean", desc: "One-line JSON." },
      ],
      notes: "JSON → CSV flattens nested objects into dotted column names (address.city).",
      examples: [
        { cmd: "toolbelt csv --file people.csv", desc: "CSV → JSON array of objects." },
        { cmd: 'toolbelt csv \'[{"name":"Ann","address":{"city":"Lyon"}}]\'', desc: "JSON → CSV." },
        { cmd: "toolbelt csv --file export.csv --delimiter semicolon --no-infer" },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const logic = await import("../../src/tools/data/csv/logic");
        const delimiter = DELIMITERS[ctx.str("delimiter", "auto")] ?? "auto";
        const header = ctx.bool("header", true);
        const to = ctx.str("to") ?? ((await isJson(text)) ? "csv" : "json");
        if (to === "csv") {
          const value = await parseJsonOrFail(text);
          const t = logic.jsonToTable(value);
          if (!t.ok)
            throw new CliError(
              "JSON → CSV needs an array (of objects, arrays or values) or an object.",
            );
          const out = logic.tableToCsv(t.header, t.rows, delimiter, header);
          return { text: out, json: { columns: t.header, rows: t.rows.length, output: out } };
        }
        const t = logic.parseCsv(text, delimiter, header);
        const shape = ctx.str("shape", "objects") as "objects" | "arrays";
        const rows = logic.tableToJson(t, shape, ctx.bool("infer", true), header);
        const out = ctx.bool("minify") ? JSON.stringify(rows) : JSON.stringify(rows, null, 2);
        const warnings = t.issues.map((i) =>
          i.kind === "quotes"
            ? `Line ${i.at}: unbalanced quotes.`
            : `Record ${i.at}: ${i.found} fields, expected ${i.expected}.`,
        );
        return {
          text: out,
          json: {
            delimiter: t.delimiter,
            columns: t.header,
            rows: t.rows.length,
            data: rows,
            warnings,
          },
          warnings,
        };
      },
    },
    {
      name: "markdown-table",
      tool: "markdown-table",
      aliases: ["md-table"],
      summary:
        "CSV, TSV or a JSON array to an aligned Markdown table, or a Markdown table back to CSV/TSV/JSON.",
      usage:
        "toolbelt markdown-table [text] [--to md|csv|tsv|json] [--align left|center|right|none|<list>] [--compact]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["md", "csv", "tsv", "json"],
          desc: "Output (default: CSV when the input is a Markdown table, Markdown otherwise).",
        },
        {
          name: "align",
          alias: "a",
          type: "string",
          arg: "<align|list>",
          desc: "Column alignment for every column, or a comma list per column (left,right,center,none).",
        },
        { name: "compact", type: "boolean", desc: "Do not pad the cells." },
      ],
      examples: [
        { cmd: "toolbelt markdown-table --file data.csv" },
        { cmd: 'toolbelt markdown-table \'[{"a":1,"b":2}]\' --align right' },
        {
          cmd: "toolbelt markdown-table --file README.md --to json",
          desc: "The first table, as JSON.",
        },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const logic = await import("../../src/tools/data/markdown-table/logic");
        const md = logic.parseMarkdownTable(text);
        const to = ctx.str("to") ?? (md.ok ? "csv" : "md");
        if (to !== "md") {
          if (!md.ok)
            throw new CliError("no Markdown table found (a header line, then a |---| line).");
          const out = logic.exportGrid(md.grid, to as "csv" | "tsv" | "json");
          return {
            text: out,
            json: { header: md.grid.header, rows: md.grid.rows, aligns: md.aligns, output: out },
          };
        }
        const r = logic.readTabular(text);
        if (!r.ok)
          throw r.error === "shape"
            ? new CliError("the JSON must be an array (of objects, arrays or values) or an object.")
            : invalid("JSON", r.error);
        const ALIGNS = ["left", "center", "right", "none"];
        const raw = ctx.str("align");
        let aligns: string[] = [];
        if (raw) {
          const parts = raw.split(",").map((s) => s.trim().toLowerCase());
          const bad = parts.find((p) => !ALIGNS.includes(p));
          if (bad)
            throw new UsageError(`--align values are left, center, right or none (got "${bad}")`);
          aligns = parts.length === 1 ? r.grid.header.map(() => parts[0] as string) : parts;
        }
        const out = logic.toMarkdown(
          r.grid,
          aligns as ("left" | "center" | "right" | "none")[],
          !ctx.bool("compact"),
        );
        return { text: out, json: { source: r.source, columns: r.grid.header, output: out } };
      },
    },
    {
      name: "json-to-ts",
      tool: "json-to-ts",
      summary: "TypeScript types or a Zod schema inferred from a JSON sample.",
      usage:
        "toolbelt json-to-ts [json] [--to ts|zod] [--root-name <Name>] [--style interface|type] [--readonly]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["ts", "zod"],
          desc: "Output.",
          default: "ts",
        },
        {
          name: "root-name",
          type: "string",
          arg: "<Name>",
          desc: "Name of the root type.",
          default: "Root",
        },
        {
          name: "style",
          type: "string",
          values: ["interface", "type"],
          desc: "TypeScript declarations.",
          default: "interface",
        },
        { name: "readonly", type: "boolean", desc: "readonly properties and arrays." },
      ],
      examples: [
        { cmd: 'toolbelt json-to-ts \'{"id":1,"tags":["a"],"owner":{"name":"Ann"}}\'' },
        { cmd: "toolbelt json-to-ts --file response.json --to zod --root-name User" },
      ],
      async run(ctx) {
        const value = await parseJsonOrFail(await input(ctx));
        const { toTypeScript, toZod } = await import("../../src/tools/data/json-to-ts/logic");
        const o = {
          rootName: ctx.str("root-name", "Root").trim() || "Root",
          style: ctx.str("style", "interface") as "interface" | "type",
          readonly: ctx.bool("readonly"),
        };
        const out = ctx.str("to", "ts") === "zod" ? toZod(value, o) : toTypeScript(value, o);
        return { text: out, json: { output: out } };
      },
    },
    {
      name: "json-diff",
      tool: "json-diff",
      summary:
        "Structural diff of two JSON documents: paths added, removed or changed (key order ignored).",
      usage:
        "toolbelt json-diff <old.json> <new.json> [--a <json>] [--b <json>] [--ignore-array-order] [--only added|removed|changed]",
      options: [
        {
          name: "a",
          type: "string",
          arg: "<json>",
          desc: "The old document, inline (instead of a file).",
        },
        {
          name: "b",
          type: "string",
          arg: "<json>",
          desc: "The new document, inline (instead of a file).",
        },
        {
          name: "ignore-array-order",
          type: "boolean",
          desc: "Compare arrays as multisets (order does not matter).",
        },
        {
          name: "only",
          type: "string",
          values: ["added", "removed", "changed"],
          desc: "Only this kind of change.",
        },
        { name: "exit-code", type: "boolean", desc: "Exit with 1 when the documents differ." },
      ],
      notes:
        "Output: one line per change, `+ $.path: value`, `- $.path: value`, `~ $.path: old → new`.",
      examples: [
        { cmd: "toolbelt json-diff old.json new.json" },
        {
          cmd: 'toolbelt json-diff --a \'{"a":1,"b":[1,2]}\' --b \'{"a":2,"b":[2,1]}\' --ignore-array-order',
        },
      ],
      async run(ctx) {
        const [a, b] = await twoInputs(
          ctx,
          ["a", "b"],
          "json-diff needs two documents: two files, or --a <json> --b <json>",
        );
        const va = await parseJsonOrFail(a.text, `JSON in ${a.name}`);
        const vb = await parseJsonOrFail(b.text, `JSON in ${b.name}`);
        const { diffJson, count, report } = await import("../../src/tools/data/json-diff/logic");
        const { formatPath } = await import("../../src/tools/data/_shared");
        const all = diffJson(va, vb, { ignoreArrayOrder: ctx.bool("ignore-array-order") });
        const only = ctx.str("only");
        const changes = only ? all.filter((c) => c.kind === only) : all;
        const counts = count(all);
        const code = ctx.bool("exit-code") && all.length ? 1 : 0;
        return {
          text: changes.length
            ? report(changes)
            : all.length
              ? `No ${only} values.`
              : "No differences.",
          json: {
            identical: !all.length,
            counts,
            changes: changes.map((c) => ({ ...c, path: formatPath(c.path) })),
          },
          code,
        };
      },
    },
    {
      name: "jsonpath",
      tool: "jsonpath",
      summary: "Run a JSONPath query ($.a.b[*], .., [?(@.price < 10)]) on a JSON document.",
      usage: "toolbelt jsonpath <query> [json] [--paths]",
      options: [
        {
          name: "paths",
          alias: "p",
          type: "boolean",
          desc: "Print the paths of the matches, not their values.",
        },
      ],
      notes:
        "The document comes after the query, or from --file or stdin. Supports $, .key, ['key'], [n], [-n], [start:end:step], [*], .., unions and filters (==, !=, <, <=, >, >=, !, &&, ||).",
      examples: [
        { cmd: "toolbelt jsonpath '$.store.book[*].author' --file store.json" },
        { cmd: "cat data.json | toolbelt jsonpath '$..[?(@.price < 10)].title'" },
      ],
      async run(ctx) {
        const [q, ...rest] = ctx.args;
        if (!q)
          throw new UsageError(
            "missing JSONPath query, e.g. toolbelt jsonpath '$.a[*]' --file doc.json",
          );
        let text: string;
        if (rest.length) text = rest.join(" ");
        else if (typeof ctx.opts.file === "string") text = await ctx.readTextFile(ctx.opts.file);
        else
          text = await ctx.readTextFile("-").catch(() => {
            throw new UsageError(
              "missing JSON document: after the query, with --file <path>, or on stdin",
            );
          });
        const doc = await parseJsonOrFail(text);
        const { query } = await import("../../src/tools/data/jsonpath/logic");
        const { formatPath } = await import("../../src/tools/data/_shared");
        const r = query(doc, q);
        if (!r.ok) {
          const col = r.error.pos + 1;
          const msg = {
            root: "a JSONPath starts with $.",
            empty: "empty query, e.g. $.store.book[*].author",
            unexpected: `unexpected character at column ${col}.`,
            expected: `expected ${r.error.expected === "name" ? "a name" : `"${r.error.expected}"`} at column ${col}.`,
            unterminated: `unclosed string starting at column ${col}.`,
          }[r.error.code];
          throw new CliError(`invalid JSONPath: ${msg}`);
        }
        const nodes = r.nodes.map((n) => ({ path: formatPath(n.path), value: n.value }));
        return {
          text: ctx.bool("paths")
            ? nodes.map((n) => n.path).join("\n")
            : JSON.stringify(
                nodes.map((n) => n.value),
                null,
                2,
              ),
          json: nodes,
        };
      },
    },
    {
      name: "sql",
      tool: "sql",
      summary: "Format SQL (many dialects, keyword case) or minify it to one line.",
      usage:
        "toolbelt sql [query] [--dialect <id>] [--keyword-case upper|lower|preserve] [--indent 2|4|tab] [--minify]",
      options: [
        {
          name: "dialect",
          alias: "d",
          type: "string",
          values: [
            "sql",
            "postgresql",
            "mysql",
            "mariadb",
            "sqlite",
            "transactsql",
            "plsql",
            "bigquery",
            "snowflake",
            "redshift",
            "duckdb",
            "clickhouse",
            "spark",
            "hive",
            "trino",
            "db2",
            "singlestoredb",
            "tidb",
            "n1ql",
          ],
          arg: "<dialect>",
          desc: "sql, postgresql, mysql, mariadb, sqlite, transactsql, plsql, bigquery, snowflake, redshift, duckdb, clickhouse, spark, hive, trino, db2, singlestoredb, tidb, n1ql.",
          default: "sql",
        },
        {
          name: "keyword-case",
          type: "string",
          values: ["upper", "lower", "preserve"],
          desc: "Case of keywords, types and functions.",
          default: "upper",
        },
        {
          name: "indent",
          type: "string",
          values: ["2", "4", "tab"],
          desc: "Indentation.",
          default: "2",
        },
        {
          name: "minify",
          alias: "m",
          type: "boolean",
          desc: "One line (strings and comments-hints kept).",
        },
      ],
      examples: [
        { cmd: 'toolbelt sql "select id, name from users where active = 1 order by name"' },
        { cmd: "toolbelt sql --file query.sql --dialect postgresql --keyword-case lower" },
        { cmd: "toolbelt sql --file query.sql --minify" },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { formatSql, minifySql } = await import("../../src/tools/data/sql/logic");
        const dialect = ctx.str("dialect", "sql") as Parameters<typeof minifySql>[1] & string;
        if (ctx.bool("minify")) {
          const out = minifySql(text, dialect);
          return { text: out, json: { output: out } };
        }
        const r = formatSql(text, {
          dialect,
          keywordCase: ctx.str("keyword-case", "upper") as "upper" | "lower" | "preserve",
          indent: ctx.str("indent", "2") as "2" | "4" | "tab",
        });
        if (!r.ok) throw invalid("SQL", r);
        return { text: r.text, json: { output: r.text } };
      },
    },
    {
      name: "xml",
      tool: "xml",
      summary: "Validate, format or minify XML (well-formedness errors with line and column).",
      usage:
        "toolbelt xml [text] [--indent 2|4|tab] [--minify] [--remove-comments] [--collapse] [--check]",
      options: [
        {
          name: "indent",
          type: "string",
          values: ["2", "4", "tab"],
          desc: "Indentation.",
          default: "2",
        },
        { name: "minify", alias: "m", type: "boolean", desc: "One line." },
        { name: "remove-comments", type: "boolean", desc: "Drop <!-- comments -->." },
        { name: "collapse", type: "boolean", desc: "Write empty elements as <tag/>." },
        {
          name: "check",
          type: "boolean",
          desc: "Only validate: print element/attribute counts and depth.",
        },
      ],
      notes: "XML → JSON is the json-xml command.",
      examples: [
        { cmd: "toolbelt xml '<a><b x=\"1\">hi</b></a>'" },
        { cmd: "toolbelt xml --file feed.xml --check" },
        { cmd: "toolbelt xml --file pom.xml --minify --remove-comments" },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { parseXml, writeXml, xmlStats, xmlErrorMessage } = await import(
          "../../src/tools/data/xml/logic"
        );
        const d = parseXml(text);
        if (!d.ok) throw new CliError(`invalid XML at ${at(d.error)}: ${xmlErrorMessage(d.error)}`);
        const stats = xmlStats(d.root);
        if (ctx.bool("check"))
          return {
            text: `Valid XML: root <${d.root.name}>, ${stats.elements} elements, ${stats.attributes} attributes, depth ${stats.depth}.`,
            json: { valid: true, root: d.root.name, ...stats },
          };
        const units = { "2": "  ", "4": "    ", tab: "\t" } as const;
        const out = writeXml(d.nodes, {
          indent: ctx.bool("minify") ? "" : units[ctx.str("indent", "2") as keyof typeof units],
          removeComments: ctx.bool("remove-comments"),
          collapseEmpty: ctx.bool("collapse"),
        });
        return { text: out, json: { valid: true, root: d.root.name, ...stats, output: out } };
      },
    },
    {
      name: "env",
      tool: "env",
      aliases: ["dotenv"],
      summary:
        ".env to JSON, or a JSON object to .env lines (dotenv rules; duplicates and bad lines reported).",
      usage: "toolbelt env [text] [--to json|env] [--export] [--sort]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["json", "env"],
          desc: "Output (default: .env for JSON input, JSON otherwise).",
        },
        { name: "export", type: "boolean", desc: ".env output: prefix lines with `export `." },
        { name: "sort", type: "boolean", desc: "Sort the keys." },
      ],
      examples: [
        { cmd: "toolbelt env --file .env", desc: "As a JSON object." },
        { cmd: 'toolbelt env \'{"PORT":8080,"NAME":"my app"}\' --export' },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { parseEnv, toEnv } = await import("../../src/tools/data/env/logic");
        const to = ctx.str("to") ?? ((await isJson(text)) ? "env" : "json");
        const sort = ctx.bool("sort");
        if (to === "env") {
          const w = toEnv(await parseJsonOrFail(text), { exportPrefix: ctx.bool("export"), sort });
          if (!w.ok) throw new CliError("expected a JSON object.");
          const warnings = [
            ...(w.badKeys.length ? [`Not valid variable names: ${w.badKeys.join(", ")}.`] : []),
            ...(w.nested.length ? [`Written as JSON text: ${w.nested.join(", ")}.`] : []),
          ];
          return { text: w.text, json: { output: w.text, warnings }, warnings };
        }
        const e = parseEnv(text);
        const values = sort
          ? Object.fromEntries(Object.entries(e.values).sort(([a], [b]) => a.localeCompare(b)))
          : e.values;
        const warnings = [
          ...e.issues.map((i) =>
            i.code === "no-equals"
              ? `Line ${i.line}: no "=" sign.`
              : i.code === "bad-key"
                ? `Line ${i.line}: invalid name "${i.key}".`
                : `Line ${i.line}: the quote of ${i.key} is never closed.`,
          ),
          ...e.duplicates.map(
            (d) =>
              `${d.key} is defined ${d.lines.length} times (lines ${d.lines.join(", ")}); the last one wins.`,
          ),
        ];
        return { text: JSON.stringify(values, null, 2), json: { values, warnings }, warnings };
      },
    },
    {
      name: "query-string",
      tool: "query-string",
      aliases: ["qs"],
      summary: "A query string (or a whole URL) to JSON, or a JSON object to a query string.",
      usage: "toolbelt query-string [text] [--to json|query] [--no-plus] [--no-brackets] [--infer]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["json", "query"],
          desc: "Output (default: a query string for JSON input, JSON otherwise).",
        },
        {
          name: "plus",
          type: "boolean",
          desc: 'Read "+" as a space and write spaces as "+" (forms); --no-plus uses %20.',
          default: true,
        },
        {
          name: "brackets",
          type: "boolean",
          desc: "Read and write a[b]=1 / a[]=1 as nesting; --no-brackets keeps keys flat.",
          default: true,
        },
        {
          name: "infer",
          type: "boolean",
          desc: 'Turn "1", "true", "null" into numbers, booleans, null.',
        },
      ],
      examples: [
        { cmd: "toolbelt query-string 'https://x.io/s?q=hello+world&tag=a&tag=b&page=2' --infer" },
        { cmd: 'toolbelt query-string \'{"q":"a b","filter":{"tags":["x","y"]}}\'' },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { parseQuery, toQuery } = await import("../../src/tools/data/query-string/logic");
        const o = {
          plus: ctx.bool("plus", true),
          brackets: ctx.bool("brackets", true),
          infer: ctx.bool("infer"),
        };
        const trimmed = text.trim();
        const to =
          ctx.str("to") ??
          ((trimmed.startsWith("{") || trimmed.startsWith("[")) && (await isJson(text))
            ? "query"
            : "json");
        if (to === "query") {
          const w = toQuery(await parseJsonOrFail(text), o);
          if (!w.ok) throw new CliError("expected a JSON object.");
          return { text: w.text, json: { output: w.text } };
        }
        const q = parseQuery(text, o);
        const warnings = [
          ...(q.badEncoding.length
            ? [`Broken %-encoding kept as typed: ${q.badEncoding.join(", ")}.`]
            : []),
          ...(q.conflicts.length
            ? [
                `Keys used both as a value and as a container (the later one wins): ${q.conflicts.join(", ")}.`,
              ]
            : []),
        ];
        return {
          text: JSON.stringify(q.value, null, 2),
          json: { value: q.value, pairs: q.pairs, warnings },
          warnings,
        };
      },
    },
    {
      name: "json-to-code",
      tool: "json-to-code",
      summary:
        "Types inferred from a JSON sample, in Go, Rust, Kotlin, Java, C#, Python, Swift or Dart.",
      usage:
        "toolbelt json-to-code [json] --to go|rust|kotlin|java|csharp|python|swift|dart [--root-name <Name>] [--java record|pojo] [--python dataclass|pydantic]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["go", "rust", "kotlin", "java", "csharp", "python", "swift", "dart"],
          desc: "Target language.",
          default: "go",
        },
        {
          name: "root-name",
          type: "string",
          arg: "<Name>",
          desc: "Name of the root type.",
          default: "Root",
        },
        {
          name: "java",
          type: "string",
          values: ["record", "pojo"],
          desc: "Java: records or classes.",
          default: "record",
        },
        {
          name: "python",
          type: "string",
          values: ["dataclass", "pydantic"],
          desc: "Python: dataclasses or Pydantic v2 models.",
          default: "dataclass",
        },
      ],
      examples: [
        { cmd: 'toolbelt json-to-code \'{"id":1,"name":"Ann","tags":["a"]}\' --to rust' },
        {
          cmd: "toolbelt json-to-code --file user.json --to python --python pydantic --root-name User",
        },
      ],
      async run(ctx) {
        const value = await parseJsonOrFail(await input(ctx));
        const { toCode } = await import("../../src/tools/data/json-to-code/logic");
        const out = toCode(value, {
          lang: ctx.str("to", "go") as Parameters<typeof toCode>[1]["lang"],
          rootName: ctx.str("root-name", "Root").trim() || "Root",
          java: ctx.str("java", "record") as "record" | "pojo",
          python: ctx.str("python", "dataclass") as "dataclass" | "pydantic",
        });
        return { text: out, json: { output: out } };
      },
    },
    {
      name: "json-schema",
      tool: "json-schema",
      summary:
        "Generate a JSON Schema (draft 2020-12) from a sample, or validate a document against a schema.",
      usage:
        "toolbelt json-schema [sample] [--no-formats] [--strict]  |  toolbelt json-schema --validate <schema.json> <doc.json> [--schema <json>] [--doc <json>]",
      options: [
        {
          name: "validate",
          alias: "V",
          type: "boolean",
          desc: "Validate a document (second file or --doc) against a schema (first file or --schema).",
        },
        { name: "schema", type: "string", arg: "<json>", desc: "--validate: the schema, inline." },
        { name: "doc", type: "string", arg: "<json>", desc: "--validate: the document, inline." },
        {
          name: "formats",
          type: "boolean",
          desc: 'Generate: add "format" for dates, emails, URIs… Validate: check formats. --no-formats to turn off.',
          default: true,
        },
        {
          name: "strict",
          type: "boolean",
          desc: "Generate: additionalProperties: false on every object.",
        },
      ],
      notes:
        "--validate exits with 1 when the document does not match, listing each problem with its path.",
      examples: [
        { cmd: "toolbelt json-schema --file sample.json --strict" },
        { cmd: "toolbelt json-schema --validate schema.json doc.json" },
        { cmd: 'toolbelt json-schema --validate --schema \'{"type":"integer"}\' --doc \'"x"\'' },
      ],
      async run(ctx) {
        const logic = await import("../../src/tools/data/json-schema/logic");
        const formats = ctx.bool("formats", true);
        if (!ctx.bool("validate")) {
          if (ctx.str("schema") !== undefined || ctx.str("doc") !== undefined)
            throw new UsageError("--schema and --doc need --validate");
          const value = await parseJsonOrFail(await input(ctx));
          const schema = logic.inferSchema(value, { formats, strict: ctx.bool("strict") });
          const out = JSON.stringify(schema, null, 2);
          return { text: out, json: schema };
        }
        const [s, d] = await twoInputs(
          ctx,
          ["schema", "doc"],
          "json-schema --validate needs a schema and a document: two files, or --schema <json> --doc <json>",
        );
        const schema = await parseJsonOrFail(s.text, `JSON in ${s.name}`);
        if (!logic.isSchema(schema))
          throw new CliError("a schema must be a JSON object or a boolean.");
        const doc = await parseJsonOrFail(d.text, `JSON in ${d.name}`);
        const { formatPath } = await import("../../src/tools/data/_shared");
        const errors = logic.validate(doc, schema, { formats }).map((e) => ({
          path: formatPath(e.path),
          code: e.code,
          message: logic.schemaErrorMessage(e),
        }));
        if (!errors.length)
          return { text: "Valid: the document matches the schema.", json: { valid: true, errors } };
        return {
          text: [
            `Invalid: ${errors.length} ${errors.length === 1 ? "error" : "errors"}.`,
            table(errors.map((e) => [e.path, e.message])),
          ].join("\n"),
          json: { valid: false, errors },
          code: 1,
        };
      },
    },
    {
      name: "html-to-jsx",
      tool: "html-to-jsx",
      aliases: ["jsx"],
      summary:
        "HTML or SVG to JSX (className, htmlFor, style objects, camelCase SVG attributes), optionally a component.",
      usage: "toolbelt html-to-jsx [html] [--component] [--name <Name>] [--typescript] [--native]",
      options: [
        {
          name: "component",
          alias: "c",
          type: "boolean",
          desc: "Wrap in `export default function Name()`.",
        },
        {
          name: "name",
          type: "string",
          arg: "<Name>",
          desc: "Component name (default: from the markup).",
        },
        { name: "typescript", type: "boolean", desc: "Type the component's props." },
        { name: "native", type: "boolean", desc: "react-native-svg components (Svg, Path…)." },
      ],
      examples: [
        {
          cmd: 'toolbelt html-to-jsx \'<label for="email" class="label" style="font-size: 12px">Email</label>\'',
        },
        { cmd: "toolbelt html-to-jsx --file icon.svg --component --name Icon --typescript" },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { htmlToJsx } = await import("../../src/tools/data/html-to-jsx/logic");
        const r = htmlToJsx(text, {
          component: ctx.bool("component"),
          name: ctx.str("name", ""),
          typescript: ctx.bool("typescript"),
          native: ctx.bool("native"),
        });
        const WARN = {
          event:
            'Inline event handlers (onclick="…") became arrow functions: check that the code they run exists in your component.',
          important: "!important was dropped: React inline styles do not support it.",
          script: "<script> tags rendered by React do not run; load scripts another way.",
          rnClass: "react-native-svg has no class names: className was dropped.",
        } as const;
        return {
          text: r.code,
          json: { output: r.code, svg: r.svg, warnings: r.warnings.map((w) => WARN[w]) },
          warnings: r.warnings.map((w) => WARN[w]),
        };
      },
    },
    {
      name: "json-tree",
      tool: "json-tree",
      summary:
        "Explore a JSON document: an outline with types and sizes, a search in keys and values, every path.",
      usage: "toolbelt json-tree [json] [--depth <n>] [--search <text>] [--paths]",
      options: [
        {
          name: "depth",
          type: "number",
          desc: "Outline depth (deeper containers are summarized).",
          default: 3,
        },
        {
          name: "search",
          alias: "s",
          type: "string",
          arg: "<text>",
          desc: "List the keys and values containing this text (case-insensitive), with their paths.",
        },
        {
          name: "paths",
          alias: "p",
          type: "boolean",
          desc: "List every scalar as `path = value` (greppable).",
        },
      ],
      examples: [
        { cmd: "toolbelt json-tree --file package.json --depth 2" },
        { cmd: "toolbelt json-tree --file data.json --search email" },
        { cmd: "toolbelt json-tree --file data.json --paths | grep price" },
      ],
      async run(ctx) {
        const root = await parseJsonOrFail(await input(ctx));
        const t = await import("../../src/tools/data/json-tree/logic");
        const { formatPath } = await import("../../src/tools/data/_shared");
        const stats = t.treeStats(root);
        const q = ctx.str("search");
        if (q !== undefined) {
          if (!q.trim()) throw new UsageError("--search needs some text");
          const found = t.search(root, q);
          const hits = [...found.hits].map((k) => {
            const path = JSON.parse(k) as (string | number)[];
            const v = t.getAt(root, path);
            return {
              path: formatPath(path),
              pointer: t.jsonPointer(path),
              type: t.typeOf(v),
              value: t.isContainer(v) ? undefined : v,
            };
          });
          const text = hits.length
            ? table(
                hits.map((h) => [
                  h.path,
                  h.value === undefined ? h.type : t.scalarText(h.value, 120),
                ]),
              )
            : `No key or value contains "${q}".`;
          return {
            text,
            json: { query: q, count: found.count, capped: found.capped, hits },
            code: hits.length ? 0 : 1,
          };
        }
        if (ctx.bool("paths")) {
          const rows: { path: string; value: unknown }[] = [];
          const walk = (v: unknown, path: (string | number)[]) => {
            if (t.isContainer(v) && t.size(v))
              for (const [k, c] of t.entries(v)) walk(c, [...path, k]);
            else rows.push({ path: formatPath(path), value: v });
          };
          walk(root, []);
          return {
            text: rows.map((r) => `${r.path} = ${JSON.stringify(r.value)}`).join("\n"),
            json: rows,
          };
        }
        const depth = ctx.num("depth", 3);
        if (!Number.isInteger(depth) || depth < 0)
          throw new UsageError("--depth must be a whole number ≥ 0");
        const lines: string[] = [];
        const label = (v: unknown) =>
          Array.isArray(v)
            ? `array[${v.length}]`
            : t.isContainer(v)
              ? `object{${t.size(v)}}`
              : t.scalarText(v, 80);
        const walk = (v: unknown, key: string, d: number) => {
          lines.push(`${"  ".repeat(d)}${key} ${label(v)}`);
          if (!t.isContainer(v) || !t.size(v)) return;
          if (d >= depth) {
            lines.push(`${"  ".repeat(d + 1)}…`);
            return;
          }
          for (const [k, c] of t.entries(v))
            walk(
              c,
              typeof k === "number"
                ? `[${k}]`
                : /^[A-Za-z_$][\w$]*$/.test(k)
                  ? k
                  : JSON.stringify(k),
              d + 1,
            );
        };
        walk(root, "$", 0);
        lines.push("", `${stats.nodes} nodes, depth ${stats.depth}.`);
        return {
          text: lines.join("\n"),
          json: { ...stats, type: t.typeOf(root), size: t.size(root) },
        };
      },
    },
    {
      name: "json-xml",
      tool: "json-xml",
      summary:
        "JSON to XML (@attributes, #text, arrays as repeated elements), or XML to JSON (direction detected).",
      usage:
        "toolbelt json-xml [text] [--to xml|json] [--root <name>] [--indent 2|4|tab|min] [--declaration] [--no-typed]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["xml", "json"],
          desc: "Output (default: XML for JSON input, JSON for XML input).",
        },
        {
          name: "root",
          type: "string",
          arg: "<name>",
          desc: "JSON → XML: root element (default: the single top-level key, else root).",
        },
        {
          name: "indent",
          type: "string",
          values: ["2", "4", "tab", "min"],
          desc: "Indentation (min: one line).",
          default: "2",
        },
        {
          name: "declaration",
          type: "boolean",
          desc: 'JSON → XML: start with <?xml version="1.0"…?>.',
        },
        {
          name: "typed",
          type: "boolean",
          desc: "XML → JSON: numbers, booleans and null as JSON values; --no-typed keeps text.",
          default: true,
        },
      ],
      examples: [
        { cmd: 'toolbelt json-xml \'{"note":{"@id":"7","to":"Ann","body":"Hi"}}\'' },
        { cmd: "toolbelt json-xml --file feed.xml", desc: "XML → JSON." },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { detect, jsonToXml, xmlToJsonValue } = await import(
          "../../src/tools/data/json-xml/logic"
        );
        const to = ctx.str("to") ?? (detect(text) === "xml" ? "json" : "xml");
        const indent = ctx.str("indent", "2");
        if (to === "xml") {
          const value = await parseJsonOrFail(text);
          const units: Record<string, string> = { "2": "  ", "4": "    ", tab: "\t", min: "" };
          const r = jsonToXml(value, {
            root: ctx.str("root", ""),
            indent: units[indent] ?? "  ",
            declaration: ctx.bool("declaration"),
          });
          const warnings = r.renamed.length
            ? [
                `Renamed to valid XML names: ${r.renamed.map(([a, b]) => `${a} → ${b}`).join(", ")}.`,
              ]
            : [];
          return { text: r.xml, json: { output: r.xml, renamed: r.renamed, warnings }, warnings };
        }
        const r = xmlToJsonValue(text, ctx.bool("typed", true));
        if (!r.ok) {
          const { xmlErrorMessage } = await import("../../src/tools/data/xml/logic");
          throw new CliError(`invalid XML at ${at(r.error)}: ${xmlErrorMessage(r.error)}`);
        }
        const space = indent === "min" ? undefined : indent === "tab" ? "\t" : Number(indent);
        return { text: JSON.stringify(r.value, null, space), json: r.value };
      },
    },
    {
      name: "docker-compose",
      tool: "docker-compose",
      aliases: ["compose"],
      summary: "docker run commands to a docker-compose.yml (ports, volumes, env, networks…).",
      usage: "toolbelt docker-compose [commands]",
      notes:
        "Several commands (one per line, or joined with && or ;) become several services. Named volumes are declared at the end; custom networks are marked external.",
      examples: [
        {
          cmd: "toolbelt docker-compose 'docker run -d --name db -p 5432:5432 -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data postgres:16'",
        },
        { cmd: "toolbelt docker-compose --file run.sh --out docker-compose.yml" },
      ],
      async run(ctx) {
        const text = await input(ctx);
        const { toCompose } = await import("../../src/tools/data/docker-compose/logic");
        const r = toCompose(text, {
          rmNote:
            '--rm: compose keeps stopped containers; for one-off runs use "docker compose run --rm SERVICE".',
        });
        if (!r.ok) throw new CliError(`unclosed quote on line ${r.line}.`);
        const warnings = r.warnings.map((w) =>
          w.code === "unsupported"
            ? `${w.service}: ${w.subject} has no compose equivalent and was left out.`
            : w.code === "publishAll"
              ? `${w.service}: -P publishes every exposed port on random host ports; list them with -p instead.`
              : w.code === "notRun"
                ? `Skipped, not a docker run command: ${w.subject}`
                : `No image in: ${w.subject}`,
        );
        if (!r.services.length)
          throw new CliError(
            `no docker run command with an image found${warnings.length ? ` (${warnings.join(" ")})` : ""}.`,
          );
        return { text: r.yaml, json: { services: r.services, output: r.yaml, warnings }, warnings };
      },
    },
  ],
};
