import { describe, expect, it } from "vitest";
import {
  AMPOULE_RAISED,
  AMPOULE_REST,
  DRAWER_OPEN_DURATION,
  DRAWER_TRAVEL,
  drawerOffset,
  drawerOpen,
  HELD_SCALE,
  HOLD_BOB_AMPLITUDE,
  LIFT_DURATION,
  liftPose,
  RAISED_SPIN,
  RAISED_TILT,
} from "./motion";

describe("서랍이 밀려 나온다", () => {
  it("닫힌 데서 출발해 정해진 거리까지만 나오고 멎는다", () => {
    expect(drawerOffset(0)).toBe(0);
    expect(drawerOffset(DRAWER_OPEN_DURATION)).toBeCloseTo(DRAWER_TRAVEL);
    // 더 기다려도 몸통에서 빠지지 않는다
    expect(drawerOffset(DRAWER_OPEN_DURATION * 3)).toBeCloseTo(DRAWER_TRAVEL);
  });

  it("도중에 되돌아가지 않는다", () => {
    let previous = -1;
    for (let t = 0; t <= DRAWER_OPEN_DURATION; t += 0.05) {
      const offset = drawerOffset(t);
      expect(offset).toBeGreaterThanOrEqual(previous);
      previous = offset;
    }
  });

  it("다 나와야 집을 수 있다", () => {
    expect(drawerOpen(DRAWER_OPEN_DURATION * 0.9)).toBe(false);
    expect(drawerOpen(DRAWER_OPEN_DURATION)).toBe(true);
  });
});

describe("앰플이 손 높이로 오른다", () => {
  it("열린 서랍 안의 자리에서 누운 채로 출발한다", () => {
    const pose = liftPose(0, 0);
    expect(pose.position[0]).toBeCloseTo(AMPOULE_REST.position[0]);
    expect(pose.position[1]).toBeCloseTo(AMPOULE_REST.position[1]);
    // 서랍이 열린 만큼 앞으로 나와 있는 자리다. 닫힌 자리에서 출발하면 몸통을 뚫고 나온다
    expect(pose.position[2]).toBeCloseTo(AMPOULE_REST.position[2] + DRAWER_TRAVEL);
    expect(pose.rotation[2]).toBeCloseTo(AMPOULE_REST.rotation[2]);
    expect(pose.scale).toBe(1);
  });

  it("다 오르면 들고 있는 자리에 똑바로 선다", () => {
    const pose = liftPose(LIFT_DURATION, 0);
    expect(pose.position[0]).toBeCloseTo(AMPOULE_RAISED[0]);
    expect(pose.position[1]).toBeCloseTo(AMPOULE_RAISED[1]);
    expect(pose.position[2]).toBeCloseTo(AMPOULE_RAISED[2]);
    expect(pose.rotation[0]).toBeCloseTo(RAISED_TILT);
    // 누웠던 몸(z축 90°)이 다 세워진다
    expect(pose.rotation[2]).toBeCloseTo(0);
    // 직교 카메라라 가까이 든 만큼을 배율로 대신한다
    expect(pose.scale).toBeCloseTo(HELD_SCALE);
  });

  it("들고 있는 동안은 천천히 돌고 숨 쉬듯 오르내린다", () => {
    const a = liftPose(LIFT_DURATION, 1);
    const b = liftPose(LIFT_DURATION, 2);
    expect(b.rotation[1] - a.rotation[1]).toBeCloseTo(RAISED_SPIN);
    for (let time = 0; time < 6; time += 0.25) {
      const bob = liftPose(LIFT_DURATION, time).position[1] - AMPOULE_RAISED[1];
      expect(Math.abs(bob)).toBeLessThanOrEqual(HOLD_BOB_AMPLITUDE + 1e-9);
    }
  });

  it("오르는 동안에는 시계와 무관하다. 손이 올리는 중이라 돌지 않는다", () => {
    const halfway = LIFT_DURATION * 0.5;
    expect(liftPose(halfway, 100).rotation[1]).toBe(liftPose(halfway, 0).rotation[1]);
    expect(liftPose(halfway, 100).position[1]).toBe(liftPose(halfway, 0).position[1]);
  });
});
