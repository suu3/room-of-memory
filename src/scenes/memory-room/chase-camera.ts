import { MathUtils } from "three";
import { LIVING_SHELL_BOUNDS, ROOM_DOOR_POSITION, ROOM_SHELL_BOUNDS } from "./layout";
import type { Aabb2 } from "./types";

/**
 * 등 뒤 시점(인트로·2막 도입)의 순수 계산: 시선 각도, 끌기·키 입력, 처음 바라보는
 * 방향, 카메라가 벽을 뚫지 않게 당기는 거리.
 *
 * 카메라(ChaseCameraRig)와 DOM 입력(use-chase-look)이 같은 수를 봐야 해서 여기 모은다.
 * three 객체를 만들지 않으므로 테스트가 가볍다.
 */

export interface LookAngles {
  /** 좌우(rad). 0이면 -z(창 쪽)를 보고, 커질수록 왼쪽으로 돈다 (three의 rotation.y). */
  yaw: number;
  /** 상하(rad). 0이 수평, 양수가 위. */
  pitch: number;
}

/** 카메라가 도는 축: 캐릭터의 가슴께. 발밑을 축으로 돌면 고개를 끄덕일 때 몸이 화면 밖으로 나간다. */
export const PIVOT_HEIGHT = 1.25;
/** 축에서 카메라까지의 거리. 캐릭터(키 1.55)가 화면 아래 절반을 차지하는 거리다. */
export const CAMERA_DISTANCE = 2.7;
/** 축에서 카메라까지 이만큼은 늘 남긴다. 벽에 몰려 이보다 가까워지면 몸통 속이다. */
export const CAMERA_MIN_DISTANCE = 0.9;
/** 카메라가 벽 안쪽 면에서 물러서는 여유. 근평면(0.05)보다 넉넉히. */
export const CAMERA_WALL_MARGIN = 0.35;
/** 세로 화각. 좁은 방이라 넓게 잡되, 75 넘게 벌리면 벽 모서리가 휘어 보인다. */
export const CHASE_FOV = 62;
/** 고개를 위아래로 꺾는 한계 (rad). 아래(-)는 더 깊이: 위에서 내려다보는 구도가 이 게임의 구도다. */
export const PITCH_LIMIT = { down: -0.95, up: 0.45 } as const;
/** 처음의 고개 각도. 살짝 내려다본다: 등 뒤에서 방바닥이 보여야 걷는 방향이 읽힌다. */
export const INITIAL_PITCH = -0.16;
/** 끌기 감도 (rad/px). 방 한 바퀴(2π)가 화면 폭 두 번쯤. */
export const LOOK_DRAG_SENSITIVITY = 0.0042;
/** 키 한 번에 도는 각도. `,`/`.`로 돈다 (아이소메트릭 회전과 같은 키). */
export const LOOK_KEY_STEP = 0.16;

export function clampPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return 0;
  return MathUtils.clamp(pitch, PITCH_LIMIT.down, PITCH_LIMIT.up);
}

/**
 * 끌기 시작점에서 (dx, dy)픽셀 끈 시선. 마우스 조작과 같은 방향이다: 오른쪽으로
 * 끌면 오른쪽을 보고, 아래로 끌면 아래를 본다. 결과는 `target`에 써서 돌려준다.
 */
export function lookFromDrag(
  start: LookAngles,
  dx: number,
  dy: number,
  target: LookAngles,
): LookAngles {
  const safeDx = Number.isFinite(dx) ? dx : 0;
  const safeDy = Number.isFinite(dy) ? dy : 0;
  target.yaw = start.yaw - safeDx * LOOK_DRAG_SENSITIVITY;
  target.pitch = clampPitch(start.pitch - safeDy * LOOK_DRAG_SENSITIVITY);
  return target;
}

interface LookKeyOptions {
  locked: boolean;
  look: LookAngles;
  apply: (next: LookAngles) => void;
  /** 버튼·입력칸 위의 키는 건드리지 않는다 (room-canvas-runtime의 isInteractiveTarget). */
  isInteractiveTarget: (target: EventTarget | null) => boolean;
}

/** `,`/`.`로 좌우로 돈다. 위아래는 끌기·마우스 몫이다. */
export function handleLookKeyDown(
  event: KeyboardEvent,
  { locked, look, apply, isInteractiveTarget }: LookKeyOptions,
): boolean {
  if (locked || isInteractiveTarget(event.target)) return false;

  let yaw: number | null = null;
  if (event.key === "," || event.key === "<") yaw = look.yaw + LOOK_KEY_STEP;
  else if (event.key === "." || event.key === ">") yaw = look.yaw - LOOK_KEY_STEP;
  if (yaw === null) return false;

  apply({ yaw, pitch: look.pitch });
  event.preventDefault();
  return true;
}

/** (x, z)에 서서 (toX, toZ)를 정면으로 보는 yaw. 카메라 정면은 (-sin yaw, 0, -cos yaw)다. */
export function yawToward(from: { x: number; z: number }, to: { x: number; z: number }): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx === 0 && dz === 0) return 0;
  return Math.atan2(-dx, -dz);
}

/**
 * 구간에 들어서는 순간 바라보는 방향.
 *
 * 인트로는 캐릭터의 등 뒤에서 캐릭터가 보는 쪽(+z, 시작 자세)을 본다. 스위치는 오른쪽
 * 뒤라 돌아서야 나온다: 찾는 게 일이니까. 문 넘기는 방금 연 문을 본다. 문을 열었는데
 * 등지고 있으면 어디로 가라는지 모른다.
 */
export function initialLook(
  viewpoint: "intro" | "doorway",
  player: { x: number; z: number },
): LookAngles {
  if (viewpoint === "intro") return { yaw: Math.PI, pitch: INITIAL_PITCH };
  return {
    yaw: yawToward(player, { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] }),
    pitch: INITIAL_PITCH,
  };
}

/** 시선(yaw·pitch)이 향하는 단위 방향. `target`에 써서 돌려준다. */
export function lookDirection(
  look: LookAngles,
  target: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const flat = Math.cos(look.pitch);
  target.x = -Math.sin(look.yaw) * flat;
  target.y = Math.sin(look.pitch);
  target.z = -Math.cos(look.yaw) * flat;
  return target;
}

/** 카메라가 머물 수 있는 바닥 범위. 문이 열린 뒤에는 거실까지 이어진다. */
export function cameraBounds(viewpoint: "intro" | "doorway"): Aabb2 {
  const room = ROOM_SHELL_BOUNDS;
  if (viewpoint === "intro") return inset(room, CAMERA_WALL_MARGIN);
  return inset(
    {
      minX: LIVING_SHELL_BOUNDS.minX,
      maxX: room.maxX,
      minZ: Math.min(room.minZ, LIVING_SHELL_BOUNDS.minZ),
      maxZ: Math.max(room.maxZ, LIVING_SHELL_BOUNDS.maxZ),
    },
    CAMERA_WALL_MARGIN,
  );
}

function inset(box: Aabb2, margin: number): Aabb2 {
  return {
    minX: box.minX + margin,
    maxX: box.maxX - margin,
    minZ: box.minZ + margin,
    maxZ: box.maxZ - margin,
  };
}

/**
 * 축에서 시선의 반대쪽으로 물러날 수 있는 거리. 벽 밖으로 나가면 벽에 닿는 지점까지
 * 당긴다. 한 번에 한 축씩 보면 되는 AABB라 광선 하나로 정확히 나온다. 결과는
 * [CAMERA_MIN_DISTANCE, wanted] 안이다.
 */
export function cameraDistanceWithin(
  pivot: { x: number; z: number },
  direction: { x: number; z: number },
  wanted: number,
  bounds: Aabb2,
): number {
  // 카메라는 시선의 반대쪽(-direction)으로 물러난다
  const backX = -direction.x;
  const backZ = -direction.z;
  let limit = wanted;
  if (backX > 1e-6) limit = Math.min(limit, (bounds.maxX - pivot.x) / backX);
  else if (backX < -1e-6) limit = Math.min(limit, (bounds.minX - pivot.x) / backX);
  if (backZ > 1e-6) limit = Math.min(limit, (bounds.maxZ - pivot.z) / backZ);
  else if (backZ < -1e-6) limit = Math.min(limit, (bounds.minZ - pivot.z) / backZ);
  if (!Number.isFinite(limit)) return wanted;
  return MathUtils.clamp(limit, CAMERA_MIN_DISTANCE, wanted);
}
