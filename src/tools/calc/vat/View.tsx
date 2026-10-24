import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, IconButton, Panel, Segmented, Stats } from "../../../app/ui";
import { l, pick, tr } from "../../../i18n";
import { parseNumber } from "../_shared";
import {
  CurrencySelect,
  Formula,
  money,
  NumText,
  numOr,
  pct,
  plain,
  Result,
  typed,
  useCurrency,
} from "../_ui";
import {
  COUNTRIES,
  findCountry,
  fromGross,
  fromNet,
  fromVat,
  rateFrom,
  type Split,
  totals,
} from "./logic";

const T = {
  country: l("Country", "Pays", "Land"),
  rate: l("VAT rate", "Taux de TVA", "Steuersatz"),
  custom: l("Custom rate", "Taux personnalisé", "Eigener Satz"),
  quick: l("Convert a price", "Convertir un prix", "Preis umrechnen"),
  amount: l("Amount", "Montant", "Betrag"),
  is: l("This amount is", "Ce montant est", "Dieser Betrag ist"),
  net: l("Before tax (excl. VAT)", "Hors taxes (HT)", "Netto (ohne MwSt.)"),
  gross: l("With tax (incl. VAT)", "Toutes taxes comprises (TTC)", "Brutto (inkl. MwSt.)"),
  vat: l("The VAT itself", "La TVA elle-même", "Die Mehrwertsteuer selbst"),
  netShort: l("Excl. VAT", "HT", "Netto"),
  grossShort: l("Incl. VAT", "TTC", "Brutto"),
  vatShort: l("VAT", "TVA", "MwSt."),
  badAmount: l(
    "Type an amount, e.g. 49.90",
    "Tape un montant, par ex. 49,90",
    "Gib einen Betrag ein, z. B. 49,90",
  ),
  badRate: l(
    "The rate must be a number between 0 and 100.",
    "Le taux doit être un nombre entre 0 et 100.",
    "Der Steuersatz muss eine Zahl zwischen 0 und 100 sein.",
  ),
  findRate: l("Find the rate", "Retrouver le taux", "Steuersatz ermitteln"),
  findHint: l(
    "Know both prices but not the rate? Type them here.",
    "Tu connais les deux prix mais pas le taux ? Tape-les ici.",
    "Du kennst beide Preise, aber nicht den Steuersatz? Gib sie hier ein.",
  ),
  foundRate: l("VAT rate", "Taux de TVA", "Steuersatz"),
  lines: l("Several items (invoice)", "Plusieurs articles (facture)", "Mehrere Posten (Rechnung)"),
  pricesAre: l("Unit prices are", "Les prix unitaires sont", "Einzelpreise sind"),
  item: l("Item", "Article", "Posten"),
  qty: l("Qty", "Qté", "Menge"),
  unitPrice: l("Unit price", "Prix unitaire", "Einzelpreis"),
  add: l("Add a line", "Ajouter une ligne", "Zeile hinzufügen"),
  remove: l("Remove line", "Supprimer la ligne", "Zeile entfernen"),
  total: l("Total", "Total", "Summe"),
  byRate: l("VAT by rate", "TVA par taux", "MwSt. nach Satz"),
  ratesNote: l(
    "Preset rates are those in force in 2025–2026 and may change: check the official source before invoicing.",
    "Les taux proposés sont ceux en vigueur en 2025–2026 et peuvent changer : vérifie la source officielle avant de facturer.",
    "Die vorgegebenen Sätze gelten 2025–2026 und können sich ändern: Prüf vor dem Rechnungstellen die offizielle Quelle.",
  ),
  f1: l(
    "With tax = before tax × (1 + rate). At 20 %: 100 × 1.20 = 120.",
    "TTC = HT × (1 + taux). À 20 % : 100 × 1,20 = 120.",
    "Brutto = netto × (1 + Steuersatz). Bei 19 %: 100 × 1,19 = 119.",
  ),
  f2: l(
    "Before tax = with tax ÷ (1 + rate). 120 ÷ 1.20 = 100 — not 120 − 20 % (= 96).",
    "HT = TTC ÷ (1 + taux). 120 ÷ 1,20 = 100 — et non 120 − 20 % (= 96).",
    "Netto = brutto ÷ (1 + Steuersatz). 119 ÷ 1,19 = 100 – nicht 119 − 19 % (= 96,39).",
  ),
  f3: l(
    "Invoice lines are rounded to the cent one by one, then added up.",
    "Les lignes de facture sont arrondies au centime une par une, puis additionnées.",
    "Rechnungszeilen werden einzeln auf den Cent gerundet und dann addiert.",
  ),
};

type Kind = "net" | "gross" | "vat";
type Row = {
  label: string;
  qty: string;
  price: string;
  rate: string;
};

const num = (s: string) => parseNumber(s);

export default function Vat() {
  const cur = useCurrency();
  const countrySig = useToolState("country", "");
  const rate = useToolState("rate", "auto");
  const amount = useToolState("amount", "100");
  const kind = useToolState<Kind>("kind", "net");
  const rNet = useToolState("rNet", "100");
  const rGross = useToolState("rGross", typed("105.5"));
  const withTax = useToolState("withTax", false);
  const rows = useToolState<Row[]>("rows", [
    { label: "", qty: "1", price: "100", rate: "" },
    { label: "", qty: "2", price: typed("12.5"), rate: "" },
  ]);

  const country = findCountry(countrySig.value || pick({ en: "uk", fr: "fr", de: "de" }));
  const std = country.rates[0]?.rate ?? 20;
  const rateText = rate.value === "auto" ? String(std) : rate.value;
  const r = num(rateText);
  const rateOk = r !== null && r >= 0 && r <= 100;
  const a = num(amount.value);
  const split: Split | null =
    a === null || !rateOk
      ? null
      : kind.value === "net"
        ? fromNet(a, r)
        : kind.value === "gross"
          ? fromGross(a, r)
          : fromVat(a, r);
  const m = (n: number) => money(n, cur.code);

  const found = (() => {
    const n = num(rNet.value);
    const g = num(rGross.value);
    return n === null || g === null ? null : rateFrom(n, g);
  })();

  const rateOptions = [...new Set([...country.rates.map((x) => x.rate), ...(rateOk ? [r] : [])])];
  const t = totals(
    rows.value.map((row) => ({
      qty: numOr(row.qty, 0),
      price: numOr(row.price, 0),
      rate: numOr(row.rate || rateText, 0),
    })),
    withTax.value,
  );
  const setRow = (i: number, patch: Partial<Row>) => {
    rows.value = rows.value.map((x, j) => (j === i ? { ...x, ...patch } : x));
  };

  return (
    <>
      <div class="grid-3">
        <Select
          label={tr(T.country)}
          value={country.id}
          onChange={(v) => {
            countrySig.value = v;
            rate.value = "auto";
          }}
          options={COUNTRIES.map((c) => ({ value: c.id, label: tr(c.name) }))}
        />
        <NumText
          label={tr(T.custom)}
          value={rateText}
          onInput={(v) => {
            rate.value = v;
          }}
        />
        <CurrencySelect cur={cur} />
      </div>
      <fieldset class="vat-rates">
        <legend class="sr-only">{tr(T.rate)}</legend>
        {country.rates.map((x) => (
          <button
            key={`${x.rate}-${x.en}`}
            type="button"
            class={`vat-rate ${rateOk && r === x.rate ? "on" : ""}`}
            aria-pressed={rateOk && r === x.rate}
            onClick={() => {
              rate.value = String(x.rate);
            }}
          >
            <strong>{pct(x.rate, 3)}</strong>
            <span class="small muted">{tr(x)}</span>
          </button>
        ))}
      </fieldset>
      {!rateOk && rateText.trim() !== "" && <ErrorNote error={tr(T.badRate)} />}

      <Panel title={tr(T.quick)}>
        <div class="grid-2">
          <NumText
            label={tr(T.amount)}
            value={amount.value}
            onInput={(v) => {
              amount.value = v;
            }}
          />
          <Select<Kind>
            label={tr(T.is)}
            value={kind.value}
            onChange={(v) => {
              kind.value = v;
            }}
            options={[
              { value: "net", label: tr(T.net) },
              { value: "gross", label: tr(T.gross) },
              { value: "vat", label: tr(T.vat) },
            ]}
          />
        </div>
        {a === null && amount.value.trim() !== "" && <ErrorNote error={tr(T.badAmount)} />}
        {split && (
          <div class="grid-3">
            <Result label={tr(T.netShort)} value={m(split.net)} copy={plain(split.net)} />
            <Result
              label={`${tr(T.vatShort)} (${pct(r ?? 0, 3)})`}
              value={m(split.vat)}
              copy={plain(split.vat)}
            />
            <Result label={tr(T.grossShort)} value={m(split.gross)} copy={plain(split.gross)} />
          </div>
        )}
      </Panel>

      <Panel title={tr(T.findRate)}>
        <p class="muted small">{tr(T.findHint)}</p>
        <div class="grid-3">
          <NumText
            label={tr(T.netShort)}
            value={rNet.value}
            onInput={(v) => {
              rNet.value = v;
            }}
          />
          <NumText
            label={tr(T.grossShort)}
            value={rGross.value}
            onInput={(v) => {
              rGross.value = v;
            }}
          />
          <Result
            label={tr(T.foundRate)}
            value={found === null ? "—" : pct(found, 3)}
            copy={found === null ? "" : plain(found, 3)}
          />
        </div>
      </Panel>

      <Panel
        title={tr(T.lines)}
        actions={
          <Segmented<"net" | "gross">
            label={tr(T.pricesAre)}
            value={withTax.value ? "gross" : "net"}
            onChange={(v) => {
              withTax.value = v === "gross";
            }}
            options={[
              { value: "net", label: tr(T.netShort) },
              { value: "gross", label: tr(T.grossShort) },
            ]}
          />
        }
      >
        <div class="table-wrap">
          <table class="table vat-table">
            <thead>
              <tr>
                <th>{tr(T.item)}</th>
                <th>{tr(T.qty)}</th>
                <th>
                  {tr(T.unitPrice)} ({withTax.value ? tr(T.grossShort) : tr(T.netShort)})
                </th>
                <th>{tr(T.rate)}</th>
                <th class="num">{tr(T.netShort)}</th>
                <th class="num">{tr(T.vatShort)}</th>
                <th class="num">{tr(T.grossShort)}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.value.map((row, i) => {
                const res = t.lines[i];
                const rowRate = numOr(row.rate || rateText, 0);
                return (
                  <tr key={i}>
                    <td>
                      <input
                        class="input"
                        type="text"
                        aria-label={tr(T.item)}
                        placeholder={`${tr(T.item)} ${i + 1}`}
                        value={row.label}
                        onInput={(e) =>
                          setRow(i, { label: (e.currentTarget as HTMLInputElement).value })
                        }
                      />
                    </td>
                    <td>
                      <NumText
                        hidden
                        class="vat-qty"
                        label={tr(T.qty)}
                        value={row.qty}
                        onInput={(v) => setRow(i, { qty: v })}
                      />
                    </td>
                    <td>
                      <NumText
                        hidden
                        label={tr(T.unitPrice)}
                        value={row.price}
                        onInput={(v) => setRow(i, { price: v })}
                      />
                    </td>
                    <td>
                      <select
                        class="input"
                        aria-label={tr(T.rate)}
                        value={String(rowRate)}
                        onChange={(e) =>
                          setRow(i, { rate: (e.currentTarget as HTMLSelectElement).value })
                        }
                      >
                        {[...new Set([...rateOptions, rowRate])].map((x) => (
                          <option key={x} value={String(x)}>
                            {pct(x, 3)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td class="num">{res ? m(res.net) : "—"}</td>
                    <td class="num">{res ? m(res.vat) : "—"}</td>
                    <td class="num">{res ? m(res.gross) : "—"}</td>
                    <td>
                      <IconButton
                        icon="close"
                        label={tr(T.remove)}
                        onClick={() => {
                          rows.value = rows.value.filter((_, j) => j !== i);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {t.byRate.length > 1 &&
                t.byRate.map((b) => (
                  <tr key={b.rate} class="muted">
                    <td colSpan={4}>
                      {tr(T.byRate)} {pct(b.rate, 3)}
                    </td>
                    <td class="num">{m(b.net)}</td>
                    <td class="num">{m(b.vat)}</td>
                    <td class="num">{m(b.gross)}</td>
                    <td />
                  </tr>
                ))}
              <tr class="vat-total">
                <td colSpan={4}>{tr(T.total)}</td>
                <td class="num">{m(t.net)}</td>
                <td class="num">{m(t.vat)}</td>
                <td class="num">{m(t.gross)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="row">
          <Button
            icon="plus"
            onClick={() => {
              rows.value = [...rows.value, { label: "", qty: "1", price: "", rate: "" }];
            }}
          >
            {tr(T.add)}
          </Button>
        </div>
        <Stats
          items={[
            { label: tr(T.netShort), value: m(t.net) },
            { label: tr(T.vatShort), value: m(t.vat) },
            { label: tr(T.grossShort), value: m(t.gross) },
          ]}
        />
      </Panel>

      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
        <p>{tr(T.f3)}</p>
        <p>{tr(T.ratesNote)}</p>
      </Formula>
    </>
  );
}
