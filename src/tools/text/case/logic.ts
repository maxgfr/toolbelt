/**
 * Case conversion. Identifier styles (camelCase, snake_case…) split each line
 * into words at separators and at case changes ("XMLHttpRequest" → XML, Http,
 * Request); prose styles (Title, Sentence, lower, UPPER) keep the text as is.
 */
import { splitLines } from "../_shared";

export type CaseId =
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "dot"
  | "path"
  | "train"
  | "title"
  | "sentence"
  | "lower"
  | "upper"
  | "alternating";

/** The words of an identifier or phrase (letters and digits only). */
export function words(text: string): string[] {
  return text
    .replace(/['’]/g, "")
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

function cap(w: string): string {
  const [first = "", ...rest] = w;
  return first.toUpperCase() + rest.join("").toLowerCase();
}

function joinWords(line: string, id: CaseId): string {
  const ws = words(line);
  switch (id) {
    case "camel":
      return ws.map((w, i) => (i ? cap(w) : w.toLowerCase())).join("");
    case "pascal":
      return ws.map(cap).join("");
    case "snake":
      return ws.join("_").toLowerCase();
    case "kebab":
      return ws.join("-").toLowerCase();
    case "constant":
      return ws.join("_").toUpperCase();
    case "dot":
      return ws.join(".").toLowerCase();
    case "path":
      return ws.join("/").toLowerCase();
    default:
      return ws.map(cap).join("-");
  }
}

/** Every word capitalized, the rest lowercased; separators untouched. */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /(^|[^\p{L}\p{M}\p{N}'’])(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
}

/** Lowercase, with the first letter of each sentence capitalized. */
export function sentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /(^\s*|[.!?…]\s+|\n\s*)(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
}

/** aLtErNaTiNg over letters only (spaces and punctuation do not break the rhythm). */
export function alternating(text: string): string {
  let i = 0;
  return text.replace(/\p{L}/gu, (ch) => (i++ % 2 ? ch.toUpperCase() : ch.toLowerCase()));
}

export function convertCase(text: string, id: CaseId): string {
  switch (id) {
    case "title":
      return titleCase(text);
    case "sentence":
      return sentenceCase(text);
    case "lower":
      return text.toLowerCase();
    case "upper":
      return text.toUpperCase();
    case "alternating":
      return alternating(text);
    default:
      // One identifier per line, so a list of names converts in one go.
      return splitLines(text)
        .map((line) => joinWords(line, id))
        .join("\n");
  }
}

export const CASES: CaseId[] = [
  "camel",
  "pascal",
  "snake",
  "kebab",
  "constant",
  "dot",
  "path",
  "train",
  "title",
  "sentence",
  "lower",
  "upper",
  "alternating",
];
