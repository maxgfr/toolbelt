/** Discounts (stacked one after the other), the reverse question, and price per unit comparison. */

/** −30 % then −10 % keeps 0.7 × 0.9 = 63 % of the price. */
export function keptFactor(discounts: number[]): number {
  return discounts.reduce((f, d) => f * (1 - d / 100), 1);
}

export interface DiscountResult {
  final: number;
  saved: number;
  /** The single discount equivalent to the stack, %. */
  equivalent: number;
  /** Price after each step. */
  steps: number[];
}

export function applyDiscounts(price: number, discounts: number[]): DiscountResult {
  const steps: number[] = [];
  let p = price;
  for (const d of discounts) {
    p *= 1 - d / 100;
    steps.push(p);
  }
  return { final: p, saved: price - p, equivalent: (1 - keptFactor(discounts)) * 100, steps };
}

/** The price before the discounts, from the sale price; null when the discounts reach 100 %. */
export function originalPrice(sale: number, discounts: number[]): number | null {
  const f = keptFactor(discounts);
  return f > 0 ? sale / f : null;
}

/** "Was 80, now 60": 25 % off. */
export function discountPercent(original: number, sale: number): number | null {
  return original > 0 ? ((original - sale) / original) * 100 : null;
}

/* --- Price per unit ---------------------------------------------------------------------- */

export type Dimension = "mass" | "volume" | "count";

export interface Unit {
  id: string;
  dim: Dimension;
  /** In the base unit of its dimension: kg, L or item. */
  factor: number;
}

export const UNITS: Unit[] = [
  { id: "g", dim: "mass", factor: 0.001 },
  { id: "kg", dim: "mass", factor: 1 },
  { id: "oz", dim: "mass", factor: 0.028349523125 },
  { id: "lb", dim: "mass", factor: 0.45359237 },
  { id: "ml", dim: "volume", factor: 0.001 },
  { id: "cl", dim: "volume", factor: 0.01 },
  { id: "L", dim: "volume", factor: 1 },
  { id: "fl oz", dim: "volume", factor: 0.0295735295625 },
  { id: "gal", dim: "volume", factor: 3.785411784 },
  { id: "item", dim: "count", factor: 1 },
];

export function findUnit(id: string): Unit {
  return UNITS.find((u) => u.id === id) ?? (UNITS[0] as Unit);
}

export interface Product {
  price: number;
  /** Packs × quantity per pack, e.g. 6 × 33 cl. */
  packs: number;
  quantity: number;
  unit: string;
}

export interface UnitPrice {
  /** Price per kg, per L or per item; null when the product can't be compared. */
  perBase: number | null;
  dim: Dimension;
  best: boolean;
  /** How much more than the best one, %. */
  overBest: number | null;
}

/**
 * Price per kg / L / item of each product. The best deal is the cheapest within the dimension
 * most products use (you can't compare grams with litres without a density).
 */
export function comparePrices(products: Product[]): {
  results: UnitPrice[];
  dim: Dimension | null;
} {
  const base = products.map((p) => {
    const u = findUnit(p.unit);
    const qty = p.packs * p.quantity * u.factor;
    return { dim: u.dim, perBase: p.price >= 0 && qty > 0 ? p.price / qty : null };
  });
  const counts = new Map<Dimension, number>();
  for (const b of base) if (b.perBase !== null) counts.set(b.dim, (counts.get(b.dim) ?? 0) + 1);
  let dim: Dimension | null = null;
  for (const [d, n] of counts) if (dim === null || n > (counts.get(dim) ?? 0)) dim = d;
  const valid = base
    .filter((b) => b.dim === dim && b.perBase !== null)
    .map((b) => b.perBase as number);
  const min = valid.length ? Math.min(...valid) : null;
  const results = base.map((b) => {
    const comparable = b.dim === dim && b.perBase !== null && min !== null;
    return {
      perBase: b.perBase,
      dim: b.dim,
      best: comparable && valid.length > 1 && b.perBase === min,
      overBest: comparable && min ? (((b.perBase as number) - min) / min) * 100 : null,
    };
  });
  return { results, dim };
}
