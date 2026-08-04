import { describe, expect, it } from "vitest";
import {
  BAND_WIDTH_MAX,
  BAND_WIDTH_MIN,
  bandWidthAt,
  GOAL_HITS,
  NEEDLE_PERIOD_MAX_MS,
  NEEDLE_PERIOD_MIN_MS,
  needlePeriodAt,
  randomBandLeft,
  staticLevel,
} from "./difficulty";

describe("bandWidthAt", () => {
  it("starts wide and narrows with every hit", () => {
    expect(bandWidthAt(0)).toBe(BAND_WIDTH_MAX);
    for (let hits = 1; hits < GOAL_HITS; hits++) {
      expect(bandWidthAt(hits)).toBeLessThan(bandWidthAt(hits - 1));
    }
  });

  it("never narrows past the aimable minimum", () => {
    expect(bandWidthAt(GOAL_HITS - 1)).toBeGreaterThanOrEqual(BAND_WIDTH_MIN);
    expect(bandWidthAt(100)).toBe(BAND_WIDTH_MIN);
  });
});

describe("needlePeriodAt", () => {
  it("speeds the needle up with every hit", () => {
    expect(needlePeriodAt(0)).toBe(NEEDLE_PERIOD_MAX_MS);
    for (let hits = 1; hits < GOAL_HITS; hits++) {
      expect(needlePeriodAt(hits)).toBeLessThan(needlePeriodAt(hits - 1));
    }
  });

  it("never gets faster than reaction time allows", () => {
    expect(needlePeriodAt(GOAL_HITS - 1)).toBeGreaterThanOrEqual(NEEDLE_PERIOD_MIN_MS);
    expect(needlePeriodAt(100)).toBe(NEEDLE_PERIOD_MIN_MS);
  });
});

describe("randomBandLeft", () => {
  it("keeps the whole band on the dial, at every width", () => {
    for (let hits = 0; hits < GOAL_HITS; hits++) {
      const width = bandWidthAt(hits);
      for (let i = 0; i < 200; i++) {
        const left = randomBandLeft(width);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + width).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("staticLevel", () => {
  it("is quietest inside the band and loudest far from it", () => {
    const width = bandWidthAt(0);
    const center = staticLevel(50, 50 - width / 2, width);
    const edge = staticLevel(50 + width / 2, 50 - width / 2, width);
    expect(edge).toBeCloseTo(center);
    expect(staticLevel(0, 50 - width / 2, width)).toBeGreaterThan(center);
    expect(staticLevel(0, 50 - width / 2, width)).toBeLessThanOrEqual(1);
  });

  it("gets noisier as the band narrows at the same distance", () => {
    // 좁아진 대역은 같은 자리에서도 더 멀다 — 소리만으로도 난이도가 올라간다.
    const wide = staticLevel(30, 50 - BAND_WIDTH_MAX / 2, BAND_WIDTH_MAX);
    const narrow = staticLevel(30, 50 - BAND_WIDTH_MIN / 2, BAND_WIDTH_MIN);
    expect(narrow).toBeGreaterThan(wide);
  });
});
