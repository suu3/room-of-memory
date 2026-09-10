import { describe, expect, it } from "vitest";
import {
  BAND_WIDTH_MAX,
  BAND_WIDTH_MIN,
  bandBonusFor,
  bandWidthAt,
  DIAL_TUNINGS,
  GOAL_HITS,
  goalHitsFor,
  MAX_MISSES,
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
    // 좁아진 대역은 같은 자리에서도 더 멀다. 소리만으로도 난이도가 올라간다.
    const wide = staticLevel(30, 50 - BAND_WIDTH_MAX / 2, BAND_WIDTH_MAX);
    const narrow = staticLevel(30, 50 - BAND_WIDTH_MIN / 2, BAND_WIDTH_MIN);
    expect(narrow).toBeGreaterThan(wide);
  });
});

describe("난이도별 다이얼", () => {
  it("이지는 보통보다 넓고 느리다. 유효 입력창이 400ms 안팎이어야 보고 누를 수 있다", () => {
    expect(bandWidthAt(0, 0, "easy")).toBeGreaterThan(bandWidthAt(0, 0, "normal"));
    expect(needlePeriodAt(0, "easy")).toBeGreaterThan(needlePeriodAt(0, "normal"));
    // 이지: 4MHz(20%) 대역, 보통의 60% 속도(주기 1/0.6배)
    expect(bandWidthAt(0, 0, "easy")).toBe(20);
    expect(needlePeriodAt(0, "easy")).toBeCloseTo(needlePeriodAt(0, "normal") / 0.6, -2);
    // 보통: 3MHz(15%) 대역, 예전 속도 그대로
    expect(bandWidthAt(0, 0, "normal")).toBe(15);
    expect(needlePeriodAt(0, "normal")).toBe(4200);
  });

  it("보통도 마지막 판까지 눈으로 조준할 수 있는 폭을 남긴다", () => {
    for (let hits = 0; hits < GOAL_HITS; hits += 1) {
      expect(bandWidthAt(hits, 0, "normal")).toBeGreaterThanOrEqual(DIAL_TUNINGS.normal.bandMin);
    }
  });

  it("실패 허용치는 배우는 값을 치를 만큼 넉넉하다", () => {
    expect(MAX_MISSES).toBeGreaterThanOrEqual(8);
  });
});

describe("2바퀴의 다이얼", () => {
  it("판 수가 줄어든다. 저쪽에서 이미 부르고 있으니까", () => {
    expect(goalHitsFor(2)).toBeLessThan(goalHitsFor(1));
    expect(goalHitsFor(1)).toBe(GOAL_HITS);
  });

  it("대역이 한 뼘 넓어진다", () => {
    expect(bandWidthAt(0, bandBonusFor(2))).toBeGreaterThan(bandWidthAt(0, bandBonusFor(1)));
  });

  it("마지막 판까지도 눈으로 조준할 수 있는 폭을 유지한다", () => {
    for (let hits = 0; hits < goalHitsFor(2); hits += 1) {
      expect(bandWidthAt(hits, bandBonusFor(2))).toBeGreaterThanOrEqual(BAND_WIDTH_MIN);
    }
  });

  it("1바퀴 폭은 예전 그대로다. 보정 없이 부르면 값이 안 바뀐다", () => {
    expect(bandWidthAt(0)).toBe(BAND_WIDTH_MAX);
  });
});
