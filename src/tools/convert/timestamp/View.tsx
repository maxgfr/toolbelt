import { useComputed, useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Field, Output, Panel, Segmented } from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { isValidZone, localZone, relative } from "../_shared";
import { attempt, ZonePicker } from "../_ui";
import { breakdown, parseInput, type UnitChoice } from "./logic";

const T = {
  now: l("Now", "Maintenant", "Jetzt"),
  use: l("Use", "Utiliser", "Übernehmen"),
  input: l("Timestamp or date", "Timestamp ou date", "Zeitstempel oder Datum"),
  placeholder: l(
    "1706702400, 1706702400000, 2024-01-31 12:00, Wed, 31 Jan 2024 12:00:00 +0000…",
    "1706702400, 1706702400000, 2024-01-31 12:00, Wed, 31 Jan 2024 12:00:00 +0000…",
    "1706702400, 1706702400000, 2024-01-31 12:00, Wed, 31 Jan 2024 12:00:00 +0000…",
  ),
  hint: l(
    "Dates without an offset are read in the time zone below.",
    "Les dates sans décalage sont lues dans le fuseau ci-dessous.",
    "Daten ohne Verschiebung werden in der Zeitzone unten gelesen.",
  ),
  unit: l("Unit", "Unité", "Einheit"),
  auto: l("Auto", "Auto", "Auto"),
  zone: l("Time zone", "Fuseau horaire", "Zeitzone"),
  seconds: l("seconds", "secondes", "Sekunden"),
  millis: l("milliseconds", "millisecondes", "Millisekunden"),
  micros: l("microseconds", "microsecondes", "Mikrosekunden"),
  nanos: l("nanoseconds", "nanosecondes", "Nanosekunden"),
  readAs: l("Read as {x}", "Lu en {x}", "Gelesen als {x}"),
  readDate: l("Read as a {x} date", "Lu comme une date {x}", "Gelesen als {x}-Datum"),
  empty: l(
    "Type a timestamp or a date, or use the current time.",
    "Tape un timestamp ou une date, ou prends l'heure actuelle.",
    "Gib einen Zeitstempel oder ein Datum ein oder nimm die aktuelle Uhrzeit.",
  ),
  invalid: l(
    "Not a timestamp or a date I can read. Try 1706702400 or 2024-01-31T12:00:00Z.",
    "Ni un timestamp ni une date lisible. Essaie 1706702400 ou 2024-01-31T12:00:00Z.",
    "Weder ein lesbarer Zeitstempel noch ein Datum. Versuch 1706702400 oder 2024-01-31T12:00:00Z.",
  ),
  range: l(
    "Out of range: dates stop around year 275,000.",
    "Hors limites : les dates s'arrêtent vers l'an 275 000.",
    "Außerhalb des Bereichs: Daten enden etwa im Jahr 275.000.",
  ),
  formats: l("Formats", "Formats", "Formate"),
  isoUtc: l("ISO 8601 (UTC)", "ISO 8601 (UTC)", "ISO 8601 (UTC)"),
  isoZone: l("ISO 8601 (zone)", "ISO 8601 (fuseau)", "ISO 8601 (Zeitzone)"),
  inZone: l("In the zone", "Dans le fuseau", "In der Zeitzone"),
  local: l("Local time", "Heure locale", "Ortszeit"),
  rfc: l("RFC 2822", "RFC 2822", "RFC 2822"),
  relative: l("Relative", "Relatif", "Relativ"),
  unix: l("Unix time", "Temps Unix", "Unixzeit"),
  sec: l("Seconds", "Secondes", "Sekunden"),
  ms: l("Milliseconds", "Millisecondes", "Millisekunden"),
  us: l("Microseconds", "Microsecondes", "Mikrosekunden"),
  ns: l("Nanoseconds", "Nanosecondes", "Nanosekunden"),
  calendar: l("Calendar", "Calendrier", "Kalender"),
  dayOfYear: l("Day of year", "Jour de l'année", "Tag im Jahr"),
  week: l("ISO week", "Semaine ISO", "ISO-Kalenderwoche"),
  weekday: l("Day", "Jour", "Wochentag"),
};

const UNIT_NAME = { s: T.seconds, ms: T.millis, us: T.micros, ns: T.nanos };

export default function Timestamp() {
  const input = useToolState("input", String(Math.floor(Date.now() / 1000)));
  const unit = useToolState<UnitChoice>("unit", "auto");
  const zone = useToolState("zone", localZone());
  const now = useSignal(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      now.value = Date.now();
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const zoneOk = useComputed(() => (isValidZone(zone.value) ? zone.value : "UTC"));
  const parsed = useComputed(() => parseInput(input.value, unit.value, zoneOk.value));
  const p = parsed.value;
  const z = zoneOk.value;
  const b = p.ok ? attempt(() => breakdown(p.ms, z, p.kind === "number" ? p.subMs : 0)) : null;
  const loc = locale();
  const human = (ms: number, timeZone?: string) =>
    attempt(() =>
      new Intl.DateTimeFormat(loc, {
        dateStyle: "full",
        timeStyle: "long",
        ...(timeZone ? { timeZone } : {}),
      }).format(ms),
    ) ?? "";
  const nowSec = String(Math.floor(now.value / 1000));

  return (
    <>
      <Panel
        title={tr(T.now)}
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon="refresh"
            onClick={() => {
              input.value = String(Math.floor(Date.now() / 1000));
            }}
          >
            {tr(T.use)}
          </Button>
        }
      >
        <div class="ts-now">
          <code class="ts-now-value mono">{nowSec}</code>
          <CopyButton text={() => String(Math.floor(Date.now() / 1000))} />
          <code class="ts-now-ms mono muted">{String(now.value)}</code>
          <CopyButton text={() => String(Date.now())} label="ms" />
          <span class="muted small">{human(now.value)}</span>
        </div>
      </Panel>

      <div class="grid-2">
        <Field label={tr(T.input)} hint={tr(T.hint)}>
          <input
            class="input mono"
            type="text"
            value={input.value}
            placeholder={tr(T.placeholder)}
            spellcheck={false}
            aria-invalid={!p.ok && p.error !== "empty"}
            onInput={(e) => {
              input.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <Field label={tr(T.zone)}>
          <ZonePicker
            value={zone.value}
            label={tr(T.zone)}
            onChange={(v) => {
              zone.value = v;
            }}
          />
        </Field>
      </div>
      <div class="row">
        <Segmented<UnitChoice>
          label={tr(T.unit)}
          value={unit.value}
          onChange={(v) => {
            unit.value = v;
          }}
          options={[
            { value: "auto", label: tr(T.auto) },
            { value: "s", label: "s" },
            { value: "ms", label: "ms" },
            { value: "us", label: "µs" },
            { value: "ns", label: "ns" },
          ]}
        />
        {p.ok && (
          <span class="muted small">
            {p.kind === "number"
              ? tr(T.readAs).replace("{x}", tr(UNIT_NAME[p.unit]))
              : tr(T.readDate).replace("{x}", p.format)}
          </span>
        )}
      </div>

      {!p.ok && p.error === "empty" && <p class="muted">{tr(T.empty)}</p>}
      {!p.ok && p.error !== "empty" && (
        <ErrorNote error={tr(p.error === "range" ? T.range : T.invalid)} />
      )}

      {p.ok && b && (
        <div class="grid-2">
          <Panel title={tr(T.formats)}>
            <div class="stack ts-list">
              <Output label={tr(T.isoUtc)} value={b.isoUtc} />
              <Output label={tr(T.isoZone)} value={b.isoZone} />
              <Output label={tr(T.inZone)} value={human(p.ms, z)} mono={false} />
              <Output label={tr(T.local)} value={human(p.ms)} mono={false} />
              <Output label={tr(T.rfc)} value={b.rfc2822} />
              <Output label={tr(T.relative)} value={relative(p.ms, now.value, loc)} mono={false} />
            </div>
          </Panel>
          <div class="stack">
            <Panel title={tr(T.unix)}>
              <div class="stack ts-list">
                <Output label={tr(T.sec)} value={b.seconds} />
                <Output label={tr(T.ms)} value={b.millis} />
                <Output label={tr(T.us)} value={b.micros} />
                <Output label={tr(T.ns)} value={b.nanos} />
              </div>
            </Panel>
            <Panel title={tr(T.calendar)}>
              <dl class="stats">
                <div class="stat">
                  <dt>{tr(T.weekday)}</dt>
                  <dd>
                    {attempt(() =>
                      new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: z }).format(p.ms),
                    )}
                  </dd>
                </div>
                <div class="stat">
                  <dt>{tr(T.dayOfYear)}</dt>
                  <dd>{fmt(b.dayOfYear)}</dd>
                </div>
                <div class="stat">
                  <dt>{tr(T.week)}</dt>
                  <dd>
                    {b.week.year}-W{String(b.week.week).padStart(2, "0")}
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
