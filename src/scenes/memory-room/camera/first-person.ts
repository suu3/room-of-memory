import { MathUtils } from "three";
import { FRONT_DOOR_INWARD, FRONT_DOOR_POSITION, ROOM_DOOR_POSITION } from "../world/layout";

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

const DOOR_X = FRONT_DOOR_POSITION[0];
const DOOR_Z = FRONT_DOOR_POSITION[2];
const [INWARD_X, INWARD_Z] = FRONT_DOOR_INWARD;
const EXIT_DOOR = { x: DOOR_X, z: DOOR_Z };
/*
 * 문 쪽(밖, -INWARD)을 볼 때의 오른쪽. 진행 방향 d의 오른쪽은 (-d.z, d.x)다
 * (-x를 볼 때 -z, -z를 볼 때 +x).
 */
const RIGHT_X = INWARD_Z;
const RIGHT_Z = -INWARD_X;

/** 문 면에서 안쪽으로 `distance`만큼 들어온 자리의 축 좌표: 문 축 위의 거리. */
function inwardDistance(point: { x: number; z: number }): number {
  return (point.x - DOOR_X) * INWARD_X + (point.z - DOOR_Z) * INWARD_Z;
}

/**
 * 구간에 들어서는 순간 바라보는 방향.
 *
 * 인트로는 침대 쪽(+x)을 본다. 눈을 뜨면 제 방의 침대와 협탁이 먼저 보여야 "내 방"으로
 * 읽힌다. 창(-z)을 먼저 보이면 커튼 너머 밤 풍경만 남아 어디인지 모른다. 스위치는
 * 왼쪽 뒤라 돌아서야 나온다: 찾는 게 일이니까. 문 넘기는 방금 연 문을 본다. 문을
 * 열었는데 등지고 있으면 어디로 가라는지 모른다. 엔딩은 현관문 쪽이다.
 */
export function initialLook(
  viewpoint: "intro" | "doorway" | "exit",
  player: { x: number; z: number },
): LookAngles {
  if (viewpoint === "intro") return { yaw: -Math.PI / 2, pitch: 0 };
  if (viewpoint === "exit") {
    // 엔딩은 시선을 각도로 들지 않는다 (FirstPersonRig가 exitCameraAt에서 lookAt한다). 문 쪽만 준다
    return { yaw: yawToward({ x: DOOR_X + INWARD_X, z: DOOR_Z + INWARD_Z }, EXIT_DOOR), pitch: 0 };
  }
  return {
    yaw: yawToward(player, { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] }),
    pitch: 0,
  };
}

/**
 * 엔딩의 문턱 넘기: 현관문을 열면 카메라가 도해의 등 뒤로 내려앉고, 도해가 제 발로
 * 문을 지나 빛 속으로 걸어 나간다. 카메라는 문턱 앞에서 멈춰 그 뒷모습을 보낸다.
 * 엔딩 영상의 첫 컷(문을 열고 나가는 뒷모습)이 이 그림을 이어 받는다.
 *
 * 앞의 두 1인칭과 달리 조작은 없다. 할 일은 이미 끝났고(문을 열었다), 이 몇 초는 떠나는
 * 걸 보는 시간이다. 몸은 선 자리가 아니라 문 정면에서 출발한다: 문은 거실 어디서든
 * 눌리므로, 선 자리에서 걸으면 소파를 뚫고 간다. 문 앞(FRONT_DOOR_INTERACTION 반경)은
 * 가구가 비워 두는 자리라 이 길은 늘 비어 있다. 전환 덮개가 그 순간이동을 가린다.
 *
 * 거리는 문 면에서 방 안쪽(FRONT_DOOR_INWARD)으로 잰다. 몸은 문 밖의 빛 판(EndingLightPlane, 문 밖
 * 0.32)을 지나 더 걸어가므로, 판을 넘는 순간 빛에 먹혀 사라진다.
 */
export const EXIT_WALK = {
  /** 몸의 출발: 문 앞 이만큼. */
  bodyStart: 1.6,
  /** 몸의 도착: 빛 판 너머. 판 뒤로 들어가 보이지 않게 된다. */
  bodyEnd: -1.3,
  /** 카메라가 몸 뒤로 떨어져 있는 거리. */
  cameraBack: 1.8,
  /**
   * 카메라가 더 따라가지 않는 자리 (문 앞 이만큼). 몇 걸음만 따라붙고 선다. 더 붙으면
   * 문틀이 화면을 채워 뒷모습이 멀어지는 그림이 안 나온다.
   */
  cameraStop: 2.7,
  /** 카메라 높이. 캐릭터 키(1.55) 위에서 어깨 너머로 문을 내려다본다. */
  cameraHeight: 2.05,
  /** 오른어깨 너머로 비켜 서는 폭. 정중앙 뒤면 머리가 문을 다 가린다. */
  cameraSide: 0.32,
  /** 문이 열리는 걸 보고 서 있는 시간 (초). 그동안 몸이 문 쪽으로 돌아선다. */
  holdS: 0.7,
  /** 걸어 나가는 시간 (초). */
  walkS: 2.6,
  /** 다 나간 뒤 빛만 남은 문을 보는 시간 (초). 이 뒤에 영상이 방을 덮는다. */
  lingerS: 0.6,
} as const;

/** 문턱 넘기 전체 길이(ms). EndingScreen이 이 뒤에 영상으로 넘어간다. */
export const EXIT_BEAT_MS = Math.round(
  (EXIT_WALK.holdS + EXIT_WALK.walkS + EXIT_WALK.lingerS) * 1000,
);

/** 문턱 넘기에서 몸이 바라보는 방향 (Player의 facing: atan2(dx, dz)). 문 밖(-INWARD) 쪽이다. */
export const EXIT_FACING = Math.atan2(-INWARD_X, -INWARD_Z);

/** 카메라가 바라보는 점: 문 너머 빛 속, 몸의 어깨 높이쯤. */
export const EXIT_LOOK_AT = {
  x: DOOR_X - INWARD_X * 2.2,
  y: 1.3,
  z: DOOR_Z - INWARD_Z * 2.2,
} as const;

/**
 * 문턱 넘기가 시작되고 `elapsed`초 뒤 몸(발)의 자리. 결과는 `target`에 써서 돌려준다.
 * 걷는 동안만 문 축 위의 거리가 줄어든다. 천천히 떼되 멈추지 않고 빛 속으로 들어간다 (ease-in).
 */
export function exitBodyAt(
  elapsed: number,
  target: { x: number; z: number },
): { x: number; z: number } {
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const walked = Math.min(1, Math.max(0, (t - EXIT_WALK.holdS) / EXIT_WALK.walkS));
  // 떼는 순간만 부드럽게, 그 뒤로는 일정한 걸음 (끝에서 멈추면 문 앞에서 머뭇거리는 그림이다)
  const eased = walked < 0.2 ? (walked * walked) / 0.4 : walked - 0.1;
  const distance = EXIT_WALK.bodyStart + ((EXIT_WALK.bodyEnd - EXIT_WALK.bodyStart) * eased) / 0.9;
  target.x = DOOR_X + INWARD_X * distance;
  target.z = DOOR_Z + INWARD_Z * distance;
  return target;
}

/**
 * 몸이 `body`에 있을 때 카메라의 자리. 몸 뒤 cameraBack만큼에서 따라가다 cameraStop에서
 * 멈춘다. `following`이 거짓(모션 줄이기)이면 출발 자리에 선 채 몸만 걸어 나간다.
 */
export function exitCameraAt(
  body: { x: number; z: number },
  following: boolean,
  target: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const start = EXIT_WALK.bodyStart + EXIT_WALK.cameraBack;
  const stop = EXIT_WALK.cameraStop;
  const trailing = following ? Math.max(stop, inwardDistance(body) + EXIT_WALK.cameraBack) : start;
  const distance = Math.min(start, trailing);
  // 문 축에서 오른어깨 쪽으로 비켜 선다
  target.x = DOOR_X + INWARD_X * distance + RIGHT_X * EXIT_WALK.cameraSide;
  target.y = EXIT_WALK.cameraHeight;
  target.z = DOOR_Z + INWARD_Z * distance + RIGHT_Z * EXIT_WALK.cameraSide;
  return target;
}
