import { useToolState } from "../../../app/state";
import { Button, CopyButton, Panel } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { formatClock } from "../_shared";
import { useKeys, useNow, useTitle } from "../_ui";
import {
  EMPTY,
  elapsed,
  lap,
  lapRows,
  lapsText,
  normalize,
  running,
  toggle,
  type Watch,
} from "./logic";

const T = {
  start: l("Start", "Démarrer"),
  stop: l("Stop", "Arrêter"),
  resume: l("Resume", "Reprendre"),
  lap: l("Lap", "Tour"),
  reset: l("Reset", "Remettre à zéro"),
  laps: l("Laps", "Tours"),
  n: l("#", "N°"),
  split: l("Lap time", "Temps du tour"),
  total: l("Total", "Total"),
  best: l("best", "meilleur"),
  worst: l("slowest", "plus lent"),
  noLaps: l(
    "No laps yet. Press L (or the Lap button) while it runs.",
    "Aucun tour pour l'instant. Appuie sur L (ou le bouton Tour) pendant qu'il tourne.",
  ),
  keys: l(
    "Shortcuts: Space start / stop · L lap · R reset. It keeps counting in the background and after a reload.",
    "Raccourcis : Espace démarrer / arrêter · L tour · R remise à zéro. Il continue en arrière-plan et après un rechargement.",
  ),
};

export default function Stopwatch() {
  const state = useToolState<Watch>("watch", EMPTY, { share: false });
  const w = normalize(state.value);
  const on = running(w);
  const now = useNow(on, 0);
  const total = elapsed(w, now);
  const rows = lapRows(w.laps);
  const current = total - (w.laps[w.laps.length - 1] ?? 0);

  useTitle(on ? `⏱ ${formatClock(total)} · toolbelt` : null);

  const doToggle = () => {
    state.value = toggle(w, Date.now());
  };
  const doLap = () => {
    if (on) state.value = lap(w, Date.now());
  };
  const doReset = () => {
    state.value = EMPTY;
  };

  useKeys((e) => {
    if (e.key === " ") {
      e.preventDefault();
      doToggle();
    } else if (e.key.toLowerCase() === "l") doLap();
    else if (e.key.toLowerCase() === "r") doReset();
  });

  return (
    <div class="stack">
      <div class="panel stopwatch-face">
        <div class="stopwatch-time" aria-live="off">
          {formatClock(total, 2)}
        </div>
        {w.laps.length > 0 && (
          <div class="muted mono">
            {tr(T.lap)} {w.laps.length + 1} · {formatClock(current, 2)}
          </div>
        )}
        <div class="row stopwatch-buttons">
          <Button variant={on ? "secondary" : "primary"} onClick={doToggle}>
            {tr(on ? T.stop : total > 0 ? T.resume : T.start)}
          </Button>
          <Button onClick={doLap} disabled={!on}>
            {tr(T.lap)}
          </Button>
          <Button variant="ghost" icon="reset" onClick={doReset} disabled={total === 0 && !on}>
            {tr(T.reset)}
          </Button>
        </div>
        <p class="muted small">{tr(T.keys)}</p>
      </div>
      <Panel
        title={tr(T.laps)}
        actions={
          rows.length > 0 && (
            <CopyButton text={() => lapsText(w.laps, [tr(T.n), tr(T.split), tr(T.total)])} />
          )
        }
      >
        {rows.length === 0 ? (
          <p class="muted small">{tr(T.noLaps)}</p>
        ) : (
          <div class="table-wrap">
            <table class="table stopwatch-laps">
              <thead>
                <tr>
                  <th>{tr(T.n)}</th>
                  <th>{tr(T.split)}</th>
                  <th>{tr(T.total)}</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr
                    key={r.n}
                    class={r.best ? "stopwatch-best" : r.worst ? "stopwatch-worst" : ""}
                  >
                    <td>{r.n}</td>
                    <td class="mono">
                      {formatClock(r.split, 2)}
                      {r.best && <span class="stopwatch-tag"> {tr(T.best)}</span>}
                      {r.worst && <span class="stopwatch-tag"> {tr(T.worst)}</span>}
                    </td>
                    <td class="mono">{formatClock(r.total, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
