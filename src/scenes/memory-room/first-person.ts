import { MathUtils } from "three";
import { ROOM_DOOR_POSITION } from "./layout";

/**
 * 1인칭 구간(인트로·2막 도입)의 순수 계산: 시선 각도, 끌기·키 입력, 처음 바라보는 방향.
 *
 * 카메라(FirstPersonRig)와 DOM 입력(use-first-person-look)이 같은 수를 봐야 해서
 * 여기 모은다. three 객체를 만들지 않으므로 테스트가 가볍다.
 */

export interface LookAngles {
  /** 좌우(rad). 0이면 -z(창 쪽)를 보고, 커질수록 왼쪽으로 돈다 (three의 rotation.y). */
  yaw: number;
  /** 상하(rad). 0이 수평, 양수가 위. */
  pitch: number;
}

/**
 * 1인칭 구간에서 몸이 옮겨 가는 층. 메인 카메라(층 0)에는 안 보이고, 거울의 반사
 * 카메라(MirrorReflection)만 이 층을 켠다. 카메라가 머리 안에 있는데 몸이 보이면
 * 제 몸통 속이고, 그렇다고 아예 지우면 거울에도 안 비친다.
 */
export const MIRROR_ONLY_LAYER = 1;
/** 눈높이. 캐릭터 키(PLAYER_TARGET_HEIGHT 1.55)에서 눈까지. 정수리에 두면 벽 위를 본다. */
export const EYE_HEIGHT = 1.38;
/** 세로 화각. 방이 좁아 넓게 잡되, 80 넘게 벌리면 벽 모서리가 휘어 보인다. */
export const FIRST_PERSON_FOV = 68;
/** 고개를 위아래로 꺾는 한계. 천장·발밑을 끝까지 보게 두면 걷는 방향(카메라 정면)이 사라진다. */
export const PITCH_LIMIT = 1.05;
/** 끌기 감도 (rad/px). 방 한 바퀴(2π)가 화면 폭 두 번쯤. */
export const LOOK_DRAG_SENSITIVITY = 0.0042;
/** 키 한 번에 도는 각도. `,`/`.`로 돈다 (아이소메트릭 회전과 같은 키). */
export const LOOK_KEY_STEP = 0.16;

export function clampPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return 0;
  return MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
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

/**
 * 구간에 들어서는 순간 바라보는 방향.
 *
 * 인트로는 침대 쪽(+x)을 본다. 눈을 뜨면 제 방의 침대와 협탁이 먼저 보여야 "내 방"으로
 * 읽힌다. 창(-z)을 먼저 보이면 커튼 너머 밤 풍경만 남아 어디인지 모른다. 스위치는
 * 왼쪽 뒤라 돌아서야 나온다: 찾는 게 일이니까. 문 넘기는 방금 연 문을 본다. 문을
 * 열었는데 등지고 있으면 어디로 가라는지 모른다.
 */
export function initialLook(
  viewpoint: "intro" | "doorway",
  player: { x: number; z: number },
): LookAngles {
  if (viewpoint === "intro") return { yaw: -Math.PI / 2, pitch: 0 };
  return {
    yaw: yawToward(player, { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] }),
    pitch: 0,
  };
}
