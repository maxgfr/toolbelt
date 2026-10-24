/**
 * Semantic versioning, following node-semver (what npm uses): parse, compare (precedence
 * with prerelease rules, build metadata ignored), ranges (^ ~ x * hyphen || and comparators,
 * desugared exactly like node-semver), and bumps.
 */

export type Ident = string | number;

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: Ident[];
  build: string[];
}

const NUM = "0|[1-9]\\d*";
const PRE_ID = `(?:${NUM}|\\d*[a-zA-Z-][a-zA-Z0-9-]*)`;
const PRE = `(?:-(${PRE_ID}(?:\\.${PRE_ID})*))`;
const BUILD = "(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))";
const FULL = new RegExp(`^[v=\\s]*(${NUM})\\.(${NUM})\\.(${NUM})${PRE}?${BUILD}?$`);

const ident = (s: string): Ident => (/^\d+$/.test(s) ? Number(s) : s);

/** A strict SemVer 2.0.0 version (a leading "v" or "=" is allowed, as in npm). */
export function parse(text: string): SemVer | null {
  const m = FULL.exec(text.trim());
  if (!m) return null;
  const nums = [m[1], m[2], m[3]].map(Number);
  if (nums.some((n) => !Number.isSafeInteger(n))) return null;
  return {
    major: nums[0] ?? 0,
    minor: nums[1] ?? 0,
    patch: nums[2] ?? 0,
    prerelease: m[4] ? m[4].split(".").map(ident) : [],
    build: m[5] ? m[5].split(".") : [],
  };
}

export function format(v: SemVer, withBuild = false): string {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease.length) s += `-${v.prerelease.join(".")}`;
  if (withBuild && v.build.length) s += `+${v.build.join(".")}`;
  return s;
}

function compareIdent(a: Ident, b: Ident): number {
  const an = typeof a === "number";
  const bn = typeof b === "number";
  if (an && bn) return a === b ? 0 : a < b ? -1 : 1;
  if (an) return -1;
  if (bn) return 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

/** -1, 0 or 1 by precedence. */
export function compare(a: SemVer, b: SemVer): -1 | 0 | 1 {
  for (const k of ["major", "minor", "patch"] as const)
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  const pa = a.prerelease;
  const pb = b.prerelease;
  if (!pa.length && !pb.length) return 0;
  if (!pa.length) return 1;
  if (!pb.length) return -1;
  for (let i = 0; ; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const c = compareIdent(x, y);
    if (c) return c as -1 | 1;
  }
}

export type DiffKind = "major" | "minor" | "patch" | "prerelease" | "build" | null;

/** The most significant part that differs. */
export function diff(a: SemVer, b: SemVer): DiffKind {
  if (a.major !== b.major) return "major";
  if (a.minor !== b.minor) return "minor";
  if (a.patch !== b.patch) return "patch";
  if (compare(a, b)) return "prerelease";
  return a.build.join(".") !== b.build.join(".") ? "build" : null;
}

/* --- Ranges ----------------------------------------------------------------- */

export type Op = "<" | "<=" | ">" | ">=" | "=";
/** One test; `null` version means "any version" (the `*` comparator). */
export interface Comparator {
  op: Op;
  version: SemVer | null;
}
export type Range = Comparator[][];

interface Partial {
  M: string | null;
  m: string | null;
  p: string | null;
  pr: string;
}

const XR = `x|X|\\*|${NUM}`;
const PARTIAL = new RegExp(`^[v=\\s]*(${XR})(?:\\.(${XR})(?:\\.(${XR})(?:${PRE})?${BUILD}?)?)?$`);

function parsePartial(text: string): Partial | null {
  const m = PARTIAL.exec(text);
  if (!m) return null;
  const x = (s: string | undefined) => (s === undefined || /^[xX*]$/.test(s) ? null : s);
  return { M: x(m[1]), m: x(m[2]), p: x(m[3]), pr: m[4] ?? "" };
}

function v(text: string): SemVer {
  const r = parse(text);
  if (!r) throw new Error(`internal: bad version ${text}`);
  return r;
}

const cmp = (op: Op, version: string): Comparator => ({ op, version: v(version) });
const ANY: Comparator = { op: ">=", version: null };
const NONE: Comparator = {
  op: "<",
  version: { major: 0, minor: 0, patch: 0, prerelease: [0], build: [] },
};

/** One comparator token (`^1.2`, `>=1.0.0-rc.1`, `1.x`, `*`) as primitive comparators. */
function desugar(token: string, incPr: boolean): Comparator[] | null {
  const z = incPr ? "-0" : "";
  const sugar = /^(\^|~>?|<=|>=|<|>|=)?(.*)$/.exec(token);
  const op = sugar?.[1] ?? "";
  const part = parsePartial(sugar?.[2] ?? "");
  if (!part) return null;
  const { M, m, p, pr } = part;
  const pre = pr ? `-${pr}` : "";

  if (op === "~" || op === "~>") {
    if (M === null) return [ANY];
    if (m === null) return [cmp(">=", `${M}.0.0${z}`), cmp("<", `${+M + 1}.0.0-0`)];
    if (p === null) return [cmp(">=", `${M}.${m}.0${z}`), cmp("<", `${M}.${+m + 1}.0-0`)];
    return [cmp(">=", `${M}.${m}.${p}${pre}`), cmp("<", `${M}.${+m + 1}.0-0`)];
  }
  if (op === "^") {
    if (M === null) return [ANY];
    if (m === null) return [cmp(">=", `${M}.0.0${z}`), cmp("<", `${+M + 1}.0.0-0`)];
    if (p === null)
      return M === "0"
        ? [cmp(">=", `${M}.${m}.0${z}`), cmp("<", `${M}.${+m + 1}.0-0`)]
        : [cmp(">=", `${M}.${m}.0${z}`), cmp("<", `${+M + 1}.0.0-0`)];
    const low = cmp(">=", `${M}.${m}.${p}${pre || (M === "0" ? z : "")}`);
    if (M !== "0") return [low, cmp("<", `${+M + 1}.0.0-0`)];
    if (m !== "0") return [low, cmp("<", `${M}.${+m + 1}.0-0`)];
    return [low, cmp("<", `${M}.${m}.${+p + 1}-0`)];
  }

  // Plain comparators and X-ranges.
  const anyX = M === null || m === null || p === null;
  let gtlt = op === "=" && anyX ? "" : op;
  if (M === null) return gtlt === "<" || gtlt === ">" ? [NONE] : [ANY];
  if (!anyX) return [cmp((gtlt || "=") as Op, `${M}.${m}.${p}${pre}`)];
  if (gtlt) {
    let maj = +M;
    let min = m === null ? 0 : +m;
    let prs = z;
    if (gtlt === ">") {
      gtlt = ">=";
      if (m === null) {
        maj += 1;
        min = 0;
      } else min += 1;
    } else if (gtlt === "<=") {
      gtlt = "<";
      if (m === null) maj += 1;
      else min += 1;
    }
    if (gtlt === "<") prs = "-0";
    return [cmp(gtlt as Op, `${maj}.${min}.0${prs}`)];
  }
  if (m === null) return [cmp(">=", `${M}.0.0${z}`), cmp("<", `${+M + 1}.0.0-0`)];
  return [cmp(">=", `${M}.${m}.0${z}`), cmp("<", `${M}.${+m + 1}.0-0`)];
}

/** `1.2.3 - 2.3.4` as primitive comparators. */
function hyphen(from: string, to: string, incPr: boolean): Comparator[] | null {
  const a = parsePartial(from);
  const b = parsePartial(to);
  if (!a || !b) return null;
  const z = incPr ? "-0" : "";
  const out: Comparator[] = [];
  if (a.M !== null) {
    if (a.m === null) out.push(cmp(">=", `${a.M}.0.0${z}`));
    else if (a.p === null) out.push(cmp(">=", `${a.M}.${a.m}.0${z}`));
    else out.push(cmp(">=", `${a.M}.${a.m}.${a.p}${a.pr ? `-${a.pr}` : z}`));
  }
  if (b.M !== null) {
    if (b.m === null) out.push(cmp("<", `${+b.M + 1}.0.0-0`));
    else if (b.p === null) out.push(cmp("<", `${b.M}.${+b.m + 1}.0-0`));
    else if (b.pr) out.push(cmp("<=", `${b.M}.${b.m}.${b.p}-${b.pr}`));
    else if (incPr) out.push(cmp("<", `${b.M}.${b.m}.${+b.p + 1}-0`));
    else out.push(cmp("<=", `${b.M}.${b.m}.${b.p}`));
  }
  return out.length ? out : [ANY];
}

/** Parses a range; null when any part is not valid. */
export function parseRange(text: string, includePrerelease = false): Range | null {
  const sets = text.split("||");
  const out: Range = [];
  for (const raw of sets) {
    const set = raw.trim().replace(/(\^|~>?|<=|>=|<|>|=)\s+/g, "$1");
    const h = /^(\S+)\s+-\s+(\S+)$/.exec(set);
    if (h) {
      const c = hyphen(h[1] ?? "", h[2] ?? "", includePrerelease);
      if (!c) return null;
      out.push(c);
      continue;
    }
    const tokens = set.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      out.push([ANY]);
      continue;
    }
    const comps: Comparator[] = [];
    for (const t of tokens) {
      const c = desugar(t, includePrerelease);
      if (!c) return null;
      comps.push(...c);
    }
    // `*` alongside other comparators adds nothing.
    const real = comps.filter((c) => c.version !== null);
    out.push(real.length ? real : [ANY]);
  }
  return out;
}

function test(c: Comparator, ver: SemVer): boolean {
  if (!c.version) return true;
  const r = compare(ver, c.version);
  switch (c.op) {
    case "<":
      return r < 0;
    case "<=":
      return r <= 0;
    case ">":
      return r > 0;
    case ">=":
      return r >= 0;
    case "=":
      return r === 0;
  }
}

function testSet(set: Comparator[], ver: SemVer, includePrerelease: boolean): boolean {
  if (!set.every((c) => test(c, ver))) return false;
  if (!ver.prerelease.length || includePrerelease) return true;
  // A prerelease only matches when a comparator of the set names a prerelease of the
  // same major.minor.patch: ^1.2.3-beta.1 lets 1.2.3-beta.4 in, but not 1.3.0-alpha.
  return set.some(
    (c) =>
      c.version !== null &&
      c.version.prerelease.length > 0 &&
      c.version.major === ver.major &&
      c.version.minor === ver.minor &&
      c.version.patch === ver.patch,
  );
}

export function satisfies(ver: SemVer, range: Range, includePrerelease = false): boolean {
  return range.some((set) => testSet(set, ver, includePrerelease));
}

/** The range as node-semver normalizes it: `>=1.2.3 <2.0.0-0 || …`. */
export function formatRange(range: Range): string {
  return range
    .map((set) =>
      set
        .map((c) => (c.version ? `${c.op === "=" ? "" : c.op}${format(c.version)}` : "*"))
        .join(" "),
    )
    .join(" || ");
}

/** The highest of `versions` in the range, or null. */
export function maxSatisfying(
  versions: SemVer[],
  range: Range,
  includePrerelease = false,
): SemVer | null {
  let best: SemVer | null = null;
  for (const ver of versions)
    if (satisfies(ver, range, includePrerelease) && (!best || compare(ver, best) > 0)) best = ver;
  return best;
}

/* --- Bumps ------------------------------------------------------------------ */

export type Release =
  | "major"
  | "minor"
  | "patch"
  | "premajor"
  | "preminor"
  | "prepatch"
  | "prerelease";

export const RELEASES: Release[] = [
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
];

function bumpPre(v: SemVer, id: string): SemVer {
  let pre = [...v.prerelease];
  if (!pre.length) pre = [0];
  else {
    let i = pre.length - 1;
    while (i >= 0 && typeof pre[i] !== "number") i--;
    if (i >= 0) pre[i] = (pre[i] as number) + 1;
    else pre.push(0);
  }
  if (id) {
    if (pre[0] !== id || typeof pre[1] !== "number") pre = [ident(id), 0];
  }
  return { ...v, prerelease: pre, build: [] };
}

/** node-semver's `inc`: 1.2.3 → major 2.0.0, prerelease "beta" → 1.2.4-beta.0. */
export function inc(v: SemVer, release: Release, id = ""): SemVer {
  const base = { ...v, build: [] as string[] };
  switch (release) {
    case "major":
      return v.minor || v.patch || !v.prerelease.length
        ? { ...base, major: v.major + 1, minor: 0, patch: 0, prerelease: [] }
        : { ...base, minor: 0, patch: 0, prerelease: [] };
    case "minor":
      return v.patch || !v.prerelease.length
        ? { ...base, minor: v.minor + 1, patch: 0, prerelease: [] }
        : { ...base, patch: 0, prerelease: [] };
    case "patch":
      return v.prerelease.length
        ? { ...base, prerelease: [] }
        : { ...base, patch: v.patch + 1, prerelease: [] };
    case "premajor":
      return bumpPre({ ...base, major: v.major + 1, minor: 0, patch: 0, prerelease: [] }, id);
    case "preminor":
      return bumpPre({ ...base, minor: v.minor + 1, patch: 0, prerelease: [] }, id);
    case "prepatch":
      return bumpPre({ ...base, patch: v.patch + 1, prerelease: [] }, id);
    case "prerelease":
      return bumpPre(v.prerelease.length ? base : { ...base, patch: v.patch + 1 }, id);
  }
}

/** A prerelease identifier must be alphanumerics and hyphens, without a leading-zero number. */
export function validPreId(id: string): boolean {
  return id === "" || new RegExp(`^${PRE_ID}$`).test(id);
}
