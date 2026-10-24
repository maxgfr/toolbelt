/**
 * The ASCII table (0–127) with every notation — decimal, hex, octal, binary, HTML entity,
 * caret and escape forms — and names in English and French; plus helpers for the key
 * inspector (location names, the shortcut as text).
 */
import type { L10n } from "../../../i18n";
import { matchesQuery } from "../_shared";

const n = (en: string, fr: string): L10n => ({ en, fr });

/** Abbreviation and name of the 33 control characters (0–31 and 127). */
const CONTROLS: [string, L10n][] = [
  ["NUL", n("Null", "Nul")],
  ["SOH", n("Start of Heading", "Début d'en-tête")],
  ["STX", n("Start of Text", "Début de texte")],
  ["ETX", n("End of Text", "Fin de texte")],
  ["EOT", n("End of Transmission", "Fin de transmission")],
  ["ENQ", n("Enquiry", "Demande")],
  ["ACK", n("Acknowledge", "Accusé de réception")],
  ["BEL", n("Bell", "Sonnerie")],
  ["BS", n("Backspace", "Retour arrière")],
  ["HT", n("Horizontal Tab", "Tabulation horizontale")],
  ["LF", n("Line Feed (new line)", "Saut de ligne")],
  ["VT", n("Vertical Tab", "Tabulation verticale")],
  ["FF", n("Form Feed", "Saut de page")],
  ["CR", n("Carriage Return", "Retour chariot")],
  ["SO", n("Shift Out", "Hors code")],
  ["SI", n("Shift In", "En code")],
  ["DLE", n("Data Link Escape", "Échappement de transmission")],
  ["DC1", n("Device Control 1 (XON)", "Commande d'appareil 1 (XON)")],
  ["DC2", n("Device Control 2", "Commande d'appareil 2")],
  ["DC3", n("Device Control 3 (XOFF)", "Commande d'appareil 3 (XOFF)")],
  ["DC4", n("Device Control 4", "Commande d'appareil 4")],
  ["NAK", n("Negative Acknowledge", "Accusé de réception négatif")],
  ["SYN", n("Synchronous Idle", "Synchronisation")],
  ["ETB", n("End of Transmission Block", "Fin de bloc de transmission")],
  ["CAN", n("Cancel", "Annulation")],
  ["EM", n("End of Medium", "Fin de support")],
  ["SUB", n("Substitute", "Substitution")],
  ["ESC", n("Escape", "Échappement")],
  ["FS", n("File Separator", "Séparateur de fichiers")],
  ["GS", n("Group Separator", "Séparateur de groupes")],
  ["RS", n("Record Separator", "Séparateur d'enregistrements")],
  ["US", n("Unit Separator", "Séparateur d'unités")],
];
const DEL: [string, L10n] = ["DEL", n("Delete", "Suppression")];

/** Names of the printable characters that are not letters or digits. */
const SYMBOLS: Record<string, L10n> = {
  " ": n("Space", "Espace"),
  "!": n("Exclamation mark", "Point d'exclamation"),
  '"': n("Quotation mark", "Guillemet droit"),
  "#": n("Number sign (hash)", "Croisillon (dièse)"),
  $: n("Dollar sign", "Dollar"),
  "%": n("Percent sign", "Pourcentage"),
  "&": n("Ampersand", "Esperluette"),
  "'": n("Apostrophe", "Apostrophe droite"),
  "(": n("Left parenthesis", "Parenthèse ouvrante"),
  ")": n("Right parenthesis", "Parenthèse fermante"),
  "*": n("Asterisk", "Astérisque"),
  "+": n("Plus sign", "Plus"),
  ",": n("Comma", "Virgule"),
  "-": n("Hyphen-minus", "Trait d'union / moins"),
  ".": n("Full stop (period)", "Point"),
  "/": n("Slash", "Barre oblique"),
  ":": n("Colon", "Deux-points"),
  ";": n("Semicolon", "Point-virgule"),
  "<": n("Less-than sign", "Inférieur à"),
  "=": n("Equals sign", "Égal"),
  ">": n("Greater-than sign", "Supérieur à"),
  "?": n("Question mark", "Point d'interrogation"),
  "@": n("At sign", "Arobase"),
  "[": n("Left square bracket", "Crochet ouvrant"),
  "\\": n("Backslash", "Barre oblique inversée"),
  "]": n("Right square bracket", "Crochet fermant"),
  "^": n("Caret (circumflex)", "Accent circonflexe"),
  _: n("Underscore", "Tiret bas"),
  "`": n("Grave accent (backtick)", "Accent grave"),
  "{": n("Left curly bracket", "Accolade ouvrante"),
  "|": n("Vertical bar (pipe)", "Barre verticale"),
  "}": n("Right curly bracket", "Accolade fermante"),
  "~": n("Tilde", "Tilde"),
};

/** HTML named entities for ASCII characters (the ones worth knowing). */
const ENTITIES: Record<string, string> = {
  "\t": "&Tab;",
  "\n": "&NewLine;",
  "!": "&excl;",
  '"': "&quot;",
  "#": "&num;",
  $: "&dollar;",
  "%": "&percnt;",
  "&": "&amp;",
  "'": "&apos;",
  "(": "&lpar;",
  ")": "&rpar;",
  "*": "&ast;",
  "+": "&plus;",
  ",": "&comma;",
  ".": "&period;",
  "/": "&sol;",
  ":": "&colon;",
  ";": "&semi;",
  "<": "&lt;",
  "=": "&equals;",
  ">": "&gt;",
  "?": "&quest;",
  "@": "&commat;",
  "[": "&lsqb;",
  "\\": "&bsol;",
  "]": "&rsqb;",
  "^": "&Hat;",
  _: "&lowbar;",
  "`": "&grave;",
  "{": "&lcub;",
  "|": "&verbar;",
  "}": "&rcub;",
};

const ESCAPES: Record<number, string> = {
  0: "\\0",
  7: "\\a",
  8: "\\b",
  9: "\\t",
  10: "\\n",
  11: "\\v",
  12: "\\f",
  13: "\\r",
  27: "\\e",
};

export interface AsciiRow {
  code: number;
  hex: string;
  oct: string;
  bin: string;
  /** The character itself, or its abbreviation for control characters (NUL, LF…). */
  char: string;
  /** The Unicode "control picture" (␀, ␊) for control characters, else the character. */
  glyph: string;
  control: boolean;
  name: L10n;
  /** `&#65;`, and the named entity when there is one. */
  html: string;
  htmlNamed: string;
  /** ^@, ^J… for control characters. */
  caret: string;
  /** C-style escape: \n, \t… */
  escape: string;
}

function nameOf(code: number, ch: string): L10n {
  if (code < 32) return CONTROLS[code]?.[1] ?? n("", "");
  if (code === 127) return DEL[1];
  if (/[A-Z]/.test(ch)) return n(`Latin capital letter ${ch}`, `Lettre majuscule latine ${ch}`);
  if (/[a-z]/.test(ch))
    return n(
      `Latin small letter ${ch.toUpperCase()}`,
      `Lettre minuscule latine ${ch.toUpperCase()}`,
    );
  if (/[0-9]/.test(ch)) return n(`Digit ${ch}`, `Chiffre ${ch}`);
  return SYMBOLS[ch] ?? n("", "");
}

export const ASCII: AsciiRow[] = Array.from({ length: 128 }, (_, code) => {
  const ch = String.fromCharCode(code);
  const control = code < 32 || code === 127;
  return {
    code,
    hex: code.toString(16).toUpperCase().padStart(2, "0"),
    oct: code.toString(8).padStart(3, "0"),
    bin: code.toString(2).padStart(7, "0"),
    char: control ? (code === 127 ? DEL[0] : (CONTROLS[code]?.[0] ?? "")) : ch,
    glyph: control ? String.fromCharCode(code === 127 ? 0x2421 : 0x2400 + code) : ch,
    control,
    name: nameOf(code, ch),
    html: `&#${code};`,
    htmlNamed: ENTITIES[ch] ?? "",
    caret: control ? `^${String.fromCharCode(code === 127 ? 63 : code + 64)}` : "",
    escape: ESCAPES[code] ?? (control ? `\\x${code.toString(16).padStart(2, "0")}` : ""),
  };
});

export type AsciiFilter = "all" | "control" | "printable" | "letters" | "digits" | "symbols";

/**
 * Rows matching `query`: one character ("A") finds itself, "0x41" / "\x41" a hex code,
 * "65" a decimal code, anything else is searched in names and abbreviations.
 */
export function searchAscii(query: string, filter: AsciiFilter = "all"): AsciiRow[] {
  const rows = ASCII.filter((r) => {
    switch (filter) {
      case "control":
        return r.control;
      case "printable":
        return !r.control;
      case "letters":
        return /[A-Za-z]/.test(r.char) && r.char.length === 1;
      case "digits":
        return /[0-9]/.test(r.char) && r.char.length === 1;
      case "symbols":
        return !r.control && !/[A-Za-z0-9]/.test(r.char);
      default:
        return true;
    }
  });
  const q = query.trim();
  if (!query) return rows;
  if (query.length === 1) return rows.filter((r) => r.char === query);
  const hex = /^(?:0x|\\x|%|u\+)([0-9a-f]{1,2})$/i.exec(q);
  if (hex) return rows.filter((r) => r.code === Number.parseInt(hex[1] ?? "", 16));
  if (/^\d{1,3}$/.test(q)) return rows.filter((r) => r.code === Number(q));
  return rows.filter((r) =>
    matchesQuery(q, r.char, r.name.en, r.name.fr, r.htmlNamed, r.caret, r.escape),
  );
}

/* --- Key inspector ------------------------------------------------------------ */

export interface KeyInfo {
  key: string;
  code: string;
  keyCode: number;
  which: number;
  location: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}

export const LOCATIONS: L10n[] = [
  n("Standard", "Standard"),
  n("Left", "Gauche"),
  n("Right", "Droite"),
  n("Numpad", "Pavé numérique"),
];

/** How `key` should be shown: " " → "Space", "" → "Unidentified". */
export function keyLabel(key: string): string {
  if (key === " ") return "Space";
  return key || "Unidentified";
}

/** The shortcut as text, modifiers first: "Ctrl + Shift + K". */
export function combo(k: KeyInfo, mac = false): string {
  const mods = [
    k.ctrlKey && k.key !== "Control" ? (mac ? "⌃" : "Ctrl") : "",
    k.altKey && k.key !== "Alt" ? (mac ? "⌥" : "Alt") : "",
    k.shiftKey && k.key !== "Shift" ? (mac ? "⇧" : "Shift") : "",
    k.metaKey && k.key !== "Meta" ? (mac ? "⌘" : "Meta") : "",
  ].filter(Boolean);
  const key = keyLabel(k.key);
  return [...mods, key.length === 1 ? key.toUpperCase() : key].join(mac ? "" : " + ");
}
