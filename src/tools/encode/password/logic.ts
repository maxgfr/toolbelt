/**
 * Passwords and passphrases from the system's secure randomness (crypto.getRandomValues through
 * rejection sampling, so every character and word is uniform), their exact entropy, and a
 * strength estimate for passwords people type themselves.
 */
import { fail, randomInt } from "../_shared";
import { WORDS } from "./words";

export const CLASSES = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
} as const;

export type CharClass = keyof typeof CLASSES;

/** Characters easy to confuse when read or typed: I l 1 | O 0 o and quotes. */
export const AMBIGUOUS = "Il1|O0o`'\"";

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  /** At least one character of each chosen class. */
  eachClass: boolean;
}

/** The character sets the options allow, one per chosen class. */
export function pools(opts: PasswordOptions): string[] {
  const out: string[] = [];
  for (const k of Object.keys(CLASSES) as CharClass[]) {
    if (!opts[k]) continue;
    let chars: string = CLASSES[k];
    if (opts.excludeAmbiguous) chars = [...chars].filter((c) => !AMBIGUOUS.includes(c)).join("");
    out.push(chars);
  }
  return out;
}

function check(opts: PasswordOptions): string[] {
  const p = pools(opts);
  if (!p.length)
    fail(
      "Choose at least one kind of character.",
      "Choisis au moins un type de caractère.",
      "Wähle mindestens eine Zeichenart.",
    );
  if (!Number.isInteger(opts.length) || opts.length < MIN_LENGTH || opts.length > MAX_LENGTH)
    fail(
      `The length must be between ${MIN_LENGTH} and ${MAX_LENGTH}.`,
      `La longueur doit être entre ${MIN_LENGTH} et ${MAX_LENGTH}.`,
      `Die Länge muss zwischen ${MIN_LENGTH} und ${MAX_LENGTH} liegen.`,
    );
  if (opts.eachClass && opts.length < p.length)
    fail(
      "The password is too short to hold one character of each kind.",
      "Le mot de passe est trop court pour contenir un caractère de chaque type.",
      "Das Passwort ist zu kurz für ein Zeichen jeder Art.",
    );
  return p;
}

/**
 * A uniform random password. With `eachClass`, draws are rejected until every class appears:
 * the result is uniform over the passwords that satisfy the rule (no forced positions).
 */
export function generatePassword(opts: PasswordOptions): string {
  const p = check(opts);
  const all = p.join("");
  for (;;) {
    let out = "";
    for (let i = 0; i < opts.length; i++) out += all[randomInt(all.length)];
    if (!opts.eachClass || p.every((set) => [...out].some((c) => set.includes(c)))) return out;
  }
}

/**
 * Exact entropy in bits of `generatePassword` with these options: log2 of the number of possible
 * passwords. With `eachClass`, counts them by inclusion–exclusion over the missing classes.
 */
export function passwordEntropy(opts: PasswordOptions): number {
  const p = pools(opts);
  const n = p.reduce((s, x) => s + x.length, 0);
  if (!n || opts.length < 1) return 0;
  let fraction = 1;
  if (opts.eachClass) {
    // Share of all n^length strings that contain every class.
    fraction = 0;
    for (let mask = 0; mask < 1 << p.length; mask++) {
      let missing = 0;
      let bits = 0;
      for (let i = 0; i < p.length; i++)
        if (mask & (1 << i)) {
          missing += (p[i] as string).length;
          bits++;
        }
      fraction += (bits % 2 ? -1 : 1) * ((n - missing) / n) ** opts.length;
    }
    if (fraction <= 0) return 0;
  }
  return opts.length * Math.log2(n) + Math.log2(fraction);
}

/* --- Passphrases --------------------------------------------------------------- */

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  /** Append one random digit to one random word. */
  digit: boolean;
}

export const MIN_WORDS = 3;
export const MAX_WORDS = 20;

export function generatePassphrase(
  opts: PassphraseOptions,
  list: readonly string[] = WORDS,
): string {
  const n = Math.min(MAX_WORDS, Math.max(1, Math.floor(opts.words) || 1));
  const words: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = list[randomInt(list.length)] as string;
    words.push(opts.capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  }
  if (opts.digit) {
    const i = randomInt(n);
    words[i] += String(randomInt(10));
  }
  return words.join(opts.separator);
}

/** Bits of a passphrase: log2(list size) per word, plus the digit and its position. */
export function passphraseEntropy(
  opts: PassphraseOptions,
  listSize: number = WORDS.length,
): number {
  const n = Math.min(MAX_WORDS, Math.max(1, Math.floor(opts.words) || 1));
  return n * Math.log2(listSize) + (opts.digit ? Math.log2(10 * n) : 0);
}

/* --- Strength of a typed password ------------------------------------------------ */

/** Very common passwords and keyboard walks: guessed first by any cracker. */
const COMMON = `
123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball
abc123 football monkey letmein shadow master 666666 qwertyuiop 123321 mustang 1234567890
michael 654321 superman 1qaz2wsx 7777777 121212 000000 qazwsx 123qwe trustno1 jordan
jennifer zxcvbnm asdfgh hunter buster soccer harley batman andrew tigger sunshine iloveyou
2000 charlie robert thomas hockey ranger daniel starwars 112233 george computer michelle
jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie 159753 aaaaaa
ginger princess joshua cheese amanda summer love ashley nicole chelsea matthew access
yankees 987654321 dallas austin thunder taylor matrix admin welcome login passw0rd azerty
motdepasse soleil doudou chouchou loulou marseille asdf qwer azer qsdf
`
  .trim()
  .split(/\s+/);
const COMMON_RANK = new Map(COMMON.map((w, i) => [w, i + 1]));
const DICT = new Set([
  ...WORDS.filter((w) => w.length >= 4),
  ...COMMON.filter((w) => w.length >= 4),
]);

export type Warning = "common" | "dictionary" | "pattern" | "short";

export interface Strength {
  bits: number;
  /** 0 very weak · 1 weak · 2 fair · 3 strong · 4 very strong. */
  score: 0 | 1 | 2 | 3 | 4;
  warnings: Warning[];
}

/** Size of the character set an attacker would try, from the kinds of characters present. */
export function charsetSize(pw: string): number {
  let size = 0;
  if (/[a-z]/.test(pw)) size += 26;
  if (/[A-Z]/.test(pw)) size += 26;
  if (/[0-9]/.test(pw)) size += 10;
  if (/[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(pw)) size += 33;
  if (/[^\x20-\x7e]/.test(pw)) size += 100;
  return size;
}

export function scoreOf(bits: number): Strength["score"] {
  if (bits < 28) return 0;
  if (bits < 36) return 1;
  if (bits < 60) return 2;
  if (bits < 80) return 3;
  return 4;
}

/**
 * A conservative estimate: log2(charset) per character, but a repeated or sequential character
 * (aa, abc, 123) costs 1 bit, a dictionary word 11–12 bits, and a common password log2(rank).
 */
export function estimateStrength(pw: string): Strength {
  const warnings = new Set<Warning>();
  if (!pw) return { bits: 0, score: 0, warnings: [] };
  const lower = pw.toLowerCase();
  // A common password, maybe with a few digits or symbols added at the end.
  const base = COMMON_RANK.has(lower) ? lower : lower.replace(/[\d\W_]+$/u, "");
  const rank = COMMON_RANK.get(base);
  if (rank) {
    const tail = pw.slice(base.length);
    const bits = Math.log2(rank + 1) + (tail ? [...tail].length * Math.log2(charsetSize(tail)) : 0);
    return { bits, score: scoreOf(bits), warnings: ["common"] };
  }
  const chars = [...pw];
  const perChar = Math.log2(charsetSize(pw));
  let bits = 0;
  let i = 0;
  while (i < chars.length) {
    let matched = 0;
    for (let len = Math.min(10, chars.length - i); len >= 4; len--) {
      if (
        DICT.has(
          chars
            .slice(i, i + len)
            .join("")
            .toLowerCase(),
        )
      ) {
        matched = len;
        break;
      }
    }
    if (matched) {
      const word = chars.slice(i, i + matched).join("");
      bits += Math.log2(WORDS.length) + (word === word.toLowerCase() ? 0 : 1);
      warnings.add("dictionary");
      i += matched;
      continue;
    }
    const c = chars[i]?.codePointAt(0) ?? 0;
    const prev = i > 0 ? (chars[i - 1]?.codePointAt(0) ?? -9) : -9;
    if (c === prev || Math.abs(c - prev) === 1) {
      bits += 1;
      warnings.add("pattern");
    } else bits += perChar;
    i++;
  }
  if (chars.length < 8) warnings.add("short");
  return { bits, score: scoreOf(bits), warnings: [...warnings] };
}

/**
 * Average time to find the password by brute force at `rate` guesses per second (default: an
 * offline attack on a fast hash with GPUs, 10^10/s), in seconds.
 */
export function crackSeconds(bits: number, rate = 1e10): number {
  return 2 ** Math.max(0, bits - 1) / rate;
}

export type TimeUnit = "instant" | "seconds" | "minutes" | "hours" | "days" | "years" | "ages";

/** A duration in the largest sensible unit; "ages" past a trillion years. */
export function timeUnit(seconds: number): { unit: TimeUnit; value: number } {
  if (seconds < 1) return { unit: "instant", value: 0 };
  if (seconds < 60) return { unit: "seconds", value: Math.round(seconds) };
  if (seconds < 3600) return { unit: "minutes", value: Math.round(seconds / 60) };
  if (seconds < 86400) return { unit: "hours", value: Math.round(seconds / 3600) };
  const days = seconds / 86400;
  if (days < 365) return { unit: "days", value: Math.round(days) };
  const years = days / 365.25;
  if (years < 1e12) return { unit: "years", value: Math.round(years) };
  return { unit: "ages", value: 0 };
}
