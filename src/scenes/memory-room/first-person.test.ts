import { describe, expect, it } from "vitest";
import {
  clampPitch,
  handleLookKeyDown,
  initialLook,
  LOOK_DRAG_SENSITIVITY,
  LOOK_KEY_STEP,
  lookDirection,
  lookFromDrag,
  PITCH_LIMIT,
  yawToward,
} from "./first-person";
import { ROOM_DOOR_POSITION } from "./layout";

const never = () => false;

describe("1인칭 시선", () => {
  it("오른쪽·아래로 끌면 오른쪽·아래를 본다 (마우스와 같은 방향)", () => {
    const target = { yaw: 0, pitch: 0 };
    lookFromDrag({ yaw: 0, pitch: 0 }, 100, 50, target);
    expect(target.yaw).toBeCloseTo(-100 * LOOK_DRAG_SENSITIVITY);
    expect(target.pitch).toBeCloseTo(-50 * LOOK_DRAG_SENSITIVITY);
  });

  it("고개는 한계 안에서만 꺾인다. 천장·발밑을 끝까지 보면 걷는 방향이 사라진다", () => {
    const target = { yaw: 0, pitch: 0 };
    lookFromDrag({ yaw: 0, pitch: 0 }, 0, -100000, target);
    expect(target.pitch).toBe(PITCH_LIMIT);
    expect(clampPitch(Number.NaN)).toBe(0);
    expect(clampPitch(-9)).toBe(-PITCH_LIMIT);
  });

  it("끌기 값이 깨져도 시선은 제자리다", () => {
    const target = { yaw: 1, pitch: 0.2 };
    lookFromDrag({ yaw: 1, pitch: 0.2 }, Number.NaN, Number.POSITIVE_INFINITY, target);
    expect(target).toEqual({ yaw: 1, pitch: 0.2 });
  });

  it("`,`/`.`로 좌우로 돌고, 버튼 위의 키나 잠긴 동안은 무시한다", () => {
    const applied: { yaw: number; pitch: number }[] = [];
    const apply = (next: { yaw: number; pitch: number }) => applied.push(next);
    const look = { yaw: 0, pitch: 0.3 };

    const left = new KeyboardEvent("keydown", { key: ",", cancelable: true });
    expect(
      handleLookKeyDown(left, { locked: false, look, apply, isInteractiveTarget: never }),
    ).toBe(true);
    expect(left.defaultPrevented).toBe(true);
    expect(applied.at(-1)).toEqual({ yaw: LOOK_KEY_STEP, pitch: 0.3 });

    const right = new KeyboardEvent("keydown", { key: ">" });
    handleLookKeyDown(right, { locked: false, look, apply, isInteractiveTarget: never });
    expect(applied.at(-1)).toEqual({ yaw: -LOOK_KEY_STEP, pitch: 0.3 });

    const other = new KeyboardEvent("keydown", { key: "w" });
    expect(
      handleLookKeyDown(other, { locked: false, look, apply, isInteractiveTarget: never }),
    ).toBe(false);
    const locked = new KeyboardEvent("keydown", { key: "," });
    expect(
      handleLookKeyDown(locked, { locked: true, look, apply, isInteractiveTarget: never }),
    ).toBe(false);
    const onButton = new KeyboardEvent("keydown", { key: "," });
    expect(
      handleLookKeyDown(onButton, { locked: false, look, apply, isInteractiveTarget: () => true }),
    ).toBe(false);
    expect(applied).toHaveLength(2);
  });

  it("yawToward는 카메라 정면(-sin yaw, -cos yaw)이 목표를 향하는 각이다", () => {
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: -5 })).toBeCloseTo(0);
    expect(yawToward({ x: 0, z: 0 }, { x: -5, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: 0 })).toBe(0);
    const yaw = yawToward({ x: 1, z: 2 }, { x: -3, z: 5 });
    const forward = lookDirection({ yaw, pitch: 0 }, { x: 0, y: 0, z: 0 });
    const toTarget = { x: -4, z: 3 };
    const length = Math.hypot(toTarget.x, toTarget.z);
    expect(forward.x).toBeCloseTo(toTarget.x / length);
    expect(forward.z).toBeCloseTo(toTarget.z / length);
  });

  it("인트로는 침대 쪽(+x)을, 문 넘기는 방금 연 문을 보고 시작한다", () => {
    const intro = initialLook("intro", { x: 0, z: 2.35 });
    expect(intro.pitch).toBe(0);
    const forward = lookDirection(intro, { x: 0, y: 0, z: 0 });
    expect(forward.x).toBeCloseTo(1);
    expect(forward.z).toBeCloseTo(0);
    const player = { x: -3, z: 4 };
    const doorway = initialLook("doorway", player);
    expect(doorway.pitch).toBe(0);
    expect(doorway.yaw).toBeCloseTo(
      yawToward(player, { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] }),
    );
  });
});
