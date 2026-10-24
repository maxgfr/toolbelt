/** CSS gradients: linear, radial and conic, with stops, repeating and an interpolation space. */
import { converter, formatHex, interpolate } from "culori";
import {
  asArray,
  asRecord,
  clampNum,
  cssColor,
  num,
  oneOf,
  parseColor,
  srgb,
  tailwindArbitrary,
} from "../_shared";

export const TYPES = ["linear", "radial", "conic"] as const;
export type GradientType = (typeof TYPES)[number];
export const SHAPES = ["ellipse", "circle"] as const;
export type Shape = (typeof SHAPES)[number];
export const SPACES = ["", "srgb", "oklab", "oklch", "hsl"] as const;
/** "" = the browser default (sRGB, no `in …` written). */
export type Space = (typeof SPACES)[number];
export const HUES = ["shorter", "longer"] as const;
export type HueMethod = (typeof HUES)[number];

export type Stop = { color: string; pos: number };

export type Gradient = {
  type: GradientType;
  angle: number;
  shape: Shape;
  x: number;
  y: number;
  repeating: boolean;
  space: Space;
  hue: HueMethod;
  stops: Stop[];
};

export const DEFAULT: Gradient = {
  type: "linear",
  angle: 135,
  shape: "ellipse",
  x: 50,
  y: 50,
  repeating: false,
  space: "oklch",
  hue: "shorter",
  stops: [
    { color: "#0f766e", pos: 0 },
    { color: "#f59e0b", pos: 100 },
  ],
};

export function cleanStop(raw: unknown): Stop {
  const r = asRecord(raw);
  return {
    color: typeof r.color === "string" ? r.color : "#000000",
    pos: clampNum(r.pos, 0, 100, 0),
  };
}

/** A clean gradient from anything; at least two stops. */
export function cleanGradient(raw: unknown): Gradient {
  const r = asRecord(raw);
  const stops = asArray(r.stops).slice(0, 16).map(cleanStop);
  return {
    type: oneOf(r.type, TYPES, DEFAULT.type),
    angle: clampNum(r.angle, 0, 360, DEFAULT.angle),
    shape: oneOf(r.shape, SHAPES, DEFAULT.shape),
    x: clampNum(r.x, 0, 100, 50),
    y: clampNum(r.y, 0, 100, 50),
    repeating: r.repeating === true,
    space: oneOf(r.space, SPACES, DEFAULT.space),
    hue: oneOf(r.hue, HUES, "shorter"),
    stops: stops.length >= 2 ? stops : DEFAULT.stops,
  };
}

/** Stops sorted by position (stable), colors written as compact CSS. */
export function sortedStops(stops: Stop[]): Stop[] {
  return stops
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.pos - b.s.pos || a.i - b.i)
    .map(({ s }) => s);
}

function stopCss(s: Stop): string {
  return `${cssColor(parseColor(s.color) ? s.color : "#000")} ${num(s.pos, 2)}%`;
}

function interpolation(g: Gradient): string {
  if (!g.space) return "";
  const polar = g.space === "oklch" || g.space === "hsl";
  return `in ${g.space}${polar && g.hue === "longer" ? " longer hue" : ""}`;
}

function at(g: Gradient): string {
  return g.x === 50 && g.y === 50 ? "" : `at ${num(g.x, 2)}% ${num(g.y, 2)}%`;
}

/** The gradient function, e.g. `linear-gradient(135deg in oklch, #0f766e 0%, #f59e0b 100%)`. */
export function gradientValue(g: Gradient, withSpace = true): string {
  const head: string[] = [];
  if (g.type === "linear") head.push(`${num(g.angle, 2)}deg`);
  else if (g.type === "radial") {
    const shape = [g.shape === "circle" ? "circle" : "", at(g)].filter(Boolean).join(" ");
    if (shape) head.push(shape);
  } else {
    const parts = [g.angle ? `from ${num(g.angle, 2)}deg` : "", at(g)].filter(Boolean).join(" ");
    if (parts) head.push(parts);
  }
  const space = withSpace ? interpolation(g) : "";
  const first = [head.join(" "), space].filter(Boolean).join(" ");
  const stops = sortedStops(g.stops).map(stopCss);
  const name = `${g.repeating ? "repeating-" : ""}${g.type}-gradient`;
  return `${name}(${[first, ...stops].filter(Boolean).join(", ")})`;
}

/**
 * The declaration to paste. With an interpolation space, a plain sRGB line comes first as a
 * fallback for browsers that do not know `in <space>` (they skip the second line).
 */
export function gradientCss(g: Gradient): string {
  const main = `background-image: ${gradientValue(g)};`;
  if (!g.space || g.space === "srgb") return main;
  return `background-image: ${gradientValue(g, false)};\n${main}`;
}

export function gradientTailwind(g: Gradient): string {
  return tailwindArbitrary("bg", gradientValue(g));
}

/** The color at `pos` (0–100) between the stops, mixed in OKLab, for a new stop. */
export function colorAt(stops: Stop[], pos: number): string {
  const s = sortedStops(stops).filter((x) => parseColor(x.color));
  if (!s.length) return "#808080";
  const first = s[0] as Stop;
  const last = s[s.length - 1] as Stop;
  if (pos <= first.pos)
    return formatHex(srgb(parseColor(first.color) ?? { mode: "rgb", r: 0, g: 0, b: 0 }));
  if (pos >= last.pos)
    return formatHex(srgb(parseColor(last.color) ?? { mode: "rgb", r: 0, g: 0, b: 0 }));
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i] as Stop;
    const b = s[i + 1] as Stop;
    if (pos >= a.pos && pos <= b.pos) {
      const t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
      const mix = interpolate([a.color, b.color], "oklab")(t);
      return formatHex(srgb(toRgb(mix)));
    }
  }
  return "#808080";
}
const toRgb = converter("rgb");

/** Where to put a new stop: the middle of the widest gap between stops. */
export function newStopPosition(stops: Stop[]): number {
  const pos = [0, ...sortedStops(stops).map((s) => s.pos), 100].sort((a, b) => a - b);
  let best = 50;
  let gap = -1;
  for (let i = 0; i < pos.length - 1; i++) {
    const a = pos[i] as number;
    const b = pos[i + 1] as number;
    if (b - a > gap) {
      gap = b - a;
      best = (a + b) / 2;
    }
  }
  return Math.round(best);
}

export interface GradientPreset {
  id: string;
  name: { en: string; fr: string; de: string };
  g: Partial<Gradient>;
}

const st = (...pairs: [string, number][]): Stop[] => pairs.map(([color, pos]) => ({ color, pos }));

export const PRESETS: GradientPreset[] = [
  {
    id: "sunset",
    name: { en: "Sunset", fr: "Coucher de soleil", de: "Sonnenuntergang" },
    g: { type: "linear", angle: 160, stops: st(["#f97316", 0], ["#db2777", 55], ["#4c1d95", 100]) },
  },
  {
    id: "ocean",
    name: { en: "Ocean", fr: "Océan", de: "Ozean" },
    g: { type: "linear", angle: 180, stops: st(["#22d3ee", 0], ["#0e7490", 60], ["#082f49", 100]) },
  },
  {
    id: "mint",
    name: { en: "Mint", fr: "Menthe", de: "Minze" },
    g: { type: "linear", angle: 120, stops: st(["#d9f99d", 0], ["#34d399", 100]) },
  },
  {
    id: "aurora",
    name: { en: "Aurora", fr: "Aurore", de: "Polarlicht" },
    g: {
      type: "radial",
      shape: "ellipse",
      x: 20,
      y: 10,
      stops: st(["#a7f3d0", 0], ["#38bdf8", 35], ["#6d28d9", 70], ["#0f172a", 100]),
    },
  },
  {
    id: "spotlight",
    name: { en: "Spotlight", fr: "Projecteur", de: "Scheinwerfer" },
    g: {
      type: "radial",
      shape: "circle",
      stops: st(["#fde68a", 0], ["#f59e0b", 30], ["#1c1917", 70]),
    },
  },
  {
    id: "rainbow",
    name: { en: "Color wheel", fr: "Roue chromatique", de: "Farbkreis" },
    g: {
      type: "conic",
      angle: 0,
      space: "oklch",
      hue: "longer",
      stops: st(["#ff0000", 0], ["#ff0000", 100]),
    },
  },
  {
    id: "stripes",
    name: { en: "Stripes", fr: "Rayures", de: "Streifen" },
    g: {
      type: "linear",
      angle: 45,
      repeating: true,
      space: "",
      stops: st(["#fbbf24", 0], ["#fbbf24", 5], ["#1f2937", 5], ["#1f2937", 10]),
    },
  },
  {
    id: "pie",
    name: { en: "Pie", fr: "Camembert", de: "Torte" },
    g: {
      type: "conic",
      angle: 0,
      space: "",
      stops: st(
        ["#0f766e", 0],
        ["#0f766e", 40],
        ["#f59e0b", 40],
        ["#f59e0b", 75],
        ["#e11d48", 75],
        ["#e11d48", 100],
      ),
    },
  },
];

/** A preset applied over the defaults. */
export function fromPreset(p: GradientPreset): Gradient {
  return cleanGradient({ ...DEFAULT, x: 50, y: 50, repeating: false, hue: "shorter", ...p.g });
}
