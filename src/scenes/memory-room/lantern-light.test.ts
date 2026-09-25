import { describe, expect, it } from "vitest";
import {
  LANTERN_MAX_INTENSITY,
  LANTERN_REACH,
  LANTERN_THRESHOLD,
  lanternAmount,
  lanternIntensity,
  lanternReach,
} from "./lantern-light";

describe("lantern", () => {
  it("문턱 위에서는 꺼져 있다: 진입 밝기와 문턱 자체에서 0", () => {
    expect(lanternAmount(0.62)).toBe(0);
    expect(lanternAmount(LANTERN_THRESHOLD)).toBe(0);
    expect(lanternIntensity(1)).toBe(0);
  });

  it("바닥에서 최대이고, 그 사이는 단조 증가한다", () => {
    expect(lanternAmount(0)).toBe(1);
    expect(lanternIntensity(0)).toBe(LANTERN_MAX_INTENSITY);
    let previous = lanternAmount(LANTERN_THRESHOLD);
    for (let level = LANTERN_THRESHOLD; level >= 0; level -= 0.05) {
      const amount = lanternAmount(level);
      expect(amount).toBeGreaterThanOrEqual(previous);
      previous = amount;
    }
  });

  it("어두울수록 닿는 거리가 좁아진다", () => {
    expect(lanternReach(LANTERN_THRESHOLD)).toBeCloseTo(LANTERN_REACH[1]);
    expect(lanternReach(0)).toBeCloseTo(LANTERN_REACH[0]);
    expect(lanternReach(0.1)).toBeLessThan(lanternReach(0.3));
  });

  it("범위 밖 입력은 끝값에 붙는다", () => {
    expect(lanternAmount(-1)).toBe(1);
    expect(lanternAmount(Number.NaN)).toBe(1);
    expect(lanternAmount(5)).toBe(0);
  });
});
