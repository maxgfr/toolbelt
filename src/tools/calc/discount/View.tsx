import { Badge, NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, IconButton, Panel } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import {
  CurrencySelect,
  currencySymbol,
  Formula,
  money,
  NumText,
  numOr,
  pct,
  plain,
  Result,
  useCurrency,
} from "../_ui";
import {
  applyDiscounts,
  comparePrices,
  type Dimension,
  discountPercent,
  originalPrice,
  UNITS,
} from "./logic";

const T = {
  sale: l("Sale price", "Prix soldé"),
  price: l("Price", "Prix"),
  discount: l("Discount", "Remise"),
  discountN: l("Discount {n}", "Remise {n}"),
  addDiscount: l("Add another discount", "Ajouter une remise"),
  stackHint: l(
    "Several discounts apply one after the other: −30 % then −10 % is −37 %, not −40 %.",
    "Plusieurs remises s'appliquent l'une après l'autre : −30 % puis −10 % font −37 %, pas −40 %.",
  ),
  remove: l("Remove", "Retirer"),
  final: l("You pay", "Tu paies"),
  saved: l("You save", "Tu économises"),
  equivalent: l("Total discount", "Remise totale"),
  reverse: l("Price before the discount", "Prix avant la remise"),
  salePrice: l("Sale price", "Prix soldé"),
  original: l("Original price", "Prix d'origine"),
  off: l("What % off?", "Quel % de remise ?"),
  was: l("Was", "Avant"),
  now: l("Now", "Maintenant"),
  percentOff: l("Discount", "Remise"),
  compare: l("Which is the best deal?", "Quel est le meilleur prix ?"),
  compareHint: l(
    "Compare the price per kg, per litre or per item. For a pack, type the number of packs × the quantity of each.",
    "Compare le prix au kilo, au litre ou à la pièce. Pour un lot, tape le nombre d'unités × la quantité de chacune.",
  ),
  product: l("Product", "Produit"),
  packs: l("Count", "Nombre"),
  qty: l("Quantity each", "Quantité unitaire"),
  unit: l("Unit", "Unité"),
  unitPrice: l("Unit price", "Prix unitaire"),
  best: l("Best deal", "Meilleur prix"),
  more: l("+{p}", "+{p}"),
  other: l("not comparable", "pas comparable"),
  addProduct: l("Add a product", "Ajouter un produit"),
  perKg: l("/ kg", "/ kg"),
  perL: l("/ L", "/ L"),
  perItem: l("/ item", "/ pièce"),
  item: l("item", "pièce"),
  f1: l(
    "Final price = price × (1 − discount 1) × (1 − discount 2)… Original price = sale price ÷ the same factors.",
    "Prix final = prix × (1 − remise 1) × (1 − remise 2)… Prix d'origine = prix soldé ÷ ces mêmes facteurs.",
  ),
  f2: l(
    "% off = (was − now) ÷ was. Unit price = price ÷ (count × quantity), converted to kg, L or item.",
    "% de remise = (avant − maintenant) ÷ avant. Prix unitaire = prix ÷ (nombre × quantité), ramené au kg, au L ou à la pièce.",
  ),
};

type Prod = {
  name: string;
  price: string;
  packs: string;
  qty: string;
  unit: string;
};

const PER: Record<Dimension, typeof T.perKg> = { mass: T.perKg, volume: T.perL, count: T.perItem };

export default function Discount() {
  const cur = useCurrency();
  const price = useToolState("price", 80);
  const discounts = useToolState<string[]>("discounts", ["30", "10"]);
  const sale = useToolState("sale", 45);
  const saleOff = useToolState("saleOff", 25);
  const was = useToolState("was", 80);
  const now = useToolState("now", 60);
  const products = useToolState<Prod[]>("products", [
    { name: "", price: "2.49", packs: "1", qty: "500", unit: "g" },
    { name: "", price: "4.20", packs: "1", qty: "1", unit: "kg" },
    { name: "", price: "1.59", packs: "2", qty: "150", unit: "g" },
  ]);
  const m = (n: number) => money(n, cur.code);
  const sym = currencySymbol(cur.code);

  const ds = discounts.value.map((d) => numOr(d, 0));
  const r = applyDiscounts(price.value, ds);
  const orig = originalPrice(sale.value, [saleOff.value]);
  const off = discountPercent(was.value, now.value);
  const cmp = comparePrices(
    products.value.map((p) => ({
      price: numOr(p.price, Number.NaN),
      packs: numOr(p.packs, 1),
      quantity: numOr(p.qty, Number.NaN),
      unit: p.unit,
    })),
  );
  const setProd = (i: number, patch: Partial<Prod>) => {
    products.value = products.value.map((p, j) => (j === i ? { ...p, ...patch } : p));
  };

  return (
    <>
      <div class="grid-3">
        <CurrencySelect cur={cur} />
      </div>
      <Panel title={tr(T.sale)}>
        <div class="grid-3">
          <NumberField
            label={tr(T.price)}
            value={price.value}
            min={0}
            step="any"
            suffix={sym}
            onChange={(v) => {
              price.value = v;
            }}
          />
          {discounts.value.map((d, i) => (
            <div key={i} class="discount-step">
              <NumText
                label={tr(T.discountN).replace("{n}", String(i + 1))}
                value={d}
                onInput={(v) => {
                  discounts.value = discounts.value.map((x, j) => (j === i ? v : x));
                }}
              />
              <span class="muted">%</span>
              {discounts.value.length > 1 && (
                <IconButton
                  icon="close"
                  label={tr(T.remove)}
                  onClick={() => {
                    discounts.value = discounts.value.filter((_, j) => j !== i);
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div class="row">
          <Button
            size="sm"
            icon="plus"
            onClick={() => {
              discounts.value = [...discounts.value, "10"];
            }}
          >
            {tr(T.addDiscount)}
          </Button>
          <span class="muted small">{tr(T.stackHint)}</span>
        </div>
        <div class="grid-3">
          <Result label={tr(T.final)} value={m(r.final)} copy={plain(r.final)} />
          <Result label={tr(T.saved)} value={m(r.saved)} copy={plain(r.saved)} />
          <Result
            label={tr(T.equivalent)}
            value={`−${pct(r.equivalent)}`}
            copy={plain(r.equivalent)}
          />
        </div>
        {r.steps.length > 1 && (
          <p class="muted small mono">
            {[m(price.value), ...r.steps.map((s, i) => `−${pct(ds[i] ?? 0)} → ${m(s)}`)].join("  ")}
          </p>
        )}
      </Panel>

      <div class="grid-2">
        <Panel title={tr(T.reverse)}>
          <div class="grid-2">
            <NumberField
              label={tr(T.salePrice)}
              value={sale.value}
              min={0}
              step="any"
              suffix={sym}
              onChange={(v) => {
                sale.value = v;
              }}
            />
            <NumberField
              label={tr(T.discount)}
              value={saleOff.value}
              min={0}
              max={99.99}
              step="any"
              suffix="%"
              onChange={(v) => {
                saleOff.value = v;
              }}
            />
          </div>
          <Result
            label={tr(T.original)}
            value={orig === null ? "—" : m(orig)}
            copy={orig === null ? "" : plain(orig)}
          />
        </Panel>
        <Panel title={tr(T.off)}>
          <div class="grid-2">
            <NumberField
              label={tr(T.was)}
              value={was.value}
              min={0}
              step="any"
              suffix={sym}
              onChange={(v) => {
                was.value = v;
              }}
            />
            <NumberField
              label={tr(T.now)}
              value={now.value}
              min={0}
              step="any"
              suffix={sym}
              onChange={(v) => {
                now.value = v;
              }}
            />
          </div>
          <Result
            label={tr(T.percentOff)}
            value={off === null ? "—" : off >= 0 ? `−${pct(off, 1)}` : `+${pct(-off, 1)}`}
            copy={off === null ? "" : plain(off, 2)}
          />
        </Panel>
      </div>

      <Panel title={tr(T.compare)}>
        <p class="muted small">{tr(T.compareHint)}</p>
        <div class="table-wrap">
          <table class="table discount-table">
            <thead>
              <tr>
                <th>{tr(T.product)}</th>
                <th>{tr(T.price)}</th>
                <th>{tr(T.packs)}</th>
                <th>{tr(T.qty)}</th>
                <th>{tr(T.unit)}</th>
                <th class="num">{tr(T.unitPrice)}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.value.map((p, i) => {
                const res = cmp.results[i];
                return (
                  <tr key={i} class={res?.best ? "discount-best" : ""}>
                    <td>
                      <input
                        class="input"
                        type="text"
                        aria-label={tr(T.product)}
                        placeholder={`${tr(T.product)} ${String.fromCharCode(65 + (i % 26))}`}
                        value={p.name}
                        onInput={(e) =>
                          setProd(i, { name: (e.currentTarget as HTMLInputElement).value })
                        }
                      />
                    </td>
                    <td>
                      <NumText
                        hidden
                        class="discount-num"
                        label={tr(T.price)}
                        value={p.price}
                        onInput={(v) => setProd(i, { price: v })}
                      />
                    </td>
                    <td>
                      <NumText
                        hidden
                        class="discount-num"
                        label={tr(T.packs)}
                        value={p.packs}
                        onInput={(v) => setProd(i, { packs: v })}
                      />
                    </td>
                    <td>
                      <NumText
                        hidden
                        class="discount-num"
                        label={tr(T.qty)}
                        value={p.qty}
                        onInput={(v) => setProd(i, { qty: v })}
                      />
                    </td>
                    <td>
                      <select
                        class="input"
                        aria-label={tr(T.unit)}
                        value={p.unit}
                        onChange={(e) =>
                          setProd(i, { unit: (e.currentTarget as HTMLSelectElement).value })
                        }
                      >
                        {UNITS.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.id === "item" ? tr(T.item) : u.id}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td class="num">
                      {res?.perBase != null ? `${m(res.perBase)} ${tr(PER[res.dim])}` : "—"}
                      <div>
                        {res?.best ? (
                          <Badge kind="ok">{tr(T.best)}</Badge>
                        ) : res?.overBest != null && res.overBest > 0 ? (
                          <span class="muted small">
                            {tr(T.more).replace("{p}", pct(res.overBest, 1))}
                          </span>
                        ) : res?.perBase != null && cmp.dim && res.dim !== cmp.dim ? (
                          <span class="muted small">{tr(T.other)}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <IconButton
                        icon="close"
                        label={tr(T.remove)}
                        onClick={() => {
                          products.value = products.value.filter((_, j) => j !== i);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div class="row">
          <Button
            icon="plus"
            onClick={() => {
              products.value = [
                ...products.value,
                { name: "", price: "", packs: "1", qty: "", unit: products.value[0]?.unit ?? "g" },
              ];
            }}
          >
            {tr(T.addProduct)}
          </Button>
        </div>
      </Panel>
      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
      </Formula>
    </>
  );
}
