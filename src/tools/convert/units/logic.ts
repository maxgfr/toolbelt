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

const n = (en: string, fr: string, de: string): L10n => ({ en, fr, de });
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
    name: n("Length", "Longueur", "Länge"),
    units: [
      u("nm", "nm", n("nanometre", "nanomètre", "Nanometer"), 1e-9),
      u("um", "µm", n("micrometre", "micromètre", "Mikrometer"), 1e-6),
      u("mm", "mm", n("millimetre", "millimètre", "Millimeter"), 1e-3),
      u("cm", "cm", n("centimetre", "centimètre", "Zentimeter"), 1e-2),
      u("m", "m", n("metre", "mètre", "Meter"), 1),
      u("km", "km", n("kilometre", "kilomètre", "Kilometer"), 1e3),
      u("in", "in", n("inch", "pouce", "Zoll"), INCH, imp),
      u("ft", "ft", n("foot", "pied", "Fuß"), FOOT, imp),
      u("yd", "yd", n("yard", "yard", "Yard"), YARD, imp),
      u("mi", "mi", n("mile", "mile", "Meile"), MILE, imp),
      u("nmi", "NM", n("nautical mile", "mille marin", "Seemeile"), 1852),
      u("ly", "ly", n("light-year", "année-lumière", "Lichtjahr"), 9.4607304725808e15),
    ],
  },
  {
    id: "mass",
    name: n("Mass", "Masse", "Masse"),
    units: [
      u("mg", "mg", n("milligram", "milligramme", "Milligramm"), 1e-6),
      u("g", "g", n("gram", "gramme", "Gramm"), 1e-3),
      u("kg", "kg", n("kilogram", "kilogramme", "Kilogramm"), 1),
      u("t", "t", n("tonne", "tonne", "Tonne"), 1000),
      u("ct", "ct", n("carat", "carat", "Karat"), 2e-4),
      u("oz", "oz", n("ounce", "once", "Unze"), POUND / 16, imp),
      u("lb", "lb", n("pound", "livre (lb)", "Pfund (lb)"), POUND, imp),
      u("st", "st", n("stone", "stone", "Stone"), POUND * 14, imp),
      u(
        "ust",
        "sh tn",
        n("short ton (US)", "tonne courte (US)", "Short Ton (US)"),
        POUND * 2000,
        imp,
      ),
      u(
        "ukt",
        "long tn",
        n("long ton (UK)", "tonne longue (UK)", "Long Ton (UK)"),
        POUND * 2240,
        imp,
      ),
    ],
  },
  {
    id: "temperature",
    name: n("Temperature", "Température", "Temperatur"),
    units: [
      u("c", "°C", n("Celsius", "Celsius", "Celsius"), 1, { offset: 273.15 }),
      u("f", "°F", n("Fahrenheit", "Fahrenheit", "Fahrenheit"), 5 / 9, {
        offset: 459.67,
        imperial: true,
      }),
      u("k", "K", n("kelvin", "kelvin", "Kelvin"), 1, { offset: 0 }),
      u("r", "°R", n("Rankine", "Rankine", "Rankine"), 5 / 9, { offset: 0 }),
    ],
  },
  {
    id: "volume",
    name: n("Volume", "Volume", "Volumen"),
    units: [
      u("ml", "mL", n("millilitre", "millilitre", "Milliliter"), 1e-3),
      u("cl", "cL", n("centilitre", "centilitre", "Zentiliter"), 1e-2),
      u("dl", "dL", n("decilitre", "décilitre", "Deziliter"), 0.1),
      u("l", "L", n("litre", "litre", "Liter"), 1),
      u("m3", "m³", n("cubic metre", "mètre cube", "Kubikmeter"), 1000),
      u("cm3", "cm³", n("cubic centimetre", "centimètre cube", "Kubikzentimeter"), 1e-3),
      u(
        "tsp",
        "tsp",
        n("teaspoon (US)", "cuillère à café (US)", "Teelöffel (US)"),
        US_GAL / 768,
        imp,
      ),
      u(
        "tbsp",
        "tbsp",
        n("tablespoon (US)", "cuillère à soupe (US)", "Esslöffel (US)"),
        US_GAL / 256,
        imp,
      ),
      u(
        "floz",
        "fl oz",
        n("fluid ounce (US)", "once liquide (US)", "Flüssigunze (US)"),
        US_GAL / 128,
        imp,
      ),
      u("cup", "cup", n("cup (US)", "tasse (US)", "Cup (US)"), US_GAL / 16, imp),
      u("pt", "pt", n("pint (US)", "pinte (US)", "Pint (US)"), US_GAL / 8, imp),
      u("qt", "qt", n("quart (US)", "quart (US)", "Quart (US)"), US_GAL / 4, imp),
      u("gal", "gal", n("gallon (US)", "gallon (US)", "Gallone (US)"), US_GAL, imp),
      u("ukpt", "pt (UK)", n("pint (UK)", "pinte (UK)", "Pint (UK)"), UK_GAL / 8, imp),
      u("ukgal", "gal (UK)", n("gallon (UK)", "gallon (UK)", "Gallone (UK)"), UK_GAL, imp),
      u("in3", "in³", n("cubic inch", "pouce cube", "Kubikzoll"), INCH ** 3 * 1000, imp),
      u("ft3", "ft³", n("cubic foot", "pied cube", "Kubikfuß"), FOOT ** 3 * 1000, imp),
    ],
  },
  {
    id: "area",
    name: n("Area", "Surface", "Fläche"),
    units: [
      u("mm2", "mm²", n("square millimetre", "millimètre carré", "Quadratmillimeter"), 1e-6),
      u("cm2", "cm²", n("square centimetre", "centimètre carré", "Quadratzentimeter"), 1e-4),
      u("m2", "m²", n("square metre", "mètre carré", "Quadratmeter"), 1),
      u("a", "a", n("are", "are", "Ar"), 100),
      u("ha", "ha", n("hectare", "hectare", "Hektar"), 1e4),
      u("km2", "km²", n("square kilometre", "kilomètre carré", "Quadratkilometer"), 1e6),
      u("in2", "in²", n("square inch", "pouce carré", "Quadratzoll"), INCH ** 2, imp),
      u("ft2", "ft²", n("square foot", "pied carré", "Quadratfuß"), FOOT ** 2, imp),
      u("yd2", "yd²", n("square yard", "yard carré", "Quadratyard"), YARD ** 2, imp),
      u("ac", "ac", n("acre", "acre", "Acre"), 4046.8564224, imp),
      u("mi2", "mi²", n("square mile", "mile carré", "Quadratmeile"), MILE ** 2, imp),
    ],
  },
  {
    id: "speed",
    name: n("Speed", "Vitesse", "Geschwindigkeit"),
    units: [
      u("mps", "m/s", n("metre per second", "mètre par seconde", "Meter pro Sekunde"), 1),
      u(
        "kmh",
        "km/h",
        n("kilometre per hour", "kilomètre par heure", "Kilometer pro Stunde"),
        1 / 3.6,
      ),
      u("mph", "mph", n("mile per hour", "mile par heure", "Meile pro Stunde"), MILE / 3600, imp),
      u("fps", "ft/s", n("foot per second", "pied par seconde", "Fuß pro Sekunde"), FOOT, imp),
      u("kn", "kn", n("knot", "nœud", "Knoten"), 1852 / 3600),
      u(
        "mach",
        "Mach",
        n("Mach (sea level, 15 °C)", "Mach (niveau de la mer, 15 °C)", "Mach (Meereshöhe, 15 °C)"),
        340.29,
      ),
      u("c", "c", n("speed of light", "vitesse de la lumière", "Lichtgeschwindigkeit"), 299792458),
    ],
  },
  {
    id: "time",
    name: n("Time", "Temps", "Zeit"),
    units: [
      u("ns", "ns", n("nanosecond", "nanoseconde", "Nanosekunde"), 1e-9),
      u("us", "µs", n("microsecond", "microseconde", "Mikrosekunde"), 1e-6),
      u("ms", "ms", n("millisecond", "milliseconde", "Millisekunde"), 1e-3),
      u("s", "s", n("second", "seconde", "Sekunde"), 1),
      u("min", "min", n("minute", "minute", "Minute"), 60),
      u("h", "h", n("hour", "heure", "Stunde"), 3600),
      u("d", "d", n("day", "jour", "Tag"), 86400),
      u("wk", "wk", n("week", "semaine", "Woche"), 604800),
      u("mo", "mo", n("month (average)", "mois (moyen)", "Monat (Durchschnitt)"), 2629746),
      u("yr", "yr", n("year (365.2425 d)", "année (365,2425 j)", "Jahr (365,2425 d)"), 31556952),
      u("dec", "dec", n("decade", "décennie", "Jahrzehnt"), 315569520),
      u("cen", "cen", n("century", "siècle", "Jahrhundert"), 3155695200),
    ],
  },
  {
    id: "energy",
    name: n("Energy", "Énergie", "Energie"),
    units: [
      u("j", "J", n("joule", "joule", "Joule"), 1),
      u("kj", "kJ", n("kilojoule", "kilojoule", "Kilojoule"), 1e3),
      u("mj", "MJ", n("megajoule", "mégajoule", "Megajoule"), 1e6),
      u("cal", "cal", n("calorie", "calorie", "Kalorie"), CAL),
      u("kcal", "kcal", n("kilocalorie", "kilocalorie", "Kilokalorie"), CAL * 1000),
      u("wh", "Wh", n("watt-hour", "wattheure", "Wattstunde"), 3600),
      u("kwh", "kWh", n("kilowatt-hour", "kilowattheure", "Kilowattstunde"), 3.6e6),
      u("ev", "eV", n("electronvolt", "électronvolt", "Elektronenvolt"), 1.602176634e-19),
      u("btu", "BTU", n("British thermal unit", "BTU", "British Thermal Unit"), 1055.05585262, imp),
      u("ftlb", "ft·lbf", n("foot-pound", "pied-livre", "Foot-Pound"), 1.3558179483314, imp),
      u("therm", "thm", n("therm (US)", "therm (US)", "Therm (US)"), 105480400, imp),
    ],
  },
  {
    id: "pressure",
    name: n("Pressure", "Pression", "Druck"),
    units: [
      u("pa", "Pa", n("pascal", "pascal", "Pascal"), 1),
      u("hpa", "hPa", n("hectopascal", "hectopascal", "Hektopascal"), 100),
      u("kpa", "kPa", n("kilopascal", "kilopascal", "Kilopascal"), 1e3),
      u("mpa", "MPa", n("megapascal", "mégapascal", "Megapascal"), 1e6),
      u("mbar", "mbar", n("millibar", "millibar", "Millibar"), 100),
      u("bar", "bar", n("bar", "bar", "Bar"), 1e5),
      u("atm", "atm", n("atmosphere", "atmosphère", "Atmosphäre"), 101325),
      u(
        "mmhg",
        "mmHg",
        n("millimetre of mercury", "millimètre de mercure", "Millimeter Quecksilbersäule"),
        133.322387415,
      ),
      u("torr", "Torr", n("torr", "torr", "Torr"), 101325 / 760),
      u(
        "psi",
        "psi",
        n("pound per square inch", "livre par pouce carré", "Pfund pro Quadratzoll"),
        6894.757293168,
        imp,
      ),
      u(
        "inhg",
        "inHg",
        n("inch of mercury", "pouce de mercure", "Zoll Quecksilbersäule"),
        3386.389,
        imp,
      ),
    ],
  },
  {
    id: "datarate",
    name: n("Data rate", "Débit de données", "Datenrate"),
    units: [
      u("bps", "bit/s", n("bit per second", "bit par seconde", "Bit pro Sekunde"), 1),
      u(
        "kbps",
        "kbit/s",
        n("kilobit per second", "kilobit par seconde", "Kilobit pro Sekunde"),
        1e3,
      ),
      u(
        "mbps",
        "Mbit/s",
        n("megabit per second", "mégabit par seconde", "Megabit pro Sekunde"),
        1e6,
      ),
      u(
        "gbps",
        "Gbit/s",
        n("gigabit per second", "gigabit par seconde", "Gigabit pro Sekunde"),
        1e9,
      ),
      u("Bps", "B/s", n("byte per second", "octet par seconde", "Byte pro Sekunde"), 8),
      u(
        "kBps",
        "kB/s",
        n("kilobyte per second", "kilo-octet par seconde", "Kilobyte pro Sekunde"),
        8e3,
      ),
      u(
        "MBps",
        "MB/s",
        n("megabyte per second", "mégaoctet par seconde", "Megabyte pro Sekunde"),
        8e6,
      ),
      u(
        "GBps",
        "GB/s",
        n("gigabyte per second", "gigaoctet par seconde", "Gigabyte pro Sekunde"),
        8e9,
      ),
      u(
        "KiBps",
        "KiB/s",
        n("kibibyte per second", "kibioctet par seconde", "Kibibyte pro Sekunde"),
        8 * 1024,
      ),
      u(
        "MiBps",
        "MiB/s",
        n("mebibyte per second", "mébioctet par seconde", "Mebibyte pro Sekunde"),
        8 * 1024 ** 2,
      ),
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
