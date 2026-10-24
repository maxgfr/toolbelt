import { describe, expect, test } from "bun:test";
import { seededInt } from "../_shared";
import { rms } from "../tuner/logic";
import {
  clampFreq,
  freqToSlider,
  noiseSamples,
  roundFreq,
  sleepLeft,
  sliderToFreq,
  smoothLoop,
  volumeToGain,
} from "./logic";

function uniform(seed: number): () => number {
  const r = seededInt(seed);
  return () => r(1_000_000) / 1_000_000;
}

/** Energy of the signal's first difference relative to the signal: high for bright noise. */
function brightness(b: Float32Array): number {
  let d = 0;
  for (let i = 1; i < b.length; i++) d += ((b[i] as number) - (b[i - 1] as number)) ** 2;
  return Math.sqrt(d / b.length) / rms(b);
}

describe("noise", () => {
  const n = 48_000;
  const white = noiseSamples("white", n, uniform(1));
  const pink = noiseSamples("pink", n, uniform(1));
  const brown = noiseSamples("brown", n, uniform(1));

  test("same loudness, within [-1, 1], no offset", () => {
    for (const b of [white, pink, brown]) {
      expect(rms(b)).toBeCloseTo(0.25, 1);
      expect(b.every((v) => v >= -1 && v <= 1)).toBe(true);
      expect(Math.abs(b.reduce((s, v) => s + v, 0) / n)).toBeLessThan(0.02);
    }
  });

  test("white is brighter than pink, pink brighter than brown", () => {
    expect(brightness(white)).toBeGreaterThan(brightness(pink));
    expect(brightness(pink)).toBeGreaterThan(brightness(brown));
  });

  test("deterministic with a seeded source", () => {
    expect(noiseSamples("pink", 100, uniform(7))).toEqual(noiseSamples("pink", 100, uniform(7)));
  });

  test("empty buffer", () => {
    expect(noiseSamples("white", 0, uniform(1))).toHaveLength(0);
  });

  test("smoothLoop crossfades the seam", () => {
    const b = new Float32Array([0, 0, 0, 0, 1, 1]);
    const s = smoothLoop(b, 2);
    expect(s).toHaveLength(4);
    expect([...s]).toEqual([1, 0.5, 0, 0]);
  });
});

describe("controls", () => {
  test("volume curve is low and capped", () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(20)).toBeCloseTo(0.02);
    expect(volumeToGain(100)).toBe(0.5);
    expect(volumeToGain(500)).toBe(0.5);
    expect(volumeToGain(Number.NaN)).toBe(0);
  });

  test("log slider round trip", () => {
    expect(sliderToFreq(0)).toBeCloseTo(20);
    expect(sliderToFreq(1000)).toBeCloseTo(20_000);
    expect(sliderToFreq(500)).toBeCloseTo(Math.sqrt(20 * 20_000));
    for (const f of [20, 100, 440, 1000, 15_000])
      expect(sliderToFreq(freqToSlider(f))).toBeCloseTo(f);
  });

  test("frequency helpers", () => {
    expect(clampFreq(5)).toBe(20);
    expect(clampFreq(50_000)).toBe(20_000);
    expect(clampFreq(Number.NaN)).toBe(440);
    expect(roundFreq(440.04)).toBe(440);
    expect(roundFreq(1234.6)).toBe(1235);
  });

  test("sleep timer", () => {
    expect(sleepLeft(null, 5)).toBeNull();
    expect(sleepLeft(10_000, 4000)).toBe(6000);
    expect(sleepLeft(10_000, 20_000)).toBe(0);
  });
});
