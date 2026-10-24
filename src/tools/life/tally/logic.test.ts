import { describe, expect, test } from "bun:test";
import {
  bump,
  type Counter,
  keyAction,
  normalizeBoard,
  normalizeCounters,
  shares,
  total,
} from "./logic";

const c = (value: number, step = 1): Counter => ({ id: String(value), name: "", value, step });

describe("counting", () => {
  test("steps and the zero floor", () => {
    expect(bump(5, 1, false)).toBe(6);
    expect(bump(0, -1, false)).toBe(-1);
    expect(bump(0, -1, true)).toBe(0);
    expect(bump(2, -5, true)).toBe(0);
  });
  test("decimal steps stay clean", () => {
    let v = 0;
    for (let i = 0; i < 3; i++) v = bump(v, 0.1, false);
    expect(v).toBe(0.3);
  });
  test("bounded", () => {
    expect(bump(1e12, 1, false)).toBe(1e12);
  });
  test("totals and shares", () => {
    expect(total([c(3), c(4.5), c(-1)])).toBe(6.5);
    expect(total([])).toBe(0);
    expect(shares([c(1), c(3)])).toEqual([25, 75]);
    expect(shares([c(0), c(0)])).toEqual([0, 0]);
  });
});

describe("keys", () => {
  const k = (key: string, code = "", shiftKey = false) => ({ key, code, shiftKey });
  test("counter mode", () => {
    expect(keyAction(k("&", "Digit1"), "counters")).toEqual({ type: "select", index: 0 });
    expect(keyAction(k("9", "Numpad9"), "counters")).toEqual({ type: "select", index: 8 });
    expect(keyAction(k("+"), "counters")).toEqual({ type: "inc" });
    expect(keyAction(k(" ", "Space"), "counters")).toEqual({ type: "inc" });
    expect(keyAction(k("ArrowDown"), "counters")).toEqual({ type: "dec" });
    expect(keyAction(k("-", "NumpadSubtract"), "counters")).toEqual({ type: "dec" });
    expect(keyAction(k("Backspace"), "counters")).toEqual({ type: "reset" });
    expect(keyAction(k("x", "KeyX"), "counters")).toBeNull();
    expect(keyAction(k("0", "Digit0"), "counters")).toBeNull();
  });
  test("scoreboard mode", () => {
    expect(keyAction(k("ArrowLeft"), "board")).toEqual({ type: "side", side: 0, delta: 1 });
    expect(keyAction(k("ArrowRight", "", true), "board")).toEqual({
      type: "side",
      side: 1,
      delta: -1,
    });
    expect(keyAction(k("q", "KeyA"), "board")).toEqual({ type: "side", side: 0, delta: 1 });
    expect(keyAction(k("+"), "board")).toBeNull();
  });
});

test("normalize", () => {
  expect(normalizeCounters([{ id: "a", value: "x", step: -2 }, 5])).toEqual([
    { id: "a", name: "", value: 0, step: 1 },
  ]);
  expect(normalizeBoard(null)).toEqual([
    { name: "A", score: 0 },
    { name: "B", score: 0 },
  ]);
  expect(normalizeBoard([{ name: "Home", score: 3 }])[0]).toEqual({ name: "Home", score: 3 });
});
