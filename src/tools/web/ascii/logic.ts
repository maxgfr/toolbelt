/**
 * The ASCII table (0–127) with every notation — decimal, hex, octal, binary, HTML entity,
 * caret and escape forms — and names in English, French and German; plus helpers for the key
 * inspector (location names, the shortcut as text).
 */
import type { L10n } from "../../../i18n";
import { matchesQuery } from "../_shared";

const n = (en: string, fr: string, de: string): L10n => ({ en, fr, de });

/** Abbreviation and name of the 33 control characters (0–31 and 127). */
const CONTROLS: [string, L10n][] = [
  ["NUL", n("Null", "Nul", "Nullzeichen")],
  ["SOH", n("Start of Heading", "Début d'en-tête", "Beginn der Kopfzeile")],
  ["STX", n("Start of Text", "Début de texte", "Beginn des Textes")],
  ["ETX", n("End of Text", "Fin de texte", "Ende des Textes")],
  ["EOT", n("End of Transmission", "Fin de transmission", "Ende der Übertragung")],
  ["ENQ", n("Enquiry", "Demande", "Anfrage")],
  ["ACK", n("Acknowledge", "Accusé de réception", "Bestätigung")],
  ["BEL", n("Bell", "Sonnerie", "Klingel")],
  ["BS", n("Backspace", "Retour arrière", "Rückschritt")],
  ["HT", n("Horizontal Tab", "Tabulation horizontale", "Horizontaler Tabulator")],
  ["LF", n("Line Feed (new line)", "Saut de ligne", "Zeilenvorschub (neue Zeile)")],
  ["VT", n("Vertical Tab", "Tabulation verticale", "Vertikaler Tabulator")],
  ["FF", n("Form Feed", "Saut de page", "Seitenvorschub")],
  ["CR", n("Carriage Return", "Retour chariot", "Wagenrücklauf")],
  ["SO", n("Shift Out", "Hors code", "Dauerumschaltung (Shift Out)")],
  ["SI", n("Shift In", "En code", "Rückschaltung (Shift In)")],
  ["DLE", n("Data Link Escape", "Échappement de transmission", "Datenübertragungsumschaltung")],
  ["DC1", n("Device Control 1 (XON)", "Commande d'appareil 1 (XON)", "Gerätesteuerung 1 (XON)")],
  ["DC2", n("Device Control 2", "Commande d'appareil 2", "Gerätesteuerung 2")],
  ["DC3", n("Device Control 3 (XOFF)", "Commande d'appareil 3 (XOFF)", "Gerätesteuerung 3 (XOFF)")],
  ["DC4", n("Device Control 4", "Commande d'appareil 4", "Gerätesteuerung 4")],
  ["NAK", n("Negative Acknowledge", "Accusé de réception négatif", "Negative Bestätigung")],
  ["SYN", n("Synchronous Idle", "Synchronisation", "Synchronisierung")],
  [
    "ETB",
    n("End of Transmission Block", "Fin de bloc de transmission", "Ende des Übertragungsblocks"),
  ],
  ["CAN", n("Cancel", "Annulation", "Abbruch")],
  ["EM", n("End of Medium", "Fin de support", "Ende des Mediums")],
  ["SUB", n("Substitute", "Substitution", "Ersatz")],
  ["ESC", n("Escape", "Échappement", "Escape")],
  ["FS", n("File Separator", "Séparateur de fichiers", "Dateitrenner")],
  ["GS", n("Group Separator", "Séparateur de groupes", "Gruppentrenner")],
  ["RS", n("Record Separator", "Séparateur d'enregistrements", "Datensatztrenner")],
  ["US", n("Unit Separator", "Séparateur d'unités", "Einheitentrenner")],
];
const DEL: [string, L10n] = ["DEL", n("Delete", "Suppression", "Löschen")];

/** Names of the printable characters that are not letters or digits. */
const SYMBOLS: Record<string, L10n> = {
  " ": n("Space", "Espace", "Leerzeichen"),
  "!": n("Exclamation mark", "Point d'exclamation", "Ausrufezeichen"),
  '"': n("Quotation mark", "Guillemet droit", "Anführungszeichen"),
  "#": n("Number sign (hash)", "Croisillon (dièse)", "Rautezeichen (Hash)"),
  $: n("Dollar sign", "Dollar", "Dollarzeichen"),
  "%": n("Percent sign", "Pourcentage", "Prozentzeichen"),
  "&": n("Ampersand", "Esperluette", "Und-Zeichen (Ampersand)"),
  "'": n("Apostrophe", "Apostrophe droite", "Apostroph"),
  "(": n("Left parenthesis", "Parenthèse ouvrante", "Runde Klammer auf"),
  ")": n("Right parenthesis", "Parenthèse fermante", "Runde Klammer zu"),
  "*": n("Asterisk", "Astérisque", "Sternchen"),
  "+": n("Plus sign", "Plus", "Pluszeichen"),
  ",": n("Comma", "Virgule", "Komma"),
  "-": n("Hyphen-minus", "Trait d'union / moins", "Bindestrich-Minus"),
  ".": n("Full stop (period)", "Point", "Punkt"),
  "/": n("Slash", "Barre oblique", "Schrägstrich"),
  ":": n("Colon", "Deux-points", "Doppelpunkt"),
  ";": n("Semicolon", "Point-virgule", "Semikolon"),
  "<": n("Less-than sign", "Inférieur à", "Kleiner-als-Zeichen"),
  "=": n("Equals sign", "Égal", "Gleichheitszeichen"),
  ">": n("Greater-than sign", "Supérieur à", "Größer-als-Zeichen"),
  "?": n("Question mark", "Point d'interrogation", "Fragezeichen"),
  "@": n("At sign", "Arobase", "At-Zeichen (Klammeraffe)"),
  "[": n("Left square bracket", "Crochet ouvrant", "Eckige Klammer auf"),
  "\\": n("Backslash", "Barre oblique inversée", "Backslash (umgekehrter Schrägstrich)"),
  "]": n("Right square bracket", "Crochet fermant", "Eckige Klammer zu"),
  "^": n("Caret (circumflex)", "Accent circonflexe", "Zirkumflex (Caret)"),
  _: n("Underscore", "Tiret bas", "Unterstrich"),
  "`": n("Grave accent (backtick)", "Accent grave", "Gravis (Backtick)"),
  "{": n("Left curly bracket", "Accolade ouvrante", "Geschweifte Klammer auf"),
  "|": n("Vertical bar (pipe)", "Barre verticale", "Senkrechter Strich (Pipe)"),
  "}": n("Right curly bracket", "Accolade fermante", "Geschweifte Klammer zu"),
  "~": n("Tilde", "Tilde", "Tilde"),
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
  if (code < 32) return CONTROLS[code]?.[1] ?? n("", "", "");
  if (code === 127) return DEL[1];
  if (/[A-Z]/.test(ch))
    return n(
      `Latin capital letter ${ch}`,
      `Lettre majuscule latine ${ch}`,
      `Lateinisches großes ${ch}`,
    );
  if (/[a-z]/.test(ch))
    return n(
      `Latin small letter ${ch.toUpperCase()}`,
      `Lettre minuscule latine ${ch.toUpperCase()}`,
      `Lateinisches kleines ${ch}`,
    );
  if (/[0-9]/.test(ch)) return n(`Digit ${ch}`, `Chiffre ${ch}`, `Ziffer ${ch}`);
  return SYMBOLS[ch] ?? n("", "", "");
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
    matchesQuery(q, r.char, r.name.en, r.name.fr, r.name.de, r.htmlNamed, r.caret, r.escape),
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
  n("Standard", "Standard", "Standard"),
  n("Left", "Gauche", "Links"),
  n("Right", "Droite", "Rechts"),
  n("Numpad", "Pavé numérique", "Ziffernblock"),
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
