import { describe, expect, it } from "vitest";
import {
  advanceSitPhases,
  advanceSitProgress,
  LIE_PERCH_SHARE,
  type LiePhases,
  lerpAngle,
  liePhasesOf,
  SIT_SECONDS,
  type SitPhases,
  sitEase,
} from "./sit-motion";

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
    // 시작과 끝이 무르다. 절반 지점까지 절반보다 덜 간다.
    expect(sitEase(0.25)).toBeLessThan(0.25);
    expect(sitEase(0.75)).toBeGreaterThan(0.75);
  });

  it("walks first and sits second, then unwinds in the other order", () => {
    const phases: SitPhases = { travel: 0, sit: 0 };
    const travelSeconds = 0.5;
    const step = 1 / 60;

    // 걷는 동안에는 앉지 않는다. 걸으면서 접히면 미끄러져 들어가는 것과 같아진다.
    for (let elapsed = 0; elapsed < travelSeconds - step; elapsed += step) {
      advanceSitPhases(phases, true, step, travelSeconds, phases);
      expect(phases.sit).toBe(0);
      expect(phases.travel).toBeLessThanOrEqual(1);
    }
    for (let elapsed = 0; elapsed <= travelSeconds + SIT_SECONDS; elapsed += step) {
      advanceSitPhases(phases, true, step, travelSeconds, phases);
    }
    expect(phases).toEqual({ travel: 1, sit: 1 });

    // 일어설 때는 순서가 뒤집힌다. 다 일어선 뒤에야 걸어 돌아온다.
    advanceSitPhases(phases, false, step, travelSeconds, phases);
    expect(phases.travel).toBe(1);
    expect(phases.sit).toBeLessThan(1);
    for (let elapsed = 0; elapsed <= travelSeconds + SIT_SECONDS + step; elapsed += step) {
      advanceSitPhases(phases, false, step, travelSeconds, phases);
    }
    expect(phases).toEqual({ travel: 0, sit: 0 });
  });

  it("skips the walk when the seat is already underfoot", () => {
    const phases: SitPhases = { travel: 0, sit: 0 };
    advanceSitPhases(phases, true, 1 / 60, 0, phases);
    expect(phases.travel).toBe(1);
    expect(phases.sit).toBeGreaterThan(0);
  });

  it("perches on the edge first and only then reclines, unwinding in the other order", () => {
    const out: LiePhases = { perch: 0, recline: 0 };
    expect(liePhasesOf(0, out)).toEqual({ perch: 0, recline: 0 });
    // 걸터앉는 동안에는 젖히지 않는다. 서서 넘어가는 그림이 돌아온다.
    liePhasesOf(LIE_PERCH_SHARE / 2, out);
    expect(out.perch).toBeCloseTo(0.5, 5);
    expect(out.recline).toBe(0);
    expect(liePhasesOf(LIE_PERCH_SHARE, out)).toEqual({ perch: 1, recline: 0 });
    // 다 앉은 뒤에야 젖힌다. 젖히는 동안 걸터앉은 자세는 그대로다.
    liePhasesOf((1 + LIE_PERCH_SHARE) / 2, out);
    expect(out.perch).toBe(1);
    expect(out.recline).toBeCloseTo(0.5, 5);
    expect(liePhasesOf(1, out)).toEqual({ perch: 1, recline: 1 });
    // 진행도가 범위를 벗어나도 양 끝에 머문다.
    expect(liePhasesOf(1.5, out)).toEqual({ perch: 1, recline: 1 });
    expect(liePhasesOf(-1, out)).toEqual({ perch: 0, recline: 0 });
  });

  it("turns the shorter way across the -π/π seam", () => {
    // -3.0에서 3.0으로 가는 짧은 길은 6rad를 도는 쪽이 아니라 π를 스치는 0.28rad 쪽이다.
    expect(lerpAngle(-3.0, 3.0, 0.5)).toBeCloseTo(-Math.PI, 5);
    expect(lerpAngle(-3.0, 3.0, 1)).toBeCloseTo(3.0 - Math.PI * 2, 5);
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 5);
  });
});
