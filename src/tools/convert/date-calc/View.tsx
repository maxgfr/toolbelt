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
import { fmt, l, tr } from "../../../i18n";
import { isoDate, localZone, parseIsoDate, parseNumber, parseTime, wallClock } from "../_shared";
import { attempt, locale } from "../_ui";
import {
  addBusinessDays,
  addDuration,
  calendarMs,
  type DateTime,
  type Duration,
  difference,
  formatDateTime,
} from "./logic";

const T = {
  mode: l("Mode", "Mode"),
  between: l("Between two dates", "Entre deux dates"),
  add: l("Add or subtract", "Ajouter ou retirer"),
  start: l("Start", "Début"),
  end: l("End", "Fin"),
  date: l("Date", "Date"),
  time: l("Time (optional)", "Heure (facultative)"),
  today: l("Today", "Aujourd'hui"),
  swap: l("Swap dates", "Inverser les dates"),
  includeEnd: l("Include the end date (+1 day)", "Inclure le jour de fin (+1 jour)"),
  badDate: l("Pick a valid date.", "Choisis une date valide."),
  badTime: l("The time is not valid.", "L'heure n'est pas valide."),
  before: l("The end is before the start.", "La fin est avant le début."),
  totalDays: l("Total days", "Jours au total"),
  weeks: l("Weeks", "Semaines"),
  months: l("Months", "Mois"),
  hours: l("Hours", "Heures"),
  minutes: l("Minutes", "Minutes"),
  business: l("Business days (Mon–Fri)", "Jours ouvrés (lun–ven)"),
  from: l("From", "À partir du"),
  operation: l("Operation", "Opération"),
  plus: l("Add", "Ajouter"),
  minus: l("Subtract", "Retirer"),
  years: l("Years", "Années"),
  days: l("Days", "Jours"),
  workdays: l("Working days", "Jours ouvrés"),
  workdaysHint: l("Skips Saturdays and Sundays.", "Saute les samedis et dimanches."),
  badNumber: l("Durations must be whole numbers.", "Les durées doivent être des nombres entiers."),
  result: l("Result", "Résultat"),
  iso: l("ISO 8601", "ISO 8601"),
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

function read(date: string, time: string): DateTime | "date" | "time" {
  const d = parseIsoDate(date);
  if (!d) return "date";
  if (!time.trim()) return { ...d, hour: 0, minute: 0 };
  const t = parseTime(time);
  if (!t) return "time";
  return { ...d, hour: t.hour, minute: t.minute };
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
    const x = read(a.value, aTime.value);
    const y = read(b.value, bTime.value);
    if (typeof x === "string") return x;
    if (typeof y === "string") return y;
    return difference(x, y, includeEnd.value);
  });

  const added = useComputed(() => {
    const x = read(a.value, aTime.value);
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
