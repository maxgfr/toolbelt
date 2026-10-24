import { Fragment } from "preact";
import { useState } from "preact/hooks";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Panel, Segmented, Stats } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import {
  CurrencySelect,
  currencySymbol,
  Formula,
  money,
  pct,
  plain,
  Result,
  useCurrency,
} from "../_ui";
import { borrowingCapacity, loan, MAX_DEBT_RATIO } from "./logic";

const T = {
  mode: l("Question", "Question"),
  payment: l("Monthly payment", "Mensualité"),
  borrow: l("How much can I borrow?", "Combien puis-je emprunter ?"),
  amount: l("Amount borrowed", "Montant emprunté"),
  rate: l("Interest rate (yearly)", "Taux d'intérêt (annuel)"),
  duration: l("Duration", "Durée"),
  unit: l("Unit", "Unité"),
  years: l("Years", "Années"),
  months: l("Months", "Mois"),
  insurance: l("Insurance rate (yearly)", "Taux d'assurance (annuel)"),
  insuranceHint: l("On the amount borrowed; 0 if none", "Sur le capital emprunté ; 0 si aucune"),
  fees: l("Fees", "Frais"),
  feesHint: l("Application, guarantee, broker…", "Dossier, garantie, courtier…"),
  monthly: l("Monthly payment", "Mensualité"),
  withIns: l("insurance included", "assurance comprise"),
  without: l("Without insurance", "Hors assurance"),
  insMonthly: l("Insurance per month", "Assurance par mois"),
  interest: l("Total interest", "Total des intérêts"),
  insTotal: l("Total insurance", "Total de l'assurance"),
  cost: l("Cost of the loan", "Coût du crédit"),
  costHint: l("interest + insurance + fees", "intérêts + assurance + frais"),
  paid: l("Total paid back", "Total remboursé"),
  bad: l(
    "Check the duration (1 month to 100 years) and the amounts.",
    "Vérifie la durée (1 mois à 100 ans) et les montants.",
  ),
  schedule: l("Amortization table", "Tableau d'amortissement"),
  scheduleHint: l("Click a year to see its months.", "Clique une année pour voir ses mois."),
  year: l("Year", "Année"),
  month: l("Month", "Mois"),
  paidCol: l("Paid", "Payé"),
  interestCol: l("Interest", "Intérêts"),
  principalCol: l("Principal", "Capital"),
  insuranceCol: l("Insurance", "Assurance"),
  balance: l("Remaining", "Restant dû"),
  budget: l("Monthly budget", "Mensualité maximale"),
  budgetHint: l("Insurance included", "Assurance comprise"),
  income: l("Net monthly income (optional)", "Revenus nets mensuels (facultatif)"),
  useRatio: l("Use {p} of income: {v}", "Utiliser {p} des revenus : {v}"),
  canBorrow: l("You could borrow about", "Tu pourrais emprunter environ"),
  ratioNote: l(
    "In France, banks usually cap loan payments at 35 % of net income, insurance included.",
    "En France, les banques plafonnent en général les mensualités à 35 % des revenus nets, assurance comprise.",
  ),
  split: l("Where the money goes", "Où va l'argent"),
  f1: l(
    "Payment = amount × r ÷ (1 − (1 + r)^−n), with r the yearly rate ÷ 12 and n the number of months. Each month, interest = remaining × r; the rest of the payment pays back the principal.",
    "Mensualité = montant × r ÷ (1 − (1 + r)^−n), avec r le taux annuel ÷ 12 et n le nombre de mois. Chaque mois, intérêts = restant dû × r ; le reste de la mensualité rembourse le capital.",
  ),
  f2: l(
    "Insurance = amount × insurance rate ÷ 12, the same every month. This is not the APR (TAEG), which also spreads the fees over time.",
    "Assurance = montant × taux d'assurance ÷ 12, identique chaque mois. Ce n'est pas le TAEG, qui étale aussi les frais dans le temps.",
  ),
  f3: l(
    "Borrowable amount = budget ÷ (r ÷ (1 − (1 + r)^−n) + insurance rate ÷ 12).",
    "Montant empruntable = budget ÷ (r ÷ (1 − (1 + r)^−n) + taux d'assurance ÷ 12).",
  ),
};

type Mode = "payment" | "borrow";

export default function Loan() {
  const cur = useCurrency();
  const mode = useToolState<Mode>("mode", "payment");
  const amount = useToolState("amount", 200000);
  const rate = useToolState("rate", 3.5);
  const duration = useToolState("duration", 20);
  const unit = useToolState<"years" | "months">("unit", "years");
  const insurance = useToolState("insurance", 0.3);
  const fees = useToolState("fees", 0);
  const budget = useToolState("budget", 1200);
  const income = useToolState("income", 0);
  const [open, setOpen] = useState<number | null>(null);

  const months = Math.round(unit.value === "years" ? duration.value * 12 : duration.value);
  const m = (n: number) => money(n, cur.code);
  const sym = currencySymbol(cur.code);

  const common = (
    <>
      <NumberField
        label={tr(T.rate)}
        value={rate.value}
        min={0}
        max={100}
        step="any"
        suffix="%"
        onChange={(v) => {
          rate.value = v;
        }}
      />
      <div class="loan-duration">
        <NumberField
          label={tr(T.duration)}
          value={duration.value}
          min={1}
          max={unit.value === "years" ? 100 : 1200}
          step="any"
          onChange={(v) => {
            duration.value = v;
          }}
        />
        <Select<"years" | "months">
          label={tr(T.unit)}
          value={unit.value}
          onChange={(v) => {
            duration.value =
              v === "months"
                ? Math.round(duration.value * 12)
                : Math.max(1, Math.round(duration.value / 12));
            unit.value = v;
          }}
          options={[
            { value: "years", label: tr(T.years) },
            { value: "months", label: tr(T.months) },
          ]}
        />
      </div>
      <NumberField
        label={tr(T.insurance)}
        hint={tr(T.insuranceHint)}
        value={insurance.value}
        min={0}
        max={10}
        step="any"
        suffix="%"
        onChange={(v) => {
          insurance.value = v;
        }}
      />
    </>
  );

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          label={tr(T.mode)}
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "payment", label: tr(T.payment) },
            { value: "borrow", label: tr(T.borrow) },
          ]}
        />
      </div>
      {mode.value === "payment" ? paymentMode() : borrowMode()}
    </>
  );

  // Plain render helpers (not components): the inputs keep their focus between renders.
  function paymentMode() {
    const r = loan({
      principal: amount.value,
      rate: rate.value,
      months,
      insuranceRate: insurance.value,
      fees: fees.value,
    });
    const parts = r
      ? [
          { k: "principal", label: tr(T.principalCol), v: amount.value },
          { k: "interest", label: tr(T.interestCol), v: r.totalInterest },
          {
            k: "other",
            label: `${tr(T.insuranceCol)} + ${tr(T.fees)}`,
            v: r.totalInsurance + fees.value,
          },
        ]
      : [];
    const whole = parts.reduce((s, p) => s + p.v, 0) || 1;
    return (
      <>
        <div class="grid-3">
          <NumberField
            label={tr(T.amount)}
            value={amount.value}
            min={0}
            step="any"
            suffix={sym}
            onChange={(v) => {
              amount.value = v;
            }}
          />
          {common}
          <NumberField
            label={tr(T.fees)}
            hint={tr(T.feesHint)}
            value={fees.value}
            min={0}
            step="any"
            suffix={sym}
            onChange={(v) => {
              fees.value = v;
            }}
          />
          <CurrencySelect cur={cur} />
        </div>
        {!r ? (
          <ErrorNote error={tr(T.bad)} />
        ) : (
          <>
            <Result
              label={`${tr(T.monthly)} (${tr(T.withIns)})`}
              value={m(r.total)}
              copy={plain(r.total)}
              note={`${fmt(months)} × ${m(r.total)}`}
            />
            <Stats
              items={[
                { label: tr(T.without), value: m(r.payment) },
                { label: tr(T.insMonthly), value: m(r.insurance) },
                { label: tr(T.interest), value: m(r.totalInterest) },
                { label: tr(T.insTotal), value: m(r.totalInsurance) },
                { label: `${tr(T.cost)} (${tr(T.costHint)})`, value: m(r.totalCost) },
                { label: tr(T.paid), value: m(r.totalPaid) },
              ]}
            />
            <div class="stack">
              <span class="muted small">{tr(T.split)}</span>
              <div class="loan-bar" aria-hidden="true">
                {parts.map((p) => (
                  <span
                    key={p.k}
                    class={`loan-bar-${p.k}`}
                    style={{ width: `${(p.v / whole) * 100}%` }}
                  />
                ))}
              </div>
              <div class="loan-legend small">
                {parts.map((p) => (
                  <span key={p.k}>
                    <i class={`loan-bar-${p.k}`} /> {p.label} · {m(p.v)} (
                    {pct((p.v / whole) * 100, 1)})
                  </span>
                ))}
              </div>
            </div>
            <Panel title={tr(T.schedule)}>
              <p class="muted small">{tr(T.scheduleHint)}</p>
              <div class="table-wrap loan-table-wrap">
                <table class="table loan-table">
                  <thead>
                    <tr>
                      <th>{tr(T.year)}</th>
                      <th class="num">{tr(T.paidCol)}</th>
                      <th class="num">{tr(T.interestCol)}</th>
                      <th class="num">{tr(T.principalCol)}</th>
                      <th class="num">{tr(T.insuranceCol)}</th>
                      <th class="num">{tr(T.balance)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.years.map((y) => (
                      <Fragment key={y.year}>
                        <tr class={open === y.year ? "loan-open" : ""}>
                          <td>
                            <button
                              type="button"
                              class="loan-toggle"
                              aria-expanded={open === y.year}
                              onClick={() => setOpen(open === y.year ? null : y.year)}
                            >
                              {open === y.year ? "▾" : "▸"} {fmt(y.year)}
                            </button>
                          </td>
                          <td class="num">{m(y.payment + y.insurance)}</td>
                          <td class="num">{m(y.interest)}</td>
                          <td class="num">{m(y.principal)}</td>
                          <td class="num">{m(y.insurance)}</td>
                          <td class="num">{m(y.balance)}</td>
                        </tr>
                        {open === y.year &&
                          y.months.map((x) => (
                            <tr key={`m${x.month}`} class="loan-month">
                              <td class="muted">
                                {tr(T.month)} {fmt(x.month)}
                              </td>
                              <td class="num">{m(x.payment + x.insurance)}</td>
                              <td class="num">{m(x.interest)}</td>
                              <td class="num">{m(x.principal)}</td>
                              <td class="num">{m(x.insurance)}</td>
                              <td class="num">{m(x.balance)}</td>
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
        <Formula>
          <p>{tr(T.f1)}</p>
          <p>{tr(T.f2)}</p>
        </Formula>
      </>
    );
  }

  function borrowMode() {
    const cap = borrowingCapacity(budget.value, rate.value, months, insurance.value);
    const suggested = (income.value * MAX_DEBT_RATIO) / 100;
    const r =
      cap === null
        ? null
        : loan({
            principal: cap,
            rate: rate.value,
            months,
            insuranceRate: insurance.value,
            fees: 0,
          });
    return (
      <>
        <div class="grid-3">
          <NumberField
            label={tr(T.budget)}
            hint={tr(T.budgetHint)}
            value={budget.value}
            min={0}
            step="any"
            suffix={sym}
            onChange={(v) => {
              budget.value = v;
            }}
          />
          {common}
          <NumberField
            label={tr(T.income)}
            value={income.value}
            min={0}
            step="any"
            suffix={sym}
            onChange={(v) => {
              income.value = v;
            }}
          />
          <CurrencySelect cur={cur} />
        </div>
        {income.value > 0 && (
          <div class="row">
            <Button
              size="sm"
              onClick={() => {
                budget.value = Math.floor(suggested);
              }}
            >
              {tr(T.useRatio).replace("{p}", pct(MAX_DEBT_RATIO)).replace("{v}", m(suggested))}
            </Button>
          </div>
        )}
        {cap === null || !r ? (
          <ErrorNote error={tr(T.bad)} />
        ) : (
          <>
            <Result label={tr(T.canBorrow)} value={m(cap)} copy={plain(cap, 0)} />
            <Stats
              items={[
                { label: tr(T.without), value: m(r.payment) },
                { label: tr(T.insMonthly), value: m(r.insurance) },
                { label: tr(T.interest), value: m(r.totalInterest) },
                { label: tr(T.paid), value: m(r.totalPaid) },
              ]}
            />
          </>
        )}
        <Formula>
          <p>{tr(T.f3)}</p>
          <p>{tr(T.ratioNote)}</p>
        </Formula>
      </>
    );
  }
}
