import { describe, expect, it } from "vitest";
import {
  LANTERN_BODY_CLEARANCE,
  LANTERN_MAX_INTENSITY,
  LANTERN_REACH,
  LANTERN_THRESHOLD,
  lanternAmount,
  lanternClearOfBody,
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

  it("몸 자리에 세우면 광원이 머리 속에 들므로 카메라 쪽 몸 밖으로 민다 (손가락 기기)", () => {
    const out = { x: 0, z: 0 };
    lanternClearOfBody({ x: 1, z: 2 }, { x: 1, z: 2 }, { x: 1, z: 12 }, out);
    expect(out.x).toBeCloseTo(1);
    expect(out.z).toBeCloseTo(2 + LANTERN_BODY_CLEARANCE);
  });

  it("몸 가까이의 커서 자리는 같은 방향으로 밀고, 충분히 먼 자리는 그대로 둔다", () => {
    const out = { x: 0, z: 0 };
    lanternClearOfBody({ x: 0.2, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 10 }, out);
    expect(out.x).toBeCloseTo(LANTERN_BODY_CLEARANCE);
    expect(out.z).toBeCloseTo(0);
    lanternClearOfBody({ x: 3, z: -1 }, { x: 0, z: 0 }, { x: 0, z: 10 }, out);
    expect(out).toEqual({ x: 3, z: -1 });
  });
});
