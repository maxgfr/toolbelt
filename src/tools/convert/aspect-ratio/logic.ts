/** Aspect ratios: simplify W×H, scale to a new size, and name the closest common ratio. */

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** Number of decimals of a finite number, to scale decimals to integers (1.85 → 2). */
function decimals(n: number): number {
  const s = String(n);
  if (s.includes("e")) return 0;
  return s.split(".")[1]?.length ?? 0;
}

export interface Ratio {
  /** Simplified terms: 1920×1080 → 16, 9. */
  w: number;
  h: number;
  /** Width ÷ height. */
  value: number;
}

/** Simplified ratio of two positive sizes (decimals allowed: 1.85 × 1 → 37:20); null if invalid. */
export function simplify(width: number, height: number): Ratio | null {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height))
    return null;
  const scale = 10 ** Math.min(6, Math.max(decimals(width), decimals(height)));
  const a = Math.round(width * scale);
  const b = Math.round(height * scale);
  const g = gcd(a, b) || 1;
  return { w: a / g, h: b / g, value: width / height };
}

export const COMMON = [
  { w: 1, h: 1 },
  { w: 5, h: 4 },
  { w: 4, h: 3 },
  { w: 3, h: 2 },
  { w: 16, h: 10 },
  { w: 16, h: 9 },
  { w: 1.85, h: 1 },
  { w: 2, h: 1 },
  { w: 2.39, h: 1 },
  { w: 21, h: 9 },
  { w: 32, h: 9 },
  { w: 4, h: 5 },
  { w: 2, h: 3 },
  { w: 9, h: 16 },
];

/** The common ratio closest to `value` (by relative difference), and how far off it is (0.01 = 1 %). */
export function nearestCommon(value: number): { w: number; h: number; off: number } {
  let best = { w: 1, h: 1, off: Number.POSITIVE_INFINITY };
  for (const c of COMMON) {
    const off = Math.abs(value / (c.w / c.h) - 1);
    if (off < best.off) best = { ...c, off };
  }
  return best;
}

/** The other side for a ratio: height for a new width, or width for a new height. */
export function scale(ratio: number, side: "width" | "height", size: number): number | null {
  if (!(ratio > 0) || !(size > 0)) return null;
  return side === "width" ? size / ratio : size * ratio;
}

/** Common widths with a whole height for this ratio, for picking a real resolution. */
export function exactSizes(
  w: number,
  h: number,
  maxWidth = 7680,
  limit = 8,
): { w: number; h: number }[] {
  const r = simplify(w, h);
  if (!r) return [];
  const out: { w: number; h: number }[] = [];
  const preferred = [
    320, 480, 640, 720, 800, 1024, 1080, 1200, 1280, 1440, 1600, 1920, 2048, 2560, 3200, 3840, 5120,
    7680,
  ];
  for (const width of preferred) {
    if (width > maxWidth) break;
    if (width % r.w === 0) out.push({ w: width, h: (width / r.w) * r.h });
  }
  return out.slice(-limit);
}
