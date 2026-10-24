import { describe, expect, test } from "bun:test";
import { seededInt } from "../_shared";
import {
  centsBetween,
  detectPitch,
  inTune,
  median,
  midiToFreq,
  nearestString,
  noteFromFreq,
  noteName,
  rms,
} from "./logic";

function sine(freq: number, sr: number, n = 4096, amp = 0.5, phase = 0.3): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = amp * Math.sin(2 * Math.PI * freq * (i / sr) + phase);
  return b;
}

/** A string-like tone: a fundamental and decaying harmonics. */
function rich(freq: number, sr: number, n = 4096): Float32Array {
  const b = new Float32Array(n);
  for (let h = 1; h <= 6; h++)
    for (let i = 0; i < n; i++)
      b[i] = (b[i] as number) + (0.5 / h) * Math.sin(2 * Math.PI * freq * h * (i / sr) + h);
  return b;
}

describe("detectPitch", () => {
  for (const sr of [44_100, 48_000])
    for (const f of [82.41, 110, 146.83, 196, 246.94, 329.63, 440, 880, 1200])
      test(`${f} Hz at ${sr} Hz`, () => {
        const p = detectPitch(sine(f, sr), sr);
        expect(p).not.toBeNull();
        expect(Math.abs(centsBetween(p?.freq ?? 0, f))).toBeLessThan(2);
        expect(p?.clarity ?? 0).toBeGreaterThan(0.9);
      });

  test("finds the fundamental of a tone with strong harmonics", () => {
    const p = detectPitch(rich(110, 48_000), 48_000);
    expect(Math.abs(centsBetween(p?.freq ?? 0, 110))).toBeLessThan(3);
  });

  test("a note that starts in the middle of the buffer is still found", () => {
    const b = sine(400, 48_000);
    b.fill(0, 0, 1800);
    const p = detectPitch(b, 48_000);
    expect(Math.abs(centsBetween(p?.freq ?? 0, 400))).toBeLessThan(5);
  });

  test("silence and noise give nothing", () => {
    expect(detectPitch(new Float32Array(4096), 48_000)).toBeNull();
    expect(detectPitch(sine(440, 48_000, 4096, 0.001), 48_000)).toBeNull();
    for (let seed = 1; seed <= 20; seed++) {
      const rand = seededInt(seed);
      const noise = new Float32Array(4096).map(() => rand(2000) / 1000 - 1);
      expect(detectPitch(noise, 48_000)).toBeNull();
    }
  });

  test("a buffer too short for the lowest note gives nothing", () => {
    expect(detectPitch(sine(440, 48_000, 512), 48_000)).toBeNull();
  });

  test("rms", () => {
    expect(rms(sine(100, 48_000, 4800, 1))).toBeCloseTo(Math.SQRT1_2, 2);
    expect(rms([])).toBe(0);
  });
});

describe("notes", () => {
  test("A4 and neighbours", () => {
    expect(noteFromFreq(440)).toMatchObject({ midi: 69, pc: 9, octave: 4 });
    expect(noteFromFreq(440)?.cents).toBeCloseTo(0);
    expect(noteName(noteFromFreq(261.63) as never)).toBe("C4");
    expect(noteName(noteFromFreq(261.63) as never, "fr")).toBe("do4");
    expect(noteName(noteFromFreq(82.41) as never)).toBe("E2");
  });
  test("cents off", () => {
    const n = noteFromFreq(445);
    expect(n?.midi).toBe(69);
    expect(n?.cents).toBeCloseTo(19.56, 1);
    expect(noteFromFreq(430)?.cents).toBeCloseTo(-39.8, 1);
  });
  test("another reference pitch", () => {
    expect(noteFromFreq(432, 432)?.cents).toBeCloseTo(0);
    expect(midiToFreq(69, 442)).toBe(442);
    expect(midiToFreq(57)).toBeCloseTo(220);
  });
  test("invalid input", () => {
    expect(noteFromFreq(0)).toBeNull();
    expect(noteFromFreq(Number.NaN)).toBeNull();
  });
  test("guitar strings", () => {
    expect(nearestString(83)).toMatchObject({ index: 0, midi: 40 });
    expect(nearestString(196.5)?.index).toBe(3);
    expect(nearestString(330)?.index).toBe(5);
    expect(nearestString(-1)).toBeNull();
  });
  test("helpers", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
    expect(inTune(4.9)).toBe(true);
    expect(inTune(-6)).toBe(false);
  });
});
