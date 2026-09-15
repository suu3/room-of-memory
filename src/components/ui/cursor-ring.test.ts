import { describe, expect, it } from "vitest";
import { damp, RING_PADDING, RING_SIZE, ringGoal } from "./cursor-ring";

const pointer = { x: 100, y: 200 };
const button = { left: 300, top: 400, width: 120, height: 40, radius: 6 };

describe("ringGoal", () => {
  it("평소에는 손 위의 원이다", () => {
    expect(ringGoal(pointer, null, null)).toEqual({
      x: 100,
      y: 200,
      width: RING_SIZE,
      height: RING_SIZE,
      radius: RING_SIZE / 2,
      scale: 1,
    });
  });

  it("버튼에 붙으면 버튼을 여백만큼 감싸는 알약이 되고 라운드를 이어받는다", () => {
    expect(ringGoal(pointer, button, null)).toEqual({
      x: 360,
      y: 420,
      width: 120 + RING_PADDING * 2,
      height: 40 + RING_PADDING * 2,
      radius: 6 + RING_PADDING,
      scale: 1,
    });
  });

  it("3D 오브젝트에는 빨려든다: 그 자리로 가며 0으로 줄어든다. 버튼보다 우선한다", () => {
    const goal = ringGoal(pointer, button, { x: 50, y: 60 });
    expect(goal.x).toBe(50);
    expect(goal.y).toBe(60);
    expect(goal.scale).toBe(0);
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
