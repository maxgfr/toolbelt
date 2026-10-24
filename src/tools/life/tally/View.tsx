import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, IconButton, Segmented, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { newId } from "../_shared";
import { useKeys } from "../_ui";
import {
  bump,
  type Counter,
  keyAction,
  normalizeBoard,
  normalizeCounters,
  type Side,
  shares,
  total,
} from "./logic";

type Mode = "counters" | "board";

const T = {
  counters: l("Counters", "Compteurs", "Zähler"),
  board: l("Scoreboard", "Tableau des scores", "Anzeigetafel"),
  add: l("Add a counter", "Ajouter un compteur", "Zähler hinzufügen"),
  counter: l("Counter", "Compteur", "Zähler"),
  name: l("Name", "Nom", "Name"),
  step: l("Step", "Pas", "Schritt"),
  plus: l("Add", "Ajouter", "Hinzufügen"),
  minus: l("Remove", "Retirer", "Abziehen"),
  reset: l("Reset", "Remettre à zéro", "Zurücksetzen"),
  remove: l("Delete", "Supprimer", "Löschen"),
  resetAll: l("Reset all", "Tout remettre à zéro", "Alle zurücksetzen"),
  floor: l("Never below zero", "Jamais en dessous de zéro", "Nie unter null"),
  total: l("Total: {n}", "Total : {n}", "Gesamt: {n}"),
  keys: l(
    "Keys: 1–9 select a counter · + ↑ Space add · − ↓ remove · Backspace resets the selected one.",
    "Touches : 1–9 choisir un compteur · + ↑ Espace ajouter · − ↓ retirer · Retour arrière remet le compteur choisi à zéro.",
    "Tasten: 1–9 Zähler wählen · + ↑ Leertaste hinzufügen · − ↓ abziehen · Rücktaste setzt den gewählten zurück.",
  ),
  boardKeys: l(
    "Keys: ← or A for the left side, → or L for the right side; hold Shift to take a point back.",
    "Touches : ← ou A pour le côté gauche, → ou L pour le côté droit ; avec Maj pour retirer un point.",
    "Tasten: ← oder A für die linke Seite, → oder L für die rechte; mit Umschalt nimmst du einen Punkt zurück.",
  ),
  swap: l("Swap sides", "Échanger les côtés", "Seiten tauschen"),
  resetScores: l("Reset scores", "Remettre les scores à zéro", "Punktestand zurücksetzen"),
  home: l("Home", "Domicile", "Heim"),
  away: l("Away", "Extérieur", "Gast"),
  empty: l(
    "No counter: add one.",
    "Aucun compteur : ajoutes-en un.",
    "Kein Zähler: Füg einen hinzu.",
  ),
};

function buzz() {
  try {
    navigator.vibrate?.(8);
  } catch {}
}

export default function Tally() {
  const mode = useToolState<Mode>("mode", "counters");
  const stored = useToolState<Counter[]>("counters", [{ id: "c1", name: "", value: 0, step: 1 }]);
  const selected = useToolState("selected", 0);
  const floor = useToolState("floor", true);
  const boardSig = useToolState<Side[]>("board", [
    { name: tr(T.home), score: 0 },
    { name: tr(T.away), score: 0 },
  ]);

  const counters = normalizeCounters(stored.value);
  const board = normalizeBoard(boardSig.value);
  const sel = Math.min(Math.max(0, selected.value), Math.max(0, counters.length - 1));

  const change = (i: number, fn: (c: Counter) => Counter) => {
    stored.value = counters.map((c, j) => (j === i ? fn(c) : c));
  };
  const step = (i: number, dir: 1 | -1) => {
    change(i, (c) => ({ ...c, value: bump(c.value, dir * c.step, floor.value) }));
    selected.value = i;
    if (dir > 0) buzz();
  };
  const score = (side: 0 | 1, delta: number) => {
    boardSig.value = board.map((s, i) =>
      i === side ? { ...s, score: bump(s.score, delta, true) } : s,
    );
    if (delta > 0) buzz();
  };

  useKeys((e) => {
    const a = keyAction(e, mode.value);
    if (!a) return;
    e.preventDefault();
    if (a.type === "side") score(a.side, a.delta);
    else if (a.type === "select") {
      if (a.index < counters.length) selected.value = a.index;
    } else if (counters.length) {
      if (a.type === "inc") step(sel, 1);
      else if (a.type === "dec") step(sel, -1);
      else change(sel, (c) => ({ ...c, value: 0 }));
    }
  });

  const pct = shares(counters);

  return (
    <div class="stack">
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "counters", label: tr(T.counters) },
            { value: "board", label: tr(T.board) },
          ]}
        />
      </div>

      {mode.value === "counters" ? (
        <>
          <div class="row">
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                stored.value = [...counters, { id: newId(), name: "", value: 0, step: 1 }];
                selected.value = counters.length;
              }}
            >
              {tr(T.add)}
            </Button>
            <Toggle
              label={tr(T.floor)}
              checked={floor.value}
              onChange={(v) => {
                floor.value = v;
              }}
            />
            <span class="spacer" />
            {counters.length > 1 && (
              <strong class="tally-total">
                {tr(T.total).replace("{n}", fmt(total(counters)))}
              </strong>
            )}
            <Button
              variant="ghost"
              icon="reset"
              disabled={counters.every((c) => c.value === 0)}
              onClick={() => {
                stored.value = counters.map((c) => ({ ...c, value: 0 }));
              }}
            >
              {tr(T.resetAll)}
            </Button>
          </div>
          {counters.length === 0 && <p class="muted">{tr(T.empty)}</p>}
          <div class="tally-grid">
            {counters.map((c, i) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: clicking a card only selects it for the keyboard
              // biome-ignore lint/a11y/useKeyWithClickEvents: digits 1–9 select cards from the keyboard
              <div
                key={c.id}
                class={`panel tally-card ${i === sel ? "tally-selected" : ""}`}
                onClick={() => {
                  selected.value = i;
                }}
              >
                <div class="row">
                  <span class="tally-index mono muted">{i < 9 ? i + 1 : ""}</span>
                  <input
                    class="input tally-name"
                    value={c.name}
                    placeholder={`${tr(T.counter)} ${i + 1}`}
                    aria-label={tr(T.name)}
                    maxLength={40}
                    onInput={(e) => {
                      const v = e.currentTarget.value;
                      change(i, (x) => ({ ...x, name: v }));
                    }}
                  />
                  <IconButton
                    icon="trash"
                    label={tr(T.remove)}
                    onClick={(e) => {
                      e.stopPropagation();
                      stored.value = counters.filter((x) => x.id !== c.id);
                    }}
                  />
                </div>
                <div class="tally-value" aria-live="polite">
                  {fmt(c.value)}
                </div>
                {counters.length > 1 && total(counters) !== 0 && (
                  <div class="tally-share" aria-hidden="true">
                    <span style={{ width: `${pct[i] ?? 0}%` }} />
                  </div>
                )}
                <div class="tally-buttons">
                  <button
                    type="button"
                    class="tally-btn"
                    aria-label={`${tr(T.minus)} ${c.step}`}
                    onClick={() => step(i, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    class="tally-btn tally-plus"
                    aria-label={`${tr(T.plus)} ${c.step}`}
                    onClick={() => step(i, 1)}
                  >
                    +
                  </button>
                </div>
                <div class="row tally-foot">
                  <div class="tally-step">
                    <NumberField
                      label={tr(T.step)}
                      value={c.step}
                      min={0.01}
                      max={1e6}
                      step="any"
                      onChange={(v) => change(i, (x) => ({ ...x, step: v > 0 ? v : 1 }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="reset"
                    disabled={c.value === 0}
                    onClick={() => change(i, (x) => ({ ...x, value: 0 }))}
                  >
                    {tr(T.reset)}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p class="muted small">{tr(T.keys)}</p>
        </>
      ) : (
        <>
          <div class="tally-board">
            {board.map((s, i) => {
              const side = i as 0 | 1;
              const lead = s.score > (board[1 - i]?.score ?? 0);
              return (
                <div key={i} class={`panel tally-side ${lead ? "tally-lead" : ""}`}>
                  <input
                    class="input tally-side-name"
                    value={s.name}
                    aria-label={tr(T.name)}
                    maxLength={30}
                    onInput={(e) => {
                      const v = e.currentTarget.value;
                      boardSig.value = board.map((x, j) => (j === i ? { ...x, name: v } : x));
                    }}
                  />
                  <button
                    type="button"
                    class="tally-score"
                    aria-label={`${s.name} +1`}
                    onClick={() => score(side, 1)}
                  >
                    {fmt(s.score)}
                  </button>
                  <div class="row tally-side-buttons">
                    <Button size="sm" onClick={() => score(side, -1)}>
                      −1
                    </Button>
                    <Button size="sm" onClick={() => score(side, 1)}>
                      +1
                    </Button>
                    <Button size="sm" onClick={() => score(side, 2)}>
                      +2
                    </Button>
                    <Button size="sm" onClick={() => score(side, 3)}>
                      +3
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div class="row">
            <Button
              icon="swap"
              onClick={() => {
                boardSig.value = [board[1], board[0]];
              }}
            >
              {tr(T.swap)}
            </Button>
            <Button
              variant="ghost"
              icon="reset"
              onClick={() => {
                boardSig.value = board.map((s) => ({ ...s, score: 0 }));
              }}
            >
              {tr(T.resetScores)}
            </Button>
          </div>
          <p class="muted small">{tr(T.boardKeys)}</p>
        </>
      )}
    </div>
  );
}
