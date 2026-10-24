import { useToolState } from "../../../app/state";
import { Button, Field, IconButton, Toggle } from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { localDateKey, newId } from "../_shared";
import { useNow } from "../_ui";
import {
  breakdown,
  type Countdown,
  calendarDays,
  nextAnnual,
  normalizeCountdowns,
  parseLocal,
  workingDays,
} from "./logic";

const T = {
  add: l("Add", "Ajouter", "Hinzufügen"),
  name: l("Event", "Événement", "Ereignis"),
  namePh: l(
    "Holidays, birthday, deadline…",
    "Vacances, anniversaire, échéance…",
    "Urlaub, Geburtstag, Abgabe…",
  ),
  date: l("Date", "Date", "Datum"),
  time: l("Time (optional)", "Heure (facultative)", "Uhrzeit (optional)"),
  quick: l("Quick add", "Ajout rapide", "Schnell hinzufügen"),
  newYear: l("New Year", "Nouvel An", "Neujahr"),
  christmas: l("Christmas", "Noël", "Weihnachten"),
  halloween: l("Halloween", "Halloween", "Halloween"),
  summer: l("Summer", "Été", "Sommer"),
  days: l("days", "jours", "Tage"),
  hours: l("hours", "heures", "Stunden"),
  minutes: l("min", "min", "Min."),
  seconds: l("s", "s", "Sek."),
  ago: l("ago", "écoulé", "vorbei"),
  today: l("It's today!", "C'est aujourd'hui !", "Es ist heute!"),
  now: l("It's now!", "C'est maintenant !", "Es ist so weit!"),
  workdays: l(
    "Show working days left",
    "Afficher les jours ouvrés restants",
    "Verbleibende Arbeitstage anzeigen",
  ),
  workHint: l(
    "Monday to Friday, from today (included) to the day (excluded).",
    "Du lundi au vendredi, d'aujourd'hui (inclus) jusqu'au jour J (exclu).",
    "Montag bis Freitag, von heute (einschließlich) bis zum Tag X (ausschließlich).",
  ),
  holidays: l(
    "Days off to skip",
    "Jours fériés / congés à exclure",
    "Freie Tage, die nicht zählen",
  ),
  holidaysPh: l("2026-11-11, 2026-12-25", "2026-11-11, 2026-12-25", "2026-12-24, 2026-12-25"),
  workLeft: l("{n} working days left", "{n} jours ouvrés restants", "noch {n} Arbeitstage"),
  weeks: l("{w} weeks · {h} hours", "{w} semaines · {h} heures", "{w} Wochen · {h} Stunden"),
  remove: l("Remove", "Supprimer", "Entfernen"),
  none: l(
    "No countdown yet: add an event above.",
    "Aucun compte à rebours : ajoute un événement ci-dessus.",
    "Noch kein Countdown: Füg oben ein Ereignis hinzu.",
  ),
  invalid: l("Invalid date", "Date invalide", "Ungültiges Datum"),
};

export default function CountdownTool() {
  const stored = useToolState<Countdown[]>("events", []);
  const name = useToolState("name", "", { share: false });
  const date = useToolState("date", "", { share: false });
  const time = useToolState("time", "", { share: false });
  const showWork = useToolState("workdays", false);
  const holidays = useToolState("holidays", "");

  const list = normalizeCountdowns(stored.value);
  const now = useNow(list.length > 0, 1000);

  const add = (n: string, d: string) => {
    stored.value = [...list, { id: newId(), name: n.trim() || tr(T.name), date: d }];
  };
  const draft = date.value ? `${date.value}${time.value ? `T${time.value}` : ""}` : "";
  const draftOk = draft !== "" && parseLocal(draft) !== null;
  const today = new Date(now);
  const days = holidays.value.match(/\d{4}-\d{2}-\d{2}/g) ?? [];

  const sorted = [...list].sort((a, b) => {
    const ta = parseLocal(a.date)?.getTime() ?? Number.POSITIVE_INFINITY;
    const tb = parseLocal(b.date)?.getTime() ?? Number.POSITIVE_INFINITY;
    const pa = ta < now ? 1 : 0;
    const pb = tb < now ? 1 : 0;
    return pa - pb || (pa ? tb - ta : ta - tb);
  });

  return (
    <div class="stack">
      <div class="panel">
        <form
          class="row countdown-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draftOk) return;
            add(name.value, draft);
            name.value = "";
          }}
        >
          <Field label={tr(T.name)}>
            <input
              class="input"
              value={name.value}
              maxLength={80}
              placeholder={tr(T.namePh)}
              onInput={(e) => {
                name.value = e.currentTarget.value;
              }}
            />
          </Field>
          <Field label={tr(T.date)}>
            <input
              class="input"
              type="date"
              value={date.value}
              onInput={(e) => {
                date.value = e.currentTarget.value;
              }}
            />
          </Field>
          <Field label={tr(T.time)}>
            <input
              class="input"
              type="time"
              value={time.value}
              onInput={(e) => {
                time.value = e.currentTarget.value;
              }}
            />
          </Field>
          <Button type="submit" variant="primary" icon="plus" disabled={!draftOk}>
            {tr(T.add)}
          </Button>
        </form>
        <div class="row">
          <span class="muted small">{tr(T.quick)}</span>
          {(
            [
              [T.newYear, 1, 1],
              [T.christmas, 12, 25],
              [T.halloween, 10, 31],
              [T.summer, 6, 21],
            ] as const
          ).map(([label, m, d]) => (
            <Button
              key={label.en}
              size="sm"
              onClick={() => add(tr(label), nextAnnual(m, d, today))}
            >
              {tr(label)}
            </Button>
          ))}
        </div>
        <Toggle
          label={tr(T.workdays)}
          checked={showWork.value}
          onChange={(v) => {
            showWork.value = v;
          }}
        />
        {showWork.value && (
          <Field label={tr(T.holidays)} hint={tr(T.workHint)}>
            <input
              class="input mono"
              value={holidays.value}
              placeholder={tr(T.holidaysPh)}
              onInput={(e) => {
                holidays.value = e.currentTarget.value;
              }}
            />
          </Field>
        )}
      </div>

      {sorted.length === 0 ? (
        <p class="muted">{tr(T.none)}</p>
      ) : (
        <div class="countdown-grid">
          {sorted.map((c) => (
            <Card
              key={c.id}
              c={c}
              now={now}
              work={showWork.value ? days : null}
              onChange={(patch) => {
                stored.value = list.map((x) => (x.id === c.id ? { ...x, ...patch } : x));
              }}
              onRemove={() => {
                stored.value = list.filter((x) => x.id !== c.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({
  c,
  now,
  work,
  onChange,
  onRemove,
}: {
  c: Countdown;
  now: number;
  work: string[] | null;
  onChange: (patch: Partial<Countdown>) => void;
  onRemove: () => void;
}) {
  const target = parseLocal(c.date);
  const [d, t] = c.date.split("T");
  const dateOnly = !t;
  const nowDate = new Date(now);
  const parts = target ? breakdown(target.getTime(), now) : null;
  const isToday = target && dateOnly && localDateKey(target) === localDateKey(nowDate);
  const label = target
    ? new Intl.DateTimeFormat(locale(), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
      }).format(target)
    : tr(T.invalid);
  const totalH = target ? Math.abs(target.getTime() - now) / 3600_000 : 0;

  return (
    <div class={`panel countdown-card ${parts?.past && !isToday ? "countdown-past" : ""}`}>
      <div class="row">
        <input
          class="input countdown-name"
          value={c.name}
          aria-label={tr(T.name)}
          maxLength={80}
          onInput={(e) => {
            onChange({ name: e.currentTarget.value });
          }}
        />
        <IconButton icon="trash" label={tr(T.remove)} onClick={onRemove} />
      </div>
      <div class="row small">
        <input
          class="input countdown-date"
          type="date"
          aria-label={tr(T.date)}
          value={d}
          onInput={(e) => {
            const v = e.currentTarget.value;
            if (v) onChange({ date: t ? `${v}T${t}` : v });
          }}
        />
        <input
          class="input countdown-date"
          type="time"
          aria-label={tr(T.time)}
          value={t ?? ""}
          onInput={(e) => {
            const v = e.currentTarget.value;
            onChange({ date: v ? `${d}T${v}` : (d ?? "") });
          }}
        />
      </div>
      <p class="muted small countdown-when">{label}</p>
      {parts &&
        (isToday ? (
          <p class="countdown-today">{tr(T.today)}</p>
        ) : parts.past && totalH < 1 / 60 ? (
          <p class="countdown-today">{tr(T.now)}</p>
        ) : (
          <>
            <div class="countdown-parts">
              {(
                [
                  [parts.days, T.days],
                  [parts.hours, T.hours],
                  [parts.minutes, T.minutes],
                  [parts.seconds, T.seconds],
                ] as const
              ).map(([n, u]) => (
                <div key={u.en}>
                  <span>{fmt(n)}</span>
                  <small>{tr(u)}</small>
                </div>
              ))}
            </div>
            <p class="muted small">
              {parts.past && `${tr(T.ago)} · `}
              {tr(T.weeks)
                .replace("{w}", fmt(totalH / 168, { maximumFractionDigits: 1 }))
                .replace("{h}", fmt(Math.floor(totalH)))}
            </p>
          </>
        ))}
      {target && work && !parts?.past && calendarDays(nowDate, target) > 0 && (
        <span class="badge badge-info">
          {tr(T.workLeft).replace("{n}", fmt(workingDays(nowDate, target, work)))}
        </span>
      )}
    </div>
  );
}
