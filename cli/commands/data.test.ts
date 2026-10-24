import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tb } from "../test-utils";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "toolbelt-data-"));
  await writeFile(join(dir, "old.json"), '{"a":1,"b":[1,2],"c":"x"}');
  await writeFile(join(dir, "new.json"), '{"a":2,"b":[1,2],"d":true}');
  await writeFile(join(dir, "bad.json"), '{"a":');
  await writeFile(join(dir, "schema.json"), '{"type":"object","required":["id"]}');
  await writeFile(join(dir, "doc.json"), '{"name":"Ann"}');
  await writeFile(join(dir, "people.csv"), "name;age\nAnn;30\nBob;25\n");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const run = (argv: string[], stdin?: string) => tb(argv, { cwd: dir, ...(stdin ? { stdin } : {}) });

async function ok(argv: string[], stdin?: string) {
  const r = await run(argv, stdin);
  if (r.code !== 0) throw new Error(`exit ${r.code}: ${r.stderr}${r.stdout}`);
  return r.stdout;
}

async function fails(argv: string[], code = 1) {
  const r = await run(argv);
  expect(r.code).toBe(code);
  expect(r.stderr).toStartWith("error: ");
  return r.stderr;
}

describe("json", () => {
  it("formats, sorts and minifies", async () => {
    expect(await ok(["json", '{"b":1,"a":2}', "--sort-keys"])).toBe('{\n  "a": 2,\n  "b": 1\n}\n');
    expect(await ok(["json", '{ "a": [1, 2] }', "--minify"])).toBe('{"a":[1,2]}\n');
    expect(await ok(["json", "--check"], '{"a":{"b":1}}')).toContain("Valid JSON");
  });
  it("locates errors", async () => {
    expect(await fails(["json", '{"a":1,}'])).toContain("line 1, column");
    expect(await fails(["json", "--file", "bad.json"])).toContain("invalid JSON");
    await fails(["json", "--indent", "3", "{}"], 2);
  });
});

describe("convert", () => {
  it("converts JSON to YAML, TOML and back", async () => {
    expect(await ok(["convert", '{"name":"app","port":8080}'])).toBe("name: app\nport: 8080\n");
    expect(await ok(["convert", '{"name":"app"}', "--to", "toml"])).toBe('name = "app"\n');
    const out = await run(["convert", "name: app\nport: 8080", "--to", "json", "--json"]);
    expect(JSON.parse(out.stdout)).toMatchObject({ from: "yaml", to: "json" });
  });
  it("rejects invalid input and non-table TOML roots", async () => {
    expect(await fails(["convert", "a: [1, 2", "--from", "yaml"])).toContain(
      "invalid YAML at line",
    );
    expect(await fails(["convert", "[1,2]", "--to", "toml"])).toContain("TOML needs a table");
  });
});

describe("csv", () => {
  it("reads CSV (delimiter detected, cells typed) and writes CSV from JSON", async () => {
    const rows = JSON.parse(await ok(["csv", "--file", "people.csv"]));
    expect(rows).toEqual([
      { name: "Ann", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    expect(await ok(["csv", '[{"name":"Ann","address":{"city":"Lyon"}}]'])).toBe(
      "name,address.city\nAnn,Lyon\n",
    );
    expect(await ok(["csv", "a,b\n1,2", "--no-infer", "--shape", "arrays", "--minify"])).toBe(
      '[["a","b"],["1","2"]]\n',
    );
  });
  it("rejects JSON that is not a table", async () => {
    expect(await fails(["csv", "42", "--to", "csv"])).toContain("needs an array");
    await fails(["csv", "a,b", "--delimiter", "x"], 2);
  });
});

describe("markdown-table", () => {
  it("builds a table and reads one back", async () => {
    expect(await ok(["markdown-table", "a,b\n1,22"])).toBe(
      "| a   | b   |\n| --- | --- |\n| 1   | 22  |\n",
    );
    expect(await ok(["markdown-table", "| a | b |\n|---|--:|\n| 1 | 2 |"])).toBe("a,b\n1,2\n");
    const json = JSON.parse(await ok(["markdown-table", "| a |\n|---|\n| x |", "--to", "json"]));
    expect(json).toEqual([{ a: "x" }]);
  });
  it("rejects bad alignments and missing tables", async () => {
    await fails(["markdown-table", "a,b", "--align", "middle"], 2);
    expect(await fails(["markdown-table", "a,b", "--to", "csv"])).toContain("no Markdown table");
  });
});

describe("json-to-ts", () => {
  it("writes TypeScript and Zod", async () => {
    const ts = await ok(["json-to-ts", '{"id":1,"name":"Ann"}', "--root-name", "User"]);
    expect(ts).toContain("interface User");
    expect(ts).toContain("name: string");
    expect(await ok(["json-to-ts", '{"id":1}', "--to", "zod"])).toContain("z.object");
  });
  it("fails on invalid JSON", async () => {
    await fails(["json-to-ts", "{nope}"]);
  });
});

describe("json-diff", () => {
  it("reports changes between two files", async () => {
    const out = await ok(["json-diff", "old.json", "new.json"]);
    expect(out).toContain("~ $.a: 1 → 2");
    expect(out).toContain('- $.c: "x"');
    expect(out).toContain("+ $.d: true");
    expect(await ok(["json-diff", "--a", "[1,2]", "--b", "[2,1]", "--ignore-array-order"])).toBe(
      "No differences.\n",
    );
    const r = await run(["json-diff", "old.json", "new.json", "--exit-code", "--json"]);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.stdout).counts).toEqual({ added: 1, removed: 1, changed: 1 });
  });
  it("needs two valid documents", async () => {
    await fails(["json-diff", "old.json"], 2);
    expect(await fails(["json-diff", "old.json", "bad.json"])).toContain("bad.json");
  });
});

describe("jsonpath", () => {
  it("queries values and paths", async () => {
    const doc = '{"store":{"book":[{"t":"A","p":8},{"t":"B","p":12}]}}';
    expect(JSON.parse(await ok(["jsonpath", "$.store.book[*].t", doc]))).toEqual(["A", "B"]);
    expect(await ok(["jsonpath", "$..[?(@.p < 10)].t", "--paths"], doc)).toBe(
      "$.store.book[0].t\n",
    );
  });
  it("explains invalid queries", async () => {
    expect(await fails(["jsonpath", "store", "{}"])).toContain("starts with $");
    await fails(["jsonpath"], 2);
  });
});

describe("sql", () => {
  it("formats and minifies", async () => {
    const out = await ok(["sql", "select id, name from users where active = 1"]);
    expect(out).toContain("SELECT\n");
    expect(out).toContain("FROM\n  users");
    expect(
      await ok(["sql", "SELECT a\n  FROM t -- note\n WHERE x = 'a  b'", "--minify"]),
    ).toContain("'a  b'");
  });
  it("rejects unknown dialects and invalid SQL", async () => {
    await fails(["sql", "select 1", "--dialect", "nosql"], 2);
    expect(await fails(["sql", "select 'unterminated"])).toContain("invalid SQL");
  });
});

describe("xml", () => {
  it("formats, minifies and checks", async () => {
    expect(await ok(["xml", '<a><b x="1">hi</b><c/></a>'])).toBe(
      '<a>\n  <b x="1">hi</b>\n  <c/>\n</a>\n',
    );
    expect(await ok(["xml", "<a>\n  <b>hi</b>\n</a>", "--minify"])).toBe("<a><b>hi</b></a>\n");
    expect(await ok(["xml", "<a><b/></a>", "--check"])).toContain("2 elements");
  });
  it("locates errors, in the chosen language", async () => {
    expect(await fails(["xml", "<a><b></a>"])).toBe(
      "error: invalid XML at line 1, column 7: Closing tag </a> does not match the open <b>.\n",
    );
    expect(await fails(["xml", "<a><b></a>", "--lang", "fr"])).toContain("La balise fermante");
  });
});

describe("env", () => {
  it("converts .env to JSON and JSON to .env", async () => {
    expect(JSON.parse(await ok(["env", 'A=1\nexport B="x y"\n# c\n']))).toEqual({
      A: "1",
      B: "x y",
    });
    expect(await ok(["env", '{"PORT":8080,"NAME":"my app"}', "--export", "--sort"])).toBe(
      'export NAME="my app"\nexport PORT=8080\n',
    );
    const r = JSON.parse(await ok(["env", "A=1\nA=2\nnope", "--json"]));
    expect(r.warnings).toHaveLength(2);
  });
  it("needs an object for .env output", async () => {
    expect(await fails(["env", "[1]", "--to", "env"])).toContain("JSON object");
  });
});

describe("query-string", () => {
  it("parses URLs and writes query strings", async () => {
    expect(
      JSON.parse(await ok(["query-string", "https://x.io/?q=a+b&tag=1&tag=2&f[x]=1", "--infer"])),
    ).toEqual({ q: "a b", tag: [1, 2], f: { x: 1 } });
    expect(await ok(["query-string", '{"q":"a b","t":["x","y"]}'])).toBe("q=a+b&t[]=x&t[]=y\n");
  });
  it("needs an object for query output", async () => {
    expect(await fails(["query-string", "[1]", "--to", "query"])).toContain("JSON object");
  });
});

describe("json-to-code", () => {
  it("writes Go and Rust", async () => {
    expect(await ok(["json-to-code", '{"id":1,"name":"Ann"}'])).toContain("type Root struct");
    expect(await ok(["json-to-code", '{"id":1}', "--to", "rust"])).toContain("pub struct Root");
  });
  it("rejects unknown languages", async () => {
    await fails(["json-to-code", "{}", "--to", "cobol"], 2);
  });
});

describe("json-schema", () => {
  it("generates a schema and validates documents", async () => {
    const schema = JSON.parse(await ok(["json-schema", '{"id":1,"email":"a@b.co"}', "--strict"]));
    expect(schema).toMatchObject({
      type: "object",
      required: ["id", "email"],
      additionalProperties: false,
    });
    expect(schema.properties.email).toEqual({ type: "string", format: "email" });
    expect(
      await ok(["json-schema", "--validate", "--schema", '{"type":"integer"}', "--doc", "3"]),
    ).toContain("Valid");
  });
  it("exits 1 with the problems when the document does not match", async () => {
    const r = await run(["json-schema", "--validate", "schema.json", "doc.json"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Missing required key “id”.");
    await fails(["json-schema", "--validate", "schema.json"], 2);
  });
});

describe("html-to-jsx", () => {
  it("converts attributes and styles", async () => {
    const out = await ok([
      "html-to-jsx",
      '<label for="e" class="l" style="font-size: 12px">E</label>',
    ]);
    expect(out).toContain('htmlFor="e"');
    expect(out).toContain('className="l"');
    expect(out).toContain('fontSize: "12px"');
    const json = JSON.parse(
      await ok(["html-to-jsx", '<p style="color: red !important">x</p>', "--json"]),
    );
    expect(json.warnings[0]).toContain("!important");
  });
  it("needs input", async () => {
    await fails(["html-to-jsx"], 2);
  });
});

describe("json-tree", () => {
  const doc = '{"user":{"name":"Ann","tags":["a","b"]},"n":1}';
  it("outlines, searches and lists paths", async () => {
    const out = await ok(["json-tree", doc]);
    expect(out).toContain("$ object{2}");
    expect(out).toContain('    name "Ann"');
    expect(out).toContain("tags array[2]");
    expect(await ok(["json-tree", doc, "--search", "ann"])).toContain("$.user.name");
    expect(await ok(["json-tree", doc, "--paths"])).toContain('$.user.tags[1] = "b"');
  });
  it("exits 1 when a search finds nothing, 2 on a bad depth", async () => {
    const r = await run(["json-tree", doc, "--search", "zzz"]);
    expect(r.code).toBe(1);
    await fails(["json-tree", doc, "--depth", "-1"], 2);
  });
});

describe("json-xml", () => {
  it("converts JSON to XML and XML to JSON", async () => {
    expect(await ok(["json-xml", '{"note":{"@id":"7","to":"Ann"}}'])).toBe(
      '<note id="7">\n  <to>Ann</to>\n</note>\n',
    );
    expect(JSON.parse(await ok(["json-xml", '<n id="7"><to>Ann</to><x>3</x></n>']))).toEqual({
      n: { "@id": 7, to: "Ann", x: 3 },
    });
  });
  it("locates XML errors", async () => {
    expect(await fails(["json-xml", "<a><b></a>"])).toContain("invalid XML at line 1");
  });
});

describe("docker-compose", () => {
  it("turns docker run into a compose file", async () => {
    const out = await ok([
      "docker-compose",
      "docker run -d --name db -p 5432:5432 -e POSTGRES_PASSWORD=secret postgres:16",
    ]);
    expect(out).toContain("services:");
    expect(out).toContain("image: postgres:16");
    expect(out).toContain("5432:5432");
  });
  it("reports unclosed quotes and inputs without docker run", async () => {
    expect(await fails(["docker-compose", "docker run -e 'A=1 nginx"])).toContain("unclosed quote");
    expect(await fails(["docker-compose", "ls -la"])).toContain("no docker run command");
  });
});
