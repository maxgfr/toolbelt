/**
 * SQL: format with sql-formatter (many dialects), or minify to one line with a
 * small tokenizer that leaves strings, quoted names and optimizer hints alone.
 */
import { format, type SqlLanguage } from "sql-formatter";
import type { Located } from "../_shared";

export type KeywordCase = "preserve" | "upper" | "lower";
export type Indent = "2" | "4" | "tab";

export const DIALECTS: { id: SqlLanguage; name: string }[] = [
  { id: "sql", name: "Standard SQL" },
  { id: "postgresql", name: "PostgreSQL" },
  { id: "mysql", name: "MySQL" },
  { id: "mariadb", name: "MariaDB" },
  { id: "sqlite", name: "SQLite" },
  { id: "transactsql", name: "SQL Server (T-SQL)" },
  { id: "plsql", name: "Oracle PL/SQL" },
  { id: "bigquery", name: "BigQuery" },
  { id: "snowflake", name: "Snowflake" },
  { id: "redshift", name: "Amazon Redshift" },
  { id: "duckdb", name: "DuckDB" },
  { id: "clickhouse", name: "ClickHouse" },
  { id: "spark", name: "Spark SQL" },
  { id: "hive", name: "Hive" },
  { id: "trino", name: "Trino / Presto" },
  { id: "db2", name: "IBM Db2" },
  { id: "singlestoredb", name: "SingleStore" },
  { id: "tidb", name: "TiDB" },
  { id: "n1ql", name: "Couchbase N1QL" },
];

export interface FormatOptions {
  dialect: SqlLanguage;
  keywordCase: KeywordCase;
  indent: Indent;
}

export type Formatted = { ok: true; text: string } | ({ ok: false } & Located);

export function formatSql(sql: string, o: FormatOptions): Formatted {
  try {
    const text = format(sql, {
      language: o.dialect,
      keywordCase: o.keywordCase,
      dataTypeCase: o.keywordCase,
      functionCase: o.keywordCase,
      tabWidth: o.indent === "4" ? 4 : 2,
      useTabs: o.indent === "tab",
    });
    return { ok: true, text };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const first = (raw.split("\n")[0] ?? raw).trim();
    const lc = /at line (\d+) column (\d+)/.exec(first);
    return {
      ok: false,
      message: first
        .replace(/\s*at line \d+ column \d+\.?/, "")
        .replace(/^Parse error:\s*/, "")
        .replace(/^Parse error at token:\s*/, "Unexpected "),
      line: lc ? Number(lc[1]) : 1,
      column: lc ? Number(lc[2]) : 1,
    };
  }
}

type Tok = { t: "str" | "word" | "punct" | "space" | "comment" | "hint"; v: string };

/** Dialects where `#` starts a comment and a backslash escapes a quote inside strings. */
const MYSQLISH = new Set<SqlLanguage>(["mysql", "mariadb", "singlestoredb", "tidb", "bigquery"]);

/** Splits SQL into strings, quoted names, comments, spaces and the rest. */
export function tokenize(sql: string, dialect: SqlLanguage = "sql"): Tok[] {
  const mysqlish = MYSQLISH.has(dialect);
  const out: Tok[] = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i] as string;
    const two = sql.slice(i, i + 2);
    let j = i + 1;
    if (/\s/.test(c)) {
      while (j < n && /\s/.test(sql[j] as string)) j++;
      out.push({ t: "space", v: sql.slice(i, j) });
    } else if (two === "--" || (c === "#" && mysqlish)) {
      while (j < n && sql[j] !== "\n") j++;
      out.push({ t: "comment", v: sql.slice(i, j) });
    } else if (two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      j = end < 0 ? n : end + 2;
      const v = sql.slice(i, j);
      out.push({ t: /^\/\*[+!]/.test(v) ? "hint" : "comment", v });
    } else if (c === "'" || c === '"' || c === "`") {
      while (j < n) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) j += 2;
          else break;
        } else if (sql[j] === "\\" && mysqlish) j += 2;
        else j++;
      }
      j = Math.min(n, j + 1);
      out.push({ t: "str", v: sql.slice(i, j) });
    } else if (c === "[" && /^\[[^\]\n]*\]/.test(sql.slice(i))) {
      j = sql.indexOf("]", i) + 1;
      out.push({ t: "str", v: sql.slice(i, j) });
    } else if (c === "$" && /^\$(\w*)\$/.test(sql.slice(i))) {
      const tag = /^\$(\w*)\$/.exec(sql.slice(i))?.[0] ?? "$$";
      const end = sql.indexOf(tag, i + tag.length);
      j = end < 0 ? n : end + tag.length;
      out.push({ t: "str", v: sql.slice(i, j) });
    } else if (/[(),;=<>+\-*/%|.]/.test(c)) {
      out.push({ t: "punct", v: c });
    } else {
      while (
        j < n &&
        !/[\s(),;=<>+\-*/%|.'"`[]/.test(sql[j] as string) &&
        sql.slice(j, j + 2) !== "--"
      )
        j++;
      out.push({ t: "word", v: sql.slice(i, j) });
    }
    i = j;
  }
  return out;
}

const TIGHT = new Set(["(", ")", ",", ";", "=", "<", ">", "."]);

/** One line: comments dropped (hints kept), spaces only where two words would merge. */
export function minifySql(sql: string, dialect: SqlLanguage = "sql"): string {
  let out = "";
  let pendingSpace = false;
  for (const t of tokenize(sql, dialect)) {
    if (t.t === "space" || t.t === "comment") {
      pendingSpace = true;
      continue;
    }
    const prev = out[out.length - 1] ?? "";
    if (pendingSpace && out && !TIGHT.has(prev) && !TIGHT.has(t.v)) out += " ";
    out += t.v;
    pendingSpace = false;
  }
  return out.trim();
}
