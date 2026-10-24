/** The everyday percentage questions. Every function returns null when the answer is undefined (÷ 0). */

/** X % of Y. */
export function percentOf(x: number, y: number): number {
  return (x / 100) * y;
}

/** X is what % of Y. */
export function whatPercent(x: number, y: number): number | null {
  return y === 0 ? null : (x / y) * 100;
}

/** % change from X to Y (relative to |X|, so a rise is positive even from a negative start). */
export function percentChange(from: number, to: number): number | null {
  return from === 0 ? null : ((to - from) / Math.abs(from)) * 100;
}

/** Y increased (or, with a negative X, decreased) by X %. */
export function addPercent(y: number, x: number): number {
  return y * (1 + x / 100);
}

/** The value before an X % change that gave Y: 120 after +20 % was 100. */
export function reversePercent(y: number, x: number): number | null {
  const f = 1 + x / 100;
  return f === 0 ? null : y / f;
}

/** Difference between two values relative to their mean (symmetric, unlike a change). */
export function percentDifference(a: number, b: number): number | null {
  const mean = (Math.abs(a) + Math.abs(b)) / 2;
  return mean === 0 ? null : (Math.abs(a - b) / mean) * 100;
}

/** Removes floating-point noise: 0.1 + 0.2 → 0.3. */
export function clean(n: number): number {
  return Number(n.toPrecision(12));
}
