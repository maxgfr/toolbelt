import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Field, Panel, Stats } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { dayNumber, parseYmd, weekday, type Ymd, ymdString } from "../_shared";
import { Formula, locale, Result } from "../_ui";
import { type AgeUnit, age, dateAtAge, nextBirthday, nextMilestones } from "./logic";

const T = {
  birth: l("Date of birth", "Date de naissance", "Geburtsdatum"),
  on: l("Age on", "Âge au", "Alter am"),
  today: l("Today", "Aujourd'hui", "Heute"),
  bad: l(
    "Pick a valid date of birth.",
    "Choisis une date de naissance valide.",
    "Wähl ein gültiges Geburtsdatum.",
  ),
  badOn: l("Pick a valid date.", "Choisis une date valide.", "Wähl ein gültiges Datum."),
  before: l(
    "This date is before the birth.",
    "Cette date est avant la naissance.",
    "Dieses Datum liegt vor der Geburt.",
  ),
  age: l("Age", "Âge", "Alter"),
  bornOn: l("Born on a {d}", "Né(e) un {d}", "Geboren an einem {d}"),
  next: l("Next birthday", "Prochain anniversaire", "Nächster Geburtstag"),
  happy: l(
    "It's today! Happy birthday 🎂",
    "C'est aujourd'hui ! Joyeux anniversaire 🎂",
    "Heute! Alles Gute zum Geburtstag 🎂",
  ),
  turning: l("turning {n}", "{n} ans", "du wirst {n}"),
  months: l("Months", "Mois", "Monate"),
  weeks: l("Weeks", "Semaines", "Wochen"),
  days: l("Days", "Jours", "Tage"),
  hours: l("Hours", "Heures", "Stunden"),
  when: l("When will I be…", "Quand aurai-je…", "Wann bin ich …"),
  amount: l("Number", "Nombre", "Zahl"),
  unit: l("Unit", "Unité", "Einheit"),
  yearsU: l("years old", "ans", "Jahre alt"),
  monthsU: l("months old", "mois", "Monate alt"),
  weeksU: l("weeks old", "semaines", "Wochen alt"),
  daysU: l("days old", "jours", "Tage alt"),
  badN: l("Type a whole number.", "Tape un nombre entier.", "Gib eine ganze Zahl ein."),
  milestones: l(
    "Next round numbers of days",
    "Prochains nombres ronds de jours",
    "Nächste runde Tageszahlen",
  ),
  f1: l(
    "Months are counted from the birthday's day each month (a 31st counts on the last day of shorter months); 29 February birthdays fall on 28 February in common years.",
    "Les mois sont comptés du jour de naissance au même jour du mois suivant (un 31 compte le dernier jour des mois plus courts) ; un anniversaire le 29 février tombe le 28 février les années non bissextiles.",
    "Monate zählen jeweils vom Geburtstag bis zum selben Tag im Folgemonat (ein 31. zählt am letzten Tag kürzerer Monate); ein Geburtstag am 29. Februar fällt in Nicht-Schaltjahren auf den 28. Februar.",
  ),
  f2: l(
    "Hours = days × 24 (time of birth not taken into account).",
    "Heures = jours × 24 (l'heure de naissance n'est pas prise en compte).",
    "Stunden = Tage × 24 (die Geburtszeit wird nicht berücksichtigt).",
  ),
};

/** "in 25 days" / "dans 25 jours" / "in 25 Tagen", or "… ago" when negative. */
function relDays(n: number): string {
  try {
    return new Intl.RelativeTimeFormat(locale(), { numeric: "always" }).format(n, "day");
  } catch {
    return `${fmt(n)} d`;
  }
}

function today(): string {
  const d = new Date();
  return ymdString({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
}

function longDate(d: Ymd): string {
  try {
    return new Intl.DateTimeFormat(locale(), { dateStyle: "full", timeZone: "UTC" }).format(
      Date.UTC(d.year, d.month - 1, d.day),
    );
  } catch {
    return ymdString(d);
  }
}

function weekdayName(d: Ymd): string {
  try {
    return new Intl.DateTimeFormat(locale(), { weekday: "long", timeZone: "UTC" }).format(
      Date.UTC(d.year, d.month - 1, d.day),
    );
  } catch {
    return String(weekday(d));
  }
}

const unit = (n: number, u: "year" | "month" | "week" | "day") =>
  fmt(n, { style: "unit", unit: u, unitDisplay: "long" });

export default function Age() {
  const birthText = useToolState("birth", "1990-05-15");
  const onText = useToolState("on", "");
  const n = useToolState("n", 10000);
  const nUnit = useToolState<AgeUnit>("unit", "days");

  const birth = parseYmd(birthText.value);
  const on = parseYmd(onText.value || today());
  const a = birth && on ? age(birth, on) : null;
  const next = birth && on ? nextBirthday(birth, on) : null;
  const at = birth ? dateAtAge(birth, n.value, nUnit.value) : null;
  const ref = on ? dayNumber(on) : 0;
  const miles = birth && on ? nextMilestones(birth, on) : [];

  const dateInput = (label: string, sig: typeof birthText, fallback?: string) => (
    <Field label={label}>
      <input
        class="input"
        type="date"
        value={sig.value || fallback || ""}
        onInput={(e) => {
          sig.value = (e.currentTarget as HTMLInputElement).value;
        }}
      />
    </Field>
  );

  return (
    <>
      <div class="age-dates">
        {dateInput(tr(T.birth), birthText)}
        {dateInput(tr(T.on), onText, today())}
        <Button
          onClick={() => {
            onText.value = "";
          }}
        >
          {tr(T.today)}
        </Button>
      </div>

      {!birth ? (
        <ErrorNote error={tr(T.bad)} />
      ) : !on ? (
        <ErrorNote error={tr(T.badOn)} />
      ) : !a ? (
        <ErrorNote error={tr(T.before)} />
      ) : (
        <>
          <Result
            label={tr(T.age)}
            value={[unit(a.years, "year"), unit(a.months, "month"), unit(a.days, "day")].join(", ")}
            note={tr(T.bornOn).replace("{d}", weekdayName(birth))}
          />
          <Stats
            items={[
              { label: tr(T.months), value: fmt(a.totalMonths) },
              {
                label: tr(T.weeks),
                value: a.weekDays
                  ? `${fmt(a.totalWeeks)} + ${unit(a.weekDays, "day")}`
                  : fmt(a.totalWeeks),
              },
              { label: tr(T.days), value: fmt(a.totalDays) },
              { label: tr(T.hours), value: fmt(a.totalHours) },
            ]}
          />
          {next && (
            <Panel title={tr(T.next)}>
              {next.daysLeft === 0 ? (
                <p class="age-big">{tr(T.happy)}</p>
              ) : (
                <p class="age-big">
                  <strong>{relDays(next.daysLeft)}</strong>
                  <span class="muted">
                    {" "}
                    · {longDate(next.date)} · {tr(T.turning).replace("{n}", fmt(next.turning))}
                  </span>
                </p>
              )}
            </Panel>
          )}
        </>
      )}

      {birth && (
        <Panel title={tr(T.when)}>
          <div class="grid-3">
            <NumberField
              label={tr(T.amount)}
              value={n.value}
              min={0}
              max={100000}
              integer
              onChange={(v) => {
                n.value = v;
              }}
            />
            <Select<AgeUnit>
              label={tr(T.unit)}
              value={nUnit.value}
              onChange={(v) => {
                nUnit.value = v;
              }}
              options={[
                { value: "years", label: tr(T.yearsU) },
                { value: "months", label: tr(T.monthsU) },
                { value: "weeks", label: tr(T.weeksU) },
                { value: "days", label: tr(T.daysU) },
              ]}
            />
          </div>
          {at ? (
            <p class="age-big">
              <strong>{longDate(at)}</strong>
              {on && <span class="muted"> · {relDays(dayNumber(at) - ref)}</span>}
            </p>
          ) : (
            <ErrorNote error={tr(T.badN)} />
          )}
          {miles.length > 0 && (
            <>
              <span class="muted small">{tr(T.milestones)}</span>
              <ul class="age-miles small">
                {miles.map((m) => (
                  <li key={m.days}>
                    <strong>{unit(m.days, "day")}</strong> — {longDate(m.date)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}
      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
      </Formula>
    </>
  );
}
