/**
 * FIGlet banners (a .flf font parser and the horizontal fitting / smushing rules of FIGlet 2.2)
 * and text boxes drawn with box-drawing characters.
 */

export interface Font {
  hardblank: string;
  height: number;
  /** Horizontal layout: 0 = full width, "fit" = kerning, "smush" with a rule mask (0 = universal). */
  layout: Layout;
  chars: Map<number, string[]>;
}

export type Layout = { kind: "full" } | { kind: "fit" } | { kind: "smush"; rules: number };
export type LayoutChoice = "font" | "full" | "fit" | "smush";

/** Parses a FIGlet font (flf2a). Only characters present in the file are kept. */
export function parseFont(src: string): Font {
  const lines = src.split(/\r?\n/);
  const head = (lines[0] ?? "").match(
    /^flf2a(.)\s+(\d+)\s+\d+\s+\d+\s+(-?\d+)\s+(\d+)(?:\s+\d+\s+(\d+))?/,
  );
  if (!head) throw new Error("Not a FIGlet font");
  const hardblank = head[1] ?? "$";
  const height = Number(head[2]);
  const oldLayout = Number(head[3]);
  const comments = Number(head[4]);
  const full = head[5] === undefined ? null : Number(head[5]);
  const layout = parseLayout(oldLayout, full);
  const chars = new Map<number, string[]>();
  let i = 1 + comments;
  const readChar = (): string[] | null => {
    if (i + height > lines.length) return null;
    const rows = lines.slice(i, i + height);
    i += height;
    return rows.map((r) => {
      const t = r.replace(/\s+$/, "");
      const end = t[t.length - 1];
      return end ? t.replace(new RegExp(`${escapeRe(end)}+$`), "") : t;
    });
  };
  // Required characters: printable ASCII, then Ä Ö Ü ä ö ü ß (empty glyphs mean "absent").
  const required = [
    ...Array.from({ length: 95 }, (_, k) => 32 + k),
    196,
    214,
    220,
    228,
    246,
    252,
    223,
  ];
  for (const code of required) {
    const rows = readChar();
    if (!rows) break;
    if (code < 127 || rows.some((r) => r.length > 0)) chars.set(code, rows);
  }
  // Optional code-tagged characters after the required ones: "196  LATIN CAPITAL…".
  while (i < lines.length) {
    const tag = (lines[i] ?? "").match(/^\s*(-?(?:0x[0-9a-f]+|0[0-7]*|\d+))/i);
    i++;
    if (!tag) continue;
    const raw = tag[1] ?? "";
    const code = raw.toLowerCase().startsWith("0x")
      ? Number.parseInt(raw, 16)
      : /^0\d/.test(raw)
        ? Number.parseInt(raw, 8)
        : Number(raw);
    const rows = readChar();
    if (!rows) break;
    if (code >= 0) chars.set(code, rows);
  }
  return { hardblank, height, layout, chars };
}

function escapeRe(c: string): string {
  return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLayout(old: number, full: number | null): Layout {
  if (full !== null) {
    if (full & 128) return { kind: "smush", rules: full & 63 };
    if (full & 64) return { kind: "fit" };
    return { kind: "full" };
  }
  if (old < 0) return { kind: "full" };
  if (old === 0) return { kind: "fit" };
  return { kind: "smush", rules: old & 63 };
}

/** FIGlet's smushing of two sub-characters, or null when they cannot merge. */
function smushChars(l: string, r: string, layout: Layout, hb: string, widths: [number, number]) {
  if (l === " ") return r;
  if (r === " ") return l;
  if (layout.kind !== "smush" || widths[0] < 2 || widths[1] < 2) return null;
  const rules = layout.rules;
  if (rules === 0) {
    if (l === hb) return r;
    if (r === hb) return l;
    return r;
  }
  if (rules & 32 && l === hb && r === hb) return l;
  if (l === hb || r === hb) return null;
  if (rules & 1 && l === r) return l;
  if (rules & 2) {
    const set = "|/\\[]{}()<>";
    if (l === "_" && set.includes(r)) return r;
    if (r === "_" && set.includes(l)) return l;
  }
  if (rules & 4) {
    const classes = ["|", "/\\", "[]", "{}", "()", "<>"];
    const cl = classes.findIndex((c) => c.includes(l));
    const cr = classes.findIndex((c) => c.includes(r));
    if (cl >= 0 && cr >= 0 && cl !== cr) return cl > cr ? l : r;
  }
  if (rules & 8) {
    const pair = l + r;
    if (["[]", "][", "{}", "}{", "()", ")("].includes(pair)) return "|";
  }
  if (rules & 16) {
    if (l === "/" && r === "\\") return "|";
    if (l === "\\" && r === "/") return "Y";
    if (l === ">" && r === "<") return "X";
  }
  return null;
}

/** Fallback for characters the font lacks: accents dropped, ligatures split, else "?". */
function glyphCodes(text: string, font: Font): number[] {
  const out: number[] = [];
  for (const ch of text.replace(/\t/g, " ")) {
    const cp = ch.codePointAt(0) ?? 63;
    if (font.chars.has(cp)) {
      out.push(cp);
      continue;
    }
    const plain = ch
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[ßẞ]/g, "ss")
      .replace(/Œ/g, "OE")
      .replace(/œ/g, "oe")
      .replace(/Æ/g, "AE")
      .replace(/æ/g, "ae")
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″«»]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[\u00a0\u202f\u2000-\u200a]/g, " ");
    for (const c of plain) {
      const p = c.codePointAt(0) ?? 63;
      if (font.chars.has(p)) out.push(p);
      else if (/\p{M}|\p{Cf}/u.test(c)) continue;
      else if (font.chars.has(63)) out.push(63);
    }
  }
  return out;
}

function effective(font: Font, choice: LayoutChoice): Layout {
  if (choice === "font") return font.layout;
  if (choice === "full") return { kind: "full" };
  if (choice === "fit") return { kind: "fit" };
  return font.layout.kind === "smush" ? font.layout : { kind: "smush", rules: 0 };
}

/** Renders one line of text (no wrapping) as rows; the hardblank is still in place. */
function renderLine(codes: number[], font: Font, layout: Layout): string[] {
  let rows: string[] = Array.from({ length: font.height }, () => "");
  let prevWidth = 0;
  for (const code of codes) {
    const glyph = font.chars.get(code);
    if (!glyph) continue;
    const width = Math.max(0, ...glyph.map((g) => g.length));
    const g = glyph.map((r) => r.padEnd(width));
    const amount =
      layout.kind === "full" ? 0 : smushAmount(rows, g, font, layout, [prevWidth, width]);
    rows = rows.map((row, r) => {
      const gr = g[r] ?? "";
      const line = row.split("");
      for (let k = 0; k < amount; k++) {
        const col = row.length - amount + k;
        if (col < 0) continue;
        const merged = smushChars(line[col] ?? " ", gr[k] ?? " ", layout, font.hardblank, [
          prevWidth,
          width,
        ]);
        line[col] = merged ?? gr[k] ?? " ";
      }
      return line.join("") + gr.slice(amount);
    });
    prevWidth = width;
  }
  return rows;
}

function smushAmount(
  rows: string[],
  glyph: string[],
  font: Font,
  layout: Layout,
  widths: [number, number],
): number {
  let max = widths[1];
  for (let r = 0; r < font.height; r++) {
    const row = rows[r] ?? "";
    const g = glyph[r] ?? "";
    // Mirrors figlet.c smushamt(): blanks at the end of the line plus blanks at the start of the
    // character, one more when the two touching sub-characters can merge.
    let lineBd = row.length;
    while (lineBd > 0 && (row[lineBd] === undefined || row[lineBd] === " ")) lineBd--;
    const ch1 = row[lineBd];
    let charBd = 0;
    while (g[charBd] === " ") charBd++;
    const ch2 = g[charBd];
    let amt = charBd + row.length - 1 - lineBd;
    if (ch1 === undefined || ch1 === " ") amt++;
    else if (ch2 !== undefined && smushChars(ch1, ch2, layout, font.hardblank, widths) !== null)
      amt++;
    max = Math.min(max, amt);
  }
  return Math.max(0, max);
}

export type Align = "left" | "center" | "right";

export interface BannerOptions {
  layout: LayoutChoice;
  /** Maximum width in columns; 0 = no wrapping. */
  width: number;
  align: Align;
}

/**
 * Renders text as a FIGlet banner. Each input line becomes a block of rows; with a width, words
 * wrap onto new blocks (and over-long words are split). Trailing spaces are trimmed.
 */
export function banner(text: string, font: Font, opts: BannerOptions): string {
  if (text.trim() === "") return "";
  const layout = effective(font, opts.layout);
  const width = opts.width > 0 ? opts.width : Number.POSITIVE_INFINITY;
  const blocks: string[][] = [];
  const render = (s: string) => renderLine(glyphCodes(s, font), font, layout);
  const w = (rows: string[]) => Math.max(0, ...rows.map((r) => r.length));

  for (const line of text.split(/\r?\n/)) {
    if (!Number.isFinite(width)) {
      blocks.push(render(line));
      continue;
    }
    const words = line.split(/ +/).filter(Boolean);
    let cur = "";
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (w(render(next)) <= width) {
        cur = next;
        continue;
      }
      if (cur) blocks.push(render(cur));
      // The word alone may still be too wide: split it by characters.
      cur = "";
      for (const ch of word) {
        const nx = cur + ch;
        if (cur && w(render(nx)) > width) {
          blocks.push(render(cur));
          cur = ch;
        } else cur = nx;
      }
    }
    blocks.push(render(cur));
  }

  const out: string[] = [];
  const blockWidths = blocks.map(w);
  const total = Number.isFinite(width) ? width : Math.max(0, ...blockWidths);
  blocks.forEach((rows, b) => {
    const bw = blockWidths[b] ?? 0;
    const pad =
      opts.align === "center"
        ? Math.floor((total - bw) / 2)
        : opts.align === "right"
          ? total - bw
          : 0;
    for (const row of rows) out.push(" ".repeat(Math.max(0, pad)) + row.padEnd(bw));
  });
  return out.map((r) => r.split(font.hardblank).join(" ").replace(/\s+$/, "")).join("\n");
}

/* --- Boxes ---------------------------------------------------------------------- */

export const BOX_STYLES = {
  single: "┌─┐│└┘",
  double: "╔═╗║╚╝",
  rounded: "╭─╮│╰╯",
  heavy: "┏━┓┃┗┛",
  ascii: "+-+|++",
  stars: "******",
  hash: "######",
} as const;
export type BoxStyle = keyof typeof BOX_STYLES;

/** Display width: wide (CJK, emoji) characters count as 2 columns, combining marks as 0. */
export function displayWidth(s: string): number {
  let n = 0;
  for (const seg of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)) {
    const cp = seg.segment.codePointAt(0) ?? 0;
    if (/^\p{M}+$/u.test(seg.segment) || cp === 0x200b) continue;
    const wide =
      /\p{Extended_Pictographic}/u.test(seg.segment) &&
      (cp >= 0x1f000 || seg.segment.includes("\ufe0f"));
    n +=
      wide ||
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x20000 && cp <= 0x3fffd)
        ? 2
        : 1;
  }
  return n;
}

export interface BoxOptions {
  style: BoxStyle;
  /** Spaces left and right of the text. */
  padX: number;
  /** Empty lines above and below the text. */
  padY: number;
  align: Align;
}

/** Draws a frame around the text (several lines allowed). */
export function box(text: string, opts: BoxOptions): string {
  const [tl = "+", h = "-", tr = "+", v = "|", bl = "+", br = "+"] = [...BOX_STYLES[opts.style]];
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  const inner = Math.max(0, ...lines.map(displayWidth));
  const px = Math.max(0, Math.floor(opts.padX));
  const py = Math.max(0, Math.floor(opts.padY));
  const fill = (s: string) => {
    const gap = inner - displayWidth(s);
    const left = opts.align === "center" ? Math.floor(gap / 2) : opts.align === "right" ? gap : 0;
    return " ".repeat(left) + s + " ".repeat(gap - left);
  };
  const row = (s: string) => `${v}${" ".repeat(px)}${fill(s)}${" ".repeat(px)}${v}`;
  const blank = row("");
  return [
    tl + h.repeat(inner + px * 2) + tr,
    ...Array.from({ length: py }, () => blank),
    ...lines.map(row),
    ...Array.from({ length: py }, () => blank),
    bl + h.repeat(inner + px * 2) + br,
  ].join("\n");
}
