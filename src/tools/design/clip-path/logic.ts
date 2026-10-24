/** clip-path shapes: polygon, circle, ellipse, inset — values in percent of the element box. */
import { asArray, asRecord, clampNum, len, oneOf, tailwindArbitrary } from "../_shared";

export const KINDS = ["polygon", "circle", "ellipse", "inset"] as const;
export type Kind = (typeof KINDS)[number];
export type Pt = [number, number];

export type Clip = {
  kind: Kind;
  points: Pt[];
  /** circle: r; ellipse: rx, ry; both centered at cx, cy. */
  r: number;
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  /** inset: top, right, bottom, left (%), corner radius (px). */
  inset: [number, number, number, number];
  round: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A regular polygon with `n` vertices, first vertex at the top. */
export function regularPolygon(n: number, rotation = 0): Pt[] {
  const k = Math.max(3, Math.min(64, Math.round(n)));
  return Array.from({ length: k }, (_, i) => {
    const a = ((rotation + (360 / k) * i - 90) * Math.PI) / 180;
    return [round1(50 + 50 * Math.cos(a)), round1(50 + 50 * Math.sin(a))] as Pt;
  });
}

/** A star with `n` branches; `inner` is the inner radius as a fraction of the outer one. */
export function star(n: number, inner = 0.4): Pt[] {
  const k = Math.max(3, Math.min(32, Math.round(n)));
  const out: Pt[] = [];
  for (let i = 0; i < k * 2; i++) {
    const rad = i % 2 === 0 ? 50 : 50 * inner;
    const a = ((180 / k) * i - 90) * (Math.PI / 180);
    out.push([round1(50 + rad * Math.cos(a)), round1(50 + rad * Math.sin(a))]);
  }
  return out;
}

export const DEFAULT: Clip = {
  kind: "polygon",
  points: [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ],
  r: 50,
  rx: 50,
  ry: 35,
  cx: 50,
  cy: 50,
  inset: [10, 10, 10, 10],
  round: 16,
};

function point(raw: unknown): Pt | null {
  const a = asArray(raw);
  if (a.length !== 2) return null;
  return [clampNum(a[0], 0, 100, 0), clampNum(a[1], 0, 100, 0)];
}

export function cleanClip(raw: unknown): Clip {
  const r = asRecord(raw);
  const pts = asArray(r.points)
    .slice(0, 64)
    .map(point)
    .filter((p): p is Pt => p !== null);
  const ins = asArray(r.inset);
  return {
    kind: oneOf(r.kind, KINDS, DEFAULT.kind),
    points: pts.length >= 3 ? pts : DEFAULT.points,
    r: clampNum(r.r, 0, 100, DEFAULT.r),
    rx: clampNum(r.rx, 0, 100, DEFAULT.rx),
    ry: clampNum(r.ry, 0, 100, DEFAULT.ry),
    cx: clampNum(r.cx, 0, 100, DEFAULT.cx),
    cy: clampNum(r.cy, 0, 100, DEFAULT.cy),
    inset:
      ins.length === 4
        ? (ins.map((v, i) => clampNum(v, 0, 100, DEFAULT.inset[i] as number)) as Clip["inset"])
        : DEFAULT.inset,
    round: clampNum(r.round, 0, 500, DEFAULT.round),
  };
}

const pc = (n: number) => len(n, "%", 2);

/** The clip-path value for the current kind. */
export function clipValue(c: Clip): string {
  switch (c.kind) {
    case "polygon":
      return `polygon(${c.points.map(([x, y]) => `${pc(x)} ${pc(y)}`).join(", ")})`;
    case "circle":
      return `circle(${pc(c.r)} at ${pc(c.cx)} ${pc(c.cy)})`;
    case "ellipse":
      return `ellipse(${pc(c.rx)} ${pc(c.ry)} at ${pc(c.cx)} ${pc(c.cy)})`;
    case "inset": {
      const [t, r, b, l] = c.inset.map(pc);
      const box =
        r === l
          ? t === b
            ? t === r
              ? `${t}`
              : `${t} ${r}`
            : `${t} ${r} ${b}`
          : `${t} ${r} ${b} ${l}`;
      return `inset(${box}${c.round > 0 ? ` round ${len(c.round)}` : ""})`;
    }
  }
}

export function clipCss(c: Clip): string {
  return `clip-path: ${clipValue(c)};`;
}

export function clipTailwind(c: Clip): string {
  return tailwindArbitrary("[clip-path", clipValue(c));
}

function dist2(a: Pt, b: Pt): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/** Squared distance from p to segment ab. */
function segDist2(p: Pt, a: Pt, b: Pt): number {
  const l2 = dist2(a, b);
  if (l2 === 0) return dist2(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2),
  );
  return dist2(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}

/** Inserts `p` into the polygon on its nearest edge; returns the new list and the new index. */
export function insertPoint(points: Pt[], p: Pt): { points: Pt[]; index: number } {
  if (points.length < 2) return { points: [...points, p], index: points.length };
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    const d = segDist2(p, points[i] as Pt, points[(i + 1) % points.length] as Pt);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const out = points.slice();
  out.splice(best + 1, 0, p);
  return { points: out, index: best + 1 };
}

/** A new point in the middle of the longest edge. */
export function splitLongestEdge(points: Pt[]): { points: Pt[]; index: number } {
  let best = 0;
  let bestL = -1;
  for (let i = 0; i < points.length; i++) {
    const l = dist2(points[i] as Pt, points[(i + 1) % points.length] as Pt);
    if (l > bestL) {
      bestL = l;
      best = i;
    }
  }
  const a = points[best] as Pt;
  const b = points[(best + 1) % points.length] as Pt;
  const out = points.slice();
  out.splice(best + 1, 0, [round1((a[0] + b[0]) / 2), round1((a[1] + b[1]) / 2)]);
  return { points: out, index: best + 1 };
}

export interface ClipPreset {
  id: string;
  name: { en: string; fr: string; de: string };
  points: Pt[];
}

const P = (...xs: number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i] as number, xs[i + 1] as number]);
  return out;
};

export const PRESETS: ClipPreset[] = [
  {
    id: "triangle",
    name: { en: "Triangle", fr: "Triangle", de: "Dreieck" },
    points: P(50, 0, 100, 100, 0, 100),
  },
  {
    id: "trapezoid",
    name: { en: "Trapezoid", fr: "Trapèze", de: "Trapez" },
    points: P(20, 0, 80, 0, 100, 100, 0, 100),
  },
  {
    id: "parallelogram",
    name: { en: "Parallelogram", fr: "Parallélogramme", de: "Parallelogramm" },
    points: P(25, 0, 100, 0, 75, 100, 0, 100),
  },
  {
    id: "rhombus",
    name: { en: "Rhombus", fr: "Losange", de: "Raute" },
    points: P(50, 0, 100, 50, 50, 100, 0, 50),
  },
  {
    id: "pentagon",
    name: { en: "Pentagon", fr: "Pentagone", de: "Fünfeck" },
    points: regularPolygon(5),
  },
  {
    id: "hexagon",
    name: { en: "Hexagon", fr: "Hexagone", de: "Sechseck" },
    points: P(25, 0, 75, 0, 100, 50, 75, 100, 25, 100, 0, 50),
  },
  {
    id: "octagon",
    name: { en: "Octagon", fr: "Octogone", de: "Achteck" },
    points: P(30, 0, 70, 0, 100, 30, 100, 70, 70, 100, 30, 100, 0, 70, 0, 30),
  },
  { id: "star", name: { en: "Star", fr: "Étoile", de: "Stern" }, points: star(5, 0.4) },
  {
    id: "cross",
    name: { en: "Cross", fr: "Croix", de: "Kreuz" },
    points: P(
      35,
      0,
      65,
      0,
      65,
      35,
      100,
      35,
      100,
      65,
      65,
      65,
      65,
      100,
      35,
      100,
      35,
      65,
      0,
      65,
      0,
      35,
      35,
      35,
    ),
  },
  {
    id: "arrow-right",
    name: { en: "Arrow", fr: "Flèche", de: "Pfeil" },
    points: P(0, 30, 60, 30, 60, 0, 100, 50, 60, 100, 60, 70, 0, 70),
  },
  {
    id: "chevron",
    name: { en: "Chevron", fr: "Chevron", de: "Chevron" },
    points: P(75, 0, 100, 50, 75, 100, 0, 100, 25, 50, 0, 0),
  },
  {
    id: "message",
    name: { en: "Speech bubble", fr: "Bulle", de: "Sprechblase" },
    points: P(0, 0, 100, 0, 100, 75, 75, 75, 75, 100, 50, 75, 0, 75),
  },
  {
    id: "frame",
    name: { en: "Frame", fr: "Cadre", de: "Rahmen" },
    points: P(0, 0, 0, 100, 25, 100, 25, 25, 75, 25, 75, 75, 25, 75, 25, 100, 100, 100, 100, 0),
  },
];
