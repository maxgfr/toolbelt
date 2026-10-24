/**
 * Tally counters and a two-sided scoreboard: steps, totals, the floor at zero, and the keyboard
 * shortcuts as a pure mapping from key events to actions.
 */

export type Counter = {
  id: string;
  name: string;
  value: number;
  step: number;
};

export type Side = { name: string; score: number };

export const MAX_ABS = 1e12;

/** `value + delta`, kept at or above zero when `floorZero`, and within ±10^12. */
export function bump(value: number, delta: number, floorZero: boolean): number {
  let v = value + delta;
  if (floorZero) v = Math.max(0, v);
  v = Math.max(-MAX_ABS, Math.min(MAX_ABS, v));
  // Steps like 0.1 add up with binary noise: keep 10 decimals at most.
  return Math.round(v * 1e10) / 1e10;
}

export function total(counters: readonly Counter[]): number {
  return Math.round(counters.reduce((s, c) => s + c.value, 0) * 1e10) / 1e10;
}

/** Each counter's share of the total, in percent (0 when the total is 0). */
export function shares(counters: readonly Counter[]): number[] {
  const t = counters.reduce((s, c) => s + Math.abs(c.value), 0);
  return counters.map((c) => (t ? (Math.abs(c.value) / t) * 100 : 0));
}

export type Action =
  | { type: "inc" }
  | { type: "dec" }
  | { type: "select"; index: number }
  | { type: "reset" }
  | { type: "side"; side: 0 | 1; delta: number };

/**
 * The action for a key press: in counter mode, 1–9 select a counter, + / ↑ / Space add a step,
 * − / ↓ remove one, Backspace resets the selected counter. On the scoreboard, ← (or the A / Q
 * key) gives a point to the left side, → (or L / P) to the right one; with Shift, it takes one.
 */
export function keyAction(
  e: { key: string; code: string; shiftKey: boolean },
  mode: "counters" | "board",
): Action | null {
  if (mode === "board") {
    const delta = e.shiftKey ? -1 : 1;
    if (e.key === "ArrowLeft" || e.code === "KeyA" || e.code === "KeyQ")
      return { type: "side", side: 0, delta };
    if (e.key === "ArrowRight" || e.code === "KeyL" || e.code === "KeyP")
      return { type: "side", side: 1, delta };
    return null;
  }
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (digit) return { type: "select", index: Number(digit[1]) - 1 };
  if (
    e.key === "+" ||
    e.key === "=" ||
    e.key === "ArrowUp" ||
    e.key === " " ||
    e.code === "NumpadAdd"
  )
    return { type: "inc" };
  if (e.key === "-" || e.key === "_" || e.key === "ArrowDown" || e.code === "NumpadSubtract")
    return { type: "dec" };
  if (e.key === "Backspace") return { type: "reset" };
  return null;
}

export function normalizeCounters(v: unknown): Counter[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string") return [];
    const value = typeof o.value === "number" && Number.isFinite(o.value) ? o.value : 0;
    const step = typeof o.step === "number" && Number.isFinite(o.step) && o.step > 0 ? o.step : 1;
    return [{ id: o.id, name: typeof o.name === "string" ? o.name : "", value, step }];
  });
}

export function normalizeBoard(v: unknown): [Side, Side] {
  const side = (x: unknown, name: string): Side => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return {
      name: typeof o.name === "string" ? o.name : name,
      score: typeof o.score === "number" && Number.isFinite(o.score) ? o.score : 0,
    };
  };
  const a = Array.isArray(v) ? v : [];
  return [side(a[0], "A"), side(a[1], "B")];
}
