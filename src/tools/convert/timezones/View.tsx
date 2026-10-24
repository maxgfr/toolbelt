import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Field, IconButton, Panel } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { formatOffset, localZone, zoneCity } from "../_shared";
import { attempt, locale, ZonePicker } from "../_ui";
import { convertZones, isWorkingHour, nowIn, splitDiff, type ZoneRow } from "./logic";

const T = {
  from: l("From", "Depuis"),
  zone: l("Time zone", "Fuseau horaire"),
  date: l("Date", "Date"),
  time: l("Time", "Heure"),
  now: l("Now", "Maintenant"),
  targets: l("In other time zones", "Dans d'autres fuseaux"),
  add: l("Add a time zone…", "Ajouter un fuseau…"),
  remove: l("Remove", "Retirer"),
  makeSource: l("Convert from this zone", "Convertir depuis ce fuseau"),
  nextDay: l("next day", "lendemain"),
  prevDay: l("previous day", "veille"),
  days: l("{n} days", "{n} jours"),
  same: l("same time", "même heure"),
  working: l("Working hours (Mon–Fri, 9:00–18:00)", "Heures de bureau (lun–ven, 9 h–18 h)"),
  noTargets: l(
    "Add time zones to compare, e.g. Tokyo, New York or UTC.",
    "Ajoute des fuseaux à comparer, par ex. Tokyo, New York ou UTC.",
  ),
  badDate: l("Pick a valid date.", "Choisis une date valide."),
  badTime: l("Pick a valid time.", "Choisis une heure valide."),
  badZone: l("Pick a time zone from the list.", "Choisis un fuseau dans la liste."),
  shifted: l(
    "This time does not exist in that zone (clocks jump forward): shown as {t}.",
    "Cette heure n'existe pas dans ce fuseau (passage à l'heure d'été) : affichée comme {t}.",
  ),
  utc: l("UTC instant:", "Instant UTC :"),
};

const DEFAULT_TARGETS = ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];

export default function Timezones() {
  const here = localZone();
  const start = nowIn(here);
  const source = useToolState("source", here);
  const date = useToolState("date", start.date);
  const time = useToolState("time", start.time);
  const targets = useToolState<string[]>(
    "targets",
    DEFAULT_TARGETS.filter((z) => z !== here),
  );
  const result = useComputed(() =>
    attempt(() => convertZones(date.value, time.value, source.value, targets.value)),
  );
  const r = result.value;
  const loc = locale();

  function setNow() {
    const n = nowIn(source.value);
    date.value = n.date;
    time.value = n.time;
  }

  function diffLabel(min: number): string {
    const d = splitDiff(min);
    if (!d.sign) return tr(T.same);
    return `${d.sign === "-" ? "−" : "+"}${d.hours} h${d.minutes ? ` ${String(d.minutes).padStart(2, "0")}` : ""}`;
  }

  function shiftLabel(n: number): string {
    if (n === 1) return `+1 · ${tr(T.nextDay)}`;
    if (n === -1) return `−1 · ${tr(T.prevDay)}`;
    return `${n > 0 ? "+" : "−"}${tr(T.days).replace("{n}", String(Math.abs(n)))}`;
  }

  function renderRow(row: ZoneRow, isSource = false) {
    const instant = r?.ok ? r.instant : new Date();
    const day =
      attempt(() =>
        new Intl.DateTimeFormat(loc, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: row.zone,
        }).format(instant),
      ) ?? row.date;
    const longName =
      attempt(
        () =>
          new Intl.DateTimeFormat(loc, { timeZone: row.zone, timeZoneName: "long" })
            .formatToParts(instant)
            .find((p) => p.type === "timeZoneName")?.value,
      ) ?? "";
    const work = isWorkingHour(row.hour, row.weekday);
    return (
      <li
        key={`${isSource ? "src" : "to"}-${row.zone}`}
        class={`tz-row ${isSource ? "tz-source" : ""}`}
      >
        <div class="tz-place">
          <strong>{zoneCity(row.zone)}</strong>
          <span class="muted small">
            {row.zone} · {longName}
          </span>
        </div>
        <div class="tz-clock">
          <span class={`tz-dot ${work ? "on" : ""}`} title={tr(T.working)} aria-hidden="true" />
          {work && <span class="sr-only">{tr(T.working)}</span>}
          <span class="tz-time mono">{row.time}</span>
        </div>
        <div class="tz-meta">
          <span>{day}</span>
          <span class="muted small mono">
            UTC{formatOffset(row.offset)}
            {!isSource && ` · ${diffLabel(row.diff)}`}
          </span>
        </div>
        <div class="tz-actions">
          {row.dayShift !== 0 && (
            <span class={`tz-shift ${row.dayShift > 0 ? "ahead" : "behind"}`}>
              {shiftLabel(row.dayShift)}
            </span>
          )}
          {!isSource && (
            <>
              <IconButton
                icon="swap"
                label={tr(T.makeSource)}
                onClick={() => {
                  const old = source.value;
                  source.value = row.zone;
                  date.value = row.date;
                  time.value = row.time;
                  targets.value = targets.value.map((z) => (z === row.zone ? old : z));
                }}
              />
              <IconButton
                icon="close"
                label={tr(T.remove)}
                onClick={() => {
                  targets.value = targets.value.filter((z) => z !== row.zone);
                }}
              />
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <>
      <Panel title={tr(T.from)}>
        <div class="tz-form">
          <Field label={tr(T.zone)}>
            <ZonePicker
              value={source.value}
              label={tr(T.zone)}
              onChange={(z) => {
                source.value = z;
              }}
            />
          </Field>
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
          <Button icon="refresh" onClick={setNow}>
            {tr(T.now)}
          </Button>
        </div>
        {r?.ok && r.shifted && (
          <p class="small tz-warn">{tr(T.shifted).replace("{t}", r.source.time)}</p>
        )}
        {r && !r.ok && (
          <ErrorNote
            error={tr(r.error === "date" ? T.badDate : r.error === "time" ? T.badTime : T.badZone)}
          />
        )}
      </Panel>

      <Panel title={tr(T.targets)}>
        {r?.ok && (
          <ul class="tz-list">
            {renderRow(r.source, true)}
            {r.rows.map((row) => renderRow(row))}
          </ul>
        )}
        {r?.ok && r.rows.length === 0 && <p class="muted">{tr(T.noTargets)}</p>}
        <div class="tz-add">
          <ZonePicker
            value=""
            clearOnPick
            label={tr(T.add)}
            placeholder={tr(T.add)}
            onChange={(z) => {
              if (z !== source.value && !targets.value.includes(z))
                targets.value = [...targets.value, z];
            }}
          />
        </div>
        {r?.ok && (
          <p class="muted small mono">
            {tr(T.utc)} {r.instant.toISOString().replace(".000Z", "Z")}
          </p>
        )}
      </Panel>
    </>
  );
}
