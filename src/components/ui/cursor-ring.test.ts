import { describe, expect, it } from "vitest";
import { damp, RING_HOT_SCALE, ringGoal } from "./cursor-ring";

const pointer = { x: 100, y: 200 };

describe("ringGoal", () => {
  it("평소에는 손 위의 원이다", () => {
    expect(ringGoal(pointer, false, null)).toEqual({ x: 100, y: 200, scale: 1 });
  });

  it("버튼 위에서도 손 자리에 남아 조여들 뿐 버튼을 감싸지 않는다", () => {
    expect(ringGoal(pointer, true, null)).toEqual({ x: 100, y: 200, scale: RING_HOT_SCALE });
  });

  it("3D 오브젝트에는 빨려든다: 그 자리로 가며 0으로 줄어든다. 버튼보다 우선한다", () => {
    expect(ringGoal(pointer, true, { x: 50, y: 60 })).toEqual({ x: 50, y: 60, scale: 0 });
  });
});

describe("damp", () => {
  it("목표 쪽으로 다가가고 dt가 0이면 그대로다", () => {
    expect(damp(0, 10, 10, 0)).toBe(0);
    const step = damp(0, 10, 10, 0.1);
    expect(step).toBeGreaterThan(5);
    expect(step).toBeLessThan(10);
    expect(damp(10, 10, 10, 1)).toBe(10);
  });
});
