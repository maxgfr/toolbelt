/**
 * Image metadata: EXIF (TIFF IFD0, Exif, GPS, Interop, IFD1) from JPEG APP1, PNG eXIf and WebP
 * EXIF chunks; PNG text chunks; XMP, IPTC, ICC and comments as blocks. Plus lossless metadata
 * removal for JPEG (drops APP1/APP13/COM segments), PNG (drops text/eXIf/tIME chunks) and WebP
 * (drops EXIF/XMP chunks). Pure: no DOM.
 */
import { type L10n, l } from "../../../i18n";
import { crc32, fail } from "../_shared";
import { type IfdKind, tagName } from "./tags";

/* --- Types ------------------------------------------------------------------- */

export interface Tag {
  ifd: IfdKind;
  id: number;
  name: string;
  /** TIFF field type (1 BYTE, 2 ASCII, 3 SHORT, 4 LONG, 5 RATIONAL, 7 UNDEFINED, …). */
  type: number;
  count: number;
  /** Numbers (rationals divided out), a string for ASCII, raw bytes for UNDEFINED/BYTE. */
  value: number[] | string | Uint8Array;
  /** Numerator/denominator pairs for (S)RATIONAL types. */
  rationals?: [number, number][];
}

export interface MetaBlock {
  kind: "exif" | "xmp" | "iptc" | "icc" | "comment" | "text" | "jfif" | "time" | "other";
  label: string;
  size: number;
  /** Readable content (XMP packet, comment, PNG text). */
  text?: string;
}

export interface Gps {
  lat: number;
  lon: number;
  alt?: number;
}

export interface ParsedMeta {
  format: "jpeg" | "png" | "webp" | "other";
  tags: Tag[];
  blocks: MetaBlock[];
  /** Bytes of metadata found (all blocks). */
  metaBytes: number;
}

/* --- TIFF / EXIF ------------------------------------------------------------- */

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
  13: 4,
};

const POINTERS: Record<number, IfdKind> = { 34665: "Exif", 34853: "GPS", 40965: "Interop" };

/**
 * Parses a TIFF structure (the body of an EXIF block, starting with "II" or "MM").
 * Malformed entries are skipped; a broken header throws.
 */
export function parseTiff(b: Uint8Array): Tag[] {
  if (b.length < 8) fail("EXIF data is truncated.", "Les données EXIF sont tronquées.");
  const order = String.fromCharCode(b[0] as number, b[1] as number);
  if (order !== "II" && order !== "MM")
    fail(
      "EXIF data has no valid byte order.",
      "Les données EXIF n'ont pas d'ordre d'octets valide.",
    );
  const le = order === "II";
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint16(2, le) !== 42) fail("Not a TIFF/EXIF block.", "Ce n'est pas un bloc TIFF/EXIF.");
  const tags: Tag[] = [];
  const seen = new Set<number>();

  const readIfd = (off: number, kind: IfdKind): number => {
    if (off < 8 || off + 2 > b.length || seen.has(off)) return 0;
    seen.add(off);
    const n = dv.getUint16(off, le);
    if (n > 1000) return 0;
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > b.length) break;
      const id = dv.getUint16(e, le);
      const type = dv.getUint16(e + 2, le);
      const count = dv.getUint32(e + 4, le);
      const size = (TYPE_SIZE[type] ?? 0) * count;
      if (!TYPE_SIZE[type] || size > b.length) continue;
      const at = size <= 4 ? e + 8 : dv.getUint32(e + 8, le);
      if (at + size > b.length) continue;
      const sub = POINTERS[id];
      if (sub && (type === 4 || type === 13 || type === 3)) {
        readIfd(type === 3 ? dv.getUint16(e + 8, le) : dv.getUint32(e + 8, le), sub);
        continue;
      }
      tags.push(readValue(dv, b, le, kind, id, type, count, at));
    }
    const nextAt = off + 2 + n * 12;
    return nextAt + 4 <= b.length ? dv.getUint32(nextAt, le) : 0;
  };

  const next = readIfd(dv.getUint32(4, le), "IFD0");
  if (next) readIfd(next, "IFD1");
  return tags;
}

function readValue(
  dv: DataView,
  b: Uint8Array,
  le: boolean,
  ifd: IfdKind,
  id: number,
  type: number,
  count: number,
  at: number,
): Tag {
  const base = { ifd, id, name: tagName(ifd, id), type, count };
  if (type === 2) {
    let s = "";
    for (let i = 0; i < count; i++) s += String.fromCharCode(b[at + i] as number);
    // ASCII in EXIF is often UTF-8 in practice.
    const bytes = b.subarray(at, at + count);
    try {
      s = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {}
    return { ...base, value: s.replace(/\0+$/, "").trim() };
  }
  if (type === 1 || type === 7 || type === 6) {
    return { ...base, value: b.slice(at, at + count) };
  }
  const nums: number[] = [];
  const rats: [number, number][] = [];
  const max = Math.min(count, 256);
  for (let i = 0; i < max; i++) {
    switch (type) {
      case 3:
        nums.push(dv.getUint16(at + i * 2, le));
        break;
      case 8:
        nums.push(dv.getInt16(at + i * 2, le));
        break;
      case 4:
      case 13:
        nums.push(dv.getUint32(at + i * 4, le));
        break;
      case 9:
        nums.push(dv.getInt32(at + i * 4, le));
        break;
      case 5:
      case 10: {
        const n = type === 5 ? dv.getUint32(at + i * 8, le) : dv.getInt32(at + i * 8, le);
        const d = type === 5 ? dv.getUint32(at + i * 8 + 4, le) : dv.getInt32(at + i * 8 + 4, le);
        rats.push([n, d]);
        nums.push(d === 0 ? 0 : n / d);
        break;
      }
      case 11:
        nums.push(dv.getFloat32(at + i * 4, le));
        break;
      case 12:
        nums.push(dv.getFloat64(at + i * 8, le));
        break;
    }
  }
  return rats.length ? { ...base, value: nums, rationals: rats } : { ...base, value: nums };
}

/* --- Reading values ------------------------------------------------------------ */

export function findTag(tags: Tag[], name: string): Tag | undefined {
  return tags.find((t) => t.name === name && t.ifd !== "IFD1");
}

function num(tags: Tag[], name: string): number | undefined {
  const v = findTag(tags, name)?.value;
  return Array.isArray(v) ? v[0] : undefined;
}

function str(tags: Tag[], name: string): string | undefined {
  const v = findTag(tags, name)?.value;
  return typeof v === "string" && v ? v : undefined;
}

/** Degrees, minutes, seconds → signed decimal degrees ("S" and "W" are negative). */
export function dmsToDecimal(dms: number[], ref: string): number {
  const [d = 0, m = 0, s = 0] = dms;
  const v = d + m / 60 + s / 3600;
  return /^[SW]/i.test(ref) ? -v : v;
}

/** 48.8582 → "48° 51′ 29.5″ N". */
export function decimalToDms(v: number, axis: "lat" | "lon"): string {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.floor((a - d) * 60);
  let s = Math.round(((a - d) * 60 - m) * 60 * 10) / 10;
  if (s >= 60) {
    s = 0;
    m++;
  }
  if (m >= 60) {
    m = 0;
    d++;
  }
  const hemi = axis === "lat" ? (v < 0 ? "S" : "N") : v < 0 ? "W" : "E";
  return `${d}° ${m}′ ${s}″ ${hemi}`;
}

export function gpsOf(tags: Tag[]): Gps | null {
  const lat = findTag(tags, "GPSLatitude")?.value;
  const lon = findTag(tags, "GPSLongitude")?.value;
  if (!Array.isArray(lat) || !Array.isArray(lon) || lat.length < 1 || lon.length < 1) return null;
  const g: Gps = {
    lat: dmsToDecimal(lat, str(tags, "GPSLatitudeRef") ?? "N"),
    lon: dmsToDecimal(lon, str(tags, "GPSLongitudeRef") ?? "E"),
  };
  if (
    !Number.isFinite(g.lat) ||
    !Number.isFinite(g.lon) ||
    Math.abs(g.lat) > 90 ||
    Math.abs(g.lon) > 180
  )
    return null;
  const alt = num(tags, "GPSAltitude");
  if (alt != null) {
    const ref = findTag(tags, "GPSAltitudeRef")?.value;
    const below = ref instanceof Uint8Array ? ref[0] === 1 : Array.isArray(ref) && ref[0] === 1;
    g.alt = below ? -alt : alt;
  }
  return g;
}

/** EXIF orientation 1–8 (1 when absent or invalid). */
export function orientationOf(tags: Tag[]): number {
  const o = num(tags, "Orientation");
  return o != null && o >= 1 && o <= 8 ? o : 1;
}

/** "1/250 s", "2 s", "0.5 s". */
export function exposureText(t: Tag): string {
  const [n, d] = t.rationals?.[0] ?? [0, 0];
  const v = Array.isArray(t.value) ? (t.value[0] ?? 0) : 0;
  if (v <= 0) return "0 s";
  if (v >= 1) return `${round(v, 1)} s`;
  if (n === 1) return `1/${d} s`;
  return `1/${Math.round(1 / v)} s`;
}

function round(v: number, digits: number): string {
  return String(Math.round(v * 10 ** digits) / 10 ** digits);
}

const ORIENTATION: Record<number, L10n> = {
  1: l("Normal", "Normale"),
  2: l("Mirrored horizontally", "Miroir horizontal"),
  3: l("Rotated 180°", "Pivotée de 180°"),
  4: l("Mirrored vertically", "Miroir vertical"),
  5: l("Mirrored, rotated 90° counter-clockwise", "Miroir, pivotée de 90° antihoraire"),
  6: l("Rotated 90° clockwise", "Pivotée de 90° horaire"),
  7: l("Mirrored, rotated 90° clockwise", "Miroir, pivotée de 90° horaire"),
  8: l("Rotated 90° counter-clockwise", "Pivotée de 90° antihoraire"),
};

const EXPOSURE_PROGRAM: Record<number, L10n> = {
  0: l("Not defined", "Non défini"),
  1: l("Manual", "Manuel"),
  2: l("Program (auto)", "Programme (auto)"),
  3: l("Aperture priority", "Priorité ouverture"),
  4: l("Shutter priority", "Priorité vitesse"),
  5: l("Creative", "Créatif"),
  6: l("Action", "Action"),
  7: l("Portrait", "Portrait"),
  8: l("Landscape", "Paysage"),
};

const METERING: Record<number, L10n> = {
  0: l("Unknown", "Inconnu"),
  1: l("Average", "Moyenne"),
  2: l("Center-weighted", "Pondérée centrale"),
  3: l("Spot", "Spot"),
  4: l("Multi-spot", "Multi-spot"),
  5: l("Pattern (matrix)", "Matricielle"),
  6: l("Partial", "Partielle"),
  255: l("Other", "Autre"),
};

const WHITE_BALANCE: Record<number, L10n> = { 0: l("Auto", "Auto"), 1: l("Manual", "Manuelle") };
const EXPOSURE_MODE: Record<number, L10n> = {
  0: l("Auto", "Auto"),
  1: l("Manual", "Manuelle"),
  2: l("Auto bracket", "Bracketing auto"),
};
const SCENE: Record<number, L10n> = {
  0: l("Standard", "Standard"),
  1: l("Landscape", "Paysage"),
  2: l("Portrait", "Portrait"),
  3: l("Night", "Nuit"),
};
const RES_UNIT: Record<number, L10n> = {
  1: l("none", "aucune"),
  2: l("inch", "pouce"),
  3: l("cm", "cm"),
};

export function orientationText(o: number): L10n {
  return ORIENTATION[o] ?? l(String(o), String(o));
}

function flashText(v: number): L10n {
  const fired = (v & 1) === 1;
  const mode = (v >> 3) & 3;
  const base = fired ? l("Fired", "Déclenché") : l("Did not fire", "Non déclenché");
  if (mode === 3) return l(`${base.en} (auto)`, `${base.fr} (auto)`);
  if (mode === 1) return l(`${base.en} (forced)`, `${base.fr} (forcé)`);
  if (mode === 2) return l(`${base.en} (off)`, `${base.fr} (désactivé)`);
  return base;
}

function bytesText(b: Uint8Array): string {
  if (b.length <= 8 && [...b].every((x) => x >= 0x20 && x < 0x7f)) return String.fromCharCode(...b);
  if (b.length <= 16) return [...b].map((x) => x.toString(16).padStart(2, "0")).join(" ");
  return `${b.length} bytes`;
}

/** UTF-16LE text of the Windows XP* tags. */
function utf16le(b: Uint8Array): string {
  return new TextDecoder("utf-16le").decode(b).replace(/\0+$/, "");
}

/** EXIF UserComment: 8-byte charset prefix then text. */
function userComment(b: Uint8Array): string {
  const head = String.fromCharCode(...b.subarray(0, 8)).replace(/\0+$/, "");
  const body = b.subarray(8);
  const text =
    head === "UNICODE" ? new TextDecoder("utf-16be").decode(body) : new TextDecoder().decode(body);
  return text.replace(/\0+$/, "").trim();
}

function enumText(table: Record<number, L10n>, v: number): L10n {
  return table[v] ?? l(String(v), String(v));
}

/** A readable value for a tag, in both languages. */
export function formatTag(t: Tag): L10n {
  const same = (s: string) => l(s, s);
  const v = t.value;
  const n = Array.isArray(v) ? (v[0] ?? 0) : 0;
  switch (t.name) {
    case "Orientation":
      return orientationText(n);
    case "ExposureTime":
      return same(exposureText(t));
    case "FNumber":
    case "ApertureValue":
    case "MaxApertureValue":
      return same(`f/${round(t.name === "FNumber" ? n : Math.SQRT2 ** n, 1)}`);
    case "FocalLength":
      return same(`${round(n, 1)} mm`);
    case "FocalLengthIn35mmFilm":
      return same(`${n} mm`);
    case "ExposureBiasValue":
      return same(`${n > 0 ? "+" : ""}${round(n, 2)} EV`);
    case "ExposureProgram":
      return enumText(EXPOSURE_PROGRAM, n);
    case "MeteringMode":
      return enumText(METERING, n);
    case "Flash":
      return flashText(n);
    case "WhiteBalance":
      return enumText(WHITE_BALANCE, n);
    case "ExposureMode":
      return enumText(EXPOSURE_MODE, n);
    case "SceneCaptureType":
      return enumText(SCENE, n);
    case "ResolutionUnit":
    case "FocalPlaneResolutionUnit":
      return enumText(RES_UNIT, n);
    case "ColorSpace":
      return n === 1
        ? same("sRGB")
        : n === 65535
          ? l("Uncalibrated", "Non calibré")
          : same(String(n));
    case "GPSLatitude":
    case "GPSLongitude":
    case "GPSDestLatitude":
    case "GPSDestLongitude":
      if (Array.isArray(v)) return same(`${v.map((x) => round(x, 4)).join(", ")}`);
      break;
    case "GPSAltitude":
      return same(`${round(n, 1)} m`);
    case "GPSTimeStamp":
      if (Array.isArray(v))
        return same(
          v
            .map((x, i) =>
              i < 2 ? String(Math.round(x)).padStart(2, "0") : round(x, 2).padStart(2, "0"),
            )
            .join(":"),
        );
      break;
    case "ExifVersion":
    case "FlashpixVersion":
    case "InteroperabilityVersion":
      if (v instanceof Uint8Array) {
        const s = String.fromCharCode(...v);
        if (/^\d{4}$/.test(s)) return same(`${Number(s.slice(0, 2))}.${s.slice(2)}`);
      }
      break;
    case "UserComment":
      if (v instanceof Uint8Array) return same(userComment(v));
      break;
    case "XPTitle":
    case "XPComment":
    case "XPAuthor":
    case "XPKeywords":
    case "XPSubject":
      if (v instanceof Uint8Array) return same(utf16le(v));
      break;
  }
  if (typeof v === "string") return same(v);
  if (v instanceof Uint8Array) {
    const s = bytesText(v);
    return /^\d+ bytes$/.test(s) ? l(s, s.replace("bytes", "octets")) : same(s);
  }
  if (t.rationals && t.rationals.length <= 4)
    return same(
      t.rationals
        .map(([a, b], i) => (b === 1 || b === 0 ? String(a) : round(v[i] ?? 0, 4)))
        .join(", "),
    );
  const shown = v.slice(0, 16).map((x) => round(x, 4));
  return same(shown.join(", ") + (t.count > 16 ? ", …" : ""));
}

export interface Summary {
  camera?: string;
  lens?: string;
  date?: string;
  exposure?: string;
  aperture?: string;
  iso?: string;
  focal?: string;
  orientation?: number;
  software?: string;
  artist?: string;
  copyright?: string;
  gps?: Gps;
}

/** "2024:05:01 12:30:00" → "2024-05-01 12:30:00". */
export function exifDate(s: string): string {
  return s.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
}

export function summarize(tags: Tag[]): Summary {
  const out: Summary = {};
  const make = str(tags, "Make");
  const model = str(tags, "Model");
  if (make || model)
    out.camera =
      model && make && model.toLowerCase().startsWith(make.toLowerCase().split(" ")[0] ?? "")
        ? model
        : [make, model].filter(Boolean).join(" ");
  const lens = str(tags, "LensModel") ?? str(tags, "LensMake");
  if (lens) out.lens = lens;
  const date =
    str(tags, "DateTimeOriginal") ?? str(tags, "DateTimeDigitized") ?? str(tags, "DateTime");
  if (date) {
    const off = str(tags, "OffsetTimeOriginal") ?? str(tags, "OffsetTime");
    out.date = exifDate(date) + (off ? ` (UTC${off})` : "");
  }
  const exp = findTag(tags, "ExposureTime");
  if (exp) out.exposure = exposureText(exp);
  const f = num(tags, "FNumber");
  if (f) out.aperture = `f/${round(f, 1)}`;
  const iso = num(tags, "ISOSpeedRatings");
  if (iso) out.iso = `ISO ${iso}`;
  const focal = num(tags, "FocalLength");
  if (focal) {
    const f35 = num(tags, "FocalLengthIn35mmFilm");
    out.focal = `${round(focal, 1)} mm${f35 && f35 !== Math.round(focal) ? ` (${f35} mm eq.)` : ""}`;
  }
  if (findTag(tags, "Orientation")) out.orientation = orientationOf(tags);
  const sw = str(tags, "Software");
  if (sw) out.software = sw;
  const artist = str(tags, "Artist");
  if (artist) out.artist = artist;
  const copy = str(tags, "Copyright");
  if (copy) out.copyright = copy;
  const gps = gpsOf(tags);
  if (gps) out.gps = gps;
  return out;
}

/* --- Containers ------------------------------------------------------------------ */

function ascii(b: Uint8Array, at: number, len: number): string {
  let s = "";
  for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i] as number);
  return s;
}

function startsWith(b: Uint8Array, at: number, sig: string): boolean {
  return ascii(b, at, sig.length) === sig;
}

const EXIF_SIG = "Exif\0\0";
const XMP_SIG = "http://ns.adobe.com/xap/1.0/\0";
const XMP_EXT_SIG = "http://ns.adobe.com/xmp/extension/\0";

export interface Segment {
  marker: number;
  /** Offset of the 0xFF byte. */
  start: number;
  /** Offset just after the segment. */
  end: number;
  /** Payload (after the length field). */
  data: Uint8Array;
}

/** JPEG marker segments up to (and including) SOS; `scan` is where the image data starts. */
export function jpegSegments(b: Uint8Array): { segments: Segment[]; scan: number } {
  if (!(b[0] === 0xff && b[1] === 0xd8)) fail("Not a JPEG file.", "Ce n'est pas un fichier JPEG.");
  const segments: Segment[] = [];
  let p = 2;
  while (p < b.length) {
    if (b[p] !== 0xff) fail("Corrupt JPEG: marker expected.", "JPEG corrompu : marqueur attendu.");
    let m = b[p + 1] as number;
    while (m === 0xff && p + 2 < b.length) {
      p++;
      m = b[p + 1] as number;
    }
    if (m === 0xd9) return { segments, scan: p };
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) {
      p += 2;
      continue;
    }
    if (p + 4 > b.length) break;
    const len = ((b[p + 2] as number) << 8) | (b[p + 3] as number);
    if (len < 2 || p + 2 + len > b.length)
      fail(
        "Corrupt JPEG: segment overruns the file.",
        "JPEG corrompu : un segment dépasse la fin du fichier.",
      );
    const seg = { marker: m, start: p, end: p + 2 + len, data: b.subarray(p + 4, p + 2 + len) };
    segments.push(seg);
    p = seg.end;
    if (m === 0xda) return { segments, scan: seg.start };
  }
  fail("Corrupt JPEG: no image data.", "JPEG corrompu : aucune donnée d'image.");
}

function latin1(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return s;
}

function jpegMeta(b: Uint8Array): ParsedMeta {
  const { segments } = jpegSegments(b);
  const tags: Tag[] = [];
  const blocks: MetaBlock[] = [];
  for (const s of segments) {
    const size = s.end - s.start;
    if (s.marker === 0xe1 && startsWith(s.data, 0, EXIF_SIG)) {
      blocks.push({ kind: "exif", label: "EXIF (APP1)", size });
      try {
        tags.push(...parseTiff(s.data.subarray(6)));
      } catch {}
    } else if (s.marker === 0xe1 && startsWith(s.data, 0, XMP_SIG)) {
      blocks.push({
        kind: "xmp",
        label: "XMP (APP1)",
        size,
        text: new TextDecoder().decode(s.data.subarray(XMP_SIG.length)),
      });
    } else if (s.marker === 0xe1 && startsWith(s.data, 0, XMP_EXT_SIG)) {
      blocks.push({ kind: "xmp", label: "Extended XMP (APP1)", size });
    } else if (s.marker === 0xe1) {
      blocks.push({ kind: "other", label: "APP1", size });
    } else if (s.marker === 0xed) {
      blocks.push({
        kind: "iptc",
        label: startsWith(s.data, 0, "Photoshop 3.0") ? "IPTC / Photoshop (APP13)" : "APP13",
        size,
      });
    } else if (s.marker === 0xe2 && startsWith(s.data, 0, "ICC_PROFILE\0")) {
      blocks.push({ kind: "icc", label: "ICC profile (APP2)", size });
    } else if (s.marker === 0xe0 && startsWith(s.data, 0, "JFIF\0")) {
      blocks.push({ kind: "jfif", label: "JFIF (APP0)", size });
    } else if (s.marker === 0xfe) {
      blocks.push({ kind: "comment", label: "COM", size, text: new TextDecoder().decode(s.data) });
    } else if (s.marker >= 0xe0 && s.marker <= 0xef) {
      const id =
        latin1(s.data.subarray(0, 12))
          .split("\0")[0]
          ?.replace(/[^\x20-\x7e]/g, "") ?? "";
      blocks.push({ kind: "other", label: `APP${s.marker - 0xe0}${id ? ` (${id})` : ""}`, size });
    }
  }
  return { format: "jpeg", tags, blocks, metaBytes: sumMeta(blocks) };
}

function sumMeta(blocks: MetaBlock[]): number {
  // JFIF and ICC describe how to display the pixels, not the photo or its author.
  return blocks
    .filter((x) => x.kind !== "jfif" && x.kind !== "icc")
    .reduce((a, x) => a + x.size, 0);
}

export interface Chunk {
  type: string;
  start: number;
  end: number;
  data: Uint8Array;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function pngChunks(b: Uint8Array): Chunk[] {
  if (!PNG_SIG.every((x, i) => b[i] === x)) fail("Not a PNG file.", "Ce n'est pas un fichier PNG.");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Chunk[] = [];
  let p = 8;
  while (p + 12 <= b.length) {
    const len = dv.getUint32(p);
    const end = p + 12 + len;
    if (end > b.length)
      fail(
        "Corrupt PNG: chunk overruns the file.",
        "PNG corrompu : un bloc dépasse la fin du fichier.",
      );
    const type = ascii(b, p + 4, 4);
    out.push({ type, start: p, end, data: b.subarray(p + 8, p + 8 + len) });
    p = end;
    if (type === "IEND") break;
  }
  return out;
}

function pngMeta(b: Uint8Array): ParsedMeta {
  const tags: Tag[] = [];
  const blocks: MetaBlock[] = [];
  const dec = new TextDecoder();
  for (const c of pngChunks(b)) {
    const size = c.end - c.start;
    const z = c.data.indexOf(0);
    const key = z > 0 ? latin1(c.data.subarray(0, z)) : "";
    switch (c.type) {
      case "tEXt":
        blocks.push({
          kind: "text",
          label: `tEXt · ${key}`,
          size,
          text: latin1(c.data.subarray(z + 1)),
        });
        break;
      case "zTXt":
        blocks.push({ kind: "text", label: `zTXt · ${key}`, size });
        break;
      case "iTXt": {
        const compressed = c.data[z + 1] === 1;
        let p = z + 3;
        const langEnd = c.data.indexOf(0, p);
        p = c.data.indexOf(0, langEnd + 1) + 1;
        const text =
          compressed || langEnd < 0 || p <= 0 ? undefined : dec.decode(c.data.subarray(p));
        const kind = key === "XML:com.adobe.xmp" ? "xmp" : "text";
        blocks.push(
          text == null
            ? { kind, label: `iTXt · ${key}`, size }
            : { kind, label: `iTXt · ${key}`, size, text },
        );
        break;
      }
      case "eXIf":
        blocks.push({ kind: "exif", label: "eXIf", size });
        try {
          tags.push(...parseTiff(c.data));
        } catch {}
        break;
      case "tIME": {
        const d = c.data;
        const y = ((d[0] as number) << 8) | (d[1] as number);
        const pad = (x: number | undefined) => String(x ?? 0).padStart(2, "0");
        blocks.push({
          kind: "time",
          label: "tIME",
          size,
          text: `${y}-${pad(d[2])}-${pad(d[3])} ${pad(d[4])}:${pad(d[5])}:${pad(d[6])} UTC`,
        });
        break;
      }
      case "iCCP":
        blocks.push({ kind: "icc", label: `iCCP · ${key}`, size });
        break;
    }
  }
  return { format: "png", tags, blocks, metaBytes: sumMeta(blocks) };
}

export function webpChunks(b: Uint8Array): Chunk[] {
  if (!(startsWith(b, 0, "RIFF") && startsWith(b, 8, "WEBP")))
    fail("Not a WebP file.", "Ce n'est pas un fichier WebP.");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Chunk[] = [];
  let p = 12;
  while (p + 8 <= b.length) {
    const len = dv.getUint32(p + 4, true);
    const end = p + 8 + len + (len & 1);
    if (p + 8 + len > b.length)
      fail(
        "Corrupt WebP: chunk overruns the file.",
        "WebP corrompu : un bloc dépasse la fin du fichier.",
      );
    out.push({
      type: ascii(b, p, 4),
      start: p,
      end: Math.min(end, b.length),
      data: b.subarray(p + 8, p + 8 + len),
    });
    p = end;
  }
  return out;
}

function webpMeta(b: Uint8Array): ParsedMeta {
  const tags: Tag[] = [];
  const blocks: MetaBlock[] = [];
  for (const c of webpChunks(b)) {
    const size = c.end - c.start;
    if (c.type === "EXIF") {
      blocks.push({ kind: "exif", label: "EXIF", size });
      try {
        tags.push(...parseTiff(startsWith(c.data, 0, EXIF_SIG) ? c.data.subarray(6) : c.data));
      } catch {}
    } else if (c.type === "XMP ") {
      blocks.push({ kind: "xmp", label: "XMP", size, text: new TextDecoder().decode(c.data) });
    } else if (c.type === "ICCP") {
      blocks.push({ kind: "icc", label: "ICC profile", size });
    }
  }
  return { format: "webp", tags, blocks, metaBytes: sumMeta(blocks) };
}

/** Metadata of a JPEG, PNG or WebP file ("other" with nothing for anything else). */
export function readMeta(b: Uint8Array): ParsedMeta {
  if (b[0] === 0xff && b[1] === 0xd8) return jpegMeta(b);
  if (b[0] === 0x89 && startsWith(b, 1, "PNG")) return pngMeta(b);
  if (startsWith(b, 0, "RIFF") && startsWith(b, 8, "WEBP")) return webpMeta(b);
  return { format: "other", tags: [], blocks: [], metaBytes: 0 };
}

/* --- Removal ---------------------------------------------------------------------- */

export interface Stripped {
  bytes: Uint8Array;
  removed: string[];
}

/** A minimal big-endian EXIF APP1 segment with only the Orientation tag. */
export function orientationApp1(orientation: number): Uint8Array {
  const out = new Uint8Array(2 + 2 + 6 + 26);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0xffe1);
  dv.setUint16(2, out.length - 2);
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // "Exif\0\0"
  const t = 10;
  out.set([0x4d, 0x4d, 0, 42], t); // "MM", 42
  dv.setUint32(t + 4, 8); // IFD0 offset
  dv.setUint16(t + 8, 1); // one entry
  dv.setUint16(t + 10, 0x0112); // Orientation
  dv.setUint16(t + 12, 3); // SHORT
  dv.setUint32(t + 14, 1); // count
  dv.setUint16(t + 18, orientation);
  dv.setUint32(t + 22, 0); // no next IFD
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * Drops the EXIF/XMP (APP1), IPTC (APP13) and comment (COM) segments of a JPEG without touching
 * the image data. With `keepOrientation`, a tiny EXIF block with only the orientation is
 * written back so rotated photos still display upright.
 */
export function stripJpeg(b: Uint8Array, keepOrientation = true): Stripped {
  const { segments, scan } = jpegSegments(b);
  const tags: Tag[] = [];
  for (const s of segments)
    if (s.marker === 0xe1 && startsWith(s.data, 0, EXIF_SIG))
      try {
        tags.push(...parseTiff(s.data.subarray(6)));
      } catch {}
  const orientation = orientationOf(tags);
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  const removed: string[] = [];
  let inserted = !(keepOrientation && orientation !== 1);
  for (const s of segments) {
    if (s.marker === 0xda) break;
    const drop = s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe;
    if (!inserted && s.marker !== 0xe0) {
      parts.push(orientationApp1(orientation));
      inserted = true;
    }
    if (drop) {
      removed.push(s.marker === 0xfe ? "COM" : `APP${s.marker - 0xe0}`);
      continue;
    }
    parts.push(b.subarray(s.start, s.end));
  }
  if (!inserted) parts.push(orientationApp1(orientation));
  parts.push(b.subarray(scan));
  return { bytes: concat(parts), removed };
}

const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

/** Drops the text, eXIf and tIME chunks of a PNG (pixels and color chunks untouched). */
export function stripPng(b: Uint8Array): Stripped {
  const chunks = pngChunks(b);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  const removed: string[] = [];
  for (const c of chunks) {
    if (PNG_DROP.has(c.type)) removed.push(c.type);
    else parts.push(b.subarray(c.start, c.end));
  }
  return { bytes: concat(parts), removed };
}

/** Drops the EXIF and XMP chunks of a WebP and fixes the VP8X flags and RIFF size. */
export function stripWebp(b: Uint8Array): Stripped {
  const chunks = webpChunks(b);
  const parts: Uint8Array[] = [b.slice(0, 12)];
  const removed: string[] = [];
  for (const c of chunks) {
    if (c.type === "EXIF" || c.type === "XMP ") {
      removed.push(c.type.trim());
      continue;
    }
    const copy = b.slice(c.start, c.end);
    if (c.type === "VP8X" && copy.length > 8) copy[8] = (copy[8] as number) & ~0x0c;
    parts.push(copy);
  }
  const out = concat(parts);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return { bytes: out, removed };
}

/** Removes metadata losslessly when the format allows it; null for other formats. */
export function stripMeta(b: Uint8Array, keepOrientation = true): Stripped | null {
  const kind = readMeta(b).format;
  if (kind === "jpeg") return stripJpeg(b, keepOrientation);
  if (kind === "png") return stripPng(b);
  if (kind === "webp") return stripWebp(b);
  return null;
}

/** Builds a PNG chunk (length, type, data, CRC); used by tests and fixtures. */
export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
