import { describe, expect, it } from "vitest";
import { DOT_SCREEN_ASPECT, DOT_SCREEN_DOTS, dotsAcrossHeight, dotsForLevel } from "./dot-screen";

describe("tv-dots", () => {
  it("가장 어두울 때 굵고(22) 다 되찾았을 때 촘촘하다(88)", () => {
    expect(dotsForLevel(0)).toBe(DOT_SCREEN_DOTS.coarse);
    expect(dotsForLevel(1)).toBe(DOT_SCREEN_DOTS.fine);
    expect(DOT_SCREEN_DOTS.coarse).toBe(22);
    expect(DOT_SCREEN_DOTS.fine).toBe(88);
  });

  it("범위 밖은 끝값에 붙고 NaN은 가장 어두운 쪽이다", () => {
    expect(dotsForLevel(-2)).toBe(DOT_SCREEN_DOTS.coarse);
    expect(dotsForLevel(3)).toBe(DOT_SCREEN_DOTS.fine);
    expect(dotsForLevel(Number.NaN)).toBe(DOT_SCREEN_DOTS.coarse);
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
    expect(dotsForLevel(0.5)).toBeCloseTo((DOT_SCREEN_DOTS.coarse + DOT_SCREEN_DOTS.fine) / 2);
  });

  it("세로 도트 수는 판의 비(0.59/1.125)를 곱한 값이라 도트가 정사각이다", () => {
    expect(DOT_SCREEN_ASPECT).toBeCloseTo(0.59 / 1.125);
    expect(DOT_SCREEN_ASPECT).toBeLessThan(1);
    expect(dotsAcrossHeight(DOT_SCREEN_DOTS.fine)).toBeCloseTo(
      DOT_SCREEN_DOTS.fine * DOT_SCREEN_ASPECT,
    );
    // 세로 도트도 가로를 따라 단조증가다
    expect(dotsAcrossHeight(dotsForLevel(1))).toBeGreaterThan(dotsAcrossHeight(dotsForLevel(0)));
  });
});
