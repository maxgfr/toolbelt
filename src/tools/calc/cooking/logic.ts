/**
 * Kitchen conversions: volume ↔ weight through an ingredient's density, oven temperatures
 * (°C, °F, gas mark, French thermostat) and a recipe scaler that understands "1 ½" and "1/2".
 */

export type Dim = "volume" | "mass";

export interface KitchenUnit {
  id: string;
  dim: Dim;
  /** In ml (volume) or g (mass). */
  factor: number;
}

export const KITCHEN_UNITS: KitchenUnit[] = [
  { id: "ml", dim: "volume", factor: 1 },
  { id: "cl", dim: "volume", factor: 10 },
  { id: "dl", dim: "volume", factor: 100 },
  { id: "l", dim: "volume", factor: 1000 },
  { id: "tsp", dim: "volume", factor: 5 },
  { id: "tbsp", dim: "volume", factor: 15 },
  { id: "cup", dim: "volume", factor: 236.5882365 },
  { id: "cupMetric", dim: "volume", factor: 250 },
  { id: "floz", dim: "volume", factor: 29.5735295625 },
  { id: "g", dim: "mass", factor: 1 },
  { id: "kg", dim: "mass", factor: 1000 },
  { id: "oz", dim: "mass", factor: 28.349523125 },
  { id: "lb", dim: "mass", factor: 453.59237 },
];

export function kitchenUnit(id: string): KitchenUnit {
  return KITCHEN_UNITS.find((u) => u.id === id) ?? (KITCHEN_UNITS[0] as KitchenUnit);
}

/** Typical densities in g/ml (spooned and levelled for powders; packed for brown sugar). */
export const INGREDIENTS: { id: string; density: number; en: string; fr: string }[] = [
  { id: "water", density: 1, en: "Water", fr: "Eau" },
  { id: "milk", density: 1.03, en: "Milk", fr: "Lait" },
  { id: "cream", density: 1.0, en: "Cream", fr: "Crème" },
  { id: "oil", density: 0.92, en: "Oil", fr: "Huile" },
  { id: "butter", density: 0.959, en: "Butter", fr: "Beurre" },
  { id: "flour", density: 0.53, en: "Flour (all-purpose)", fr: "Farine (T45/T55)" },
  { id: "sugar", density: 0.85, en: "Sugar (granulated)", fr: "Sucre (en poudre)" },
  { id: "brownSugar", density: 0.93, en: "Brown sugar (packed)", fr: "Cassonade (tassée)" },
  { id: "icingSugar", density: 0.51, en: "Icing sugar", fr: "Sucre glace" },
  { id: "honey", density: 1.42, en: "Honey", fr: "Miel" },
  { id: "syrup", density: 1.33, en: "Maple syrup", fr: "Sirop d'érable" },
  { id: "rice", density: 0.8, en: "Rice (uncooked)", fr: "Riz (cru)" },
  { id: "oats", density: 0.38, en: "Rolled oats", fr: "Flocons d'avoine" },
  { id: "cocoa", density: 0.42, en: "Cocoa powder", fr: "Cacao en poudre" },
  { id: "cornstarch", density: 0.54, en: "Cornstarch", fr: "Fécule de maïs (Maïzena)" },
  { id: "almond", density: 0.4, en: "Ground almonds", fr: "Poudre d'amande" },
  { id: "salt", density: 1.2, en: "Salt (fine)", fr: "Sel (fin)" },
  { id: "yogurt", density: 1.03, en: "Yogurt", fr: "Yaourt" },
  { id: "chocolateChips", density: 0.72, en: "Chocolate chips", fr: "Pépites de chocolat" },
];

export function density(id: string): number {
  return INGREDIENTS.find((i) => i.id === id)?.density ?? 1;
}

/** Converts between any two kitchen units, through the density when crossing volume ↔ mass. */
export function convertKitchen(
  amount: number,
  from: string,
  to: string,
  ingredient: string,
): number {
  const a = kitchenUnit(from);
  const b = kitchenUnit(to);
  let base = amount * a.factor; // ml or g
  if (a.dim !== b.dim)
    base = a.dim === "volume" ? base * density(ingredient) : base / density(ingredient);
  return base / b.factor;
}

/* --- Oven ------------------------------------------------------------------------------------ */

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** The nearest gas mark (¼, ½, 1 … 10) for a temperature in °C; null outside an oven's range. */
export function gasMark(c: number): number | null {
  const f = cToF(c);
  if (f < 200 || f > 512.5) return null;
  if (f < 237.5) return 0.25;
  if (f < 262.5) return 0.5;
  return Math.min(10, Math.max(1, Math.round((f - 250) / 25)));
}

/** Gas mark → °F: 1 = 275 °F, then +25 °F per mark; ½ = 250 °F, ¼ = 225 °F. */
export function gasToF(mark: number): number {
  if (mark <= 0.25) return 225;
  if (mark <= 0.5) return 250;
  return 250 + 25 * mark;
}

/** French oven "thermostat": th 6 = 180 °C (°C ÷ 30). */
export function thermostat(c: number): number {
  return c / 30;
}

export const GAS_MARKS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/* --- Recipe scaler --------------------------------------------------------------------------- */

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};
const UF = Object.keys(UNICODE_FRACTIONS).join("");

/** One quantity: "1 1/2", "1 ½", "1½", "½", "3/4", "2", "1.5", "1,5". */
const Q = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[${UF}]|[${UF}]|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)`;
const LINE = new RegExp(`^(\\s*(?:[-*•]\\s*)?)(${Q})(?:(\\s*(?:-|–|to|à)\\s*)(${Q}))?(.*)$`, "u");

export function parseQuantity(s: string): number | null {
  const t = s.trim();
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = new RegExp(`^(\\d+)\\s*([${UF}])$`, "u").exec(t);
  if (m) return Number(m[1]) + (UNICODE_FRACTIONS[m[2] ?? ""] ?? 0);
  if (t in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[t] ?? null;
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  if (/^\d+(?:[.,]\d+)?$/.test(t)) return Number(t.replace(",", "."));
  return null;
}

const NICE: [number, string][] = [
  [0, ""],
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
  [1, ""],
];

/** 1.5 → "1 ½", 0.333 → "⅓", 2.97 → "3": the nearest kitchen fraction. */
export function toFraction(n: number): string {
  if (!(n > 0)) return "0";
  let whole = Math.floor(n);
  const rest = n - whole;
  let best = NICE[0] as [number, string];
  for (const c of NICE) if (Math.abs(c[0] - rest) < Math.abs(best[0] - rest)) best = c;
  if (best[0] === 1) whole += 1;
  if (!best[1]) return String(whole);
  return whole ? `${whole} ${best[1]}` : best[1];
}

/** A decimal with sensible precision: 375, 37.5, 3.75, 0.38. */
export function toDecimal(n: number, decimalComma: boolean): string {
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  const s = String(Number(n.toFixed(digits)));
  return decimalComma ? s.replace(".", ",") : s;
}

export interface ScaledLine {
  text: string;
  /** False for lines without a leading quantity (kept as they are). */
  scaled: boolean;
}

/**
 * Scales the leading quantity of every line by `factor`. Quantities written as fractions are
 * written back as fractions; decimals stay decimals.
 */
export function scaleRecipe(text: string, factor: number, decimalComma: boolean): ScaledLine[] {
  return text.split("\n").map((line) => {
    const m = LINE.exec(line);
    if (!m || !Number.isFinite(factor)) return { text: line, scaled: false };
    const [, lead = "", q1 = "", sep, q2, rest = ""] = m;
    const a = parseQuantity(q1);
    if (a === null) return { text: line, scaled: false };
    const frac = /[/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/u.test(q1 + (q2 ?? ""));
    const show = (x: number) => (frac ? toFraction(x) : toDecimal(x, decimalComma || /,/.test(q1)));
    let out = show(a * factor);
    if (sep !== undefined && q2 !== undefined) {
      const b = parseQuantity(q2);
      out += sep + (b === null ? q2 : show(b * factor));
    }
    return { text: `${lead}${out}${rest}`, scaled: true };
  });
}
