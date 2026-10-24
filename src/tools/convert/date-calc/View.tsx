import { useComputed } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useToolState } from "../../../app/state";
import {
  Button,
  ErrorNote,
  Field,
  IconButton,
  Output,
  Panel,
  Segmented,
  Stats,
  Toggle,
} from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { isoDate, localZone, parseNumber, wallClock } from "../_shared";
import { attempt } from "../_ui";
import {
  addBusinessDays,
  addDuration,
  calendarMs,
  type DateTime,
  type Duration,
  difference,
  formatDateTime,
  readDateTime,
} from "./logic";

const T = {
  mode: l("Mode", "Mode", "Modus"),
  between: l("Between two dates", "Entre deux dates", "Zwischen zwei Daten"),
  add: l("Add or subtract", "Ajouter ou retirer", "Addieren oder subtrahieren"),
  start: l("Start", "Début", "Beginn"),
  end: l("End", "Fin", "Ende"),
  date: l("Date", "Date", "Datum"),
  time: l("Time (optional)", "Heure (facultative)", "Uhrzeit (optional)"),
  today: l("Today", "Aujourd'hui", "Heute"),
  swap: l("Swap dates", "Inverser les dates", "Daten tauschen"),
  includeEnd: l(
    "Include the end date (+1 day)",
    "Inclure le jour de fin (+1 jour)",
    "Enddatum mitzählen (+1 Tag)",
  ),
  badDate: l("Pick a valid date.", "Choisis une date valide.", "Wähle ein gültiges Datum."),
  badTime: l("The time is not valid.", "L'heure n'est pas valide.", "Die Uhrzeit ist ungültig."),
  before: l(
    "The end is before the start.",
    "La fin est avant le début.",
    "Das Ende liegt vor dem Beginn.",
  ),
  totalDays: l("Total days", "Jours au total", "Tage insgesamt"),
  weeks: l("Weeks", "Semaines", "Wochen"),
  months: l("Months", "Mois", "Monate"),
  hours: l("Hours", "Heures", "Stunden"),
  minutes: l("Minutes", "Minutes", "Minuten"),
  business: l("Business days (Mon–Fri)", "Jours ouvrés (lun–ven)", "Werktage (Mo–Fr)"),
  from: l("From", "À partir du", "Ab"),
  operation: l("Operation", "Opération", "Rechenart"),
  plus: l("Add", "Ajouter", "Addieren"),
  minus: l("Subtract", "Retirer", "Subtrahieren"),
  years: l("Years", "Années", "Jahre"),
  days: l("Days", "Jours", "Tage"),
  workdays: l("Working days", "Jours ouvrés", "Werktage"),
  workdaysHint: l(
    "Skips Saturdays and Sundays.",
    "Saute les samedis et dimanches.",
    "Überspringt Samstage und Sonntage.",
  ),
  badNumber: l(
    "Durations must be whole numbers.",
    "Les durées doivent être des nombres entiers.",
    "Dauern müssen ganze Zahlen sein.",
  ),
  result: l("Result", "Résultat", "Ergebnis"),
  iso: l("ISO 8601", "ISO 8601", "ISO 8601"),
};

const UNITS = ["years", "months", "weeks", "days", "hours", "minutes"] as const;
type Part = (typeof UNITS)[number];
const UNIT_LABEL: Record<Part, typeof T.years> = {
  years: T.years,
  months: T.months,
  weeks: T.weeks,
  days: T.days,
  hours: T.hours,
  minutes: T.minutes,
};

type Mode = "between" | "add";

function today(): string {
  return isoDate(wallClock(new Date(), localZone()));
}

/** "4 years", "4 ans": Intl knows the plural rules of both languages. */
function unit(n: number, u: "year" | "month" | "week" | "day" | "hour" | "minute"): string {
  return fmt(n, { style: "unit", unit: u, unitDisplay: "long" });
}

export default function DateCalc() {
  const now = today();
  const mode = useToolState<Mode>("mode", "between");
  const a = useToolState("a", now);
  const aTime = useToolState("aTime", "");
  const b = useToolState("b", `${now.slice(0, 4)}-12-31`);
  const bTime = useToolState("bTime", "");
  const includeEnd = useToolState("includeEnd", false);
  const sign = useToolState<"+" | "-">("sign", "+");
  const dur = useToolState<Record<string, string>>("dur", { days: "30" });
  const workdays = useToolState("workdays", "");

  const diff = useComputed(() => {
    const x = readDateTime(a.value, aTime.value);
    const y = readDateTime(b.value, bTime.value);
    if (typeof x === "string") return x;
    if (typeof y === "string") return y;
    return difference(x, y, includeEnd.value);
  });

  const added = useComputed(() => {
    const x = readDateTime(a.value, aTime.value);
    if (typeof x === "string") return x;
    const parts: Duration = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0 };
    for (const u of UNITS) {
      const raw = dur.value[u] ?? "";
      const n = raw.trim() ? parseNumber(raw) : 0;
      if (n === null || !Number.isInteger(n)) return "number";
      parts[u] = n;
    }
    const w = workdays.value.trim() ? parseNumber(workdays.value) : 0;
    if (w === null || !Number.isInteger(w)) return "number";
    const s = sign.value === "-" ? -1 : 1;
    return attempt(() => {
      const r = addDuration(x, parts, s);
      return w ? addBusinessDays(r, s * w) : r;
    });
  });

  const loc = locale();
  const hasTime = !!(aTime.value.trim() || bTime.value.trim());
  const show = (d: DateTime) =>
    attempt(() =>
      new Intl.DateTimeFormat(loc, {
        dateStyle: "full",
        ...(hasTime || d.hour || d.minute ? { timeStyle: "short" } : {}),
        timeZone: "UTC",
      }).format(calendarMs(d)),
    ) ?? formatDateTime(d);

  const dateInputs = (
    label: typeof T.start,
    date: typeof a,
    time: typeof aTime,
    extra?: ComponentChildren,
  ) => (
    <Panel title={tr(label)}>
      <div class="dc-when">
        <Field label={tr(T.date)}>
          <input
            class="input"
            type="date"
            value={date.value}
            onInput={(e) => {
              date.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <Field label={tr(T.time)}>
          <input
            class="input"
            type="time"
            value={time.value}
            onInput={(e) => {
              time.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <Button
          onClick={() => {
            date.value = today();
          }}
        >
          {tr(T.today)}
        </Button>
        {extra}
      </div>
    </Panel>
  );

  const r = diff.value;
  const res = added.value;

  return (
    <>
      <Segmented<Mode>
        label={tr(T.mode)}
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "between", label: tr(T.between) },
          { value: "add", label: tr(T.add) },
        ]}
      />

      {mode.value === "between" ? (
        <>
          <div class="grid-2">
            {dateInputs(T.start, a, aTime)}
            {dateInputs(
              T.end,
              b,
              bTime,
              <IconButton
                icon="swap"
                label={tr(T.swap)}
                onClick={() => {
                  [a.value, b.value] = [b.value, a.value];
                  [aTime.value, bTime.value] = [bTime.value, aTime.value];
                }}
              />,
            )}
          </div>
          <Toggle
            checked={includeEnd.value}
            onChange={(v) => {
              includeEnd.value = v;
            }}
            label={tr(T.includeEnd)}
          />
          {typeof r === "string" ? (
            <ErrorNote error={tr(r === "time" ? T.badTime : T.badDate)} />
          ) : (
            <>
              <div class="dc-headline">
                <strong>
                  {[
                    r.years && unit(r.years, "year"),
                    r.months && unit(r.months, "month"),
                    (r.days || (!r.years && !r.months && !r.hours && !r.minutes)) &&
                      unit(r.days, "day"),
                    r.hours && unit(r.hours, "hour"),
                    r.minutes && unit(r.minutes, "minute"),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </strong>
                {r.sign < 0 && <span class="muted small">{tr(T.before)}</span>}
              </div>
              <Stats
                items={[
                  { label: tr(T.totalDays), value: fmt(r.totalDays) },
                  {
                    label: tr(T.weeks),
                    value: r.weekDays
                      ? `${fmt(r.weeks)} + ${unit(r.weekDays, "day")}`
                      : fmt(r.weeks),
                  },
                  { label: tr(T.months), value: fmt(r.totalMonths) },
                  { label: tr(T.hours), value: fmt(r.totalHours) },
                  { label: tr(T.minutes), value: fmt(r.totalMinutes) },
                  { label: tr(T.business), value: fmt(r.businessDays) },
                ]}
              />
            </>
          )}
        </>
      ) : (
        <>
          {dateInputs(T.from, a, aTime)}
          <Panel
            title={tr(T.operation)}
            actions={
              <Segmented<"+" | "-">
                label={tr(T.operation)}
                value={sign.value}
                onChange={(v) => {
                  sign.value = v;
                }}
                options={[
                  { value: "+", label: `+ ${tr(T.plus)}` },
                  { value: "-", label: `− ${tr(T.minus)}` },
                ]}
              />
            }
          >
            <div class="dc-parts">
              {UNITS.map((u) => (
                <Field key={u} label={tr(UNIT_LABEL[u])}>
                  <input
                    class="input"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={dur.value[u] ?? ""}
                    onInput={(e) => {
                      dur.value = {
                        ...dur.value,
                        [u]: (e.currentTarget as HTMLInputElement).value,
                      };
                    }}
                  />
                </Field>
              ))}
              <Field label={tr(T.workdays)} hint={tr(T.workdaysHint)}>
                <input
                  class="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={workdays.value}
                  onInput={(e) => {
                    workdays.value = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </Field>
            </div>
          </Panel>
          {res === "date" || res === "time" || res === "number" || res === null ? (
            <ErrorNote
              error={tr(res === "time" ? T.badTime : res === "number" ? T.badNumber : T.badDate)}
            />
          ) : (
            <Panel title={tr(T.result)}>
              <p class="dc-headline">
                <strong>{show(res)}</strong>
              </p>
              <Output
                label={tr(T.iso)}
                value={
                  res.hour || res.minute || aTime.value.trim()
                    ? formatDateTime(res)
                    : formatDateTime(res).slice(0, 10)
                }
              />
            </Panel>
          )}
        </>
      )}
    </>
  );
}
