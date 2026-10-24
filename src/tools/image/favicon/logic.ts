/**
 * Favicon set: the sizes and file names, the ICO container (PNG entries), the web manifest and
 * the <link> tags, and the layout math of an icon (padding, corner radius, fitting). Pure.
 */
import { fail } from "../_shared";

export interface IconFile {
  size: number;
  name: string;
}

export const ICON_FILES: IconFile[] = [
  { size: 16, name: "favicon-16x16.png" },
  { size: 32, name: "favicon-32x32.png" },
  { size: 48, name: "favicon-48x48.png" },
  { size: 180, name: "apple-touch-icon.png" },
  { size: 192, name: "android-chrome-192x192.png" },
  { size: 512, name: "android-chrome-512x512.png" },
];

/** Sizes packed into favicon.ico. */
export const ICO_SIZES = [16, 32, 48];

export interface IcoImage {
  size: number;
  png: Uint8Array;
}

/**
 * An ICO file whose images are PNG streams (supported by every browser and Windows Vista+).
 * Sizes must be 1–256 (256 is written as 0 in the directory).
 */
export function writeIco(images: IcoImage[]): Uint8Array {
  if (!images.length)
    fail("An ICO needs at least one image.", "Un ICO demande au moins une image.");
  const header = 6 + 16 * images.length;
  const total = header + images.reduce((a, im) => a + im.png.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0, true); // reserved
  dv.setUint16(2, 1, true); // type: icon
  dv.setUint16(4, images.length, true);
  let offset = header;
  for (const [i, im] of images.entries()) {
    if (im.size < 1 || im.size > 256 || !Number.isInteger(im.size))
      fail("ICO images must be 1 to 256 px.", "Les images ICO doivent faire de 1 à 256 px.");
    const e = 6 + i * 16;
    out[e] = im.size === 256 ? 0 : im.size; // width
    out[e + 1] = im.size === 256 ? 0 : im.size; // height
    out[e + 2] = 0; // palette colors
    out[e + 3] = 0; // reserved
    dv.setUint16(e + 4, 1, true); // color planes
    dv.setUint16(e + 6, 32, true); // bits per pixel
    dv.setUint32(e + 8, im.png.length, true);
    dv.setUint32(e + 12, offset, true);
    out.set(im.png, offset);
    offset += im.png.length;
  }
  return out;
}

/** Reads an ICO directory back (for tests and checks). */
export function readIco(
  b: Uint8Array,
): { width: number; height: number; bpp: number; data: Uint8Array }[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 6 || dv.getUint16(0, true) !== 0 || dv.getUint16(2, true) !== 1)
    fail("Not an ICO file.", "Ce n'est pas un fichier ICO.");
  const n = dv.getUint16(4, true);
  const out = [];
  for (let i = 0; i < n; i++) {
    const e = 6 + i * 16;
    const size = dv.getUint32(e + 8, true);
    const off = dv.getUint32(e + 12, true);
    if (off + size > b.length) fail("Truncated ICO file.", "Fichier ICO tronqué.");
    out.push({
      width: (b[e] as number) || 256,
      height: (b[e + 1] as number) || 256,
      bpp: dv.getUint16(e + 6, true),
      data: b.subarray(off, off + size),
    });
  }
  return out;
}

export interface ManifestOptions {
  name: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
}

/** The site.webmanifest JSON (icons at the site root). */
export function manifest(o: ManifestOptions): string {
  const m = {
    name: o.name || "My site",
    short_name: o.shortName || o.name || "Site",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: o.themeColor,
    background_color: o.backgroundColor,
    display: "standalone",
  };
  return `${JSON.stringify(m, null, 2)}\n`;
}

/** The <link> tags to put in <head>. */
export function linkTags(themeColor: string): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${themeColor}">`,
  ].join("\n");
}

export interface IconLayout {
  /** Corner radius of the background, px. */
  radius: number;
  /** The content box (inside the padding). */
  x: number;
  y: number;
  box: number;
}

/** Background radius and content box of a `size` px icon; padding and radius in % of the size. */
export function iconLayout(size: number, paddingPct: number, radiusPct: number): IconLayout {
  const pad = (size * Math.min(45, Math.max(0, paddingPct))) / 100;
  const radius = (size * Math.min(50, Math.max(0, radiusPct))) / 100;
  return { radius, x: pad, y: pad, box: size - 2 * pad };
}

/** Where to draw a w × h source to fit ("contain") a square box at (x, y). */
export function containRect(
  w: number,
  h: number,
  x: number,
  y: number,
  box: number,
): { x: number; y: number; w: number; h: number } {
  const s = Math.min(box / w, box / h);
  const dw = w * s;
  const dh = h * s;
  return { x: x + (box - dw) / 2, y: y + (box - dh) / 2, w: dw, h: dh };
}

/** Font size that fits a text measured at 100 px (width, ascent + descent) into a square box. */
export function fitFontSize(width100: number, height100: number, box: number): number {
  if (width100 <= 0 || height100 <= 0) return box;
  return Math.max(1, Math.min((box * 100) / width100, (box * 100) / height100));
}
