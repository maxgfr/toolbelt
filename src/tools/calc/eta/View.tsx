import { useEffect, useState } from "preact/hooks";
import { Badge, NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Field, Segmented, Stats } from "../../../app/ui";
import { l, pick, tr } from "../../../i18n";
import { Formula, locale, num, pct, Result } from "../_ui";
import {
  eta,
  type PaceUnit,
  PER_HOUR,
  parseLocal,
  requiredPace,
  splitDuration,
  timeAtPace,
  toLocalInput,
} from "./logic";

const T = {
  mode: l("I know", "Je connais", "Ich kenne"),
  progress: l("My progress so far", "Mon avancement", "Meinen Fortschritt"),
  pace: l("My pace", "Mon rythme", "Mein Tempo"),
  total: l("Total to do", "Total à faire", "Insgesamt zu erledigen"),
  done: l("Done so far", "Déjà fait", "Schon erledigt"),
  itemsHint: l(
    "Pages, tasks, files, km… any unit",
    "Pages, tâches, fichiers, km… toute unité",
    "Seiten, Aufgaben, Dateien, km … jede Einheit",
  ),
  started: l("Started at", "Commencé à", "Angefangen um"),
  now: l("Now", "Maintenant", "Jetzt"),
  deadline: l("Deadline (optional)", "Échéance (facultative)", "Frist (optional)"),
  finish: l("Finished at", "Terminé à", "Fertig um"),
  left: l("Time left", "Temps restant", "Restzeit"),
  elapsed: l("Elapsed", "Écoulé", "Vergangen"),
  rate: l("Pace", "Rythme", "Tempo"),
  perHour: l("{n} per hour", "{n} par heure", "{n} pro Stunde"),
  every: l("1 every {d}", "1 toutes les {d}", "1 alle {d}"),
  remaining: l("Left to do", "Reste à faire", "Noch zu erledigen"),
  totalTime: l("Total duration", "Durée totale", "Gesamtdauer"),
  noRate: l(
    "Nothing done yet: no pace to extrapolate from.",
    "Rien de fait pour l'instant : pas de rythme à prolonger.",
    "Noch nichts erledigt: kein Tempo, aus dem sich hochrechnen lässt.",
  ),
  allDone: l("All done!", "Tout est fait !", "Alles erledigt!"),
  errTotal: l(
    "The total must be more than 0.",
    "Le total doit être supérieur à 0.",
    "Die Gesamtmenge muss größer als 0 sein.",
  ),
  errDone: l(
    "“Done” must be between 0 and the total.",
    "« Déjà fait » doit être entre 0 et le total.",
    "„Schon erledigt“ muss zwischen 0 und der Gesamtmenge liegen.",
  ),
  errStart: l(
    "The start must be in the past.",
    "Le début doit être dans le passé.",
    "Der Beginn muss in der Vergangenheit liegen.",
  ),
  need: l(
    "Needed to make the deadline: {r}",
    "Rythme nécessaire pour l'échéance : {r}",
    "Nötig, um die Frist zu schaffen: {r}",
  ),
  onTrack: l("On track", "Dans les temps", "Im Zeitplan"),
  late: l("Behind schedule", "En retard", "Hinter dem Zeitplan"),
  passed: l("The deadline has passed.", "L'échéance est passée.", "Die Frist ist abgelaufen."),
  toDo: l("Left to do", "Reste à faire", "Noch zu erledigen"),
  speed: l("Items per", "Éléments par", "Einheiten pro"),
  hour: l("hour", "heure", "Stunde"),
  minute: l("minute", "minute", "Minute"),
  day: l("day", "jour", "Tag"),
  f1: l(
    "Pace = done ÷ time elapsed since the start. Time left = left to do ÷ pace. It assumes you keep the same pace, breaks included.",
    "Rythme = déjà fait ÷ temps écoulé depuis le début. Temps restant = reste à faire ÷ rythme. On suppose que tu gardes le même rythme, pauses comprises.",
    "Tempo = erledigt ÷ seit dem Beginn vergangene Zeit. Restzeit = noch zu erledigen ÷ Tempo. Dabei wird angenommen, dass du dein Tempo hältst, Pausen eingeschlossen.",
  ),
};

function defaultStart(): string {
  const d = new Date();
  const nine = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0).getTime();
  return toLocalInput(nine < d.getTime() ? nine : d.getTime() - 3600000);
}

function dur(ms: number): string {
  if (!Number.isFinite(ms)) return "∞";
  const { d, h, m } = splitDuration(ms);
  const parts: string[] = [];
  if (d) parts.push(`${num(d, 0)} ${pick({ en: "d", fr: "j", de: "Tg." })}`);
  if (h) parts.push(`${h} h`);
  if (m || !parts.length) parts.push(`${m} min`);
  return parts.join(" ");
}

function when(ms: number, nowMs: number): string {
  try {
    const sameDay = new Date(ms).toDateString() === new Date(nowMs).toDateString();
    return new Intl.DateTimeFormat(
      locale(),
      sameDay ? { timeStyle: "short" } : { dateStyle: "full", timeStyle: "short" },
    ).format(ms);
  } catch {
    return toLocalInput(ms);
  }
}

type Mode = "progress" | "pace";

export default function Eta() {
  const mode = useToolState<Mode>("mode", "progress");
  const total = useToolState("total", 120);
  const done = useToolState("done", 30);
  const start = useToolState("start", defaultStart());
  const deadline = useToolState("deadline", "");
  const left = useToolState("left", 90);
  const speed = useToolState("speed", 20);
  const speedUnit = useToolState<PaceUnit>("speedUnit", "hour");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const startMs = parseLocal(start.value);
  const r =
    startMs === null ? "start" : eta({ total: total.value, done: done.value, startMs, nowMs: now });
  const deadlineMs = parseLocal(deadline.value);
  const rate = (perHour: number) => {
    if (!(perHour > 0)) return "—";
    const main = tr(T.perHour).replace("{n}", num(perHour, perHour < 10 ? 2 : 1));
    return `${main} · ${tr(T.every).replace("{d}", dur(3600000 / perHour))}`;
  };

  const deadlineInfo = (remaining: number, finishMs: number | null) => {
    if (deadlineMs === null) return null;
    const need = requiredPace(remaining, now, deadlineMs);
    if (need === null) return <ErrorNote error={tr(T.passed)} />;
    const ok = finishMs !== null && finishMs <= deadlineMs;
    return (
      <div class="row">
        <Badge kind={ok ? "ok" : "warn"}>{tr(ok ? T.onTrack : T.late)}</Badge>
        <span class="small">{tr(T.need).replace("{r}", rate(need))}</span>
      </div>
    );
  };

  const deadlineField = (
    <Field label={tr(T.deadline)}>
      <input
        class="input"
        type="datetime-local"
        value={deadline.value}
        onInput={(e) => {
          deadline.value = (e.currentTarget as HTMLInputElement).value;
        }}
      />
    </Field>
  );

  const paceTime = timeAtPace(left.value, speed.value * PER_HOUR[speedUnit.value]);

  return (
    <>
      <Segmented<Mode>
        label={tr(T.mode)}
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "progress", label: tr(T.progress) },
          { value: "pace", label: tr(T.pace) },
        ]}
      />
      {mode.value === "progress" ? (
        <>
          <div class="grid-3">
            <NumberField
              label={tr(T.total)}
              hint={tr(T.itemsHint)}
              value={total.value}
              min={0}
              step="any"
              onChange={(v) => {
                total.value = v;
              }}
            />
            <NumberField
              label={tr(T.done)}
              value={done.value}
              min={0}
              step="any"
              onChange={(v) => {
                done.value = v;
              }}
            />
            <div class="eta-start">
              <Field label={tr(T.started)}>
                <input
                  class="input"
                  type="datetime-local"
                  value={start.value}
                  onInput={(e) => {
                    start.value = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </Field>
              <Button
                size="sm"
                onClick={() => {
                  start.value = toLocalInput(Date.now());
                }}
              >
                {tr(T.now)}
              </Button>
            </div>
            {deadlineField}
          </div>
          {typeof r === "string" ? (
            <ErrorNote
              error={tr(r === "total" ? T.errTotal : r === "done" ? T.errDone : T.errStart)}
            />
          ) : (
            <>
              <div
                class="eta-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(r.percent)}
              >
                <span style={{ width: `${r.percent}%` }} />
              </div>
              {r.remaining === 0 ? (
                <Result label={pct(100)} value={tr(T.allDone)} />
              ) : r.finishMs === null ? (
                <p class="muted">{tr(T.noRate)}</p>
              ) : (
                <div class="grid-2">
                  <Result label={tr(T.finish)} value={when(r.finishMs, now)} />
                  <Result label={tr(T.left)} value={dur(r.remainingMs)} />
                </div>
              )}
              <Stats
                items={[
                  {
                    label: pct(r.percent, 1),
                    value: `${num(done.value, 2)} / ${num(total.value, 2)}`,
                  },
                  { label: tr(T.elapsed), value: dur(r.elapsedMs) },
                  {
                    label: tr(T.rate),
                    value:
                      r.perHour > 0
                        ? tr(T.perHour).replace("{n}", num(r.perHour, r.perHour < 10 ? 2 : 1))
                        : "—",
                  },
                  { label: tr(T.remaining), value: num(r.remaining, 2) },
                  ...(Number.isFinite(r.totalMs)
                    ? [{ label: tr(T.totalTime), value: dur(r.totalMs) }]
                    : []),
                ]}
              />
              {r.remaining > 0 && deadlineInfo(r.remaining, r.finishMs)}
            </>
          )}
        </>
      ) : (
        <>
          <div class="grid-3">
            <NumberField
              label={tr(T.toDo)}
              hint={tr(T.itemsHint)}
              value={left.value}
              min={0}
              step="any"
              onChange={(v) => {
                left.value = v;
              }}
            />
            <div class="eta-pace">
              <NumberField
                label={tr(T.speed)}
                value={speed.value}
                min={0}
                step="any"
                onChange={(v) => {
                  speed.value = v;
                }}
              />
              <Select<PaceUnit>
                label={tr(T.rate)}
                value={speedUnit.value}
                onChange={(v) => {
                  speedUnit.value = v;
                }}
                options={[
                  { value: "minute", label: tr(T.minute) },
                  { value: "hour", label: tr(T.hour) },
                  { value: "day", label: tr(T.day) },
                ]}
              />
            </div>
            {deadlineField}
          </div>
          {paceTime === null ? (
            <ErrorNote error={tr(T.noRate)} />
          ) : (
            <>
              <div class="grid-2">
                <Result label={tr(T.left)} value={dur(paceTime)} />
                <Result label={tr(T.finish)} value={when(now + paceTime, now)} />
              </div>
              {left.value > 0 && deadlineInfo(left.value, now + paceTime)}
            </>
          )}
        </>
      )}
      <Formula>
        <p>{tr(T.f1)}</p>
      </Formula>
    </>
  );
}
