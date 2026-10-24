import { useEffect, useRef } from "preact/hooks";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Panel, Toggle, toast } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { askNotify, canNotify, notify } from "../_audio";
import { chime, formatRemaining, localDateKey } from "../_shared";
import { useAlarm, useKeys, useNow, useTitle } from "../_ui";
import {
  advance,
  cycleDots,
  DEFAULTS,
  INITIAL,
  normalizePomo,
  normalizeSettings,
  type Phase,
  type Pomo,
  pause,
  progress,
  remaining,
  resetCycle,
  restartPhase,
  type Settings,
  skip,
  start,
  todayCount,
} from "./logic";

const T = {
  work: l("Focus", "Concentration", "Fokus"),
  short: l("Short break", "Pause courte", "Kurze Pause"),
  long: l("Long break", "Pause longue", "Lange Pause"),
  start: l("Start", "Démarrer", "Start"),
  pause: l("Pause", "Pause", "Pause"),
  resume: l("Resume", "Reprendre", "Weiter"),
  skip: l("Skip", "Passer", "Überspringen"),
  restart: l("Restart phase", "Recommencer la phase", "Phase neu starten"),
  resetCycle: l("Reset cycle", "Recommencer le cycle", "Zyklus zurücksetzen"),
  today: l("Sessions today: {n}", "Sessions aujourd'hui : {n}", "Einheiten heute: {n}"),
  inCycle: l("Session {n} of {m}", "Session {n} sur {m}", "Einheit {n} von {m}"),
  settings: l("Settings", "Réglages", "Einstellungen"),
  workLen: l("Focus", "Concentration", "Fokus"),
  shortLen: l("Short break", "Pause courte", "Kurze Pause"),
  longLen: l("Long break", "Pause longue", "Lange Pause"),
  cycles: l(
    "Sessions before a long break",
    "Sessions avant une pause longue",
    "Einheiten vor einer langen Pause",
  ),
  autoBreak: l(
    "Start breaks automatically",
    "Lancer les pauses automatiquement",
    "Pausen automatisch starten",
  ),
  autoWork: l(
    "Start focus sessions automatically",
    "Lancer les sessions automatiquement",
    "Fokus-Einheiten automatisch starten",
  ),
  sound: l(
    "Sound at the end of each phase",
    "Son à la fin de chaque phase",
    "Ton am Ende jeder Phase",
  ),
  notify: l("System notification", "Notification système", "Systembenachrichtigung"),
  denied: l(
    "Notifications are blocked for this site in the browser settings.",
    "Les notifications sont bloquées pour ce site dans les réglages du navigateur.",
    "Benachrichtigungen sind für diese Seite in den Browsereinstellungen blockiert.",
  ),
  ended: l(
    "{a} is over — {b} next.",
    "{a} terminée — ensuite : {b}.",
    "{a} ist vorbei – als Nächstes: {b}.",
  ),
  min: l("min", "min", "min"),
  keys: l(
    "Space start / pause · S skip. Keeps going in the background and after a reload.",
    "Espace démarrer / pause · S passer. Continue en arrière-plan et après un rechargement.",
    "Leertaste Start / Pause · S überspringen. Läuft im Hintergrund und nach dem Neuladen weiter.",
  ),
};

const PHASE: Record<Phase, L10n> = {
  work: T.work,
  short: T.short,
  long: T.long,
};

const R = 88;
const C = 2 * Math.PI * R;

export default function Pomodoro() {
  const settingsSig = useToolState<Settings>("settings", DEFAULTS);
  const stateSig = useToolState<Pomo>("state", INITIAL, { share: false });
  const sound = useToolState("sound", true);
  const notifyOn = useToolState("notify", false);

  const s = normalizeSettings(settingsSig.value);
  const p = normalizePomo(stateSig.value);
  const running = p.endAt !== null;
  const now = useNow(running, 250);
  const alarm = useAlarm(chime());
  const first = useRef(true);

  // Apply phase ends (several if the tab slept); announce the ones that just happened.
  useEffect(() => {
    const { state, events } = advance(p, s, Date.now());
    if (!events.length) {
      first.current = false;
      return;
    }
    stateSig.value = state;
    const last = events[events.length - 1];
    if (!last || first.current) {
      first.current = false;
      return;
    }
    const late = Date.now() - last.at;
    if (sound.value && !alarm.covers("phase", last.at) && late < 15_000) alarm.ring();
    if (notifyOn.value && late < 60_000)
      notify(
        `🍅 ${tr(PHASE[last.next])}`,
        tr(T.ended).replace("{a}", tr(PHASE[last.phase])).replace("{b}", tr(PHASE[last.next])),
        "pomodoro",
      );
  }, [now, p.endAt]);

  useEffect(() => {
    alarm.sync(sound.value && p.endAt !== null ? [{ id: "phase", at: p.endAt }] : []);
  }, [p.endAt, sound.value]);

  const left = remaining(p, s, now);
  useTitle(running ? `🍅 ${formatRemaining(left)} · ${tr(PHASE[p.phase])}` : null);

  const set = (patch: Partial<Settings>) => {
    settingsSig.value = { ...s, ...patch };
  };
  const toggle = () => {
    alarm.ensure();
    stateSig.value = running ? pause(p, s, Date.now()) : start(p, s, Date.now());
  };

  useKeys((e) => {
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    } else if (e.key.toLowerCase() === "s") stateSig.value = skip(p, s, Date.now());
  });

  const frac = progress(p, s, now);
  const dots = cycleDots(p, s.cycles);
  const fresh = !running && p.left === null;

  return (
    <div class="grid-2 pomodoro">
      <div class={`panel pomodoro-main pomodoro-${p.phase}`}>
        <div class="pomodoro-phases">
          {(["work", "short", "long"] as Phase[]).map((ph) => (
            <span key={ph} class={ph === p.phase ? "on" : ""}>
              {tr(PHASE[ph])}
            </span>
          ))}
        </div>
        <svg class="pomodoro-ring" viewBox="0 0 200 200" role="img" aria-label={tr(PHASE[p.phase])}>
          <circle class="pomodoro-track" cx="100" cy="100" r={R} />
          <circle
            class="pomodoro-arc"
            cx="100"
            cy="100"
            r={R}
            stroke-dasharray={C}
            stroke-dashoffset={C * (1 - frac)}
            transform="rotate(-90 100 100)"
          />
          <text x="100" y="98" class="pomodoro-time">
            {formatRemaining(left)}
          </text>
          <text x="100" y="128" class="pomodoro-label">
            {tr(PHASE[p.phase])}
          </text>
        </svg>
        <div
          class="pomodoro-dots"
          role="img"
          aria-label={tr(T.inCycle)
            .replace("{n}", String(Math.min(s.cycles, (p.done % s.cycles) + 1)))
            .replace("{m}", String(s.cycles))}
        >
          {dots.map((on, i) => (
            <span key={i} class={on ? "on" : ""} />
          ))}
        </div>
        <div class="row pomodoro-buttons">
          <Button variant={running ? "secondary" : "primary"} onClick={toggle}>
            {tr(running ? T.pause : fresh ? T.start : T.resume)}
          </Button>
          <Button onClick={() => (stateSig.value = skip(p, s, Date.now()))}>{tr(T.skip)}</Button>
          <Button
            variant="ghost"
            icon="reset"
            disabled={fresh}
            onClick={() => (stateSig.value = restartPhase(p))}
          >
            {tr(T.restart)}
          </Button>
        </div>
        <div class="row">
          <span class="badge badge-info">
            {tr(T.today).replace("{n}", String(todayCount(p, localDateKey(new Date(now)))))}
          </span>
          <Button size="sm" variant="ghost" onClick={() => (stateSig.value = resetCycle(p))}>
            {tr(T.resetCycle)}
          </Button>
        </div>
        <p class="muted small">{tr(T.keys)}</p>
      </div>
      <Panel title={tr(T.settings)}>
        <div class="grid-3">
          <NumberField
            label={tr(T.workLen)}
            value={s.work}
            min={1}
            max={180}
            integer
            suffix={tr(T.min)}
            onChange={(v) => set({ work: v })}
          />
          <NumberField
            label={tr(T.shortLen)}
            value={s.short}
            min={1}
            max={60}
            integer
            suffix={tr(T.min)}
            onChange={(v) => set({ short: v })}
          />
          <NumberField
            label={tr(T.longLen)}
            value={s.long}
            min={1}
            max={120}
            integer
            suffix={tr(T.min)}
            onChange={(v) => set({ long: v })}
          />
        </div>
        <NumberField
          label={tr(T.cycles)}
          value={s.cycles}
          min={1}
          max={12}
          integer
          onChange={(v) => set({ cycles: v })}
        />
        <Toggle
          label={tr(T.autoBreak)}
          checked={s.autoBreak}
          onChange={(v) => set({ autoBreak: v })}
        />
        <Toggle
          label={tr(T.autoWork)}
          checked={s.autoWork}
          onChange={(v) => set({ autoWork: v })}
        />
        <Toggle
          label={tr(T.sound)}
          checked={sound.value}
          onChange={(v) => {
            sound.value = v;
            if (v) alarm.ensure();
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
      </Panel>
    </div>
  );
}
