import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { ErrorNote, Segmented } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { CurrencySelect, Formula, money, num, pct, plain, Result, useCurrency } from "../_ui";
import {
  type Amounts,
  convertPay,
  FULL_TIME_MONTHLY_HOURS,
  NON_DEDUCTIBLE,
  type PayPeriod,
  type Period,
  PRESETS,
  type Status,
  salary,
} from "./logic";

const T = {
  mode: l("Calculator", "Calculateur", "Rechner"),
  france: l("France: gross ↔ net", "France : brut ↔ net", "Frankreich: brutto ↔ netto"),
  any: l(
    "Any country: hourly ↔ yearly",
    "Tout pays : horaire ↔ annuel",
    "Jedes Land: Stundenlohn ↔ Jahresgehalt",
  ),
  estimate: l("Estimate", "Estimation", "Schätzung"),
  warning: l(
    "This is an estimate with average contribution rates, not a payslip. Real contributions depend on the salary level, the company, the collective agreement, the mutual insurance, overtime, bonuses… The rates used are shown below and can be changed.",
    "Ceci est une estimation avec des taux de cotisations moyens, pas une fiche de paie. Les vraies cotisations dépendent du niveau de salaire, de l'entreprise, de la convention collective, de la mutuelle, des heures sup, des primes… Les taux utilisés sont affichés ci-dessous et modifiables.",
    "Nur für Gehälter in Frankreich (französische Sozialabgaben und Steuern, nicht die deutschen): eine Schätzung mit durchschnittlichen Beitragssätzen, keine Gehaltsabrechnung. Die echten Abgaben hängen von Gehaltshöhe, Unternehmen, Tarifvertrag, Zusatzkrankenversicherung, Überstunden, Prämien … ab. Die verwendeten Sätze stehen unten und lassen sich ändern.",
  ),
  amount: l("Amount", "Montant", "Betrag"),
  kind: l("This amount is", "Ce montant est", "Dieser Betrag ist"),
  gross: l("Gross", "Brut", "Brutto"),
  net: l("Net", "Net", "Netto"),
  period: l("Per", "Par", "Pro"),
  hour: l("Hour", "Heure", "Stunde"),
  day: l("Day", "Jour", "Tag"),
  week: l("Week", "Semaine", "Woche"),
  month: l("Month", "Mois", "Monat"),
  year: l("Year", "An", "Jahr"),
  status: l("Status", "Statut", "Status"),
  nonCadre: l(
    "Private sector, non-executive (non-cadre)",
    "Salarié non-cadre (privé)",
    "Angestellte(r) ohne Führungsstatus (non-cadre, Privatwirtschaft)",
  ),
  cadre: l(
    "Private sector, executive (cadre)",
    "Salarié cadre (privé)",
    "Leitende(r) Angestellte(r) (cadre, Privatwirtschaft)",
  ),
  public: l(
    "Civil servant (fonction publique)",
    "Fonction publique",
    "Öffentlicher Dienst (fonction publique)",
  ),
  portage: l(
    "Umbrella company (portage salarial)",
    "Portage salarial",
    "Lohnträgerschaft (portage salarial)",
  ),
  employeeRate: l("Employee contributions", "Cotisations salariales", "Arbeitnehmerbeiträge"),
  feeRate: l(
    "Management fee (portage)",
    "Frais de gestion (portage)",
    "Verwaltungsgebühr (portage)",
  ),
  partTime: l("Working time", "Temps de travail", "Arbeitszeit"),
  partTimeHint: l("100 % = 35 h a week", "100 % = 35 h par semaine", "100 % = 35 Std. pro Woche"),
  months: l("Months paid per year", "Mois payés par an", "Bezahlte Monate pro Jahr"),
  months12: l("12 months", "12 mois", "12 Monate"),
  months13: l("13 months (13th month)", "13 mois (13e mois)", "13 Monate (13. Monatsgehalt)"),
  months14: l("14 months", "14 mois", "14 Monate"),
  tax: l(
    "Withholding tax rate",
    "Taux de prélèvement à la source",
    "Quellensteuersatz (prélèvement à la source)",
  ),
  taxHint: l(
    "On your tax notice or payslip; 0 if not taxable",
    "Sur ton avis d'impôt ou ta fiche de paie ; 0 si non imposable",
    "Steht auf deinem Steuerbescheid oder deiner Gehaltsabrechnung; 0, wenn nicht steuerpflichtig",
  ),
  perHour: l("Hourly", "Horaire", "Pro Stunde"),
  perMonth: l("Monthly", "Mensuel", "Pro Monat"),
  perYear: l("Yearly", "Annuel", "Pro Jahr"),
  taxable: l("Taxable net", "Net imposable", "Steuerpflichtiges Netto"),
  afterTax: l("Net after tax", "Net après impôt", "Netto nach Steuern"),
  cost: l("Employer cost", "Coût employeur", "Arbeitgeberkosten"),
  revenue: l(
    "Revenue to bill (excl. VAT)",
    "Chiffre d'affaires à facturer (HT)",
    "Zu fakturierender Umsatz (netto)",
  ),
  bad: l(
    "These settings give no result (working time or rate out of range).",
    "Ces réglages ne donnent aucun résultat (temps de travail ou taux hors limites).",
    "Diese Einstellungen ergeben kein Ergebnis (Arbeitszeit oder Satz außerhalb des Bereichs).",
  ),
  netMonthly: l("Net per month", "Net mensuel", "Netto pro Monat"),
  grossMonthly: l("Gross per month", "Brut mensuel", "Brutto pro Monat"),
  afterTaxMonthly: l(
    "Net after tax per month",
    "Net après impôt par mois",
    "Netto nach Steuern pro Monat",
  ),
  f1: l(
    "Net = gross × (1 − employee rate). Gross = net ÷ (1 − employee rate).",
    "Net = brut × (1 − taux salarial). Brut = net ÷ (1 − taux salarial).",
    "Netto = brutto × (1 − Arbeitnehmersatz). Brutto = netto ÷ (1 − Arbeitnehmersatz).",
  ),
  f2: l(
    "Hourly = monthly ÷ {h} h ({p} of 35 h × 52 weeks ÷ 12). Yearly = monthly × months paid.",
    "Horaire = mensuel ÷ {h} h ({p} de 35 h × 52 semaines ÷ 12). Annuel = mensuel × mois payés.",
    "Pro Stunde = pro Monat ÷ {h} Std. ({p} von 35 Std. × 52 Wochen ÷ 12). Pro Jahr = pro Monat × bezahlte Monate.",
  ),
  f3: l(
    "Taxable net ≈ net + 2.9 % non-deductible CSG/CRDS on 98.25 % of gross; net after tax = net − taxable net × withholding rate.",
    "Net imposable ≈ net + 2,9 % de CSG/CRDS non déductibles sur 98,25 % du brut ; net après impôt = net − net imposable × taux de prélèvement.",
    "Steuerpflichtiges Netto ≈ netto + 2,9 % nicht abziehbare CSG/CRDS auf 98,25 % des Bruttos; netto nach Steuern = netto − steuerpflichtiges Netto × Quellensteuersatz.",
  ),
  f4: l(
    "Rates used: employee {e}; employer {r} (before the reductions on low wages, so the real employer cost can be much lower near the minimum wage).",
    "Taux utilisés : salarial {e} ; patronal {r} (avant les allègements sur les bas salaires : le vrai coût employeur peut être bien plus bas près du SMIC).",
    "Verwendete Sätze: Arbeitnehmer {e}; Arbeitgeber {r} (vor den Entlastungen für niedrige Löhne, die echten Arbeitgeberkosten können daher nahe am Mindestlohn SMIC deutlich niedriger sein).",
  ),
  f5: l(
    "Portage: revenue = employer cost ÷ (1 − management fee). Net is then roughly half the revenue.",
    "Portage : chiffre d'affaires = coût employeur ÷ (1 − frais de gestion). Le net vaut alors à peu près la moitié du CA.",
    "Portage: Umsatz = Arbeitgeberkosten ÷ (1 − Verwaltungsgebühr). Das Netto ist dann etwa die Hälfte des Umsatzes.",
  ),
  hoursPerWeek: l("Hours per week", "Heures par semaine", "Stunden pro Woche"),
  daysPerWeek: l("Days per week", "Jours par semaine", "Tage pro Woche"),
  weeksPerYear: l("Paid weeks per year", "Semaines payées par an", "Bezahlte Wochen pro Jahr"),
  weeksHint: l(
    "52 when holidays are paid",
    "52 si les congés sont payés",
    "52, wenn der Urlaub bezahlt ist",
  ),
  anyNote: l(
    "Same pay, different periods: before or after tax, whatever you type. Yearly = hourly × hours per week × weeks; monthly = yearly ÷ 12.",
    "La même paie sur différentes périodes, brute ou nette selon ce que tu tapes. Annuel = horaire × heures par semaine × semaines ; mensuel = annuel ÷ 12.",
    "Derselbe Lohn über verschiedene Zeiträume, brutto oder netto, je nachdem, was du eingibst. Pro Jahr = Stundenlohn × Stunden pro Woche × Wochen; pro Monat = pro Jahr ÷ 12.",
  ),
};

type Mode = "france" | "any";

export default function Salary() {
  const mode = useToolState<Mode>("mode", "france");
  return (
    <>
      <Segmented<Mode>
        label={tr(T.mode)}
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "france", label: tr(T.france) },
          { value: "any", label: tr(T.any) },
        ]}
      />
      {mode.value === "france" ? <France /> : <AnyCountry />}
    </>
  );
}

function France() {
  const amount = useToolState("amount", 2500);
  const kind = useToolState<"gross" | "net">("kind", "gross");
  const period = useToolState<Period>("period", "month");
  const status = useToolState<Status>("status", "nonCadre");
  const employee = useToolState("employee", PRESETS.nonCadre.employee);
  const fee = useToolState("fee", PRESETS.portage.fee);
  const partTime = useToolState("partTime", 100);
  const months = useToolState("months", "12");
  const tax = useToolState("tax", 0);

  const preset = PRESETS[status.value] ?? PRESETS.nonCadre;
  const rates = {
    ...preset,
    employee: employee.value,
    fee: status.value === "portage" ? fee.value : 0,
  };
  const r = salary({
    amount: amount.value,
    period: period.value,
    kind: kind.value,
    rates,
    partTime: partTime.value,
    monthsPerYear: Number(months.value) || 12,
    taxRate: tax.value,
  });
  const eur = (n: number) => money(n, "EUR");
  const row = (label: string, a: Amounts, strong = false) => (
    <tr key={label} class={strong ? "salary-strong" : ""}>
      <th scope="row">{label}</th>
      <td class="num">{money(a.hour, "EUR", 2)}</td>
      <td class="num">{eur(a.month)}</td>
      <td class="num">{eur(a.year)}</td>
    </tr>
  );

  return (
    <>
      <p class="salary-warning" role="note">
        <strong>{tr(T.estimate)}</strong> {tr(T.warning)}
      </p>
      <div class="grid-3">
        <NumberField
          label={tr(T.amount)}
          value={amount.value}
          min={0}
          step="any"
          suffix="€"
          onChange={(v) => {
            amount.value = v;
          }}
        />
        <Select<"gross" | "net">
          label={tr(T.kind)}
          value={kind.value}
          onChange={(v) => {
            kind.value = v;
          }}
          options={[
            { value: "gross", label: tr(T.gross) },
            { value: "net", label: tr(T.net) },
          ]}
        />
        <Select<Period>
          label={tr(T.period)}
          value={period.value}
          onChange={(v) => {
            period.value = v;
          }}
          options={[
            { value: "hour", label: tr(T.hour) },
            { value: "month", label: tr(T.month) },
            { value: "year", label: tr(T.year) },
          ]}
        />
        <Select<Status>
          label={tr(T.status)}
          value={status.value}
          onChange={(v) => {
            status.value = v;
            employee.value = PRESETS[v].employee;
          }}
          options={(["nonCadre", "cadre", "public", "portage"] as const).map((s) => ({
            value: s,
            label: tr(T[s]),
          }))}
        />
        <NumberField
          label={tr(T.employeeRate)}
          value={employee.value}
          min={0}
          max={90}
          step="any"
          suffix="%"
          onChange={(v) => {
            employee.value = v;
          }}
        />
        {status.value === "portage" && (
          <NumberField
            label={tr(T.feeRate)}
            value={fee.value}
            min={0}
            max={50}
            step="any"
            suffix="%"
            onChange={(v) => {
              fee.value = v;
            }}
          />
        )}
        <NumberField
          label={tr(T.partTime)}
          hint={tr(T.partTimeHint)}
          value={partTime.value}
          min={1}
          max={100}
          step="any"
          suffix="%"
          onChange={(v) => {
            partTime.value = v;
          }}
        />
        <Select
          label={tr(T.months)}
          value={months.value}
          onChange={(v) => {
            months.value = v;
          }}
          options={[
            { value: "12", label: tr(T.months12) },
            { value: "13", label: tr(T.months13) },
            { value: "14", label: tr(T.months14) },
          ]}
        />
        <NumberField
          label={tr(T.tax)}
          hint={tr(T.taxHint)}
          value={tax.value}
          min={0}
          max={60}
          step="any"
          suffix="%"
          onChange={(v) => {
            tax.value = v;
          }}
        />
      </div>

      {!r ? (
        <ErrorNote error={tr(T.bad)} />
      ) : (
        <>
          <div class="grid-3">
            <Result
              label={tr(T.grossMonthly)}
              value={eur(r.gross.month)}
              copy={plain(r.gross.month)}
            />
            <Result label={tr(T.netMonthly)} value={eur(r.net.month)} copy={plain(r.net.month)} />
            <Result
              label={tr(T.afterTaxMonthly)}
              value={eur(r.afterTax.month)}
              copy={plain(r.afterTax.month)}
            />
          </div>
          <div class="table-wrap">
            <table class="table salary-table">
              <thead>
                <tr>
                  <th />
                  <th class="num">{tr(T.perHour)}</th>
                  <th class="num">{tr(T.perMonth)}</th>
                  <th class="num">{tr(T.perYear)}</th>
                </tr>
              </thead>
              <tbody>
                {r.revenue && row(tr(T.revenue), r.revenue)}
                {r.employerCost && row(tr(T.cost), r.employerCost)}
                {row(tr(T.gross), r.gross, kind.value === "gross")}
                {row(tr(T.net), r.net, kind.value === "net")}
                {row(tr(T.taxable), r.taxableNet)}
                {row(tr(T.afterTax), r.afterTax, true)}
              </tbody>
            </table>
          </div>
          <Formula>
            <p>{tr(T.f1)}</p>
            <p>{tr(T.f2).replace("{h}", num(r.hours, 2)).replace("{p}", pct(partTime.value))}</p>
            <p>{tr(T.f3)}</p>
            <p>
              {tr(T.f4)
                .replace("{e}", pct(employee.value))
                .replace("{r}", preset.employer === null ? "—" : pct(preset.employer))}
            </p>
            {status.value === "portage" && <p>{tr(T.f5)}</p>}
            <p class="muted">
              {num(FULL_TIME_MONTHLY_HOURS, 2)} h · CSG/CRDS {pct(NON_DEDUCTIBLE * 100, 3)}
            </p>
          </Formula>
        </>
      )}
    </>
  );
}

const PERIODS: PayPeriod[] = ["hour", "day", "week", "month", "year"];

function AnyCountry() {
  const cur = useCurrency();
  const amount = useToolState("payAmount", 20);
  const from = useToolState<PayPeriod>("payFrom", "hour");
  const hours = useToolState("hoursPerWeek", 40);
  const days = useToolState("daysPerWeek", 5);
  const weeks = useToolState("weeksPerYear", 52);
  const r = convertPay(amount.value, from.value, {
    hoursPerWeek: hours.value,
    daysPerWeek: days.value,
    weeksPerYear: weeks.value,
  });

  return (
    <>
      <div class="grid-3">
        <NumberField
          label={tr(T.amount)}
          value={amount.value}
          min={0}
          step="any"
          onChange={(v) => {
            amount.value = v;
          }}
        />
        <Select<PayPeriod>
          label={tr(T.period)}
          value={from.value}
          onChange={(v) => {
            from.value = v;
          }}
          options={PERIODS.map((p) => ({ value: p, label: tr(T[p]) }))}
        />
        <CurrencySelect cur={cur} />
        <NumberField
          label={tr(T.hoursPerWeek)}
          value={hours.value}
          min={1}
          max={168}
          step="any"
          onChange={(v) => {
            hours.value = v;
          }}
        />
        <NumberField
          label={tr(T.daysPerWeek)}
          value={days.value}
          min={1}
          max={7}
          step="any"
          onChange={(v) => {
            days.value = v;
          }}
        />
        <NumberField
          label={tr(T.weeksPerYear)}
          hint={tr(T.weeksHint)}
          value={weeks.value}
          min={1}
          max={53}
          step="any"
          onChange={(v) => {
            weeks.value = v;
          }}
        />
      </div>
      {r && (
        <div class="salary-periods">
          {PERIODS.map((p) => (
            <Result key={p} label={tr(T[p])} value={money(r[p], cur.code)} copy={plain(r[p])} />
          ))}
        </div>
      )}
      <Formula>
        <p>{tr(T.anyNote)}</p>
      </Formula>
    </>
  );
}
