import { describe, expect, it } from "vitest";
import { CRACK_MAX_RAYS, CRACK_ONSET, crackCount, crackSegments } from "./window-cracks";

describe("window-cracks", () => {
  it("평범한 저녁에는 금이 없고, 다 무너지면 최대 개수다", () => {
    expect(crackCount(0)).toBe(0);
    expect(crackCount(CRACK_ONSET - 0.01)).toBe(0);
    expect(crackCount(1)).toBe(CRACK_MAX_RAYS);
    expect(crackSegments(0)).toEqual([]);
  });

  it("붕괴도가 오를수록 금이 늘고 길어진다 (되돌아가지 않는 축)", () => {
    let previousCount = 0;
    let previousReach = 0;
    for (let decay = 0; decay <= 1.0001; decay += 1 / 7) {
      const count = crackCount(decay);
      expect(count).toBeGreaterThanOrEqual(previousCount);
      previousCount = count;
      const reach = crackSegments(decay).reduce(
        (max, segment) => Math.max(max, Math.hypot(segment.to[0] - 0.62, segment.to[1] - 0.36)),
        0,
      );
      expect(reach).toBeGreaterThanOrEqual(previousReach);
      previousReach = reach;
    }
  });

  it("같은 붕괴도면 같은 금이다 (해시, 난수 아님)", () => {
    expect(crackSegments(0.5)).toEqual(crackSegments(0.5));
  });

  it("충격점 가까운 마디가 굵다", () => {
    const segments = crackSegments(1);
    expect(segments[0].weight).toBeGreaterThan(segments[2].weight);
  });
});
