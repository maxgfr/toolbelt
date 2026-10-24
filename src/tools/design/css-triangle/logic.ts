/** CSS triangles two ways: the classic transparent-borders trick, and clip-path on a box. */
import {
  asRecord,
  clampNum,
  cssColor,
  type Decl,
  declsToCss,
  len,
  num,
  oneOf,
  tailwindArbitrary,
} from "../_shared";

export const DIRECTIONS = [
  "up",
  "down",
  "left",
  "right",
  "up-left",
  "up-right",
  "down-left",
  "down-right",
] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type Triangle = { dir: Direction; w: number; h: number; color: string };

export const DEFAULT: Triangle = { dir: "up", w: 80, h: 60, color: "#0f766e" };
export const MAX_SIZE = 1000;

export function cleanTriangle(raw: unknown): Triangle {
  const r = asRecord(raw);
  return {
    dir: oneOf(r.dir, DIRECTIONS, DEFAULT.dir),
    w: clampNum(r.w, 1, MAX_SIZE, DEFAULT.w),
    h: clampNum(r.h, 1, MAX_SIZE, DEFAULT.h),
    color: typeof r.color === "string" ? r.color : DEFAULT.color,
  };
}

type Side = "top" | "right" | "bottom" | "left";

/** Which borders draw the triangle: the colored one and the transparent ones, with sizes. */
function borders(t: Triangle): { side: Side; size: number; solid: boolean }[] {
  const half = (n: number) => n / 2;
  switch (t.dir) {
    case "up":
      return [
        { side: "left", size: half(t.w), solid: false },
        { side: "right", size: half(t.w), solid: false },
        { side: "bottom", size: t.h, solid: true },
      ];
    case "down":
      return [
        { side: "left", size: half(t.w), solid: false },
        { side: "right", size: half(t.w), solid: false },
        { side: "top", size: t.h, solid: true },
      ];
    case "left":
      return [
        { side: "top", size: half(t.h), solid: false },
        { side: "bottom", size: half(t.h), solid: false },
        { side: "right", size: t.w, solid: true },
      ];
    case "right":
      return [
        { side: "top", size: half(t.h), solid: false },
        { side: "bottom", size: half(t.h), solid: false },
        { side: "left", size: t.w, solid: true },
      ];
    case "up-left":
      return [
        { side: "top", size: t.h, solid: true },
        { side: "right", size: t.w, solid: false },
      ];
    case "up-right":
      return [
        { side: "top", size: t.h, solid: true },
        { side: "left", size: t.w, solid: false },
      ];
    case "down-left":
      return [
        { side: "bottom", size: t.h, solid: true },
        { side: "right", size: t.w, solid: false },
      ];
    case "down-right":
      return [
        { side: "bottom", size: t.h, solid: true },
        { side: "left", size: t.w, solid: false },
      ];
  }
}

export function borderDecls(t: Triangle): Decl[] {
  const color = cssColor(t.color);
  return [
    ["width", "0"],
    ["height", "0"],
    ...borders(t).map(
      (b): Decl => [
        `border-${b.side}`,
        `${len(b.size, "px", 2)} solid ${b.solid ? color : "transparent"}`,
      ],
    ),
  ];
}

const POLYGONS: Record<Direction, string> = {
  up: "50% 0, 100% 100%, 0 100%",
  down: "0 0, 100% 0, 50% 100%",
  left: "100% 0, 100% 100%, 0 50%",
  right: "0 0, 100% 50%, 0 100%",
  "up-left": "0 0, 100% 0, 0 100%",
  "up-right": "0 0, 100% 0, 100% 100%",
  "down-left": "0 0, 100% 100%, 0 100%",
  "down-right": "100% 0, 100% 100%, 0 100%",
};

export function clipDecls(t: Triangle): Decl[] {
  return [
    ["width", len(t.w, "px", 2)],
    ["height", len(t.h, "px", 2)],
    ["background", cssColor(t.color)],
    ["clip-path", `polygon(${POLYGONS[t.dir]})`],
  ];
}

export function borderCss(t: Triangle): string {
  return declsToCss(borderDecls(t), ".triangle");
}

export function clipCss(t: Triangle): string {
  return declsToCss(clipDecls(t), ".triangle");
}

const SIDE_TW: Record<Side, string> = { top: "t", right: "r", bottom: "b", left: "l" };

export function borderTailwind(t: Triangle): string {
  const color = cssColor(t.color);
  const out = ["w-0", "h-0"];
  for (const b of borders(t)) {
    const s = SIDE_TW[b.side];
    out.push(tailwindArbitrary(`border-${s}`, `${num(b.size, 2)}px`));
    out.push(b.solid ? tailwindArbitrary(`border-${s}`, color) : `border-${s}-transparent`);
  }
  return out.join(" ");
}

export function clipTailwind(t: Triangle): string {
  return [
    tailwindArbitrary("w", `${num(t.w, 2)}px`),
    tailwindArbitrary("h", `${num(t.h, 2)}px`),
    tailwindArbitrary("bg", cssColor(t.color)),
    tailwindArbitrary("[clip-path", `polygon(${POLYGONS[t.dir]})`),
  ].join(" ");
}

/** The height of an equilateral triangle on a base of `w` (for up/down; else the width). */
export function equilateral(base: number): number {
  return Math.round(((base * Math.sqrt(3)) / 2) * 100) / 100;
}
