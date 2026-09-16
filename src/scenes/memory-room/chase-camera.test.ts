import { describe, expect, it } from "vitest";
import {
  CAMERA_DISTANCE,
  CAMERA_MIN_DISTANCE,
  CAMERA_WALL_MARGIN,
  cameraBounds,
  cameraDistanceWithin,
  clampPitch,
  handleLookKeyDown,
  INITIAL_PITCH,
  initialLook,
  LOOK_DRAG_SENSITIVITY,
  LOOK_KEY_STEP,
  lookDirection,
  lookFromDrag,
  PITCH_LIMIT,
  yawToward,
} from "./chase-camera";
import { LIVING_SHELL_BOUNDS, ROOM_DOOR_POSITION, ROOM_SHELL_BOUNDS } from "./layout";

const never = () => false;

describe("등 뒤 시점의 시선", () => {
  it("오른쪽·아래로 끌면 오른쪽·아래를 본다 (마우스와 같은 방향)", () => {
    const target = { yaw: 0, pitch: 0 };
    lookFromDrag({ yaw: 0, pitch: 0 }, 100, 50, target);
    expect(target.yaw).toBeCloseTo(-100 * LOOK_DRAG_SENSITIVITY);
    expect(target.pitch).toBeCloseTo(-50 * LOOK_DRAG_SENSITIVITY);
  });

  it("고개는 한계 안에서만 꺾이고, 아래가 위보다 깊다 (내려다보는 게임이다)", () => {
    const target = { yaw: 0, pitch: 0 };
    lookFromDrag({ yaw: 0, pitch: 0 }, 0, -100000, target);
    expect(target.pitch).toBe(PITCH_LIMIT.up);
    expect(clampPitch(Number.NaN)).toBe(0);
    expect(clampPitch(-9)).toBe(PITCH_LIMIT.down);
    expect(-PITCH_LIMIT.down).toBeGreaterThan(PITCH_LIMIT.up);
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

  it("인트로는 캐릭터 등 뒤에서 캐릭터가 보는 쪽(+z)을, 문 넘기는 방금 연 문을 본다", () => {
    const intro = initialLook("intro", { x: 0, z: 2.35 });
    expect(intro.pitch).toBe(INITIAL_PITCH);
    const forward = lookDirection({ yaw: intro.yaw, pitch: 0 }, { x: 0, y: 0, z: 0 });
    expect(forward.z).toBeCloseTo(1);
    const player = { x: -3, z: 4 };
    const doorway = initialLook("doorway", player);
    expect(doorway.yaw).toBeCloseTo(
      yawToward(player, { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] }),
    );
  });
});

describe("등 뒤 카메라가 벽을 뚫지 않는 거리", () => {
  const bounds = cameraBounds("intro");

  it("카메라 범위는 방 안쪽 면에서 여유만큼 들어와 있고, 문이 열리면 거실까지 이어진다", () => {
    expect(bounds.minX).toBeCloseTo(ROOM_SHELL_BOUNDS.minX + CAMERA_WALL_MARGIN);
    expect(bounds.maxZ).toBeCloseTo(ROOM_SHELL_BOUNDS.maxZ - CAMERA_WALL_MARGIN);
    const open = cameraBounds("doorway");
    expect(open.minX).toBeCloseTo(LIVING_SHELL_BOUNDS.minX + CAMERA_WALL_MARGIN);
    expect(open.maxX).toBeCloseTo(ROOM_SHELL_BOUNDS.maxX - CAMERA_WALL_MARGIN);
  });

  it("방 한가운데서는 원하는 거리 그대로다", () => {
    const pivot = { x: 1, z: 1 };
    expect(cameraDistanceWithin(pivot, { x: 0, z: -1 }, CAMERA_DISTANCE, bounds)).toBe(
      CAMERA_DISTANCE,
    );
  });

  it("벽을 등지고 서면 벽에 닿는 거리까지만 물러난다", () => {
    // 뒷벽(minZ) 앞에서 앞(+z)을 본다: 카메라는 -z로 물러나다 벽에 막힌다
    const pivot = { x: 1, z: bounds.minZ + 1 };
    const distance = cameraDistanceWithin(pivot, { x: 0, z: 1 }, CAMERA_DISTANCE, bounds);
    expect(distance).toBeCloseTo(1);
    // 비스듬해도 닿는 축이 정한다
    const diagonal = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
    const slanted = cameraDistanceWithin(pivot, diagonal, CAMERA_DISTANCE, bounds);
    expect(slanted).toBeCloseTo(1 / Math.SQRT1_2);
  });

  it("벽에 바짝 붙어도 최소 거리는 남긴다. 그보다 가까우면 몸통 속이다", () => {
    const pivot = { x: 1, z: bounds.minZ + 0.1 };
    expect(cameraDistanceWithin(pivot, { x: 0, z: 1 }, CAMERA_DISTANCE, bounds)).toBe(
      CAMERA_MIN_DISTANCE,
    );
  });
});
