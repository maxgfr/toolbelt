/** Data sizes in bits and bytes, SI (1000) and IEC (1024), and how long a transfer takes. */

export interface SizeUnit {
  id: string;
  /** Size of one unit, in bits. */
  bits: number;
  system: "bit" | "si" | "iec";
}

export const SIZE_UNITS: SizeUnit[] = [
  { id: "bit", bits: 1, system: "bit" },
  { id: "kbit", bits: 1e3, system: "bit" },
  { id: "Mbit", bits: 1e6, system: "bit" },
  { id: "Gbit", bits: 1e9, system: "bit" },
  { id: "Tbit", bits: 1e12, system: "bit" },
  { id: "B", bits: 8, system: "si" },
  { id: "kB", bits: 8e3, system: "si" },
  { id: "MB", bits: 8e6, system: "si" },
  { id: "GB", bits: 8e9, system: "si" },
  { id: "TB", bits: 8e12, system: "si" },
  { id: "PB", bits: 8e15, system: "si" },
  { id: "KiB", bits: 8 * 1024, system: "iec" },
  { id: "MiB", bits: 8 * 1024 ** 2, system: "iec" },
  { id: "GiB", bits: 8 * 1024 ** 3, system: "iec" },
  { id: "TiB", bits: 8 * 1024 ** 4, system: "iec" },
  { id: "PiB", bits: 8 * 1024 ** 5, system: "iec" },
];

export interface RateUnit {
  id: string;
  /** Bits per second. */
  bps: number;
}

export const RATE_UNITS: RateUnit[] = [
  { id: "kbit/s", bps: 1e3 },
  { id: "Mbit/s", bps: 1e6 },
  { id: "Gbit/s", bps: 1e9 },
  { id: "kB/s", bps: 8e3 },
  { id: "MB/s", bps: 8e6 },
  { id: "GB/s", bps: 8e9 },
  { id: "KiB/s", bps: 8 * 1024 },
  { id: "MiB/s", bps: 8 * 1024 ** 2 },
];

function unit<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((u) => u.id === id);
}

/** `value` of `from` expressed in every unit. */
export function convertSize(value: number, from: string): { id: string; value: number }[] {
  const u = unit(SIZE_UNITS, from);
  if (!u) return [];
  const bits = value * u.bits;
  return SIZE_UNITS.map((t) => ({ id: t.id, value: bits / t.bits }));
}

/** The largest unit of a system where the value is at least 1: 1536 B → 1.5 KiB. */
export function humanSize(bytes: number, system: "si" | "iec"): { value: number; id: string } {
  const list = SIZE_UNITS.filter((u) => u.system === system || u.id === "B");
  const bits = bytes * 8;
  let best = list[0] as SizeUnit;
  for (const u of list) if (Math.abs(bits) >= u.bits) best = u;
  return { value: bits / best.bits, id: best.id };
}

/** Seconds to move `size` of `sizeUnit` at `rate` of `rateUnit`; null if the rate is not positive. */
export function transferSeconds(
  size: number,
  sizeUnit: string,
  rate: number,
  rateUnit: string,
): number | null {
  const s = unit(SIZE_UNITS, sizeUnit);
  const r = unit(RATE_UNITS, rateUnit);
  if (!s || !r || !(rate > 0) || !(size >= 0)) return null;
  return (size * s.bits) / (rate * r.bps);
}
