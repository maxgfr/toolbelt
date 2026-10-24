/**
 * Classic letter ciphers: Caesar (any shift), ROT13 (Caesar 13, its own
 * inverse), ROT47 (the printable ASCII range ! to ~) and Atbash (A↔Z).
 * Only unaccented Latin letters move; everything else is kept as is.
 */

export type Cipher = "rot13" | "rot47" | "caesar" | "atbash";

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function caesar(text: string, shift: number): string {
  const k = mod(Math.trunc(shift), 26);
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + mod(c.charCodeAt(0) - base + k, 26));
  });
}

export function rot13(text: string): string {
  return caesar(text, 13);
}

export function rot47(text: string): string {
  return text.replace(/[!-~]/g, (c) =>
    String.fromCharCode(33 + mod(c.charCodeAt(0) - 33 + 47, 94)),
  );
}

export function atbash(text: string): string {
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

/** Applies a cipher; `decode` only matters for Caesar (the others are their own inverse). */
export function applyCipher(text: string, cipher: Cipher, shift: number, decode: boolean): string {
  switch (cipher) {
    case "rot13":
      return rot13(text);
    case "rot47":
      return rot47(text);
    case "atbash":
      return atbash(text);
    case "caesar":
      return caesar(text, decode ? -shift : shift);
  }
}

/** Frequent English, French and German words, to rank Caesar shifts by how readable they make a text. */
const COMMON = new Set(
  (
    "the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was " +
    "le la les de des du un une et en est que qui dans pour pas sur au avec il elle ne se ce son sa ses plus par je tu nous vous ils on mais ou si leur bien tout fait comme été être avoir aux cette mon ma mes " +
    "der die das und ist nicht ein eine einen zu den von mit sich des auf für im dem auch es als nach wie aus bei sind wird ich sie er wir ihr oder aber noch über dass hat haben war wenn nur kann schon"
  ).split(" "),
);

/** How many words of the text are common words (a rough "does it read like a language" score). */
export function readability(text: string): number {
  let n = 0;
  for (const w of text.toLowerCase().match(/\p{L}+/gu) ?? []) if (COMMON.has(w)) n++;
  return n;
}

/** All 25 Caesar decodings, the most readable first (ties keep the shift order). */
export function bruteForce(text: string): { shift: number; text: string; score: number }[] {
  const all = Array.from({ length: 25 }, (_, i) => {
    const out = caesar(text, -(i + 1));
    return { shift: i + 1, text: out, score: readability(out) };
  });
  return all.sort((a, b) => b.score - a.score || a.shift - b.shift);
}
