/** Trip fuel (or electricity) cost, and conversions between consumption units. */

export const KM_PER_MILE = 1.609344;
export const L_PER_US_GAL = 3.785411784;
export const L_PER_UK_GAL = 4.54609;

export type FuelUnit = "l100" | "mpgUS" | "mpgUK" | "kmL";
export type EvUnit = "kwh100" | "whkm" | "miKwh" | "kwh100mi";

/** mpg = 100 km ÷ (L ÷ L per gallon) in miles: 235.215 ÷ L/100 km (US), 282.481 (UK). */
const MPG_US = (100 / KM_PER_MILE) * L_PER_US_GAL;
const MPG_UK = (100 / KM_PER_MILE) * L_PER_UK_GAL;

/** Any fuel consumption to L/100 km (these units are inverse to each other: mpg and km/L). */
export function toL100(value: number, unit: FuelUnit): number | null {
  if (!(value > 0)) return null;
  switch (unit) {
    case "l100":
      return value;
    case "mpgUS":
      return MPG_US / value;
    case "mpgUK":
      return MPG_UK / value;
    case "kmL":
      return 100 / value;
  }
}

export function fromL100(l100: number, unit: FuelUnit): number | null {
  // Each conversion is its own inverse: x ↦ k / x.
  return toL100(l100, unit);
}

/** Any electric consumption to kWh/100 km. */
export function toKwh100(value: number, unit: EvUnit): number | null {
  if (!(value > 0)) return null;
  switch (unit) {
    case "kwh100":
      return value;
    case "whkm":
      return value / 10;
    case "miKwh":
      return 100 / KM_PER_MILE / value;
    case "kwh100mi":
      return value / KM_PER_MILE;
  }
}

export function fromKwh100(kwh100: number, unit: EvUnit): number | null {
  if (!(kwh100 > 0)) return null;
  switch (unit) {
    case "kwh100":
      return kwh100;
    case "whkm":
      return kwh100 * 10;
    case "miKwh":
      return 100 / KM_PER_MILE / kwh100;
    case "kwh100mi":
      return kwh100 * KM_PER_MILE;
  }
}

export type PriceUnit = "L" | "galUS" | "galUK" | "kWh";

export function pricePerBase(price: number, unit: PriceUnit): number {
  return unit === "galUS" ? price / L_PER_US_GAL : unit === "galUK" ? price / L_PER_UK_GAL : price;
}

export interface Trip {
  /** km. */
  distance: number;
  /** L/100 km or kWh/100 km. */
  per100: number;
  /** Per L or per kWh. */
  price: number;
  people: number;
  roundTrip: boolean;
}

export interface TripResult {
  km: number;
  /** L or kWh. */
  energy: number;
  cost: number;
  perPerson: number;
  perKm: number;
}

export function trip(t: Trip): TripResult | null {
  const people = Math.round(t.people);
  if (!(t.distance >= 0) || !(t.per100 > 0) || !(t.price >= 0) || !(people >= 1)) return null;
  const km = t.distance * (t.roundTrip ? 2 : 1);
  const energy = (km * t.per100) / 100;
  const cost = energy * t.price;
  return { km, energy, cost, perPerson: cost / people, perKm: km > 0 ? cost / km : 0 };
}

/** Your real consumption from a full-to-full refill: L/100 km = litres ÷ km × 100. */
export function measured(liters: number, km: number): number | null {
  return liters > 0 && km > 0 ? (liters / km) * 100 : null;
}
