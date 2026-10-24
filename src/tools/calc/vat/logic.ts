/**
 * VAT (TVA): from the price before tax (HT), the price with tax (TTC) or the tax itself,
 * the other two; the rate from both prices; invoice lines with totals per rate.
 */
import { roundTo } from "../_shared";

export interface Country {
  id: string;
  name: { en: string; fr: string };
  /** Standard rate first. */
  rates: { rate: number; en: string; fr: string }[];
}

/** Rates in force in 2025–2026 (they change: check the official source for invoices). */
export const COUNTRIES: Country[] = [
  {
    id: "fr",
    name: { en: "France", fr: "France" },
    rates: [
      { rate: 20, en: "standard", fr: "normal" },
      {
        rate: 10,
        en: "intermediate (restaurants, works)",
        fr: "intermédiaire (restauration, travaux)",
      },
      {
        rate: 5.5,
        en: "reduced (food, energy, books)",
        fr: "réduit (alimentation, énergie, livres)",
      },
      {
        rate: 2.1,
        en: "super-reduced (medicines, press)",
        fr: "particulier (médicaments, presse)",
      },
    ],
  },
  {
    id: "be",
    name: { en: "Belgium", fr: "Belgique" },
    rates: [
      { rate: 21, en: "standard", fr: "normal" },
      { rate: 12, en: "intermediate", fr: "intermédiaire" },
      { rate: 6, en: "reduced", fr: "réduit" },
    ],
  },
  {
    id: "ch",
    name: { en: "Switzerland", fr: "Suisse" },
    rates: [
      { rate: 8.1, en: "standard", fr: "normal" },
      { rate: 3.8, en: "accommodation", fr: "hébergement" },
      { rate: 2.6, en: "reduced", fr: "réduit" },
    ],
  },
  {
    id: "lu",
    name: { en: "Luxembourg", fr: "Luxembourg" },
    rates: [
      { rate: 17, en: "standard", fr: "normal" },
      { rate: 14, en: "intermediate", fr: "intermédiaire" },
      { rate: 8, en: "reduced", fr: "réduit" },
      { rate: 3, en: "super-reduced", fr: "super-réduit" },
    ],
  },
  {
    id: "de",
    name: { en: "Germany", fr: "Allemagne" },
    rates: [
      { rate: 19, en: "standard", fr: "normal" },
      { rate: 7, en: "reduced", fr: "réduit" },
    ],
  },
  {
    id: "es",
    name: { en: "Spain", fr: "Espagne" },
    rates: [
      { rate: 21, en: "standard", fr: "normal" },
      { rate: 10, en: "reduced", fr: "réduit" },
      { rate: 4, en: "super-reduced", fr: "super-réduit" },
    ],
  },
  {
    id: "it",
    name: { en: "Italy", fr: "Italie" },
    rates: [
      { rate: 22, en: "standard", fr: "normal" },
      { rate: 10, en: "reduced", fr: "réduit" },
      { rate: 5, en: "reduced", fr: "réduit" },
      { rate: 4, en: "super-reduced", fr: "super-réduit" },
    ],
  },
  {
    id: "pt",
    name: { en: "Portugal", fr: "Portugal" },
    rates: [
      { rate: 23, en: "standard", fr: "normal" },
      { rate: 13, en: "intermediate", fr: "intermédiaire" },
      { rate: 6, en: "reduced", fr: "réduit" },
    ],
  },
  {
    id: "nl",
    name: { en: "Netherlands", fr: "Pays-Bas" },
    rates: [
      { rate: 21, en: "standard", fr: "normal" },
      { rate: 9, en: "reduced", fr: "réduit" },
    ],
  },
  {
    id: "at",
    name: { en: "Austria", fr: "Autriche" },
    rates: [
      { rate: 20, en: "standard", fr: "normal" },
      { rate: 13, en: "reduced", fr: "réduit" },
      { rate: 10, en: "reduced", fr: "réduit" },
    ],
  },
  {
    id: "ie",
    name: { en: "Ireland", fr: "Irlande" },
    rates: [
      { rate: 23, en: "standard", fr: "normal" },
      { rate: 13.5, en: "reduced", fr: "réduit" },
      { rate: 9, en: "second reduced", fr: "second réduit" },
    ],
  },
  {
    id: "uk",
    name: { en: "United Kingdom", fr: "Royaume-Uni" },
    rates: [
      { rate: 20, en: "standard", fr: "normal" },
      { rate: 5, en: "reduced (energy, child seats)", fr: "réduit (énergie, sièges auto)" },
      { rate: 0, en: "zero (food, books)", fr: "zéro (alimentation, livres)" },
    ],
  },
  {
    id: "ca",
    name: { en: "Canada", fr: "Canada" },
    rates: [
      { rate: 5, en: "GST only (AB, territories…)", fr: "TPS seule (AB, territoires…)" },
      { rate: 14.975, en: "Quebec: GST 5 + QST 9.975", fr: "Québec : TPS 5 + TVQ 9,975" },
      { rate: 13, en: "HST Ontario", fr: "TVH Ontario" },
      { rate: 14, en: "HST Nova Scotia", fr: "TVH Nouvelle-Écosse" },
      { rate: 15, en: "HST NB, NL, PEI", fr: "TVH N.-B., T.-N.-L., Î.-P.-É." },
      { rate: 12, en: "BC: GST 5 + PST 7", fr: "C.-B. : TPS 5 + TVP 7" },
    ],
  },
  {
    id: "ma",
    name: { en: "Morocco", fr: "Maroc" },
    rates: [
      { rate: 20, en: "standard", fr: "normal" },
      { rate: 14, en: "reduced", fr: "réduit" },
      { rate: 10, en: "reduced", fr: "réduit" },
      { rate: 7, en: "reduced", fr: "réduit" },
    ],
  },
];

export function findCountry(id: string): Country {
  return COUNTRIES.find((c) => c.id === id) ?? (COUNTRIES[0] as Country);
}

export interface Split {
  net: number;
  vat: number;
  gross: number;
}

/** From the price before tax: 100 at 20 % → VAT 20, total 120. */
export function fromNet(net: number, rate: number): Split {
  const vat = (net * rate) / 100;
  return { net, vat, gross: net + vat };
}

/** From the price with tax: 120 at 20 % → before tax 100 (not 120 − 20 %). */
export function fromGross(gross: number, rate: number): Split | null {
  const f = 1 + rate / 100;
  if (f <= 0) return null;
  const net = gross / f;
  return { net, vat: gross - net, gross };
}

/** From the tax amount: VAT 20 at 20 % → before tax 100. */
export function fromVat(vat: number, rate: number): Split | null {
  if (rate === 0) return null;
  const net = (vat * 100) / rate;
  return { net, vat, gross: net + vat };
}

/** The rate that turns `net` into `gross` (in %), null if net is 0. */
export function rateFrom(net: number, gross: number): number | null {
  if (net === 0) return null;
  return ((gross - net) / net) * 100;
}

export interface Line {
  qty: number;
  /** Unit price, before or with tax depending on `withTax`. */
  price: number;
  rate: number;
}

export interface LineResult extends Split {
  rate: number;
}

export interface Totals extends Split {
  lines: LineResult[];
  /** One entry per rate, sorted by rate (descending). */
  byRate: LineResult[];
}

/**
 * Invoice-style totals: each line is rounded to the cent (like on an invoice), then summed.
 * `withTax`: the unit prices include tax (TTC) rather than exclude it (HT).
 */
export function totals(lines: Line[], withTax: boolean, digits = 2): Totals {
  const out: LineResult[] = lines.map((l) => {
    const amount = l.qty * l.price;
    if (withTax) {
      const gross = roundTo(amount, digits);
      const net = roundTo(gross / (1 + l.rate / 100), digits);
      return { rate: l.rate, net, vat: roundTo(gross - net, digits), gross };
    }
    const net = roundTo(amount, digits);
    const vat = roundTo((net * l.rate) / 100, digits);
    return { rate: l.rate, net, vat, gross: roundTo(net + vat, digits) };
  });
  const map = new Map<number, LineResult>();
  for (const r of out) {
    const m = map.get(r.rate) ?? { rate: r.rate, net: 0, vat: 0, gross: 0 };
    m.net = roundTo(m.net + r.net, digits);
    m.vat = roundTo(m.vat + r.vat, digits);
    m.gross = roundTo(m.gross + r.gross, digits);
    map.set(r.rate, m);
  }
  const byRate = [...map.values()].sort((a, b) => b.rate - a.rate);
  const sum = (k: keyof Split) =>
    roundTo(
      out.reduce((s, r) => s + r[k], 0),
      digits,
    );
  return { lines: out, byRate, net: sum("net"), vat: sum("vat"), gross: sum("gross") };
}
