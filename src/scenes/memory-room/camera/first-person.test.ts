import { describe, expect, it } from "vitest";
import { FRONT_DOOR_INWARD, FRONT_DOOR_POSITION, ROOM_DOOR_POSITION } from "../world/layout";
import {
  clampPitch,
  EXIT_FACING,
  EXIT_LOOK_AT,
  EXIT_WALK,
  exitBodyAt,
  exitCameraAt,
  handleLookKeyDown,
  initialLook,
  LOOK_DRAG_SENSITIVITY,
  LOOK_KEY_STEP,
  lookDirection,
  lookFromDrag,
  PITCH_LIMIT,
  touchLookSensitivity,
  yawToward,
} from "./first-person";

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

  it("손가락은 화면 폭을 두 번 쓸면 한 바퀴 돌고, 좌우에는 한계가 없다", () => {
    const width = 390;
    const target = { yaw: 0, pitch: 0 };
    // 오른쪽에서 왼쪽으로 폭 두 번: 한 바퀴 (폰에서 뒤를 보려고 네 번 쓸던 것)
    lookFromDrag({ yaw: 0, pitch: 0 }, -width * 2, 0, target, touchLookSensitivity(width));
    expect(target.yaw).toBeCloseTo(Math.PI * 2);
    lookFromDrag(target, -width * 4, 0, target, touchLookSensitivity(width));
    expect(target.yaw).toBeCloseTo(Math.PI * 6);
  });

  it("손가락 감도는 좌우에만 붙는다. 위아래는 옆으로 쓰는 손이 조금 기울어도 튀지 않게 그대로다", () => {
    const target = { yaw: 0, pitch: 0 };
    lookFromDrag({ yaw: 0, pitch: 0 }, 0, 40, target, touchLookSensitivity(390));
    expect(target.pitch).toBeCloseTo(-40 * LOOK_DRAG_SENSITIVITY);
    // 아주 넓은 화면에서도 마우스보다 둔해지지 않는다
    expect(touchLookSensitivity(4000)).toBe(LOOK_DRAG_SENSITIVITY);
    expect(touchLookSensitivity(0)).toBe(LOOK_DRAG_SENSITIVITY);
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

describe("엔딩의 문턱 넘기", () => {
  const [inX, inZ] = FRONT_DOOR_INWARD;
  /** 문 면에서 안쪽(FRONT_DOOR_INWARD)으로 잰 거리와, 문 축에서 비켜 선 폭. */
  const along = (p: { x: number; z: number }) =>
    (p.x - FRONT_DOOR_POSITION[0]) * inX + (p.z - FRONT_DOOR_POSITION[2]) * inZ;
  const across = (p: { x: number; z: number }) =>
    (p.x - FRONT_DOOR_POSITION[0]) * inZ - (p.z - FRONT_DOOR_POSITION[2]) * inX;
  const body = (elapsed: number) => exitBodyAt(elapsed, { x: 0, z: 0 });
  const cameraFor = (elapsed: number, following = true) =>
    exitCameraAt(body(elapsed), following, { x: 0, y: 0, z: 0 });
  const end = EXIT_WALK.holdS + EXIT_WALK.walkS;

  it("몸은 현관문 정면 안쪽에 서서, 문이 열리는 동안은 움직이지 않는다", () => {
    expect(across(body(0))).toBeCloseTo(0);
    expect(along(body(0))).toBeCloseTo(EXIT_WALK.bodyStart);
    expect(along(body(EXIT_WALK.holdS * 0.9))).toBeCloseTo(along(body(0)));
  });

  it("몸은 문을 지나 빛 판(문 밖 0.32) 너머로 사라지고, 걸음은 뒤로 물러서지 않는다", () => {
    expect(along(body(end))).toBeCloseTo(EXIT_WALK.bodyEnd);
    expect(along(body(end))).toBeLessThan(-0.32);
    let previous = along(body(0));
    for (let t = 0; t <= end; t += 0.05) {
      const distance = along(body(t));
      expect(distance).toBeLessThanOrEqual(previous + 1e-9);
      previous = distance;
    }
  });

  it("몸은 문 밖을 보고 걷는다", () => {
    const step = { x: -inX, z: -inZ };
    expect(EXIT_FACING).toBeCloseTo(Math.atan2(step.x, step.z));
  });

  it("카메라는 몸 뒤에서 문 쪽을 보고, 문턱 앞에서 멈춰 뒷모습을 보낸다", () => {
    const start = cameraFor(0);
    expect(along(start)).toBeGreaterThan(along(body(0)));
    expect(along(EXIT_LOOK_AT)).toBeLessThan(0);
    const stopped = cameraFor(end);
    expect(along(stopped)).toBeCloseTo(EXIT_WALK.cameraStop);
    // 문틀(개구부 반폭 0.82) 안쪽 폭에 선다
    expect(Math.abs(across(stopped))).toBeLessThan(0.82);
  });

  it("모션 줄이기에서는 카메라가 출발 자리에 선 채로 본다", () => {
    const still = cameraFor(end, false);
    expect(still.x).toBeCloseTo(cameraFor(0).x);
    expect(still.z).toBeCloseTo(cameraFor(0).z);
  });
});
