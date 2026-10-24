/**
 * Browser-side helpers of the image tools: decoding files into drawable sources (with the EXIF
 * orientation applied), canvas encoding, encoder feature detection. Needs the DOM.
 */
import { fail, mimeOf, type OutFormat } from "./_shared";

export interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

function isSvg(blob: Blob, name = ""): boolean {
  return blob.type === "image/svg+xml" || /\.svg$/i.test(name);
}

/** Loads an <img> from a blob (used for SVG, which createImageBitmap may refuse). */
function loadImg(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

/**
 * Decodes an image file. Raster images go through createImageBitmap with the EXIF orientation
 * applied; SVG goes through an <img> (no script runs and nothing external loads in that mode).
 */
export async function decodeImage(
  blob: Blob,
  name = "",
  svgFallback: Size2 = [512, 512],
): Promise<Decoded> {
  try {
    if (isSvg(blob, name)) {
      const img = await loadImg(blob);
      const w = img.naturalWidth || svgFallback[0];
      const h = img.naturalHeight || svgFallback[1];
      return { source: img, width: w, height: h, close: () => {} };
    }
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    fail(
      "This file is not an image the browser can open.",
      "Ce fichier n'est pas une image lisible par le navigateur.",
    );
  }
}

type Size2 = [number, number];

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement, readback = false): CanvasRenderingContext2D {
  const ctx = c.getContext("2d", readback ? { willReadFrequently: true } : undefined);
  if (!ctx) fail("Canvas is not available.", "Le canvas n'est pas disponible.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/**
 * Draws a source scaled into a new canvas. Big reductions go by halves first, which looks
 * much better than one bilinear step.
 */
export function drawScaled(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  w: number,
  h: number,
  background?: string,
): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cw = sw;
  let ch = sh;
  while (cw / 2 >= w && ch / 2 >= h && cw > 2 && ch > 2) {
    const half = makeCanvas(Math.round(cw / 2), Math.round(ch / 2));
    ctx2d(half).drawImage(cur, 0, 0, cw, ch, 0, 0, half.width, half.height);
    cur = half;
    cw = half.width;
    ch = half.height;
  }
  const out = makeCanvas(w, h);
  const ctx = ctx2d(out);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, out.width, out.height);
  return out;
}

/** Encodes a canvas; rejects when the browser cannot produce that type. */
export async function encodeCanvas(
  c: HTMLCanvasElement,
  format: OutFormat,
  quality = 0.85,
): Promise<Blob> {
  const mime = mimeOf(format);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, mime, quality));
  if (!blob || blob.type !== mime)
    fail(
      `This browser cannot encode ${format.toUpperCase()}.`,
      `Ce navigateur ne sait pas encoder le ${format.toUpperCase()}.`,
    );
  return blob;
}

const support = new Map<OutFormat, Promise<boolean>>();

/** Whether canvas.toBlob produces this format (unsupported types silently fall back to PNG). */
export function canEncode(format: OutFormat): Promise<boolean> {
  let p = support.get(format);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      try {
        const c = makeCanvas(2, 2);
        c.toBlob((b) => resolve(!!b && b.type === mimeOf(format)), mimeOf(format), 0.5);
      } catch {
        resolve(false);
      }
    });
    support.set(format, p);
  }
  return p;
}

export async function blobBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

/** A Blob of bytes (copied into a plain ArrayBuffer-backed array for the Blob constructor). */
export function bytesBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
}
