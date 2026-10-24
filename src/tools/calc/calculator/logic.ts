/**
 * A calculator without eval: a tokenizer, a recursive-descent parser to a small tree, and an
 * evaluator. One expression per line, `x = 3` defines a variable, `ans` is the last result,
 * `sum` / `total` add the lines above (up to a blank line). French and German names work too
 * (`racine`, `wurzel`, `somme`, `summe`…).
 */

export type Angle = "deg" | "rad";

export interface CalcOptions {
  angle: Angle;
  /**
   * French and German style: "1,5" is one and a half (use ";" or ", " between function
   * arguments).
   */
  decimalComma: boolean;
}

export type ErrorCode =
  | "char" // unknown character
  | "syntax" // unexpected token
  | "paren" // missing parenthesis
  | "name" // unknown variable
  | "func" // unknown function
  | "args" // wrong number of arguments
  | "divZero"
  | "domain" // sqrt(-1), log(0)…
  | "overflow"
  | "reserved"; // assigning to pi, sin, ans…

export class CalcError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail = "",
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "(" }
  | { t: ")" }
  | { t: "sep" }
  | { t: "=" };

const GROUP = /[   '_]/;
const DIGIT = /[0-9]/;
const ID_START = /[\p{L}_]/u;
const ID_PART = /[\p{L}\p{N}_]/u;

export function tokenize(src: string, opts: Pick<CalcOptions, "decimalComma">): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const at = (k: number) => src[k] ?? "";
  const digitsAt = (k: number, n: number) => {
    for (let j = 0; j < n; j++) if (!DIGIT.test(at(k + j))) return false;
    return !DIGIT.test(at(k + n));
  };
  while (i < src.length) {
    const c = at(i);
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const decimalStart = (c === "." || (c === "," && opts.decimalComma)) && DIGIT.test(at(i + 1));
    if (DIGIT.test(c) || decimalStart) {
      let s = "";
      let intLen = 0;
      while (DIGIT.test(at(i))) {
        s += at(i++);
        intLen++;
      }
      // Thousands groups: "1 000 000", "1'000", "1,000" (English only).
      while (intLen > 0 && intLen <= 3) {
        const g = at(i);
        const isGroup = GROUP.test(g) || (g === "," && !opts.decimalComma);
        if (isGroup && digitsAt(i + 1, 3)) {
          s += src.slice(i + 1, i + 4);
          i += 4;
        } else break;
      }
      const d = at(i);
      if ((d === "." || (d === "," && opts.decimalComma)) && DIGIT.test(at(i + 1))) {
        s += ".";
        i++;
        while (DIGIT.test(at(i))) s += at(i++);
      }
      // Exponent: 2e3, 1.5E-4 (but "2e" alone is 2 × e).
      if (/[eE]/.test(at(i))) {
        const sign = /[+-]/.test(at(i + 1)) ? 1 : 0;
        if (DIGIT.test(at(i + 1 + sign))) {
          s += `e${sign ? at(i + 1) : ""}`;
          i += 1 + sign;
          while (DIGIT.test(at(i))) s += at(i++);
        }
      }
      out.push({ t: "num", v: Number(s) });
      continue;
    }
    if (ID_START.test(c) || c === "π") {
      let s = "";
      while (i < src.length && (ID_PART.test(at(i)) || at(i) === "π")) s += at(i++);
      out.push({ t: "id", v: s });
      continue;
    }
    if (c === "*" && at(i + 1) === "*") {
      out.push({ t: "op", v: "^" });
      i += 2;
      continue;
    }
    const op = OPS[c];
    if (op) {
      out.push({ t: "op", v: op });
      i++;
      continue;
    }
    if (c === "(" || c === "[") out.push({ t: "(" });
    else if (c === ")" || c === "]") out.push({ t: ")" });
    else if (c === ";" || c === ",") out.push({ t: "sep" });
    else if (c === "=") out.push({ t: "=" });
    else throw new CalcError("char", c);
    i++;
  }
  return out;
}

const OPS: Record<string, string> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "–": "-",
  "*": "*",
  "×": "*",
  "·": "*",
  "/": "/",
  "÷": "/",
  ":": "/",
  "^": "^",
  "%": "%",
  "!": "!",
};

export type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "pct"; a: Node }
  | { k: "fact"; a: Node }
  | { k: "call"; name: string; args: Node[] };

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  peek(): Tok | undefined {
    return this.toks[this.i];
  }
  next(): Tok | undefined {
    return this.toks[this.i++];
  }
  done(): boolean {
    return this.i >= this.toks.length;
  }
  isOp(v: string): boolean {
    const t = this.peek();
    return t?.t === "op" && t.v === v;
  }

  expr(): Node {
    let a = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.next() as { v: string }).v;
      a = { k: "bin", op, a, b: this.term() };
    }
    return a;
  }

  term(): Node {
    let a = this.unary();
    for (;;) {
      const t = this.peek();
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.next() as { v: string }).v;
        a = { k: "bin", op, a, b: this.unary() };
      } else if (t?.t === "id" && t.v.toLowerCase() === "mod") {
        this.next();
        a = { k: "bin", op: "mod", a, b: this.unary() };
      } else if (t?.t === "id" || t?.t === "(") {
        // Implicit multiplication: 2pi, 3(4 + 1), (1 + 2)(3 + 4).
        a = { k: "bin", op: "*", a, b: this.power() };
      } else return a;
    }
  }

  unary(): Node {
    if (this.isOp("-")) {
      this.next();
      return { k: "neg", a: this.unary() };
    }
    if (this.isOp("+")) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  power(): Node {
    const base = this.postfix();
    if (this.isOp("^")) {
      this.next();
      return { k: "bin", op: "^", a: base, b: this.unary() };
    }
    return base;
  }

  postfix(): Node {
    let a = this.primary();
    for (;;) {
      if (this.isOp("%")) {
        this.next();
        a = { k: "pct", a };
      } else if (this.isOp("!")) {
        this.next();
        a = { k: "fact", a };
      } else return a;
    }
  }

  primary(): Node {
    const t = this.next();
    if (!t) throw new CalcError("syntax", "end");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "(") {
      const e = this.expr();
      if (this.next()?.t !== ")") throw new CalcError("paren");
      return e;
    }
    if (t.t === "id") {
      if (this.peek()?.t === "(" && FUNCS[t.v.toLowerCase()]) {
        this.next();
        const args: Node[] = [];
        if (this.peek()?.t !== ")") {
          args.push(this.expr());
          while (this.peek()?.t === "sep") {
            this.next();
            args.push(this.expr());
          }
        }
        if (this.next()?.t !== ")") throw new CalcError("paren");
        return { k: "call", name: t.v.toLowerCase(), args };
      }
      if (FUNCS[t.v.toLowerCase()] && !CONSTS[t.v.toLowerCase()]) {
        // "sqrt 9" → sqrt(9): a function name followed by a single value.
        return { k: "call", name: t.v.toLowerCase(), args: [this.power()] };
      }
      return { k: "var", name: t.v };
    }
    throw new CalcError("syntax", tokText(t));
  }
}

function tokText(t: Tok): string {
  if (t.t === "num" || t.t === "id" || t.t === "op") return String(t.v);
  return t.t === "sep" ? ";" : t.t;
}

export function parse(toks: Tok[]): Node {
  const p = new Parser(toks);
  const n = p.expr();
  const rest = p.peek();
  if (rest) throw new CalcError(rest.t === ")" ? "paren" : "syntax", tokText(rest));
  return n;
}

const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI };

interface Func {
  min: number;
  max: number;
  f: (args: number[], o: CalcOptions) => number;
}

const toRad = (x: number, o: CalcOptions) => (o.angle === "deg" ? (x * Math.PI) / 180 : x);
const fromRad = (x: number, o: CalcOptions) => (o.angle === "deg" ? (x * 180) / Math.PI : x);
/** Trigonometry snaps the tiny leftovers of π to zero: sin(180°) = 0, not 1.2e-16. */
const snap = (x: number) => (Math.abs(x) < 1e-14 ? 0 : x);

function trig(name: "sin" | "cos" | "tan", x: number, o: CalcOptions): number {
  if (o.angle === "deg") {
    const m = ((x % 360) + 360) % 360;
    if (name === "sin" && m % 180 === 0) return 0;
    if (name === "cos" && m % 180 === 90) return 0;
    if (name === "tan" && m % 180 === 0) return 0;
    if (name === "tan" && m % 180 === 90) return Number.NaN;
    if (name === "sin" && m === 90) return 1;
    if (name === "sin" && m === 270) return -1;
    if (name === "cos" && m === 0) return 1;
    if (name === "cos" && m === 180) return -1;
  }
  return snap(Math[name](toRad(x, o)));
}

const one = (f: (x: number, o: CalcOptions) => number): Func => ({
  min: 1,
  max: 1,
  f: (a, o) => f(a[0] ?? Number.NaN, o),
});

export const FUNCS: Record<string, Func> = {
  sqrt: one((x) => Math.sqrt(x)),
  racine: one((x) => Math.sqrt(x)),
  cbrt: one((x) => Math.cbrt(x)),
  sin: one((x, o) => trig("sin", x, o)),
  cos: one((x, o) => trig("cos", x, o)),
  tan: one((x, o) => trig("tan", x, o)),
  asin: one((x, o) => fromRad(Math.asin(x), o)),
  acos: one((x, o) => fromRad(Math.acos(x), o)),
  atan: one((x, o) => fromRad(Math.atan(x), o)),
  ln: one((x) => Math.log(x)),
  log: {
    min: 1,
    max: 2,
    f: ([x = Number.NaN, b]) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b)),
  },
  log2: one((x) => Math.log2(x)),
  exp: one((x) => Math.exp(x)),
  abs: one((x) => Math.abs(x)),
  round: {
    min: 1,
    max: 2,
    f: ([x = Number.NaN, d = 0]) => {
      const f = 10 ** Math.round(d);
      return (Math.sign(x) * Math.round(Math.abs(x) * f)) / f;
    },
  },
  floor: one((x) => Math.floor(x)),
  ceil: one((x) => Math.ceil(x)),
  min: { min: 1, max: Number.POSITIVE_INFINITY, f: (a) => Math.min(...a) },
  max: { min: 1, max: Number.POSITIVE_INFINITY, f: (a) => Math.max(...a) },
  avg: { min: 1, max: Number.POSITIVE_INFINITY, f: (a) => a.reduce((s, x) => s + x, 0) / a.length },
};
FUNCS.moy = FUNCS.avg as Func;
FUNCS.arrondi = FUNCS.round as Func;
FUNCS.wurzel = FUNCS.sqrt as Func;
FUNCS.mittel = FUNCS.avg as Func;
FUNCS.runden = FUNCS.round as Func;

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return Number.NaN;
  if (n > 170) return Number.POSITIVE_INFINITY;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Names that cannot be assigned to. */
export function isReserved(name: string): boolean {
  const n = name.toLowerCase();
  return n in CONSTS || n in FUNCS || n === "ans" || n === "mod" || SUM_NAMES.has(n);
}

const SUM_NAMES = new Set(["sum", "total", "somme", "summe"]);

export function evaluate(node: Node, vars: ReadonlyMap<string, number>, opts: CalcOptions): number {
  const ev = (n: Node): number => {
    switch (n.k) {
      case "num":
        return n.v;
      case "var": {
        const v = vars.get(n.name) ?? vars.get(n.name.toLowerCase());
        if (v !== undefined) return v;
        const c = CONSTS[n.name.toLowerCase()];
        if (c !== undefined) return c;
        throw new CalcError("name", n.name);
      }
      case "neg":
        return -ev(n.a);
      case "pct":
        return ev(n.a) / 100;
      case "fact":
        return factorial(ev(n.a));
      case "call": {
        const f = FUNCS[n.name];
        if (!f) throw new CalcError("func", n.name);
        if (n.args.length < f.min || n.args.length > f.max) throw new CalcError("args", n.name);
        return f.f(n.args.map(ev), opts);
      }
      case "bin": {
        const a = ev(n.a);
        // Calculator percentages: 200 + 10% = 220, 200 − 10% = 180.
        if ((n.op === "+" || n.op === "-") && n.b.k === "pct") {
          const p = (a * ev(n.b.a)) / 100;
          return n.op === "+" ? a + p : a - p;
        }
        const b = ev(n.b);
        switch (n.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            if (b === 0) throw new CalcError("divZero");
            return a / b;
          case "mod":
            if (b === 0) throw new CalcError("divZero");
            return ((a % b) + b) % b;
          default:
            return a ** b;
        }
      }
    }
  };
  const r = ev(node);
  if (Number.isNaN(r)) throw new CalcError("domain");
  if (!Number.isFinite(r)) throw new CalcError("overflow");
  return r;
}

export type LineResult =
  | { kind: "blank" }
  | { kind: "value"; value: number; name?: string; label?: string }
  | { kind: "error"; code: ErrorCode; detail: string };

/** Strips a comment (# or //) and a "Label:" prefix; gives what's left to compute. */
export function splitLine(line: string): { label: string; expr: string } {
  let s = line;
  const hash = s.search(/#|\/\//);
  if (hash >= 0) s = s.slice(0, hash);
  const m = /^\s*([^:=()]*\p{L}[^:=()]*?)\s*:\s*(.*)$/u.exec(s);
  if (m) return { label: (m[1] ?? "").trim(), expr: m[2] ?? "" };
  return { label: "", expr: s };
}

/** Evaluates every line; variables and `ans` carry over from one line to the next. */
export function evaluateSheet(text: string, opts: CalcOptions): LineResult[] {
  const vars = new Map<string, number>();
  const out: LineResult[] = [];
  let block: number[] = [];
  let ans: number | undefined;
  for (const line of text.split("\n")) {
    const { label, expr } = splitLine(line);
    if (!expr.trim()) {
      out.push({ kind: "blank" });
      if (!line.trim()) block = [];
      continue;
    }
    try {
      const toks = tokenize(expr, opts);
      let name: string | undefined;
      let body = toks;
      const eq = toks.findIndex((t) => t.t === "=");
      if (eq >= 0) {
        const target = toks[0];
        if (eq !== 1 || target?.t !== "id") throw new CalcError("syntax", "=");
        if (isReserved(target.v)) throw new CalcError("reserved", target.v);
        name = target.v;
        body = toks.slice(2);
      }
      const scope = new Map(vars);
      if (ans !== undefined) scope.set("ans", ans);
      const total = block.reduce((s, x) => s + x, 0);
      for (const n of SUM_NAMES) if (!scope.has(n)) scope.set(n, total);
      const value = evaluate(parse(body), scope, opts);
      if (name) vars.set(name, value);
      ans = value;
      block.push(value);
      out.push({
        kind: "value",
        value,
        ...(name ? { name } : {}),
        ...(label ? { label } : {}),
      });
    } catch (err) {
      if (err instanceof CalcError) out.push({ kind: "error", code: err.code, detail: err.detail });
      else out.push({ kind: "error", code: "syntax", detail: "" });
    }
  }
  return out;
}

/** One expression on its own (no variables): handy for tests and quick use. */
export function calc(expr: string, opts: Partial<CalcOptions> = {}): number {
  const o: CalcOptions = { angle: "deg", decimalComma: false, ...opts };
  return evaluate(parse(tokenize(expr, o)), new Map(), o);
}
