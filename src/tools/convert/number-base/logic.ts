/** Integers in any base from 2 to 36, with BigInt so size is not a limit. */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const PREFIX: Record<string, number> = { "0x": 16, "0b": 2, "0o": 8 };

export type ParseResult =
  | { ok: true; value: bigint }
  | { ok: false; error: "empty" }
  | { ok: false; error: "digit"; char: string; index: number }
  | { ok: false; error: "base" };

export function isBase(base: number): boolean {
  return Number.isInteger(base) && base >= 2 && base <= 36;
}

/**
 * Reads an integer written in `base`. Spaces, underscores and apostrophes are
 * ignored (digit groups), a sign is allowed, and so is the 0x / 0b / 0o prefix
 * of the matching base.
 */
export function parseInBase(input: string, base: number): ParseResult {
  if (!isBase(base)) return { ok: false, error: "base" };
  let s = input
    .trim()
    .replace(/[\s_'  ]/g, "")
    .toLowerCase();
  if (!s) return { ok: false, error: "empty" };
  let negative = false;
  if (s[0] === "-" || s[0] === "+" || s[0] === "−") {
    negative = s[0] !== "+";
    s = s.slice(1);
  }
  const prefix = PREFIX[s.slice(0, 2)];
  if (prefix === base && s.length > 2) s = s.slice(2);
  if (!s) return { ok: false, error: "empty" };
  const b = BigInt(base);
  let value = 0n;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) {
      // Point at the character in the original input.
      const index = input.toLowerCase().indexOf(ch);
      return { ok: false, error: "digit", char: input[index] ?? ch, index };
    }
    value = value * b + BigInt(d);
  }
  return { ok: true, value: negative ? -value : value };
}

export function toBase(value: bigint, base: number, upper = false): string {
  const s = value.toString(base);
  return upper ? s.toUpperCase() : s;
}

/** Groups digits from the right: "11111111" by 4 → "1111 1111". The sign stays in front. */
export function groupDigits(s: string, size: number, sep = " "): string {
  if (size <= 0) return s;
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  const out: string[] = [];
  for (let end = digits.length; end > 0; end -= size)
    out.unshift(digits.slice(Math.max(0, end - size), end));
  return (neg ? "-" : "") + out.join(sep);
}

/** The usual group size for a base: 4 for binary and hex, 3 for the rest. */
export function groupSize(base: number): number {
  return base === 2 || base === 16 ? 4 : 3;
}

export interface TwosComplement {
  bits: number;
  /** Whether the value fits in this width (signed or unsigned). */
  fits: boolean;
  binary: string;
  hex: string;
  /** The same bits read as a signed integer. */
  signed: bigint;
  /** The same bits read as an unsigned integer. */
  unsigned: bigint;
}

/** The bit pattern of `value` in a `bits`-wide register (two's complement for negatives). */
export function twosComplement(value: bigint, bits: number): TwosComplement {
  const width = BigInt(bits);
  const size = 1n << width;
  const fits = value >= -(size >> 1n) && value < size;
  const unsigned = BigInt.asUintN(bits, value);
  return {
    bits,
    fits,
    binary: unsigned.toString(2).padStart(bits, "0"),
    hex: unsigned
      .toString(16)
      .toUpperCase()
      .padStart(bits / 4, "0"),
    signed: BigInt.asIntN(bits, value),
    unsigned,
  };
}

/** Number of bits needed for the magnitude (0 → 1). */
export function bitLength(value: bigint): number {
  const v = value < 0n ? -value : value;
  return v === 0n ? 1 : v.toString(2).length;
}
