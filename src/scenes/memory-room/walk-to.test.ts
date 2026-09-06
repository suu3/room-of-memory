import { describe, expect, it } from "vitest";
import { isWalkBlocked, stepToward, WALK_ARRIVE_DISTANCE } from "./walk-to";

describe("walk-to", () => {
  it("steps straight toward the target without overshooting it", () => {
    const out = { x: 0, z: 0 };
    // 멀면 한 프레임 이동량만큼만
    expect(stepToward({ x: 0, z: 0 }, { x: 3, z: 4 }, 0.1, out)).toBeCloseTo(0.1);
    expect(out.x).toBeCloseTo(0.06);
    expect(out.z).toBeCloseTo(0.08);
    // 가까우면 남은 거리만큼만 — 지나쳐서 되돌아오지 않는다
    expect(stepToward({ x: 0, z: 0 }, { x: 0.2, z: 0 }, 1, out)).toBeCloseTo(0.2);
    expect(out).toEqual({ x: 0.2, z: 0 });
  });

  it("reports arrival inside the arrive radius and leaves the delta alone", () => {
    const out = { x: 9, z: 9 };
    const near = WALK_ARRIVE_DISTANCE * 0.5;
    expect(stepToward({ x: 1, z: 1 }, { x: 1 + near, z: 1 }, 1, out)).toBe(0);
    expect(out).toEqual({ x: 9, z: 9 });
  });

  it("treats a step that barely moved as blocked, but not a slide along a wall", () => {
    expect(isWalkBlocked(0.1, 0)).toBe(true);
    expect(isWalkBlocked(0.1, 0.001)).toBe(true);
    // 벽을 따라 비스듬히 미끄러지면 상당히 간다 — 막힌 게 아니다
    expect(isWalkBlocked(0.1, 0.05)).toBe(false);
    expect(isWalkBlocked(0, 0)).toBe(false);
  });
});
