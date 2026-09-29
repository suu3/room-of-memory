import { MathUtils } from "three";
import { FRONT_DOOR_POSITION, ROOM_DOOR_POSITION } from "./layout";

/**
 * 1인칭 구간(인트로·2막 도입·엔딩의 문턱)의 순수 계산: 시선 각도, 끌기·키 입력, 처음 바라보는 방향.
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
/** 끌기 감도 (rad/px). 방 한 바퀴(2π)가 화면 폭 두 번쯤. 마우스 기준이다. */
export const LOOK_DRAG_SENSITIVITY = 0.0042;
/**
 * 손가락으로 끌 때 화면 폭 한 번에 도는 각도. 반 바퀴라 두 번 쓸면 한 바퀴다.
 *
 * 마우스 감도를 그대로 쓰면 폭 390px 폰에서 끝에서 끝까지 쓸어도 94°밖에 안 돌아,
 * 뒤를 보려면 네 번을 쓸어야 했다. 폰마다 폭이 달라 px당 값이 아니라 폭으로 잰다.
 */
export const TOUCH_TURN_PER_WIDTH = Math.PI;

/** 이 폭의 화면에서 손가락 끌기의 좌우 감도 (rad/px). 넓은 화면에서도 마우스보다 둔해지지 않는다. */
export function touchLookSensitivity(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return LOOK_DRAG_SENSITIVITY;
  return Math.max(LOOK_DRAG_SENSITIVITY, TOUCH_TURN_PER_WIDTH / width);
}
/** 키 한 번에 도는 각도. `,`/`.`로 돈다 (아이소메트릭 회전과 같은 키). */
export const LOOK_KEY_STEP = 0.16;

export function clampPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return 0;
  return MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
}

/**
 * 끌기 시작점에서 (dx, dy)픽셀 끈 시선. 마우스 조작과 같은 방향이다: 오른쪽으로
 * 끌면 오른쪽을 보고, 아래로 끌면 아래를 본다. 결과는 `target`에 써서 돌려준다.
 * 좌우(yaw)에는 한계가 없다: 몇 바퀴든 돈다. 위아래만 PITCH_LIMIT에서 멈춘다.
 */
export function lookFromDrag(
  start: LookAngles,
  dx: number,
  dy: number,
  target: LookAngles,
  yawSensitivity = LOOK_DRAG_SENSITIVITY,
): LookAngles {
  const safeDx = Number.isFinite(dx) ? dx : 0;
  const safeDy = Number.isFinite(dy) ? dy : 0;
  target.yaw = start.yaw - safeDx * yawSensitivity;
  // 위아래는 늘 마우스 감도: 옆으로 쓰는 손가락이 조금만 기울어도 천장·바닥으로 튀지 않게
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
 * 열었는데 등지고 있으면 어디로 가라는지 모른다. 엔딩은 현관문을 정면으로 본다
 * (서는 자리는 플레이어가 아니라 exitWalkAt이 정한다).
 */
export function initialLook(
  viewpoint: "intro" | "doorway" | "exit",
  player: { x: number; z: number },
): LookAngles {
  if (viewpoint === "intro") return { yaw: -Math.PI / 2, pitch: 0 };
  if (viewpoint === "exit") {
    const start = exitWalkAt(0, true, { x: 0, y: 0, z: 0 });
    return {
      yaw: yawToward(start, { x: FRONT_DOOR_POSITION[0], z: FRONT_DOOR_POSITION[2] }),
      pitch: EXIT_PITCH,
    };
  }
  return {
    yaw: yawToward(player, { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] }),
    pitch: 0,
  };
}

/**
 * 엔딩의 문턱 넘기: 현관문을 연 뒤 카메라가 도해 대신 몇 걸음 걸어 나간다.
 *
 * 앞의 두 1인칭은 플레이어가 걷지만 여기서는 손을 뗀다. 할 일은 이미 끝났고(문을 열었다),
 * 이 몇 초는 떠나는 걸 보는 시간이다. 서는 자리도 플레이어 위치가 아니라 문 정면에서
 * 정한다: 문은 거실 어디서든 눌리므로, 몸이 선 자리에서 걸으면 소파를 뚫고 간다.
 * 문 앞(FRONT_DOOR_INTERACTION 반경)은 가구가 비워 두는 자리라 이 길은 늘 비어 있다.
 *
 * 거리는 문 면에서 방 안쪽(+x)으로 잰다. 끝은 문턱을 조금 넘은 자리(음수)로, 문 밖의
 * 빛 판(EndingLightPlane, 문 밖 0.32) 바로 앞이라 화면이 빛으로 찬다.
 */
export const EXIT_WALK = {
  /** 출발: 문 앞 이만큼. 문짝이 도는 게 한눈에 들어오는 거리. */
  startDistance: 2.1,
  /** 도착: 문턱 너머. 빛 판(-0.32)을 뚫지 않는다. */
  endDistance: -0.16,
  /** 문이 열리는 걸 보고 서 있는 시간 (초). 문짝이 거의 다 열리는 박자. */
  holdS: 0.8,
  /** 걸어 나가는 시간 (초). */
  walkS: 2.4,
  /** 도착해 빛 속에 머무는 시간 (초). 이 뒤에 영상이 방을 덮는다. */
  lingerS: 0.5,
} as const;

/** 문턱 넘기 전체 길이(ms). EndingScreen이 이 뒤에 영상으로 넘어간다. */
export const EXIT_BEAT_MS = Math.round(
  (EXIT_WALK.holdS + EXIT_WALK.walkS + EXIT_WALK.lingerS) * 1000,
);

/** 살짝 내려다본다: 문고리 높이의 문을 정면으로 보면 눈높이가 문 위쪽에 걸린다. */
const EXIT_PITCH = -0.04;
/** 걸음마다 머리가 오르내리는 폭과 빠르기. 크면 멀미고, 없으면 미끄러진다. */
const EXIT_BOB_HEIGHT = 0.025;
const EXIT_STEPS_PER_S = 1.8;

/**
 * 문턱 넘기가 시작되고 `elapsed`초 뒤 눈(카메라)의 자리. 결과는 `target`에 써서 돌려준다.
 * `moving`이 거짓(모션 줄이기)이면 출발점에 선 채 문이 열리고 빛이 드는 것만 본다.
 */
export function exitWalkAt(
  elapsed: number,
  moving: boolean,
  target: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const walked = moving ? Math.min(1, Math.max(0, (t - EXIT_WALK.holdS) / EXIT_WALK.walkS)) : 0;
  // 천천히 떼서 천천히 멈춘다
  const eased = walked * walked * (3 - 2 * walked);
  const distance =
    EXIT_WALK.startDistance + (EXIT_WALK.endDistance - EXIT_WALK.startDistance) * eased;
  // 걷는 동안에만 머리가 흔들린다. 떼는 순간·멈추는 순간은 sin(πu)가 0이라 튀지 않는다
  const stride = Math.sin(Math.PI * walked);
  const bob =
    Math.abs(Math.sin(Math.PI * EXIT_STEPS_PER_S * (t - EXIT_WALK.holdS))) *
    EXIT_BOB_HEIGHT *
    stride;
  // 현관문은 방 안쪽이 +x다 (FRONT_DOOR_ROTATION: 문이 벽 안쪽을 본다)
  target.x = FRONT_DOOR_POSITION[0] + distance;
  target.y = EYE_HEIGHT + (walked > 0 ? bob : 0);
  target.z = FRONT_DOOR_POSITION[2];
  return target;
}
