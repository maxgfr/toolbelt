/**
 * HTML entities: escape text (only the unsafe characters, named references, or numeric ones) and
 * decode named and numeric references the way browsers do (with the Windows-1252 fix-ups for
 * &#128;–&#159; and U+FFFD for impossible code points).
 */
import { LEGACY, NAME_OF, NAMED } from "./entities";

export type EncodeMode = "unsafe" | "named" | "numeric";

export interface EncodeOptions {
  mode: EncodeMode;
  /** Numeric references in hex (&#xE9;) rather than decimal (&#233;). */
  hex: boolean;
}

const UNSAFE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function numeric(cp: number, hex: boolean): string {
  return hex ? `&#x${cp.toString(16).toUpperCase()};` : `&#${cp};`;
}

export function encodeEntities(text: string, { mode, hex }: EncodeOptions): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    const unsafe = UNSAFE[ch];
    if (mode === "unsafe") out += unsafe ?? ch;
    else if (mode === "numeric") out += unsafe || cp > 0x7e ? numeric(cp, hex) : ch;
    else if (unsafe) out += unsafe;
    else if (cp > 0x7e) {
      const name = NAME_OF.get(cp);
      out += name ? `&${name};` : numeric(cp, hex);
    } else out += ch;
  }
  return out;
}

/** What browsers show for &#128;–&#159; (the Windows-1252 characters). */
const C1: Record<number, number> = {
  128: 0x20ac,
  130: 0x201a,
  131: 0x0192,
  132: 0x201e,
  133: 0x2026,
  134: 0x2020,
  135: 0x2021,
  136: 0x02c6,
  137: 0x2030,
  138: 0x0160,
  139: 0x2039,
  140: 0x0152,
  142: 0x017d,
  145: 0x2018,
  146: 0x2019,
  147: 0x201c,
  148: 0x201d,
  149: 0x2022,
  150: 0x2013,
  151: 0x2014,
  152: 0x02dc,
  153: 0x2122,
  154: 0x0161,
  155: 0x203a,
  156: 0x0153,
  158: 0x017e,
  159: 0x0178,
};

function fromCodePoint(cp: number): string {
  if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return "�";
  return String.fromCodePoint(C1[cp] ?? cp);
}

export interface Decoded {
  text: string;
  /** How many references were replaced. */
  count: number;
  /** Named references that are not in the bundled table (left as they are). */
  unknown: string[];
}

export function decodeEntities(text: string): Decoded {
  let count = 0;
  const unknown = new Set<string>();
  const out = text.replace(
    /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]*))(;?)/g,
    (all, dec: string | undefined, hex: string | undefined, name: string | undefined, semi) => {
      if (dec !== undefined || hex !== undefined) {
        count++;
        const cp = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex ?? "", 16);
        return fromCodePoint(Number.isFinite(cp) ? cp : 0x110000);
      }
      const n = name ?? "";
      const cp = NAMED.get(n);
      if (cp !== undefined && (semi || LEGACY.has(n))) {
        count++;
        return String.fromCodePoint(cp);
      }
      if (semi) unknown.add(`&${n};`);
      return all;
    },
  );
  return { text: out, count, unknown: [...unknown] };
}
