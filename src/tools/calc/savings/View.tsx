import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { ErrorNote, Stats, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import {
  CurrencySelect,
  currencySymbol,
  Formula,
  locale,
  money,
  num,
  plain,
  Result,
  useCurrency,
} from "../_ui";
import { type Compounding, doublingYears, savings, type YearPoint } from "./logic";

const T = {
  initial: l("Starting amount", "Montant de départ"),
  monthly: l("Added every month", "Versement mensuel"),
  rate: l("Yearly interest rate", "Taux d'intérêt annuel"),
  years: l("Years", "Années"),
  compounding: l("Interest added", "Intérêts ajoutés"),
  yearly: l("Once a year", "Une fois par an"),
  quarterly: l("Every quarter", "Chaque trimestre"),
  monthlyC: l("Every month", "Chaque mois"),
  daily: l("Every day", "Chaque jour"),
  start: l("Deposit at the start of each month", "Verser en début de mois"),
  inflation: l("Inflation (yearly)", "Inflation (annuelle)"),
  inflationHint: l("0 to ignore", "0 pour l'ignorer"),
  final: l("Final amount", "Montant final"),
  after: l("after {n} years", "au bout de {n} ans"),
  contributed: l("You put in", "Tu as versé"),
  interest: l("Interest earned", "Intérêts gagnés"),
  real: l("In today's money", "En argent d'aujourd'hui"),
  doubling: l("Doubles in", "Double en"),
  yearsShort: l("years", "ans"),
  bad: l(
    "Check the duration (0 to 100 years) and the rates.",
    "Vérifie la durée (0 à 100 ans) et les taux.",
  ),
  table: l("Year by year", "Année par année"),
  year: l("Year", "Année"),
  balance: l("Balance", "Solde"),
  chart: l("Growth of the savings", "Évolution de l'épargne"),
  f1: l(
    "Each month: balance × (1 + monthly rate), then the deposit is added (before, if you deposit at the start of the month).",
    "Chaque mois : solde × (1 + taux mensuel), puis le versement s'ajoute (avant, si tu verses en début de mois).",
  ),
  f2: l(
    "Monthly rate = (1 + yearly rate ÷ m)^(m ÷ 12) − 1, where m is how often interest is added per year. Today's money = amount ÷ (1 + inflation)^years.",
    "Taux mensuel = (1 + taux annuel ÷ m)^(m ÷ 12) − 1, où m est le nombre d'ajouts d'intérêts par an. Argent d'aujourd'hui = montant ÷ (1 + inflation)^années.",
  ),
  f3: l(
    "Taxes and fees are not included.",
    "Les impôts, prélèvements sociaux et frais ne sont pas inclus.",
  ),
};

export default function Savings() {
  const cur = useCurrency();
  const initial = useToolState("initial", 1000);
  const monthly = useToolState("monthly", 100);
  const rate = useToolState("rate", 3);
  const years = useToolState("years", 10);
  const comp = useToolState<Compounding>("compounding", "yearly");
  const start = useToolState("startOfMonth", false);
  const inflation = useToolState("inflation", 0);

  const r = savings({
    initial: initial.value,
    monthly: monthly.value,
    rate: rate.value,
    years: years.value,
    compounding: comp.value,
    startOfMonth: start.value,
    inflation: inflation.value,
  });
  const m = (n: number) => money(n, cur.code);
  const sym = currencySymbol(cur.code);
  const dbl = doublingYears(rate.value);

  return (
    <>
      <div class="grid-3">
        <NumberField
          label={tr(T.initial)}
          value={initial.value}
          min={0}
          step="any"
          suffix={sym}
          onChange={(v) => {
            initial.value = v;
          }}
        />
        <NumberField
          label={tr(T.monthly)}
          value={monthly.value}
          min={0}
          step="any"
          suffix={sym}
          onChange={(v) => {
            monthly.value = v;
          }}
        />
        <NumberField
          label={tr(T.rate)}
          value={rate.value}
          min={-50}
          max={100}
          step="any"
          suffix="%"
          onChange={(v) => {
            rate.value = v;
          }}
        />
        <NumberField
          label={tr(T.years)}
          value={years.value}
          min={0}
          max={100}
          step="any"
          onChange={(v) => {
            years.value = v;
          }}
        />
        <Select<Compounding>
          label={tr(T.compounding)}
          value={comp.value}
          onChange={(v) => {
            comp.value = v;
          }}
          options={[
            { value: "yearly", label: tr(T.yearly) },
            { value: "quarterly", label: tr(T.quarterly) },
            { value: "monthly", label: tr(T.monthlyC) },
            { value: "daily", label: tr(T.daily) },
          ]}
        />
        <NumberField
          label={tr(T.inflation)}
          hint={tr(T.inflationHint)}
          value={inflation.value}
          min={-50}
          max={100}
          step="any"
          suffix="%"
          onChange={(v) => {
            inflation.value = v;
          }}
        />
        <CurrencySelect cur={cur} />
      </div>
      <Toggle
        checked={start.value}
        onChange={(v) => {
          start.value = v;
        }}
        label={tr(T.start)}
      />

      {!r ? (
        <ErrorNote error={tr(T.bad)} />
      ) : (
        <>
          <Result
            label={tr(T.final)}
            value={m(r.final)}
            copy={plain(r.final)}
            note={tr(T.after).replace("{n}", num(years.value, 2))}
          />
          <Stats
            items={[
              { label: tr(T.contributed), value: m(r.contributed) },
              { label: tr(T.interest), value: m(r.interest) },
              ...(inflation.value !== 0 ? [{ label: tr(T.real), value: m(r.real) }] : []),
              ...(dbl !== null
                ? [{ label: tr(T.doubling), value: `${num(dbl, 1)} ${tr(T.yearsShort)}` }]
                : []),
            ]}
          />
          {r.points.length > 1 && (
            <Chart points={r.points} showReal={inflation.value !== 0} code={cur.code} />
          )}
          <details class="savings-details">
            <summary>{tr(T.table)}</summary>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{tr(T.year)}</th>
                    <th class="num">{tr(T.contributed)}</th>
                    <th class="num">{tr(T.interest)}</th>
                    <th class="num">{tr(T.balance)}</th>
                    {inflation.value !== 0 && <th class="num">{tr(T.real)}</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.points.slice(1).map((p) => (
                    <tr key={p.year}>
                      <td>{num(p.year, 2)}</td>
                      <td class="num">{m(p.contributed)}</td>
                      <td class="num">{m(p.interest)}</td>
                      <td class="num">{m(p.balance)}</td>
                      {inflation.value !== 0 && <td class="num">{m(p.real)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
        <p>{tr(T.f3)}</p>
      </Formula>
    </>
  );
}

/** Stacked areas: what was put in (bottom) and the interest on top; a dashed line for today's money. */
function Chart({
  points,
  showReal,
  code,
}: {
  points: YearPoint[];
  showReal: boolean;
  code: string;
}) {
  const W = 900;
  const H = 300;
  const pad = { l: 64, r: 12, t: 12, b: 26 };
  const maxX = points[points.length - 1]?.year || 1;
  const maxY = Math.max(1, ...points.map((p) => Math.max(p.balance, p.contributed)));
  const x = (v: number) => pad.l + (v / maxX) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (Math.max(0, v) / maxY) * (H - pad.t - pad.b);
  const line = (f: (p: YearPoint) => number) =>
    points.map((p) => `${x(p.year)},${y(f(p))}`).join(" ");
  const area = (f: (p: YearPoint) => number, g: (p: YearPoint) => number) =>
    `${line(f)} ${[...points]
      .reverse()
      .map((p) => `${x(p.year)},${y(g(p))}`)
      .join(" ")}`;
  const compact = (v: number) => {
    try {
      return new Intl.NumberFormat(locale(), {
        style: "currency",
        currency: code,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v);
    } catch {
      return fmt(v, { notation: "compact" });
    }
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);
  const step = Math.max(1, Math.ceil(maxX / 8));
  const xt: number[] = [];
  for (let v = 0; v <= maxX; v += step) xt.push(v);
  const last = points[points.length - 1] as YearPoint;
  const label = `${tr(T.chart)}: ${money(last.contributed, code)} → ${money(last.balance, code)}`;

  return (
    <figure class="savings-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line class="savings-grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text class="savings-axis" x={pad.l - 6} y={y(t) + 4} text-anchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={v} class="savings-axis" x={x(v)} y={H - 8} text-anchor="middle">
            {fmt(v)}
          </text>
        ))}
        <polygon
          class="savings-interest"
          points={area(
            (p) => p.balance,
            (p) => p.contributed,
          )}
        />
        <polygon
          class="savings-contrib"
          points={area(
            (p) => p.contributed,
            () => 0,
          )}
        />
        <polyline class="savings-line" points={line((p) => p.balance)} />
        {showReal && <polyline class="savings-real" points={line((p) => p.real)} />}
      </svg>
      <figcaption class="row small muted">
        <span>
          <i class="savings-key savings-contrib" /> {tr(T.contributed)}
        </span>
        <span>
          <i class="savings-key savings-interest" /> {tr(T.interest)}
        </span>
        {showReal && (
          <span>
            <i class="savings-key savings-key-real" /> {tr(T.real)}
          </span>
        )}
        <span class="spacer" />
        <span>{tr(T.years)}</span>
      </figcaption>
    </figure>
  );
}
