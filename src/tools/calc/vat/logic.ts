/**
 * VAT (TVA): from the price before tax (HT), the price with tax (TTC) or the tax itself,
 * the other two; the rate from both prices; invoice lines with totals per rate.
 */
import { roundTo } from "../_shared";

export interface Country {
  id: string;
  name: { en: string; fr: string; de: string };
  /** Standard rate first. */
  rates: { rate: number; en: string; fr: string; de: string }[];
}

/** Rates in force in 2025–2026 (they change: check the official source for invoices). */
export const COUNTRIES: Country[] = [
  {
    id: "fr",
    name: { en: "France", fr: "France", de: "Frankreich" },
    rates: [
      { rate: 20, en: "standard", fr: "normal", de: "Normalsatz" },
      {
        rate: 10,
        en: "intermediate (restaurants, works)",
        fr: "intermédiaire (restauration, travaux)",
        de: "Zwischensatz (Gastronomie, Bauarbeiten)",
      },
      {
        rate: 5.5,
        en: "reduced (food, energy, books)",
        fr: "réduit (alimentation, énergie, livres)",
        de: "ermäßigt (Lebensmittel, Energie, Bücher)",
      },
      {
        rate: 2.1,
        en: "super-reduced (medicines, press)",
        fr: "particulier (médicaments, presse)",
        de: "stark ermäßigt (Medikamente, Presse)",
      },
    ],
  },
  {
    id: "be",
    name: { en: "Belgium", fr: "Belgique", de: "Belgien" },
    rates: [
      { rate: 21, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 12, en: "intermediate", fr: "intermédiaire", de: "Zwischensatz" },
      { rate: 6, en: "reduced", fr: "réduit", de: "ermäßigt" },
    ],
  },
  {
    id: "ch",
    name: { en: "Switzerland", fr: "Suisse", de: "Schweiz" },
    rates: [
      { rate: 8.1, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 3.8, en: "accommodation", fr: "hébergement", de: "Beherbergung" },
      {
        rate: 2.6,
        en: "reduced (food, books)",
        fr: "réduit (alimentation, livres)",
        de: "reduziert (Lebensmittel, Bücher)",
      },
    ],
  },
  {
    id: "lu",
    name: { en: "Luxembourg", fr: "Luxembourg", de: "Luxemburg" },
    rates: [
      { rate: 17, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 14, en: "intermediate", fr: "intermédiaire", de: "Zwischensatz" },
      { rate: 8, en: "reduced", fr: "réduit", de: "ermäßigt" },
      { rate: 3, en: "super-reduced", fr: "super-réduit", de: "stark ermäßigt" },
    ],
  },
  {
    id: "de",
    name: { en: "Germany", fr: "Allemagne", de: "Deutschland" },
    rates: [
      { rate: 19, en: "standard", fr: "normal", de: "Regelsatz" },
      {
        rate: 7,
        en: "reduced (food, books, local transport)",
        fr: "réduit (alimentation, livres, transports locaux)",
        de: "ermäßigt (Lebensmittel, Bücher, Nahverkehr)",
      },
    ],
  },
  {
    id: "es",
    name: { en: "Spain", fr: "Espagne", de: "Spanien" },
    rates: [
      { rate: 21, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 10, en: "reduced", fr: "réduit", de: "ermäßigt" },
      { rate: 4, en: "super-reduced", fr: "super-réduit", de: "stark ermäßigt" },
    ],
  },
  {
    id: "it",
    name: { en: "Italy", fr: "Italie", de: "Italien" },
    rates: [
      { rate: 22, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 10, en: "reduced", fr: "réduit", de: "ermäßigt" },
      { rate: 5, en: "reduced", fr: "réduit", de: "ermäßigt" },
      { rate: 4, en: "super-reduced", fr: "super-réduit", de: "stark ermäßigt" },
    ],
  },
  {
    id: "pt",
    name: { en: "Portugal", fr: "Portugal", de: "Portugal" },
    rates: [
      { rate: 23, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 13, en: "intermediate", fr: "intermédiaire", de: "Zwischensatz" },
      { rate: 6, en: "reduced", fr: "réduit", de: "ermäßigt" },
    ],
  },
  {
    id: "nl",
    name: { en: "Netherlands", fr: "Pays-Bas", de: "Niederlande" },
    rates: [
      { rate: 21, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 9, en: "reduced", fr: "réduit", de: "ermäßigt" },
    ],
  },
  {
    id: "at",
    name: { en: "Austria", fr: "Autriche", de: "Österreich" },
    rates: [
      { rate: 20, en: "standard", fr: "normal", de: "Normalsatz" },
      {
        rate: 13,
        en: "reduced (culture, plants)",
        fr: "réduit (culture, plantes)",
        de: "ermäßigt (Kultur, Pflanzen)",
      },
      {
        rate: 10,
        en: "reduced (food, books, hotels)",
        fr: "réduit (alimentation, livres, hôtels)",
        de: "ermäßigt (Lebensmittel, Bücher, Beherbergung)",
      },
    ],
  },
  {
    id: "ie",
    name: { en: "Ireland", fr: "Irlande", de: "Irland" },
    rates: [
      { rate: 23, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 13.5, en: "reduced", fr: "réduit", de: "ermäßigt" },
      { rate: 9, en: "second reduced", fr: "second réduit", de: "zweiter ermäßigter Satz" },
    ],
  },
  {
    id: "uk",
    name: { en: "United Kingdom", fr: "Royaume-Uni", de: "Vereinigtes Königreich" },
    rates: [
      { rate: 20, en: "standard", fr: "normal", de: "Normalsatz" },
      {
        rate: 5,
        en: "reduced (energy, child seats)",
        fr: "réduit (énergie, sièges auto)",
        de: "ermäßigt (Energie, Kindersitze)",
      },
      {
        rate: 0,
        en: "zero (food, books)",
        fr: "zéro (alimentation, livres)",
        de: "null (Lebensmittel, Bücher)",
      },
    ],
  },
  {
    id: "ca",
    name: { en: "Canada", fr: "Canada", de: "Kanada" },
    rates: [
      {
        rate: 5,
        en: "GST only (AB, territories…)",
        fr: "TPS seule (AB, territoires…)",
        de: "nur GST (AB, Territorien …)",
      },
      {
        rate: 14.975,
        en: "Quebec: GST 5 + QST 9.975",
        fr: "Québec : TPS 5 + TVQ 9,975",
        de: "Québec: GST 5 + QST 9,975",
      },
      { rate: 13, en: "HST Ontario", fr: "TVH Ontario", de: "HST Ontario" },
      { rate: 14, en: "HST Nova Scotia", fr: "TVH Nouvelle-Écosse", de: "HST Nova Scotia" },
      {
        rate: 15,
        en: "HST NB, NL, PEI",
        fr: "TVH N.-B., T.-N.-L., Î.-P.-É.",
        de: "HST NB, NL, PEI",
      },
      { rate: 12, en: "BC: GST 5 + PST 7", fr: "C.-B. : TPS 5 + TVP 7", de: "BC: GST 5 + PST 7" },
    ],
  },
  {
    id: "ma",
    name: { en: "Morocco", fr: "Maroc", de: "Marokko" },
    rates: [
      { rate: 20, en: "standard", fr: "normal", de: "Normalsatz" },
      { rate: 14, en: "reduced", fr: "réduit", de: "ermäßigt" },
      { rate: 10, en: "reduced", fr: "réduit", de: "ermäßigt" },
      { rate: 7, en: "reduced", fr: "réduit", de: "ermäßigt" },
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
