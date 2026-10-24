import { describe, expect, it } from "bun:test";
import { parseEnv, quoteValue, toEnv } from "./logic";

describe("env", () => {
  it("parses keys, quotes, comments and export", () => {
    const r = parseEnv(
      [
        "# database",
        "export DB_HOST=localhost",
        "DB_PORT = 5432 # inline comment",
        'GREETING="Hello\\nWorld \\"quoted\\""',
        "RAW='no $escapes\\n here # not a comment'",
        "URL=https://x.io/a#frag",
        "EMPTY=",
        "  SPACED=  value with spaces  ",
        "NAME=Zoé 🎉",
      ].join("\n"),
    );
    expect(r.values).toEqual({
      DB_HOST: "localhost",
      DB_PORT: "5432",
      GREETING: 'Hello\nWorld "quoted"',
      RAW: "no $escapes\\n here # not a comment",
      URL: "https://x.io/a#frag",
      EMPTY: "",
      SPACED: "value with spaces",
      NAME: "Zoé 🎉",
    });
    expect(r.issues).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it("reads multiline values in quotes", () => {
    const r = parseEnv('KEY="-----BEGIN-----\nabc  \n-----END-----"\nNEXT=1\nB=`x\ny`');
    expect(r.values).toEqual({
      KEY: "-----BEGIN-----\nabc  \n-----END-----",
      NEXT: "1",
      B: "x\ny",
    });
  });

  it("reports duplicates, bad lines and unclosed quotes", () => {
    const r = parseEnv('A=1\nnot a pair\n1BAD=x\nA=2\nB="open\nC=3');
    expect(r.values.A).toBe("2");
    expect(r.duplicates).toEqual([{ key: "A", lines: [1, 4] }]);
    expect(r.issues).toEqual([
      { code: "no-equals", line: 2 },
      { code: "bad-key", line: 3, key: "1BAD" },
      { code: "unterminated", line: 5, key: "B" },
    ]);
    expect(r.values.C).toBe("3");
    expect(parseEnv("")).toEqual({ values: {}, issues: [], duplicates: [] });
  });

  it("writes .env from JSON, quoting only when needed", () => {
    const r = toEnv(
      { HOST: "db.local", MSG: 'say "hi"\nbye', PORT: 5432, ON: true, NONE: null, LIST: [1, "a"] },
      { exportPrefix: false, sort: false },
    );
    expect(r).toEqual({
      ok: true,
      text: 'HOST=db.local\nMSG="say \\"hi\\"\\nbye"\nPORT=5432\nON=true\nNONE=\nLIST=\'[1,"a"]\'\n',
      badKeys: [],
      nested: ["LIST"],
    });
    const s = toEnv({ b: "x y", a: "1", "bad key": "v" }, { exportPrefix: true, sort: true });
    expect(s).toEqual({
      ok: true,
      text: 'export a=1\nexport b="x y"\nexport bad key=v\n',
      badKeys: ["bad key"],
      nested: [],
    });
    expect(toEnv([1], { exportPrefix: false, sort: false })).toEqual({ ok: false });
  });

  it("round-trips", () => {
    const values = { A: 'q"uote', B: "multi\nline", C: "back\\slash", D: "#hash", E: "" };
    const w = toEnv(values, { exportPrefix: false, sort: false });
    expect(w.ok && parseEnv(w.text).values).toEqual(values);
    expect(quoteValue("simple-value_1.2")).toBe("simple-value_1.2");
  });
});
