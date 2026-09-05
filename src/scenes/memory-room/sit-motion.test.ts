import { describe, expect, it } from "vitest";
import { advanceSitProgress, lerpAngle, SIT_SECONDS, sitEase } from "./sit-motion";

describe("sit motion", () => {
  it("runs the progress to both ends in the transition time and stops there", () => {
    let progress = 0;
    for (let elapsed = 0; elapsed <= SIT_SECONDS; elapsed += 1 / 60) {
      progress = advanceSitProgress(progress, true, 1 / 60);
      expect(progress).toBeLessThanOrEqual(1);
    }
    expect(progress).toBe(1);
    expect(advanceSitProgress(progress, true, 1)).toBe(1);

    for (let elapsed = 0; elapsed <= SIT_SECONDS; elapsed += 1 / 60) {
      progress = advanceSitProgress(progress, false, 1 / 60);
      expect(progress).toBeGreaterThanOrEqual(0);
    }
    expect(progress).toBe(0);
    expect(advanceSitProgress(progress, false, 1)).toBe(0);
  });

  it("ignores negative frame deltas", () => {
    expect(advanceSitProgress(0.5, true, -1)).toBe(0.5);
  });

  it("eases without overshooting", () => {
    expect(sitEase(0)).toBe(0);
    expect(sitEase(1)).toBe(1);
    expect(sitEase(0.5)).toBeCloseTo(0.5, 5);
    // 시작과 끝이 무르다 — 절반 지점까지 절반보다 덜 간다.
    expect(sitEase(0.25)).toBeLessThan(0.25);
    expect(sitEase(0.75)).toBeGreaterThan(0.75);
  });

  it("turns the shorter way across the -π/π seam", () => {
    // -3.0에서 3.0으로 가는 짧은 길은 6rad를 도는 쪽이 아니라 π를 스치는 0.28rad 쪽이다.
    expect(lerpAngle(-3.0, 3.0, 0.5)).toBeCloseTo(-Math.PI, 5);
    expect(lerpAngle(-3.0, 3.0, 1)).toBeCloseTo(3.0 - Math.PI * 2, 5);
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 5);
  });
});
