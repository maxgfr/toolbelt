/**
 * Crop & resize math: crop rectangles in image pixels, drag handles with an optional locked
 * aspect ratio, rotations and flips of a crop, and the output size. Pure.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLES: Exclude<Handle, "move">[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export type AspectPreset = "free" | "original" | "1:1" | "4:3" | "3:2" | "16:9" | "9:16" | "custom";

export const PRESETS: AspectPreset[] = [
  "free",
  "original",
  "1:1",
  "4:3",
  "3:2",
  "16:9",
  "9:16",
  "custom",
];

/** Width / height of a preset, or null for a free crop. */
export function aspectRatio(
  preset: AspectPreset,
  custom: { w: number; h: number },
  image: { w: number; h: number },
): number | null {
  switch (preset) {
    case "free":
      return null;
    case "original":
      return image.h > 0 ? image.w / image.h : null;
    case "custom":
      return custom.w > 0 && custom.h > 0 ? custom.w / custom.h : null;
    default: {
      const [a, b] = preset.split(":").map(Number);
      return (a as number) / (b as number);
    }
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The full image as a crop. */
export function fullRect(W: number, H: number): Rect {
  return { x: 0, y: 0, w: W, h: H };
}

/** Rounds a crop to whole pixels and keeps it inside the image, at least `min` px wide. */
export function clampRect(r: Rect, W: number, H: number, min = 1): Rect {
  const m = Math.min(min, W, H);
  const w = clamp(Math.round(r.w), m, W);
  const h = clamp(Math.round(r.h), m, H);
  return { x: clamp(Math.round(r.x), 0, W - w), y: clamp(Math.round(r.y), 0, H - h), w, h };
}

/** The largest rectangle of the given ratio inside `r`, centered on it. */
export function fitAspect(r: Rect, ratio: number, W: number, H: number): Rect {
  let w = r.w;
  let h = w / ratio;
  if (h > r.h) {
    h = r.h;
    w = h * ratio;
  }
  return clampRect({ x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h }, W, H);
}

/**
 * The crop after dragging `handle` by (dx, dy) image pixels from `start`. Corners keep the
 * opposite corner fixed, edges keep the opposite edge fixed; with a ratio, the box keeps its
 * shape (edges grow it around their middle). The result stays inside W × H.
 */
export function dragRect(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  W: number,
  H: number,
  ratio: number | null,
  min = 8,
): Rect {
  const m = Math.min(min, W, H);
  if (handle === "move") return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, W, H, m);

  const hasE = handle.includes("e");
  const hasW = handle.includes("w");
  const hasN = handle.includes("n");
  const hasS = handle.includes("s");

  if (ratio == null) {
    let left = start.x;
    let right = start.x + start.w;
    let top = start.y;
    let bottom = start.y + start.h;
    if (hasW) left = clamp(left + dx, 0, right - m);
    if (hasE) right = clamp(right + dx, left + m, W);
    if (hasN) top = clamp(top + dy, 0, bottom - m);
    if (hasS) bottom = clamp(bottom + dy, top + m, H);
    return clampRect({ x: left, y: top, w: right - left, h: bottom - top }, W, H, m);
  }

  const minW = Math.max(m, m * ratio);
  if ((hasE || hasW) && (hasN || hasS)) {
    // Corner: the opposite corner is the anchor.
    const ax = hasE ? start.x : start.x + start.w;
    const ay = hasS ? start.y : start.y + start.h;
    const wx = hasE ? start.w + dx : start.w - dx;
    const hy = hasS ? start.h + dy : start.h - dy;
    let w = wx / ratio >= hy ? wx : hy * ratio;
    const maxW = Math.min(hasE ? W - ax : ax, (hasS ? H - ay : ay) * ratio);
    w = clamp(w, Math.min(minW, maxW), maxW);
    const h = w / ratio;
    return clampRect({ x: hasE ? ax : ax - w, y: hasS ? ay : ay - h, w, h }, W, H, 1);
  }
  if (hasE || hasW) {
    // Side edge: width follows the pointer, height follows the ratio around the middle.
    const ax = hasE ? start.x : start.x + start.w;
    const cy = start.y + start.h / 2;
    const maxW = Math.min(hasE ? W - ax : ax, 2 * Math.min(cy, H - cy) * ratio);
    const w = clamp(hasE ? start.w + dx : start.w - dx, Math.min(minW, maxW), maxW);
    const h = w / ratio;
    return clampRect({ x: hasE ? ax : ax - w, y: cy - h / 2, w, h }, W, H, 1);
  }
  const ay = hasS ? start.y : start.y + start.h;
  const cx = start.x + start.w / 2;
  const maxH = Math.min(hasS ? H - ay : ay, (2 * Math.min(cx, W - cx)) / ratio);
  const h = clamp(hasS ? start.h + dy : start.h - dy, Math.min(minW / ratio, maxH), maxH);
  const w = h * ratio;
  return clampRect({ x: cx - w / 2, y: hasS ? ay : ay - h, w, h }, W, H, 1);
}

/* --- Rotation & flips -------------------------------------------------------- */

export interface Orientation {
  /** Clockwise quarter turns: 0–3. */
  turns: number;
  flipH: boolean;
  flipV: boolean;
}

/** Image size after the orientation. */
export function orientedSize(w: number, h: number, o: Orientation): { w: number; h: number } {
  return o.turns % 2 ? { w: h, h: w } : { w, h };
}

/**
 * Turns the orientation a quarter clockwise. The flips apply after the rotation, so they swap:
 * turning a mirrored image equals mirroring the turned one on the other axis.
 */
export function rotateOrientation(o: Orientation): Orientation {
  return { turns: (o.turns + 1) % 4, flipH: o.flipV, flipV: o.flipH };
}

/** A crop in a W × H image, moved with the image turned a quarter clockwise (now H × W). */
export function rotateRect(r: Rect, _W: number, H: number): Rect {
  return { x: H - (r.y + r.h), y: r.x, w: r.h, h: r.w };
}

export function flipRectH(r: Rect, W: number): Rect {
  return { ...r, x: W - r.x - r.w };
}

export function flipRectV(r: Rect, H: number): Rect {
  return { ...r, y: H - r.y - r.h };
}

/* --- Output size -------------------------------------------------------------- */

/** Browsers refuse canvases beyond these. */
export const MAX_SIDE = 16384;
export const MAX_AREA = 16384 * 16384;

export interface ResizeSettings {
  mode: "px" | "pct";
  /** Percent of the crop (pct mode). */
  pct: number;
  /** Requested size in px; 0 = automatic (follows the other side or the crop). */
  w: number;
  h: number;
  lock: boolean;
}

/** The final size of the cropped image, capped to what a canvas can hold. */
export function outputSize(
  crop: { w: number; h: number },
  s: ResizeSettings,
): { w: number; h: number } {
  let w: number;
  let h: number;
  if (s.mode === "pct") {
    w = (crop.w * s.pct) / 100;
    h = (crop.h * s.pct) / 100;
  } else if (s.lock) {
    if (s.w > 0) {
      w = s.w;
      h = (s.w * crop.h) / crop.w;
    } else if (s.h > 0) {
      h = s.h;
      w = (s.h * crop.w) / crop.h;
    } else {
      w = crop.w;
      h = crop.h;
    }
  } else {
    w = s.w > 0 ? s.w : crop.w;
    h = s.h > 0 ? s.h : crop.h;
  }
  let k = 1;
  k = Math.min(k, MAX_SIDE / w, MAX_SIDE / h, Math.sqrt(MAX_AREA / (w * h)));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
