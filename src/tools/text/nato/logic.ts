/**
 * Spelling alphabets: the international (NATO / ICAO) one, and the French
 * one (Anatole, Berthe, Célestin…). Words come in the alphabet's language,
 * including accents, case and common symbols, so a spelled-out email address
 * or password can be read aloud as is.
 */

export type Alphabet = "nato" | "fr";

interface Spec {
  letters: string[];
  digits: string[];
  symbols: Record<string, string>;
  accents: Record<string, string>;
  upper: (w: string) => string;
  lower: (w: string) => string;
  space: string;
}

const SPECS: Record<Alphabet, Spec> = {
  nato: {
    letters:
      "Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu".split(
        " ",
      ),
    digits: "Zero One Two Three Four Five Six Seven Eight Nine".split(" "),
    symbols: {
      ".": "Dot",
      ",": "Comma",
      "-": "Dash",
      _: "Underscore",
      "@": "At",
      "/": "Slash",
      "\\": "Backslash",
      ":": "Colon",
      ";": "Semicolon",
      "!": "Exclamation mark",
      "?": "Question mark",
      "#": "Hash",
      "&": "Ampersand",
      "*": "Asterisk",
      "+": "Plus",
      "=": "Equals",
      "%": "Percent",
      $: "Dollar",
      "€": "Euro",
      "'": "Apostrophe",
      '"': "Quote",
      "(": "Open parenthesis",
      ")": "Close parenthesis",
    },
    accents: {
      "\u0301": "acute",
      "\u0300": "grave",
      "\u0302": "circumflex",
      "\u0308": "diaeresis",
      "\u0327": "cedilla",
      "\u0303": "tilde",
    },
    upper: (w) => `capital ${w}`,
    lower: (w) => `small ${w}`,
    space: "Space",
  },
  fr: {
    letters:
      "Anatole Berthe Célestin Désiré Eugène François Gaston Henri Irma Joseph Kléber Louis Marcel Nicolas Oscar Pierre Quintal Raoul Suzanne Thérèse Ursule Victor William Xavier Yvonne Zoé".split(
        " ",
      ),
    digits: "zéro un deux trois quatre cinq six sept huit neuf".split(" "),
    symbols: {
      ".": "point",
      ",": "virgule",
      "-": "tiret",
      _: "tiret bas",
      "@": "arobase",
      "/": "barre oblique",
      "\\": "barre oblique inversée",
      ":": "deux-points",
      ";": "point-virgule",
      "!": "point d'exclamation",
      "?": "point d'interrogation",
      "#": "dièse",
      "&": "esperluette",
      "*": "astérisque",
      "+": "plus",
      "=": "égal",
      "%": "pour cent",
      $: "dollar",
      "€": "euro",
      "'": "apostrophe",
      '"': "guillemet",
      "(": "parenthèse ouvrante",
      ")": "parenthèse fermante",
    },
    accents: {
      "\u0301": "accent aigu",
      "\u0300": "accent grave",
      "\u0302": "accent circonflexe",
      "\u0308": "tréma",
      "\u0327": "cédille",
      "\u0303": "tilde",
    },
    upper: (w) => `${w} majuscule`,
    lower: (w) => `${w} minuscule`,
    space: "espace",
  },
};

export interface Spelled {
  char: string;
  word: string;
  /** A letter, digit or known symbol (false: kept as is). */
  known: boolean;
  space: boolean;
}

export function spell(text: string, alphabet: Alphabet, markCase: boolean): Spelled[] {
  const spec = SPECS[alphabet];
  const out: Spelled[] = [];
  for (const { segment: ch } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
    text,
  )) {
    if (/^\s+$/.test(ch)) {
      if (out.length && !out[out.length - 1]?.space)
        out.push({ char: " ", word: spec.space, known: true, space: true });
      continue;
    }
    if (ch === "œ" || ch === "Œ" || ch === "æ" || ch === "Æ") {
      // Ligatures are spelled as their two letters.
      for (const part of ch === "œ" ? "oe" : ch === "Œ" ? "OE" : ch === "æ" ? "ae" : "AE")
        out.push(...spell(part, alphabet, markCase));
      continue;
    }
    const nfd = ch.normalize("NFD");
    const base = nfd[0] ?? "";
    const marks = [...nfd.slice(1)];
    const upper = base.toUpperCase();
    const letter = /^[A-Z]$/.test(upper) ? spec.letters[upper.charCodeAt(0) - 65] : undefined;
    if (letter) {
      let word = letter;
      if (markCase) word = base === upper ? spec.upper(word) : spec.lower(word);
      const accents = marks.map((m) => spec.accents[m]).filter(Boolean);
      if (accents.length)
        word += alphabet === "fr" ? ` ${accents.join(" ")}` : ` (${accents.join(", ")})`;
      out.push({ char: ch, word, known: true, space: false });
    } else if (/^[0-9]$/.test(ch)) {
      out.push({ char: ch, word: spec.digits[Number(ch)] ?? ch, known: true, space: false });
    } else if (spec.symbols[ch]) {
      out.push({ char: ch, word: spec.symbols[ch] ?? ch, known: true, space: false });
    } else out.push({ char: ch, word: ch, known: false, space: false });
  }
  if (out[out.length - 1]?.space) out.pop();
  return out;
}

/** One line per word of the input, the spelled words separated by spaces. */
export function spellText(items: Spelled[]): string {
  const lines: string[][] = [[]];
  for (const it of items) {
    if (it.space) lines.push([]);
    else lines[lines.length - 1]?.push(it.word);
  }
  return lines
    .filter((l) => l.length)
    .map((l) => l.join(" "))
    .join("\n");
}

export function alphabetTable(alphabet: Alphabet): { char: string; word: string }[] {
  const spec = SPECS[alphabet];
  return [
    ...spec.letters.map((word, i) => ({ char: String.fromCharCode(65 + i), word })),
    ...spec.digits.map((word, i) => ({ char: String(i), word })),
  ];
}
