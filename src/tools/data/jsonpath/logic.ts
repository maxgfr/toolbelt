/**
 * A JSONPath subset (close to RFC 9535): $, .key, ['key'], [n], [-n],
 * [start:end:step], [*], .., unions [a,b] and filters [?(@.price < 10 && @.tag)]
 * with ==, !=, <, <=, >, >=, !, && and ||. Every result comes with its path.
 */

import { isPlainObject, type Path } from "../_shared";
import { canonical } from "../json-diff/logic";

type Selector =
  | { t: "name"; name: string }
  | { t: "wild" }
  | { t: "index"; i: number }
  | { t: "slice"; start: number | null; end: number | null; step: number | null }
  | { t: "filter"; expr: Expr };

interface Segment {
  desc: boolean;
  sels: Selector[];
}

type Op = "==" | "!=" | "<" | "<=" | ">" | ">=";
type Operand = { t: "lit"; v: unknown } | { t: "query"; root: "@" | "$"; segs: Segment[] };
type Expr =
  | { t: "or" | "and"; a: Expr; b: Expr }
  | { t: "not"; e: Expr }
  | { t: "cmp"; op: Op; a: Operand; b: Operand }
  | { t: "test"; q: Extract<Operand, { t: "query" }> };

export interface QueryError {
  code: "root" | "unexpected" | "expected" | "unterminated" | "empty";
  /** 0-based offset in the query. */
  pos: number;
  /** What was expected ("]", "a name"…), for "expected". */
  expected?: string;
}

class Fail extends Error {
  constructor(readonly info: QueryError) {
    super(info.code);
  }
}

const NAME_START = /[A-Za-z_$]|\P{ASCII}/u;
const NAME_CHAR = /[\w$-]|\P{ASCII}/u;

function parser(src: string) {
  let pos = 0;
  const peek = (n = 0) => src[pos + n] ?? "";
  const ws = () => {
    while (/\s/.test(peek())) pos++;
  };
  const fail = (code: QueryError["code"], expected?: string): never => {
    throw new Fail(expected ? { code, pos, expected } : { code, pos });
  };
  const eat = (s: string) => {
    if (src.startsWith(s, pos)) {
      pos += s.length;
      return true;
    }
    return false;
  };
  const expect = (s: string) => {
    if (!eat(s)) fail("expected", s);
  };

  const name = (): string => {
    const start = pos;
    if (!NAME_START.test(peek())) fail("expected", "name");
    while (NAME_CHAR.test(peek())) pos++;
    return src.slice(start, pos);
  };

  const string = (): string => {
    const q = peek();
    const start = pos;
    pos++;
    let out = "";
    while (pos < src.length && peek() !== q) {
      if (peek() === "\\") {
        const e = peek(1);
        const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
        out += map[e] ?? e;
        pos += 2;
      } else out += src[pos++];
    }
    if (pos >= src.length) {
      pos = start;
      fail("unterminated");
    }
    pos++;
    return out;
  };

  const int = (): number | null => {
    const m = /^-?\d+/.exec(src.slice(pos));
    if (!m) return null;
    pos += m[0].length;
    return Number(m[0]);
  };

  const selector = (): Selector => {
    ws();
    const c = peek();
    if (c === "'" || c === '"') return { t: "name", name: string() };
    if (c === "*") {
      pos++;
      return { t: "wild" };
    }
    if (c === "?") {
      pos++;
      ws();
      return { t: "filter", expr: or() };
    }
    const start = int();
    ws();
    if (peek() !== ":") {
      if (start === null) fail("unexpected");
      return { t: "index", i: start as number };
    }
    pos++;
    ws();
    const end = int();
    ws();
    let step: number | null = null;
    if (eat(":")) {
      ws();
      step = int();
    }
    return { t: "slice", start, end, step };
  };

  const bracket = (): Selector[] => {
    expect("[");
    const sels = [selector()];
    ws();
    while (eat(",")) sels.push(selector());
    ws();
    expect("]");
    return sels;
  };

  /** Segments after a root ($ or @), up to something that is not a segment. */
  const segments = (): Segment[] => {
    const segs: Segment[] = [];
    for (;;) {
      if (src.startsWith("..", pos)) {
        pos += 2;
        if (peek() === "[") segs.push({ desc: true, sels: bracket() });
        else if (eat("*")) segs.push({ desc: true, sels: [{ t: "wild" }] });
        else segs.push({ desc: true, sels: [{ t: "name", name: name() }] });
      } else if (peek() === ".") {
        pos++;
        if (eat("*")) segs.push({ desc: false, sels: [{ t: "wild" }] });
        else segs.push({ desc: false, sels: [{ t: "name", name: name() }] });
      } else if (peek() === "[") segs.push({ desc: false, sels: bracket() });
      else return segs;
    }
  };

  const operand = (): Operand => {
    ws();
    const c = peek();
    if (c === "@" || c === "$") {
      pos++;
      return { t: "query", root: c, segs: segments() };
    }
    if (c === "'" || c === '"') return { t: "lit", v: string() };
    const num = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(pos));
    if (num) {
      pos += num[0].length;
      return { t: "lit", v: Number(num[0]) };
    }
    for (const [word, v] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const)
      if (eat(word)) return { t: "lit", v };
    return fail("unexpected");
  };

  const primary = (): Expr => {
    ws();
    if (eat("!")) return { t: "not", e: primary() };
    if (eat("(")) {
      const e = or();
      ws();
      expect(")");
      return e;
    }
    const a = operand();
    ws();
    const op = (["==", "!=", "<=", ">=", "<", ">"] as const).find((o) => src.startsWith(o, pos));
    if (!op) {
      if (a.t !== "query") fail("expected", "==");
      return { t: "test", q: a as Extract<Operand, { t: "query" }> };
    }
    pos += op.length;
    if (src[pos] === "=") pos++; // tolerate === and !==
    return { t: "cmp", op, a, b: operand() };
  };

  const and = (): Expr => {
    let e = primary();
    ws();
    while (eat("&&")) {
      e = { t: "and", a: e, b: primary() };
      ws();
    }
    return e;
  };

  function or(): Expr {
    let e = and();
    ws();
    while (eat("||")) {
      e = { t: "or", a: e, b: and() };
      ws();
    }
    return e;
  }

  return {
    query(): Segment[] {
      ws();
      if (pos >= src.length) fail("empty");
      if (!eat("$")) fail("root");
      const segs = segments();
      ws();
      if (pos < src.length) fail("unexpected");
      return segs;
    },
  };
}

export interface Node {
  path: Path;
  value: unknown;
}

function children(n: Node): Node[] {
  if (Array.isArray(n.value)) return n.value.map((v, i) => ({ path: [...n.path, i], value: v }));
  if (isPlainObject(n.value))
    return Object.entries(n.value).map(([k, v]) => ({ path: [...n.path, k], value: v }));
  return [];
}

function descendants(n: Node, out: Node[] = []): Node[] {
  out.push(n);
  for (const c of children(n)) descendants(c, out);
  return out;
}

function slice(len: number, s: Extract<Selector, { t: "slice" }>): number[] {
  const step = s.step ?? 1;
  if (step === 0) return [];
  const norm = (i: number) => (i >= 0 ? i : len + i);
  const out: number[] = [];
  if (step > 0) {
    const lo = Math.min(Math.max(norm(s.start ?? 0), 0), len);
    const hi = Math.min(Math.max(norm(s.end ?? len), 0), len);
    for (let i = lo; i < hi; i += step) out.push(i);
  } else {
    const hi = Math.min(Math.max(norm(s.start ?? len - 1), -1), len - 1);
    const lo = Math.min(Math.max(s.end === null ? -1 : norm(s.end), -1), len - 1);
    for (let i = hi; i > lo; i += step) out.push(i);
  }
  return out;
}

const NOTHING = Symbol("nothing");

function select(n: Node, sel: Selector, root: unknown): Node[] {
  const v = n.value;
  switch (sel.t) {
    case "name":
      return isPlainObject(v) && Object.hasOwn(v, sel.name)
        ? [{ path: [...n.path, sel.name], value: v[sel.name] }]
        : [];
    case "wild":
      return children(n);
    case "index": {
      if (!Array.isArray(v)) return [];
      const i = sel.i < 0 ? v.length + sel.i : sel.i;
      return i >= 0 && i < v.length ? [{ path: [...n.path, i], value: v[i] }] : [];
    }
    case "slice":
      return Array.isArray(v)
        ? slice(v.length, sel).map((i) => ({ path: [...n.path, i], value: v[i] }))
        : [];
    case "filter":
      return children(n).filter((c) => test(sel.expr, c.value, root));
  }
}

function run(segs: Segment[], start: Node, root: unknown): Node[] {
  let nodes = [start];
  for (const seg of segs) {
    const from = seg.desc ? nodes.flatMap((n) => descendants(n)) : nodes;
    nodes = from.flatMap((n) => seg.sels.flatMap((s) => select(n, s, root)));
  }
  return nodes;
}

function value(o: Operand, current: unknown, root: unknown): unknown {
  if (o.t === "lit") return o.v;
  const found = run(o.segs, { path: [], value: o.root === "@" ? current : root }, root);
  return found.length ? found[0]?.value : NOTHING;
}

function compare(op: Op, a: unknown, b: unknown): boolean {
  if (op === "==" || op === "!=") {
    const eq = a === NOTHING || b === NOTHING ? a === b : canonical(a) === canonical(b);
    return op === "==" ? eq : !eq;
  }
  const comparable =
    (typeof a === "number" && typeof b === "number") ||
    (typeof a === "string" && typeof b === "string");
  if (!comparable) return false;
  const x = a as number | string;
  const y = b as number | string;
  return op === "<" ? x < y : op === "<=" ? x <= y : op === ">" ? x > y : x >= y;
}

function test(e: Expr, current: unknown, root: unknown): boolean {
  switch (e.t) {
    case "or":
      return test(e.a, current, root) || test(e.b, current, root);
    case "and":
      return test(e.a, current, root) && test(e.b, current, root);
    case "not":
      return !test(e.e, current, root);
    case "test":
      return value(e.q, current, root) !== NOTHING;
    case "cmp":
      return compare(e.op, value(e.a, current, root), value(e.b, current, root));
  }
}

export type QueryResult = { ok: true; nodes: Node[] } | { ok: false; error: QueryError };

export function query(doc: unknown, q: string): QueryResult {
  try {
    const segs = parser(q).query();
    return { ok: true, nodes: run(segs, { path: [], value: doc }, doc) };
  } catch (err) {
    if (err instanceof Fail) return { ok: false, error: err.info };
    if (err instanceof RangeError) return { ok: false, error: { code: "unexpected", pos: 0 } };
    throw err;
  }
}

export const SAMPLE = {
  store: {
    book: [
      { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
      { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
      {
        category: "fiction",
        author: "Herman Melville",
        title: "Moby Dick",
        isbn: "0-553-21311-3",
        price: 8.99,
      },
      {
        category: "fiction",
        author: "J. R. R. Tolkien",
        title: "The Lord of the Rings",
        isbn: "0-395-19395-8",
        price: 22.99,
      },
    ],
    bicycle: { color: "red", price: 399 },
  },
};

export const PRESETS = [
  "$.store.book[*].author",
  "$..author",
  "$.store.*",
  "$.store..price",
  "$..book[2]",
  "$..book[-1]",
  "$..book[0:2]",
  "$..book[?(@.isbn)]",
  "$..book[?(@.price < 10)]",
  "$..book[?(@.category == 'fiction' && @.price > 10)]",
  "$..*",
];
