import { describe, expect, it } from "vitest";
import { dotsAcrossHeight, dotsForLevel, TV_DOT_ASPECT, TV_DOTS } from "./tv-dots";

describe("tv-dots", () => {
  it("가장 어두울 때 굵고(22) 다 되찾았을 때 촘촘하다(88)", () => {
    expect(dotsForLevel(0)).toBe(TV_DOTS.coarse);
    expect(dotsForLevel(1)).toBe(TV_DOTS.fine);
    expect(TV_DOTS.coarse).toBe(22);
    expect(TV_DOTS.fine).toBe(88);
  });

  it("범위 밖은 끝값에 붙고 NaN은 가장 어두운 쪽이다", () => {
    expect(dotsForLevel(-2)).toBe(TV_DOTS.coarse);
    expect(dotsForLevel(3)).toBe(TV_DOTS.fine);
    expect(dotsForLevel(Number.NaN)).toBe(TV_DOTS.coarse);
  });

  it("밝아질수록 도트가 늘기만 한다 (단조증가)", () => {
    let previous = dotsForLevel(0);
    for (let step = 1; step <= 20; step += 1) {
      const next = dotsForLevel(step / 20);
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it("중간 밝기는 두 끝의 중간이다 (선형)", () => {
    expect(dotsForLevel(0.5)).toBeCloseTo((TV_DOTS.coarse + TV_DOTS.fine) / 2);
  });

  it("세로 도트 수는 판의 비(1.04/1.86)를 곱한 값이라 도트가 정사각이다", () => {
    expect(TV_DOT_ASPECT).toBeCloseTo(1.04 / 1.86);
    expect(TV_DOT_ASPECT).toBeLessThan(1);
    expect(dotsAcrossHeight(TV_DOTS.fine)).toBeCloseTo(TV_DOTS.fine * TV_DOT_ASPECT);
    // 세로 도트도 가로를 따라 단조증가다
    expect(dotsAcrossHeight(dotsForLevel(1))).toBeGreaterThan(dotsAcrossHeight(dotsForLevel(0)));
  });
});
