import { describe, expect, test } from "bun:test";
import {
  aspectRatio,
  deviceLabel,
  measuredFps,
  meterFraction,
  nextPeak,
  pickMime,
  resolutionName,
  toDb,
} from "./logic";

describe("levels", () => {
  test("dBFS", () => {
    expect(toDb(1)).toBe(0);
    expect(toDb(0.1)).toBeCloseTo(-20);
    expect(toDb(0)).toBe(Number.NEGATIVE_INFINITY);
  });
  test("meter position", () => {
    expect(meterFraction(0)).toBe(1);
    expect(meterFraction(-30)).toBe(0.5);
    expect(meterFraction(-90)).toBe(0);
    expect(meterFraction(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(meterFraction(6)).toBe(1);
  });
  test("peak hold then fall", () => {
    let p = { db: Number.NEGATIVE_INFINITY, at: 0 };
    p = nextPeak(p, -10, 0);
    expect(p).toEqual({ db: -10, at: 0 });
    expect(nextPeak(p, -40, 500)).toEqual(p);
    expect(nextPeak(p, -40, 1500).db).toBeCloseTo(-20);
    expect(nextPeak(p, -40, 5000)).toEqual({ db: -40, at: 5000 });
    expect(nextPeak(p, -5, 100)).toEqual({ db: -5, at: 100 });
  });
});

describe("video", () => {
  test("resolution names", () => {
    expect(resolutionName(1280, 720)).toBe("720p");
    expect(resolutionName(1920, 1080)).toBe("1080p");
    expect(resolutionName(1080, 1920)).toBe("1080p");
    expect(resolutionName(3840, 2160)).toBe("4K");
    expect(resolutionName(1000, 700)).toBeNull();
  });
  test("aspect ratios", () => {
    expect(aspectRatio(1920, 1080)).toBe("16:9");
    expect(aspectRatio(640, 480)).toBe("4:3");
    expect(aspectRatio(1080, 1920)).toBe("9:16");
    expect(aspectRatio(1000, 700)).toBe("10:7");
    expect(aspectRatio(1001, 700)).toBe("1.43:1");
    expect(aspectRatio(0, 10)).toBe("–");
  });
  test("measured fps", () => {
    const times = Array.from({ length: 31 }, (_, i) => i * (1000 / 30));
    expect(measuredFps(times)).toBeCloseTo(30);
    expect(measuredFps([5])).toBeNull();
    expect(measuredFps([0, 0])).toBeNull();
  });
});

test("device labels and recording format", () => {
  expect(deviceLabel("", 1, "Camera")).toBe("Camera 2");
  expect(deviceLabel("FaceTime HD", 0, "Camera")).toBe("FaceTime HD");
  expect(pickMime((t) => t === "audio/mp4")).toBe("audio/mp4");
  expect(pickMime(() => true)).toBe("audio/webm;codecs=opus");
  expect(pickMime(() => false)).toBe("");
});
