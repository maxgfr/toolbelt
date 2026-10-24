/** Frosted-glass cards: a translucent fill over a blurred, saturated backdrop. */
import {
  asRecord,
  clampNum,
  cssColor,
  type Decl,
  declsToCss,
  len,
  num,
  oneOf,
  parseColor,
  readableOn,
  tailwindArbitrary,
} from "../_shared";

export type Glass = {
  blur: number;
  /** Opacity of the fill, 0–1. */
  alpha: number;
  /** backdrop saturate(), percent. */
  saturation: number;
  tint: string;
  /** Opacity of the 1px border, 0 for none. */
  border: number;
  radius: number;
  /** Opacity of the drop shadow, 0 for none. */
  shadow: number;
  bg: string;
};

export const BACKGROUNDS = [
  {
    id: "aurora",
    name: { en: "Aurora", fr: "Aurore" },
    ink: "#ffffff",
    css: "radial-gradient(circle at 20% 25%, #22d3ee 0, transparent 40%), radial-gradient(circle at 80% 30%, #a855f7 0, transparent 45%), radial-gradient(circle at 50% 85%, #f43f5e 0, transparent 45%), linear-gradient(135deg, #1e3a8a, #0f172a)",
  },
  {
    id: "sunset",
    name: { en: "Sunset", fr: "Coucher de soleil" },
    ink: "#ffffff",
    css: "radial-gradient(circle at 75% 20%, #fde047 0, transparent 35%), radial-gradient(circle at 15% 80%, #ec4899 0, transparent 45%), linear-gradient(160deg, #f97316, #9d174d)",
  },
  {
    id: "mint",
    name: { en: "Mint", fr: "Menthe" },
    ink: "#ffffff",
    css: "radial-gradient(circle at 25% 30%, #a3e635 0, transparent 40%), radial-gradient(circle at 80% 70%, #06b6d4 0, transparent 45%), linear-gradient(135deg, #0f766e, #134e4a)",
  },
  {
    id: "candy",
    name: { en: "Candy", fr: "Bonbon" },
    ink: "#1e1b4b",
    css: "radial-gradient(circle at 30% 20%, #f9a8d4 0, transparent 45%), radial-gradient(circle at 70% 80%, #93c5fd 0, transparent 45%), linear-gradient(135deg, #fbcfe8, #c7d2fe)",
  },
] as const;

export type BgId = (typeof BACKGROUNDS)[number]["id"];
const BG_IDS = BACKGROUNDS.map((b) => b.id);

export const DEFAULT: Glass = {
  blur: 16,
  alpha: 0.18,
  saturation: 180,
  tint: "#ffffff",
  border: 0.3,
  radius: 20,
  shadow: 0.2,
  bg: "aurora",
};

export function cleanGlass(raw: unknown): Glass {
  const r = asRecord(raw);
  return {
    blur: clampNum(r.blur, 0, 64, DEFAULT.blur),
    alpha: clampNum(r.alpha, 0, 1, DEFAULT.alpha),
    saturation: clampNum(r.saturation, 0, 400, DEFAULT.saturation),
    tint: typeof r.tint === "string" ? r.tint : DEFAULT.tint,
    border: clampNum(r.border, 0, 1, DEFAULT.border),
    radius: clampNum(r.radius, 0, 100, DEFAULT.radius),
    shadow: clampNum(r.shadow, 0, 1, DEFAULT.shadow),
    bg: oneOf(r.bg, BG_IDS, "aurora"),
  };
}

export function backdropValue(g: Glass): string {
  const parts = [`blur(${len(g.blur)})`];
  if (g.saturation !== 100) parts.push(`saturate(${num(g.saturation, 1)}%)`);
  return parts.join(" ");
}

function shadowValue(g: Glass): string {
  return `0 8px 32px ${cssColor("#000", g.shadow)}`;
}

/** The declarations, in the order they are written. */
export function glassDecls(g: Glass): Decl[] {
  const d: Decl[] = [["background", cssColor(g.tint, g.alpha)]];
  const bf = backdropValue(g);
  d.push(["-webkit-backdrop-filter", bf], ["backdrop-filter", bf]);
  if (g.border > 0) d.push(["border", `1px solid ${cssColor(g.tint, g.border)}`]);
  if (g.radius > 0) d.push(["border-radius", len(g.radius)]);
  if (g.shadow > 0) d.push(["box-shadow", shadowValue(g)]);
  return d;
}

export function glassCss(g: Glass): string {
  return declsToCss(glassDecls(g), ".glass");
}

export function glassTailwind(g: Glass): string {
  const c = [
    tailwindArbitrary("bg", cssColor(g.tint, g.alpha)),
    tailwindArbitrary("backdrop-blur", len(g.blur)),
  ];
  if (g.saturation !== 100)
    c.push(tailwindArbitrary("backdrop-saturate", `${num(g.saturation, 1)}%`));
  if (g.border > 0) c.push("border", tailwindArbitrary("border", cssColor(g.tint, g.border)));
  if (g.radius > 0) c.push(tailwindArbitrary("rounded", len(g.radius)));
  if (g.shadow > 0) c.push(tailwindArbitrary("shadow", shadowValue(g)));
  return c.join(" ");
}

export function background(id: string): (typeof BACKGROUNDS)[number] {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}

/** Text color on the card: follows the tint when the fill is mostly opaque, else the backdrop. */
export function cardInk(g: Glass): string {
  return g.alpha > 0.5 ? readableOn(parseColor(g.tint)) : background(g.bg).ink;
}

export interface GlassPreset {
  id: string;
  name: { en: string; fr: string };
  g: Partial<Glass>;
}

export const PRESETS: GlassPreset[] = [
  {
    id: "frosted",
    name: { en: "Frosted", fr: "Givré" },
    g: { blur: 16, alpha: 0.18, saturation: 180, tint: "#ffffff", border: 0.3, shadow: 0.2 },
  },
  {
    id: "clear",
    name: { en: "Clear", fr: "Transparent" },
    g: { blur: 6, alpha: 0.08, saturation: 120, tint: "#ffffff", border: 0.25, shadow: 0.1 },
  },
  {
    id: "milky",
    name: { en: "Milky", fr: "Laiteux" },
    g: { blur: 28, alpha: 0.45, saturation: 140, tint: "#ffffff", border: 0.5, shadow: 0.15 },
  },
  {
    id: "dark",
    name: { en: "Dark glass", fr: "Verre fumé" },
    g: { blur: 20, alpha: 0.35, saturation: 160, tint: "#0f172a", border: 0.4, shadow: 0.35 },
  },
  {
    id: "tinted",
    name: { en: "Tinted", fr: "Teinté" },
    g: { blur: 14, alpha: 0.22, saturation: 200, tint: "#f0abfc", border: 0.35, shadow: 0.2 },
  },
];
