import { describe, expect, it } from "bun:test";
import { formatSql, minifySql, tokenize } from "./logic";

const base = { dialect: "sql" as const, keywordCase: "upper" as const, indent: "2" as const };

describe("sql", () => {
  it("formats with keyword case and indentation", () => {
    const r = formatSql("select a, b from t where a = 1 and b in (select x from y)", base);
    expect(r).toEqual({
      ok: true,
      text: [
        "SELECT",
        "  a,",
        "  b",
        "FROM",
        "  t",
        "WHERE",
        "  a = 1",
        "  AND b IN (",
        "    SELECT",
        "      x",
        "    FROM",
        "      y",
        "  )",
      ].join("\n"),
    });
    const tab = formatSql("SELECT a FROM t", { ...base, keywordCase: "lower", indent: "tab" });
    expect(tab.ok && tab.text).toBe("select\n\ta\nfrom\n\tt");
  });

  it("reports parse errors with a line and column", () => {
    const r = formatSql("SELECT a\nFROM t WHERE x = 'open", { ...base, dialect: "postgresql" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(2);
      expect(r.column).toBeGreaterThan(1);
      expect(r.message).not.toContain("\n");
    }
  });

  it("minifies, keeping strings, quoted names and hints", () => {
    const sql = [
      "SELECT /*+ INDEX(t i) */ a ,  'two  spaces -- not a comment' AS \"x  y\"",
      "FROM t -- trailing comment",
      "WHERE b = ( 1 + 2 ) /* block */AND c<>3;",
    ].join("\n");
    expect(minifySql(sql)).toBe(
      "SELECT /*+ INDEX(t i) */ a,'two  spaces -- not a comment' AS \"x  y\" FROM t WHERE b=(1 + 2)AND c<>3;",
    );
    expect(minifySql("SELECT 1 - -1")).toBe("SELECT 1 - -1");
    expect(minifySql("SELECT/*x*/1")).toBe("SELECT 1");
    expect(minifySql("")).toBe("");
  });

  it("handles dialect quirks", () => {
    expect(minifySql("SELECT a # note\nFROM t", "mysql")).toBe("SELECT a FROM t");
    expect(minifySql("SELECT data #> '{a}' FROM t", "postgresql")).toBe(
      "SELECT data #>'{a}' FROM t",
    );
    expect(minifySql("SELECT 'it\\'s  x' FROM t", "mysql")).toBe("SELECT 'it\\'s  x' FROM t");
    expect(minifySql("SELECT 'C:\\'  ,  [my  col] FROM t", "transactsql")).toBe(
      "SELECT 'C:\\',[my  col] FROM t",
    );
    expect(minifySql("SELECT $$a  b$$,  $1", "postgresql")).toBe("SELECT $$a  b$$,$1");
    expect(tokenize("'it''s'")).toEqual([{ t: "str", v: "'it''s'" }]);
  });
});
