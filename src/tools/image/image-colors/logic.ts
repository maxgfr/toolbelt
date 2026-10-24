/**
 * Palette extraction: pixel sampling, a seeded k-means (k-means++ start) that runs one
 * iteration per step so the view can yield between steps, the average color, and color
 * formats (hex, rgb, hsl). Pure.
 */
import { type Rgb, toHex } from "../_shared";

/** Up to `max` opaque pixels (alpha ≥ 128) taken on an even stride over RGBA data. */
export function samplePixels(data: Uint8ClampedArray | Uint8Array, max = 40000): Float32Array {
  const n = data.length >> 2;
  const stride = Math.max(1, Math.floor(n / max));
  const out = new Float32Array(Math.min(n, max + 1) * 3);
  let k = 0;
  for (let i = 0; i < n && k + 3 <= out.length; i += stride) {
    const p = i * 4;
    if ((data[p + 3] as number) < 128) continue;
    out[k++] = data[p] as number;
    out[k++] = data[p + 1] as number;
    out[k++] = data[p + 2] as number;
  }
  return out.subarray(0, k);
}

/** Mean color of sampled pixels (null when there are none). */
export function averageColor(px: Float32Array): Rgb | null {
  const n = px.length / 3;
  if (!n) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < px.length; i += 3) {
    r += px[i] as number;
    g += px[i + 1] as number;
    b += px[i + 2] as number;
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Mulberry32: a small seeded PRNG, so the same image always gives the same palette. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Swatch {
  rgb: Rgb;
  /** Share of the sampled pixels, 0–1. */
  share: number;
}

export interface KMeans {
  /** Runs one assignment + update pass; true once it has converged (or hit the limit). */
  step(): boolean;
  result(): Swatch[];
}

function dist2(px: Float32Array, i: number, c: Float64Array, j: number): number {
  const dr = (px[i] as number) - (c[j] as number);
  const dg = (px[i + 1] as number) - (c[j + 1] as number);
  const db = (px[i + 2] as number) - (c[j + 2] as number);
  return dr * dr + dg * dg + db * db;
}

/** k-means over RGB samples; at most k clusters (fewer when the image has fewer colors). */
export function kmeans(px: Float32Array, k: number, seed = 1, maxIter = 24): KMeans {
  const n = px.length / 3;
  const rand = rng(seed);
  const kk = Math.max(1, Math.min(k, n));
  const centers = new Float64Array(kk * 3);
  const assign = new Int32Array(n).fill(-1);
  const counts = new Float64Array(kk);
  let used = 0;

  // k-means++ start: each new center is drawn proportionally to its squared distance.
  if (n > 0) {
    const first = Math.floor(rand() * n) * 3;
    centers.set([px[first] as number, px[first + 1] as number, px[first + 2] as number], 0);
    used = 1;
    const d = new Float64Array(n);
    for (let i = 0; i < n; i++) d[i] = dist2(px, i * 3, centers, 0);
    while (used < kk) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += d[i] as number;
      if (sum === 0) break; // fewer distinct colors than k
      let r = rand() * sum;
      let pick = n - 1;
      for (let i = 0; i < n; i++) {
        r -= d[i] as number;
        if (r <= 0) {
          pick = i;
          break;
        }
      }
      centers.set(
        [px[pick * 3] as number, px[pick * 3 + 1] as number, px[pick * 3 + 2] as number],
        used * 3,
      );
      for (let i = 0; i < n; i++)
        d[i] = Math.min(d[i] as number, dist2(px, i * 3, centers, used * 3));
      used++;
    }
  }

  let iter = 0;
  let done = n === 0;
  const sums = new Float64Array(used * 3);

  return {
    step() {
      if (done) return true;
      let changed = 0;
      sums.fill(0);
      counts.fill(0);
      for (let i = 0; i < n; i++) {
        let best = 0;
        let bestD = Number.POSITIVE_INFINITY;
        for (let j = 0; j < used; j++) {
          const dd = dist2(px, i * 3, centers, j * 3);
          if (dd < bestD) {
            bestD = dd;
            best = j;
          }
        }
        if (assign[i] !== best) {
          assign[i] = best;
          changed++;
        }
        counts[best] = (counts[best] as number) + 1;
        sums[best * 3] = (sums[best * 3] as number) + (px[i * 3] as number);
        sums[best * 3 + 1] = (sums[best * 3 + 1] as number) + (px[i * 3 + 1] as number);
        sums[best * 3 + 2] = (sums[best * 3 + 2] as number) + (px[i * 3 + 2] as number);
      }
      for (let j = 0; j < used; j++) {
        const c = counts[j] as number;
        if (c > 0) for (let t = 0; t < 3; t++) centers[j * 3 + t] = (sums[j * 3 + t] as number) / c;
      }
      iter++;
      done = changed === 0 || iter >= maxIter || changed / n < 0.001;
      return done;
    },
    result() {
      const out: Swatch[] = [];
      for (let j = 0; j < used; j++) {
        const c = counts[j] as number;
        if (c > 0)
          out.push({
            rgb: [
              Math.round(centers[j * 3] as number),
              Math.round(centers[j * 3 + 1] as number),
              Math.round(centers[j * 3 + 2] as number),
            ],
            share: c / n,
          });
      }
      return out.sort((a, b) => b.share - a.share);
    },
  };
}

/** Runs k-means to the end in one go (tests, small inputs). */
export function palette(px: Float32Array, k: number, seed = 1): Swatch[] {
  const km = kmeans(px, k, seed);
  while (!km.step()) {}
  return km.result();
}

/* --- Formats ---------------------------------------------------------------------- */

export type Hsl = [number, number, number];

/** RGB 0–255 → HSL (hue 0–360, saturation and lightness 0–100), rounded. */
export function rgbToHsl([r, g, b]: Rgb): Hsl {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const L = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
  }
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(L * 100)];
}

export function formatsOf(c: Rgb): { hex: string; rgb: string; hsl: string } {
  const [h, s, l] = rgbToHsl(c);
  return {
    hex: toHex(c),
    rgb: `rgb(${c[0]} ${c[1]} ${c[2]})`,
    hsl: `hsl(${h} ${s}% ${l}%)`,
  };
}

/** Relative luminance (WCAG) to pick black or white text on a swatch. */
export function textOn([r, g, b]: Rgb): "#000000" | "#ffffff" {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

/** The palette as CSS custom properties. */
export function cssVariables(sw: Swatch[], prefix = "color"): string {
  return `:root {\n${sw.map((s, i) => `  --${prefix}-${i + 1}: ${toHex(s.rgb)};`).join("\n")}\n}`;
}

/** Image pixel under a click: maps a point in a displayed box to source pixel coordinates. */
export function pickPoint(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
  w: number,
  h: number,
): { x: number; y: number } {
  const x = Math.floor(((clientX - box.left) / box.width) * w);
  const y = Math.floor(((clientY - box.top) / box.height) * h);
  return { x: Math.min(w - 1, Math.max(0, x)), y: Math.min(h - 1, Math.max(0, y)) };
}
