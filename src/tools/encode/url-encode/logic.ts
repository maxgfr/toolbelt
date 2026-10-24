/**
 * Percent-encoding (RFC 3986) as a URL component, a whole URL, or HTML form data
 * (application/x-www-form-urlencoded, spaces as +), and the matching decoders, with the
 * position of a malformed escape.
 */
import { fail } from "../_shared";

export type UrlMode = "component" | "uri" | "form";

/** `encodeURIComponent`, plus `!'()*` when `strict` (they are reserved in RFC 3986). */
export function encodeComponent(text: string, strict = false): string {
  const s = encodeURIComponent(text);
  return strict
    ? s.replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    : s;
}

/** The WHATWG form encoding: only A–Z a–z 0–9 * - . _ stay as they are, spaces become +. */
export function encodeForm(text: string): string {
  let out = "";
  for (const b of new TextEncoder().encode(text)) {
    const c = String.fromCharCode(b);
    if (/[A-Za-z0-9*\-._]/.test(c)) out += c;
    else if (b === 0x20) out += "+";
    else out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

export function encodeUrl(text: string, mode: UrlMode, strict = false): string {
  try {
    if (mode === "component") return encodeComponent(text, strict);
    if (mode === "uri") return encodeURI(text);
    return encodeForm(text);
  } catch {
    // encodeURI* throw on a lone surrogate, which only arrives from pasted broken text.
    fail(
      "The text contains a broken character (lone surrogate).",
      "Le texte contient un caractère cassé (surrogate isolé).",
      "Der Text enthält ein kaputtes Zeichen (einzelnes Surrogat).",
    );
  }
}

export function decodeUrl(text: string, mode: UrlMode): string {
  const src = mode === "form" ? text.replace(/\+/g, " ") : text;
  try {
    return mode === "uri" ? decodeURI(src) : decodeURIComponent(src);
  } catch {
    explainMalformed(src);
  }
}

/** Throws a message saying where and why a percent-encoded string does not decode. */
function explainMalformed(text: string): never {
  const bad = /%(?![0-9a-f]{2})/i.exec(text);
  if (bad)
    fail(
      `Incomplete escape at position ${bad.index + 1}: % must be followed by two hex digits.`,
      `Échappement incomplet à la position ${bad.index + 1} : % doit être suivi de deux chiffres hexa.`,
      `Unvollständige Escape-Sequenz an Position ${bad.index + 1}: Auf % müssen zwei Hex-Ziffern folgen.`,
    );
  // Every escape is well-formed, so a run of escapes is not valid UTF-8.
  const re = /(?:%[0-9a-f]{2})+/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    try {
      decodeURIComponent(m[0]);
    } catch {
      fail(
        `The bytes ${m[0]} at position ${m.index + 1} are not valid UTF-8.`,
        `Les octets ${m[0]} à la position ${m.index + 1} ne sont pas de l'UTF-8 valide.`,
        `Die Bytes ${m[0]} an Position ${m.index + 1} sind kein gültiges UTF-8.`,
      );
    }
  }
  fail(
    "Malformed percent-encoding.",
    "Encodage pourcent malformé.",
    "Fehlerhafte Prozentkodierung.",
  );
}

/** True when the text still contains percent escapes (it was probably encoded twice). */
export function looksEncoded(text: string): boolean {
  return /%[0-9a-f]{2}/i.test(text);
}
