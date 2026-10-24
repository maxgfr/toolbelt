import { describe, expect, it } from "bun:test";
import { flatten, jsonToTable, parseCsv, tableToCsv, tableToJson, uniqueNames } from "./logic";

describe("csv", () => {
  it("parses with a header and infers types", () => {
    const t = parseCsv("name,age,admin,note\nAnn,30,true,\nBob,007,false,null\n", "auto", true);
    expect(t.header).toEqual(["name", "age", "admin", "note"]);
    expect(tableToJson(t, "objects", true, true)).toEqual([
      { name: "Ann", age: 30, admin: true, note: null },
      { name: "Bob", age: "007", admin: false, note: null },
    ]);
    expect(tableToJson(t, "objects", false, true)[0]).toEqual({
      name: "Ann",
      age: "30",
      admin: "true",
      note: "",
    });
  });

  it("detects the delimiter and handles quotes and line breaks", () => {
    const t = parseCsv('a;b\n"x;1";"multi\nline ""quoted"""\n', "auto", true);
    expect(t.delimiter).toBe(";");
    expect(t.rows).toEqual([["x;1", 'multi\nline "quoted"']]);
    expect(parseCsv("a\tb\n1\t2", "auto", true).delimiter).toBe("\t");
    expect(parseCsv("a|b\n1|2", "|", false).rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("outputs arrays, with the header first", () => {
    const t = parseCsv("a,b\n1,x", ",", true);
    expect(tableToJson(t, "arrays", true, true)).toEqual([
      ["a", "b"],
      [1, "x"],
    ]);
    const n = parseCsv("1,2\n3,4", ",", false);
    expect(n.header).toEqual(["column1", "column2"]);
    expect(tableToJson(n, "objects", true, false)).toEqual([
      { column1: 1, column2: 2 },
      { column1: 3, column2: 4 },
    ]);
  });

  it("reports ragged rows and broken quotes", () => {
    const t = parseCsv("a,b\n1\n2,3,4", ",", true);
    expect(t.issues).toEqual([
      { kind: "fields", at: 2, expected: 2, found: 1 },
      { kind: "fields", at: 3, expected: 2, found: 3 },
    ]);
    expect(t.header).toEqual(["a", "b", "column3"]);
    const q = parseCsv('a,b\n1,"open\n2,3', ",", true);
    expect(q.issues.some((i) => i.kind === "quotes" && i.at === 2)).toBe(true);
  });

  it("is safe with empty input and odd header names", () => {
    expect(parseCsv("", "auto", true)).toMatchObject({ header: [], rows: [], issues: [] });
    expect(uniqueNames(["id", "", "id", "id"])).toEqual(["id", "column2", "id_2", "id_3"]);
    const t = parseCsv("__proto__,b\n1,2", ",", true);
    const o = tableToJson(t, "objects", true, true)[0] as Record<string, unknown>;
    expect(Object.keys(o)).toEqual(["__proto__", "b"]);
    expect(({} as Record<string, unknown>).b).toBeUndefined();
  });

  it("flattens nested JSON to dotted columns", () => {
    expect([...flatten({ a: { b: 1, c: { d: 2 } }, e: [1, 2], f: {} })]).toEqual([
      ["a.b", 1],
      ["a.c.d", 2],
      ["e", [1, 2]],
      ["f", {}],
    ]);
    const t = jsonToTable([
      { id: 1, user: { name: "Zoé" } },
      { id: 2, tags: ["x"], user: { name: 'A "q", b' } },
    ]);
    expect(t).toEqual({
      ok: true,
      header: ["id", "user.name", "tags"],
      rows: [
        ["1", "Zoé", ""],
        ["2", 'A "q", b', '["x"]'],
      ],
    });
    if (t.ok)
      expect(tableToCsv(t.header, t.rows, "auto", true)).toBe(
        'id,user.name,tags\n1,Zoé,\n2,"A ""q"", b","[""x""]"',
      );
  });

  it("accepts arrays of arrays, of values, a single object; refuses scalars", () => {
    expect(jsonToTable([[1, 2], [3]])).toEqual({
      ok: true,
      header: ["column1", "column2"],
      rows: [["1", "2"], ["3"]],
    });
    expect(jsonToTable([1, null])).toEqual({ ok: true, header: ["value"], rows: [["1"], [""]] });
    expect(jsonToTable({ a: 1 })).toEqual({ ok: true, header: ["a"], rows: [["1"]] });
    expect(jsonToTable(42)).toEqual({ ok: false });
    expect(tableToCsv(["a"], [["1"]], ";", false)).toBe("1");
  });
});
