/**
 * Screen test helpers: refresh rate from animation frame times, the dead-pixel color cycle,
 * and keyboard layouts (QWERTY ANSI and French AZERTY ISO) keyed by physical key code.
 */

const RATES = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 170, 180, 200, 240, 360];

export function median(values: readonly number[]): number {
  if (!values.length) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/**
 * Refresh rate from consecutive frame timestamps (ms): the typical frame time, and the usual
 * rate it is closest to (within 5 %), if any.
 */
export function estimateRefresh(
  times: readonly number[],
): { hz: number; snapped: number | null } | null {
  const deltas: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const d = (times[i] as number) - (times[i - 1] as number);
    if (d > 0) deltas.push(d);
  }
  if (deltas.length < 5) return null;
  // Average the frame times close to the median: dropped frames (twice as long) are ignored,
  // and timer jitter averages out.
  const m = median(deltas);
  const near = deltas.filter((d) => Math.abs(d - m) < m / 2);
  const hz = 1000 / (near.reduce((a, b) => a + b, 0) / near.length);
  let snapped: number | null = null;
  for (const r of RATES)
    if (
      Math.abs(hz - r) / r < 0.05 &&
      (snapped === null || Math.abs(hz - r) < Math.abs(hz - snapped))
    )
      snapped = r;
  return { hz, snapped };
}

/** Colors of the dead / stuck pixel test, in order. */
export const TEST_COLORS: { css: string; en: string; fr: string }[] = [
  { css: "#000000", en: "Black", fr: "Noir" },
  { css: "#ffffff", en: "White", fr: "Blanc" },
  { css: "#ff0000", en: "Red", fr: "Rouge" },
  { css: "#00ff00", en: "Green", fr: "Vert" },
  { css: "#0000ff", en: "Blue", fr: "Bleu" },
  { css: "#00ffff", en: "Cyan", fr: "Cyan" },
  { css: "#ff00ff", en: "Magenta", fr: "Magenta" },
  { css: "#ffff00", en: "Yellow", fr: "Jaune" },
  { css: "#808080", en: "Gray", fr: "Gris" },
];

/** The next index in a cycle of `n`, going forward (1) or back (−1). */
export function cycle(i: number, n: number, dir: 1 | -1 = 1): number {
  return n > 0 ? (((i + dir) % n) + n) % n : 0;
}

export interface Key {
  /** KeyboardEvent.code; "" for a blank spacer. */
  code: string;
  label: string;
  /** Width in key units. */
  w: number;
}

export type Layout = "qwerty" | "azerty";

const k = (code: string, label: string, w = 1): Key => ({ code, label, w });

const FN_ROW: Key[] = [
  k("Escape", "Esc"),
  k("", "", 0.5),
  ...Array.from({ length: 12 }, (_, i) => k(`F${i + 1}`, `F${i + 1}`)),
];

const BOTTOM = (altGr: string): Key[] => [
  k("ControlLeft", "Ctrl", 1.25),
  k("MetaLeft", "⌘ ⊞", 1.25),
  k("AltLeft", "Alt", 1.25),
  k("Space", "", 6.25),
  k("AltRight", altGr, 1.25),
  k("MetaRight", "⌘ ⊞", 1.25),
  k("ContextMenu", "☰", 1.25),
  k("ControlRight", "Ctrl", 1.25),
];

const ARROWS: Key[] = [
  k("ArrowLeft", "←"),
  k("ArrowUp", "↑"),
  k("ArrowDown", "↓"),
  k("ArrowRight", "→"),
  k("", "", 0.5),
  k("Insert", "Ins"),
  k("Delete", "Del"),
  k("Home", "⇱"),
  k("End", "⇲"),
  k("PageUp", "⇞"),
  k("PageDown", "⇟"),
];

const letters = (codes: string, labels: string): Key[] =>
  [...codes].map((c, i) => k(`Key${c}`, labels[i] as string));

export const LAYOUTS: Record<Layout, Key[][]> = {
  qwerty: [
    FN_ROW,
    [
      k("Backquote", "`"),
      ...[..."1234567890"].map((d) => k(`Digit${d}`, d)),
      k("Minus", "-"),
      k("Equal", "="),
      k("Backspace", "⌫", 2),
    ],
    [
      k("Tab", "↹", 1.5),
      ...letters("QWERTYUIOP", "QWERTYUIOP"),
      k("BracketLeft", "["),
      k("BracketRight", "]"),
      k("Backslash", "\\", 1.5),
    ],
    [
      k("CapsLock", "⇪", 1.75),
      ...letters("ASDFGHJKL", "ASDFGHJKL"),
      k("Semicolon", ";"),
      k("Quote", "'"),
      k("Enter", "⏎", 2.25),
    ],
    [
      k("ShiftLeft", "⇧", 2.25),
      ...letters("ZXCVBNM", "ZXCVBNM"),
      k("Comma", ","),
      k("Period", "."),
      k("Slash", "/"),
      k("ShiftRight", "⇧", 2.75),
    ],
    BOTTOM("Alt"),
    ARROWS,
  ],
  azerty: [
    FN_ROW,
    [
      k("Backquote", "²"),
      ...[..."&é\"'(-è_çà"].map((c, i) => k(`Digit${(i + 1) % 10}`, c)),
      k("Minus", ")"),
      k("Equal", "="),
      k("Backspace", "⌫", 2),
    ],
    [
      k("Tab", "↹", 1.5),
      ...letters("QWERTYUIOP", "AZERTYUIOP"),
      k("BracketLeft", "^"),
      k("BracketRight", "$"),
      k("Enter", "⏎", 1.5),
    ],
    [
      k("CapsLock", "⇪", 1.75),
      ...letters("ASDFGHJKL", "QSDFGHJKL"),
      k("Semicolon", "M"),
      k("Quote", "ù"),
      k("Backslash", "*"),
      k("Enter", "", 1.25),
    ],
    [
      k("ShiftLeft", "⇧", 1.25),
      k("IntlBackslash", "<"),
      ...letters("ZXCVBN", "WXCVBN"),
      k("KeyM", ","),
      k("Comma", ";"),
      k("Period", ":"),
      k("Slash", "!"),
      k("ShiftRight", "⇧", 2.75),
    ],
    BOTTOM("AltGr"),
    ARROWS,
  ],
};

/** Every key code drawn on a layout. */
export function layoutCodes(layout: Layout): Set<string> {
  return new Set(
    LAYOUTS[layout]
      .flat()
      .map((x) => x.code)
      .filter(Boolean),
  );
}

/** Total width of a row, in key units. */
export function rowWidth(row: readonly Key[]): number {
  return row.reduce((s, x) => s + x.w, 0);
}

/** Physical pixels of a CSS size at a device pixel ratio. */
export function physicalPixels(w: number, h: number, dpr: number): { w: number; h: number } {
  return { w: Math.round(w * dpr), h: Math.round(h * dpr) };
}
