import { useEffect, useRef } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, Field, IconButton, Panel, Toggle, toast } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { askNotify, canNotify, notify } from "../_audio";
import { beepPattern, formatRemaining, newId } from "../_shared";
import { useAlarm, useNow, useTitle } from "../_ui";
import {
  addTime,
  endKey,
  makeTimer,
  newlyDone,
  normalizeTimers,
  parseDuration,
  pauseTimer,
  progress,
  remaining,
  resetTimer,
  startTimer,
  status,
  type Timer,
  titleText,
} from "./logic";

const T = {
  add: l("New timer", "Nouveau minuteur", "Neuer Timer"),
  name: l("Name", "Nom", "Name"),
  namePh: l("Pasta, tea, laundry…", "Pâtes, thé, lessive…", "Nudeln, Tee, Wäsche…"),
  duration: l("Duration", "Durée", "Dauer"),
  durationHint: l(
    "5 = 5 min · 1:30 · 90s · 1h30",
    "5 = 5 min · 1:30 · 90s · 1h30",
    "5 = 5 Min. · 1:30 · 90s · 1h30",
  ),
  badDuration: l(
    "Type a duration like 5, 1:30, 90s or 1h30 (up to 100 h).",
    "Tape une durée comme 5, 1:30, 90s ou 1h30 (jusqu'à 100 h).",
    "Gib eine Dauer wie 5, 1:30, 90s oder 1h30 ein (bis 100 h).",
  ),
  addBtn: l("Add & start", "Ajouter et lancer", "Hinzufügen und starten"),
  presets: l("Quick timers", "Minuteurs rapides", "Schnelltimer"),
  timer: l("Timer", "Minuteur", "Timer"),
  start: l("Start", "Démarrer", "Start"),
  pause: l("Pause", "Pause", "Pause"),
  resume: l("Resume", "Reprendre", "Weiter"),
  reset: l("Reset", "Réinitialiser", "Zurücksetzen"),
  restart: l("Restart", "Relancer", "Neu starten"),
  dismiss: l("Stop", "Arrêter", "Stopp"),
  plus1: l("+1 min", "+1 min", "+1 Min."),
  remove: l("Remove", "Supprimer", "Entfernen"),
  done: l("Time's up!", "C'est l'heure !", "Zeit ist um!"),
  paused: l("Paused", "En pause", "Pausiert"),
  sound: l("Sound at the end", "Son à la fin", "Ton am Ende"),
  notify: l("System notification", "Notification système", "Systembenachrichtigung"),
  denied: l(
    "Notifications are blocked for this site in the browser settings.",
    "Les notifications sont bloquées pour ce site dans les réglages du navigateur.",
    "Benachrichtigungen sind für diese Seite in den Browsereinstellungen blockiert.",
  ),
  none: l(
    "No timer yet: pick a quick timer or type a duration.",
    "Aucun minuteur : choisis un minuteur rapide ou tape une durée.",
    "Noch kein Timer: Wähl einen Schnelltimer oder gib eine Dauer ein.",
  ),
  note: l(
    "Timers keep running in the background and after a reload; the page title shows the next one.",
    "Les minuteurs continuent en arrière-plan et après un rechargement ; le titre de la page affiche le prochain.",
    "Timer laufen im Hintergrund und nach dem Neuladen weiter; der Seitentitel zeigt den nächsten.",
  ),
  startAll: l("Start all", "Tout lancer", "Alle starten"),
  pauseAll: l("Pause all", "Tout mettre en pause", "Alle pausieren"),
};

const PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60];

export default function TimerTool() {
  const stored = useToolState<Timer[]>("timers", [], { share: false });
  const sound = useToolState("sound", true);
  const notifyOn = useToolState("notify", false);
  const name = useToolState("name", "", { share: false });
  const text = useToolState("duration", "5", { share: false });

  const timers = normalizeTimers(stored.value);
  const active = timers.some((t) => t.endAt !== null);
  const now = useNow(active, 250);
  const alarm = useAlarm(beepPattern());
  const announced = useRef<Set<string> | null>(null);

  // Ends that happened before this page was opened are not announced again.
  if (announced.current === null)
    announced.current = new Set(newlyDone(timers, new Set(), Date.now()).map(endKey));

  useTitle(titleText(timers, now));

  // Keep the end alarms scheduled on the audio clock.
  const schedule = timers
    .filter((t) => t.endAt !== null)
    .map((t) => `${t.id}:${t.endAt}`)
    .join(",");
  useEffect(() => {
    alarm.sync(
      sound.value
        ? timers.flatMap((t) => (t.endAt === null ? [] : [{ id: t.id, at: t.endAt }]))
        : [],
    );
  }, [schedule, sound.value]);

  useEffect(() => {
    const seen = announced.current;
    if (!seen) return;
    for (const t of newlyDone(timers, seen, now)) {
      seen.add(endKey(t));
      const late = now - (t.endAt as number);
      if (sound.value && !alarm.covers(t.id, t.endAt as number) && late < 15_000) alarm.ring();
      if (notifyOn.value && late < 60_000) notify(`⏰ ${t.name}`, tr(T.done), `timer-${t.id}`);
    }
  }, [now, schedule]);

  const update = (id: string, fn: (t: Timer) => Timer) => {
    stored.value = timers.map((t) => (t.id === id ? fn(t) : t));
  };

  const create = (ms: number, label: string) => {
    alarm.ensure();
    const t = startTimer(
      makeTimer(newId(), label.trim() || `${tr(T.timer)} ${timers.length + 1}`, ms),
      Date.now(),
    );
    stored.value = [...timers, t];
  };

  const parsed = parseDuration(text.value);
  const anyDone = timers.some((t) => status(t, now) === "done");

  return (
    <div class="stack">
      <Panel title={tr(T.add)}>
        <form
          class="row timer-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed === null) return;
            create(parsed, name.value);
            name.value = "";
          }}
        >
          <Field label={tr(T.name)}>
            <input
              class="input"
              value={name.value}
              placeholder={tr(T.namePh)}
              maxLength={60}
              onInput={(e) => {
                name.value = e.currentTarget.value;
              }}
            />
          </Field>
          <Field label={tr(T.duration)} hint={tr(T.durationHint)}>
            <input
              class="input mono"
              value={text.value}
              aria-invalid={parsed === null && text.value.trim() !== ""}
              onInput={(e) => {
                text.value = e.currentTarget.value;
              }}
            />
          </Field>
          <Button type="submit" variant="primary" icon="plus" disabled={parsed === null}>
            {tr(T.addBtn)}
          </Button>
        </form>
        {parsed === null && text.value.trim() !== "" && (
          <p class="error-note">{tr(T.badDuration)}</p>
        )}
        <div class="row">
          <span class="muted small">{tr(T.presets)}</span>
          {PRESETS.map((m) => (
            <Button key={m} size="sm" onClick={() => create(m * 60_000, `${m} min`)}>
              {m < 60 ? `${m} min` : "1 h"}
            </Button>
          ))}
        </div>
        <div class="row">
          <Toggle
            label={tr(T.sound)}
            checked={sound.value}
            onChange={(v) => {
              sound.value = v;
              if (v) alarm.ensure();
              else alarm.silence();
            }}
          />
          {canNotify() && (
            <Toggle
              label={tr(T.notify)}
              checked={notifyOn.value}
              onChange={async (v) => {
                if (!v) {
                  notifyOn.value = false;
                  return;
                }
                const ok = await askNotify();
                notifyOn.value = ok;
                if (!ok) toast(tr(T.denied), "error");
              }}
            />
          )}
        </div>
      </Panel>

      {timers.length === 0 ? (
        <p class="muted">{tr(T.none)}</p>
      ) : (
        <>
          <div class="row">
            <Button
              size="sm"
              onClick={() => {
                alarm.ensure();
                const n = Date.now();
                stored.value = timers.map((t) => (status(t, n) === "done" ? t : startTimer(t, n)));
              }}
            >
              {tr(T.startAll)}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const n = Date.now();
                stored.value = timers.map((t) => pauseTimer(t, n));
              }}
            >
              {tr(T.pauseAll)}
            </Button>
            {anyDone && sound.value && (
              <Button size="sm" variant="danger" onClick={() => alarm.silence()}>
                🔕 {tr(T.dismiss)}
              </Button>
            )}
          </div>
          <div class="timer-grid">
            {timers.map((t) => (
              <TimerCard
                key={t.id}
                t={t}
                now={now}
                onChange={(fn) => update(t.id, fn)}
                onStart={() => alarm.ensure()}
                onRemove={() => {
                  stored.value = timers.filter((x) => x.id !== t.id);
                  if (status(t, Date.now()) === "done") alarm.silence();
                }}
                onDismiss={() => alarm.silence()}
              />
            ))}
          </div>
        </>
      )}
      <p class="muted small">{tr(T.note)}</p>
    </div>
  );
}

function TimerCard({
  t,
  now,
  onChange,
  onStart,
  onRemove,
  onDismiss,
}: {
  t: Timer;
  now: number;
  onChange: (fn: (t: Timer) => Timer) => void;
  onStart: () => void;
  onRemove: () => void;
  onDismiss: () => void;
}) {
  const s = status(t, now);
  const pct = Math.round(progress(t, now) * 1000) / 10;
  return (
    <div class={`panel timer-card timer-${s}`}>
      <div class="row">
        <input
          class="input timer-name"
          value={t.name}
          aria-label={tr(T.name)}
          maxLength={60}
          onInput={(e) => {
            const v = e.currentTarget.value;
            onChange((x) => ({ ...x, name: v }));
          }}
        />
        <IconButton icon="trash" label={tr(T.remove)} onClick={onRemove} />
      </div>
      <div class="timer-time" role={s === "done" ? "alert" : undefined}>
        {s === "done" ? tr(T.done) : formatRemaining(remaining(t, now))}
      </div>
      <div class="timer-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div class="row">
        {s === "done" ? (
          <>
            <Button
              variant="primary"
              onClick={() => {
                onDismiss();
                onChange(resetTimer);
              }}
            >
              {tr(T.dismiss)}
            </Button>
            <Button
              onClick={() => {
                onDismiss();
                onStart();
                onChange((x) => startTimer(x, Date.now()));
              }}
            >
              {tr(T.restart)}
            </Button>
          </>
        ) : s === "running" ? (
          <Button onClick={() => onChange((x) => pauseTimer(x, Date.now()))}>{tr(T.pause)}</Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              onStart();
              onChange((x) => startTimer(x, Date.now()));
            }}
          >
            {tr(s === "paused" ? T.resume : T.start)}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (s === "done") onDismiss();
            onChange((x) => addTime(x, 60_000, Date.now()));
          }}
        >
          {tr(T.plus1)}
        </Button>
        {(s === "running" || s === "paused") && (
          <Button size="sm" variant="ghost" icon="reset" onClick={() => onChange(resetTimer)}>
            {tr(T.reset)}
          </Button>
        )}
        {s === "paused" && <span class="muted small">{tr(T.paused)}</span>}
      </div>
    </div>
  );
}
