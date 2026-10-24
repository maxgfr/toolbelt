/**
 * Unit conversion by category. Each unit is a factor to the category's base
 * unit (metre, kilogram, litre…), except temperatures, which need an offset.
 */
import type { L10n } from "../../../i18n";

export interface Unit {
  id: string;
  symbol: string;
  name: L10n;
  /** Base units in one of this unit. */
  factor: number;
  /** For temperatures: value in kelvin = (value + offset) × factor. */
  offset?: number;
  imperial?: boolean;
}

export interface Category {
  id: string;
  name: L10n;
  units: Unit[];
}

const n = (en: string, fr: string): L10n => ({ en, fr });
const u = (
  id: string,
  symbol: string,
  name: L10n,
  factor: number,
  extra: Partial<Unit> = {},
): Unit => ({ id, symbol, name, factor, ...extra });
const imp = { imperial: true };

const INCH = 0.0254;
const FOOT = 0.3048;
const YARD = 0.9144;
const MILE = 1609.344;
const POUND = 0.45359237;
const US_GAL = 3.785411784;
const UK_GAL = 4.54609;
const CAL = 4.184;

export const CATEGORIES: Category[] = [
  {
    id: "length",
    name: n("Length", "Longueur"),
    units: [
      u("nm", "nm", n("nanometre", "nanomètre"), 1e-9),
      u("um", "µm", n("micrometre", "micromètre"), 1e-6),
      u("mm", "mm", n("millimetre", "millimètre"), 1e-3),
      u("cm", "cm", n("centimetre", "centimètre"), 1e-2),
      u("m", "m", n("metre", "mètre"), 1),
      u("km", "km", n("kilometre", "kilomètre"), 1e3),
      u("in", "in", n("inch", "pouce"), INCH, imp),
      u("ft", "ft", n("foot", "pied"), FOOT, imp),
      u("yd", "yd", n("yard", "yard"), YARD, imp),
      u("mi", "mi", n("mile", "mile"), MILE, imp),
      u("nmi", "NM", n("nautical mile", "mille marin"), 1852),
      u("ly", "ly", n("light-year", "année-lumière"), 9.4607304725808e15),
    ],
  },
  {
    id: "mass",
    name: n("Mass", "Masse"),
    units: [
      u("mg", "mg", n("milligram", "milligramme"), 1e-6),
      u("g", "g", n("gram", "gramme"), 1e-3),
      u("kg", "kg", n("kilogram", "kilogramme"), 1),
      u("t", "t", n("tonne", "tonne"), 1000),
      u("ct", "ct", n("carat", "carat"), 2e-4),
      u("oz", "oz", n("ounce", "once"), POUND / 16, imp),
      u("lb", "lb", n("pound", "livre (lb)"), POUND, imp),
      u("st", "st", n("stone", "stone"), POUND * 14, imp),
      u("ust", "sh tn", n("short ton (US)", "tonne courte (US)"), POUND * 2000, imp),
      u("ukt", "long tn", n("long ton (UK)", "tonne longue (UK)"), POUND * 2240, imp),
    ],
  },
  {
    id: "temperature",
    name: n("Temperature", "Température"),
    units: [
      u("c", "°C", n("Celsius", "Celsius"), 1, { offset: 273.15 }),
      u("f", "°F", n("Fahrenheit", "Fahrenheit"), 5 / 9, { offset: 459.67, imperial: true }),
      u("k", "K", n("kelvin", "kelvin"), 1, { offset: 0 }),
      u("r", "°R", n("Rankine", "Rankine"), 5 / 9, { offset: 0 }),
    ],
  },
  {
    id: "volume",
    name: n("Volume", "Volume"),
    units: [
      u("ml", "mL", n("millilitre", "millilitre"), 1e-3),
      u("cl", "cL", n("centilitre", "centilitre"), 1e-2),
      u("dl", "dL", n("decilitre", "décilitre"), 0.1),
      u("l", "L", n("litre", "litre"), 1),
      u("m3", "m³", n("cubic metre", "mètre cube"), 1000),
      u("cm3", "cm³", n("cubic centimetre", "centimètre cube"), 1e-3),
      u("tsp", "tsp", n("teaspoon (US)", "cuillère à café (US)"), US_GAL / 768, imp),
      u("tbsp", "tbsp", n("tablespoon (US)", "cuillère à soupe (US)"), US_GAL / 256, imp),
      u("floz", "fl oz", n("fluid ounce (US)", "once liquide (US)"), US_GAL / 128, imp),
      u("cup", "cup", n("cup (US)", "tasse (US)"), US_GAL / 16, imp),
      u("pt", "pt", n("pint (US)", "pinte (US)"), US_GAL / 8, imp),
      u("qt", "qt", n("quart (US)", "quart (US)"), US_GAL / 4, imp),
      u("gal", "gal", n("gallon (US)", "gallon (US)"), US_GAL, imp),
      u("ukpt", "pt (UK)", n("pint (UK)", "pinte (UK)"), UK_GAL / 8, imp),
      u("ukgal", "gal (UK)", n("gallon (UK)", "gallon (UK)"), UK_GAL, imp),
      u("in3", "in³", n("cubic inch", "pouce cube"), INCH ** 3 * 1000, imp),
      u("ft3", "ft³", n("cubic foot", "pied cube"), FOOT ** 3 * 1000, imp),
    ],
  },
  {
    id: "area",
    name: n("Area", "Surface"),
    units: [
      u("mm2", "mm²", n("square millimetre", "millimètre carré"), 1e-6),
      u("cm2", "cm²", n("square centimetre", "centimètre carré"), 1e-4),
      u("m2", "m²", n("square metre", "mètre carré"), 1),
      u("a", "a", n("are", "are"), 100),
      u("ha", "ha", n("hectare", "hectare"), 1e4),
      u("km2", "km²", n("square kilometre", "kilomètre carré"), 1e6),
      u("in2", "in²", n("square inch", "pouce carré"), INCH ** 2, imp),
      u("ft2", "ft²", n("square foot", "pied carré"), FOOT ** 2, imp),
      u("yd2", "yd²", n("square yard", "yard carré"), YARD ** 2, imp),
      u("ac", "ac", n("acre", "acre"), 4046.8564224, imp),
      u("mi2", "mi²", n("square mile", "mile carré"), MILE ** 2, imp),
    ],
  },
  {
    id: "speed",
    name: n("Speed", "Vitesse"),
    units: [
      u("mps", "m/s", n("metre per second", "mètre par seconde"), 1),
      u("kmh", "km/h", n("kilometre per hour", "kilomètre par heure"), 1 / 3.6),
      u("mph", "mph", n("mile per hour", "mile par heure"), MILE / 3600, imp),
      u("fps", "ft/s", n("foot per second", "pied par seconde"), FOOT, imp),
      u("kn", "kn", n("knot", "nœud"), 1852 / 3600),
      u("mach", "Mach", n("Mach (sea level, 15 °C)", "Mach (niveau de la mer, 15 °C)"), 340.29),
      u("c", "c", n("speed of light", "vitesse de la lumière"), 299792458),
    ],
  },
  {
    id: "time",
    name: n("Time", "Temps"),
    units: [
      u("ns", "ns", n("nanosecond", "nanoseconde"), 1e-9),
      u("us", "µs", n("microsecond", "microseconde"), 1e-6),
      u("ms", "ms", n("millisecond", "milliseconde"), 1e-3),
      u("s", "s", n("second", "seconde"), 1),
      u("min", "min", n("minute", "minute"), 60),
      u("h", "h", n("hour", "heure"), 3600),
      u("d", "d", n("day", "jour"), 86400),
      u("wk", "wk", n("week", "semaine"), 604800),
      u("mo", "mo", n("month (average)", "mois (moyen)"), 2629746),
      u("yr", "yr", n("year (365.2425 d)", "année (365,2425 j)"), 31556952),
      u("dec", "dec", n("decade", "décennie"), 315569520),
      u("cen", "cen", n("century", "siècle"), 3155695200),
    ],
  },
  {
    id: "energy",
    name: n("Energy", "Énergie"),
    units: [
      u("j", "J", n("joule", "joule"), 1),
      u("kj", "kJ", n("kilojoule", "kilojoule"), 1e3),
      u("mj", "MJ", n("megajoule", "mégajoule"), 1e6),
      u("cal", "cal", n("calorie", "calorie"), CAL),
      u("kcal", "kcal", n("kilocalorie", "kilocalorie"), CAL * 1000),
      u("wh", "Wh", n("watt-hour", "wattheure"), 3600),
      u("kwh", "kWh", n("kilowatt-hour", "kilowattheure"), 3.6e6),
      u("ev", "eV", n("electronvolt", "électronvolt"), 1.602176634e-19),
      u("btu", "BTU", n("British thermal unit", "BTU"), 1055.05585262, imp),
      u("ftlb", "ft·lbf", n("foot-pound", "pied-livre"), 1.3558179483314, imp),
      u("therm", "thm", n("therm (US)", "therm (US)"), 105480400, imp),
    ],
  },
  {
    id: "pressure",
    name: n("Pressure", "Pression"),
    units: [
      u("pa", "Pa", n("pascal", "pascal"), 1),
      u("hpa", "hPa", n("hectopascal", "hectopascal"), 100),
      u("kpa", "kPa", n("kilopascal", "kilopascal"), 1e3),
      u("mpa", "MPa", n("megapascal", "mégapascal"), 1e6),
      u("mbar", "mbar", n("millibar", "millibar"), 100),
      u("bar", "bar", n("bar", "bar"), 1e5),
      u("atm", "atm", n("atmosphere", "atmosphère"), 101325),
      u("mmhg", "mmHg", n("millimetre of mercury", "millimètre de mercure"), 133.322387415),
      u("torr", "Torr", n("torr", "torr"), 101325 / 760),
      u("psi", "psi", n("pound per square inch", "livre par pouce carré"), 6894.757293168, imp),
      u("inhg", "inHg", n("inch of mercury", "pouce de mercure"), 3386.389, imp),
    ],
  },
  {
    id: "datarate",
    name: n("Data rate", "Débit de données"),
    units: [
      u("bps", "bit/s", n("bit per second", "bit par seconde"), 1),
      u("kbps", "kbit/s", n("kilobit per second", "kilobit par seconde"), 1e3),
      u("mbps", "Mbit/s", n("megabit per second", "mégabit par seconde"), 1e6),
      u("gbps", "Gbit/s", n("gigabit per second", "gigabit par seconde"), 1e9),
      u("Bps", "B/s", n("byte per second", "octet par seconde"), 8),
      u("kBps", "kB/s", n("kilobyte per second", "kilo-octet par seconde"), 8e3),
      u("MBps", "MB/s", n("megabyte per second", "mégaoctet par seconde"), 8e6),
      u("GBps", "GB/s", n("gigabyte per second", "gigaoctet par seconde"), 8e9),
      u("KiBps", "KiB/s", n("kibibyte per second", "kibioctet par seconde"), 8 * 1024),
      u("MiBps", "MiB/s", n("mebibyte per second", "mébioctet par seconde"), 8 * 1024 ** 2),
    ],
  },
];

export function findCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? (CATEGORIES[0] as Category);
}

export function findUnit(cat: Category, id: string): Unit | undefined {
  return cat.units.find((x) => x.id === id);
}

function toBase(v: number, unit: Unit): number {
  return unit.offset === undefined ? v * unit.factor : (v + unit.offset) * unit.factor;
}

function fromBase(v: number, unit: Unit): number {
  return unit.offset === undefined ? v / unit.factor : v / unit.factor - unit.offset;
}

/** `value` from one unit to another of the same category; null if a unit is unknown. */
export function convert(
  value: number,
  categoryId: string,
  from: string,
  to: string,
): number | null {
  const cat = findCategory(categoryId);
  const a = findUnit(cat, from);
  const b = findUnit(cat, to);
  if (!a || !b) return null;
  return fromBase(toBase(value, a), b);
}

/** `value` of `from` in every unit of its category. */
export function convertAll(
  value: number,
  categoryId: string,
  from: string,
): { unit: Unit; value: number }[] {
  const cat = findCategory(categoryId);
  const a = findUnit(cat, from);
  if (!a) return [];
  const base = toBase(value, a);
  return cat.units.map((unit) => ({ unit, value: fromBase(base, unit) }));
}

/** Below absolute zero, a temperature is impossible. */
export function belowAbsoluteZero(value: number, categoryId: string, from: string): boolean {
  if (categoryId !== "temperature") return false;
  const k = convert(value, "temperature", from, "k");
  return k !== null && k < -1e-9;
}
