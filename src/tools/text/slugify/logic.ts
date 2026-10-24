/**
 * URL slugs: accents stripped (é → e, ß → ss, œ → oe…), anything that is not
 * a letter or digit becomes the separator, no separator at either end, and an
 * optional maximum length cut at a word boundary.
 */
import { splitLines } from "../_shared";

export interface SlugOptions {
  separator: string;
  lowercase: boolean;
  /** 0 = no limit. */
  maxLength: number;
  /** Drop letters that have no ASCII form (Cyrillic, CJK…); otherwise keep them. */
  asciiOnly: boolean;
}

export const DEFAULTS: SlugOptions = {
  separator: "-",
  lowercase: true,
  maxLength: 0,
  asciiOnly: true,
};

/** Letters that NFKD does not decompose into a base letter. */
const SPECIAL: Record<string, string> = {
  ß: "ss",
  ẞ: "SS",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ø: "o",
  Ø: "O",
  đ: "d",
  Đ: "D",
  ð: "d",
  Ð: "D",
  ł: "l",
  Ł: "L",
  þ: "th",
  Þ: "TH",
  ı: "i",
};

export function slugify(text: string, o: SlugOptions): string {
  const base = text
    .replace(/[ßẞæÆœŒøØđĐðÐłŁþÞı]/g, (c) => SPECIAL[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "");
  const kept = o.asciiOnly ? /[^A-Za-z0-9]+/g : /[^\p{L}\p{N}]+/gu;
  let slug = base.replace(kept, " ").trim();
  if (o.lowercase) slug = slug.toLowerCase();
  const sep = o.separator;
  let parts = slug.split(" ").filter(Boolean);
  if (o.maxLength > 0) {
    const out: string[] = [];
    let len = 0;
    for (const p of parts) {
      const add = (out.length ? sep.length : 0) + p.length;
      if (len + add > o.maxLength) {
        // A single word longer than the limit is cut rather than dropped.
        if (!out.length) out.push(p.slice(0, o.maxLength));
        break;
      }
      out.push(p);
      len += add;
    }
    parts = out;
  }
  return parts.join(sep);
}

/** One slug per non-empty line. */
export function slugifyLines(text: string, o: SlugOptions): string {
  return splitLines(text)
    .filter((line) => line.trim())
    .map((line) => slugify(line, o))
    .join("\n");
}
