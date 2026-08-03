import type { Vec3Tuple } from "./types";

/**
 * 블록 캐릭터의 파트 배치.
 *
 * 이 glb에는 스켈레톤이 없다 — 몸/머리/팔/다리가 변환 없는 별개 노드로 들어 있어서
 * 각 메쉬의 정점이 곧 모델 공간 좌표다. 그래서 팔다리를 돌리려면 관절 위치에 그룹을
 * 두고 메쉬를 그만큼 반대로 밀어 넣어 회전축을 만들어 줘야 한다.
 *
 * 값은 glb의 파트별 바운딩 박스에서 읽었다 (모델 전체 높이 16, 폭 8, 발끝이 +Z).
 */
export const PLAYER_PART_NAMES = [
  "Body1",
  "Head1",
  "ArmLeft1",
  "ArmRight1",
  "LegLeft1",
  "LegRight1",
] as const;

export type PlayerPartName = (typeof PLAYER_PART_NAMES)[number];

/** 회전하는 팔다리의 관절 위치(모델 공간). 어깨는 몸통 윗변, 골반은 몸통 밑변. */
export const PLAYER_JOINTS = {
  ArmLeft1: [3, 12, 0],
  ArmRight1: [-3, 12, 0],
  LegLeft1: [1, 6, 0],
  LegRight1: [-1, 6, 0],
} as const satisfies Partial<Record<PlayerPartName, Vec3Tuple>>;

export type PlayerJointName = keyof typeof PLAYER_JOINTS;

export function isJointPart(name: string): name is PlayerJointName {
  return name in PLAYER_JOINTS;
}

/** 모델 원본 키 16을 방 스케일(책상 상판 1.11)에 맞춘다. */
export const PLAYER_MODEL_HEIGHT = 16;
export const PLAYER_TARGET_HEIGHT = 1.55;
export const PLAYER_MODEL_SCALE = PLAYER_TARGET_HEIGHT / PLAYER_MODEL_HEIGHT;

/** 걷기 한 걸음의 각도와 속도. */
const LEG_SWING = 0.62;
const ARM_SWING = 0.46;
/** 이동 속도 1일 때 초당 보각(rad). 보폭이 속도와 안 맞으면 발이 미끄러져 보인다. */
export const STEP_RATE = 3.2;
/** 서 있을 때 팔이 몸통에서 살짝 벌어진 각도. */
const IDLE_ARM = 0.06;

export interface PlayerPose {
  legLeft: number;
  legRight: number;
  armLeft: number;
  armRight: number;
  /** 몸 전체의 위아래 흔들림(모델 공간). 걸을 때 한 걸음마다 두 번 튄다. */
  bob: number;
  /** 몸통·머리의 좌우 기울기. */
  sway: number;
}

/**
 * 걷기/서기 포즈. 걷기 강도(0~1)로 두 포즈를 섞어 멈출 때 뚝 끊기지 않게 한다.
 *
 * @param phase 누적된 보각(rad)
 * @param walk  0=완전히 서 있음, 1=제 속도로 걷는 중
 */
export function playerPose(phase: number, walk: number, breathe: number): PlayerPose {
  const swing = Math.sin(phase);
  const idleBreath = Math.sin(breathe) * 0.02;
  return {
    // 팔다리는 대각선으로 엇갈린다 — 왼다리가 나가면 오른팔이 나간다
    legLeft: swing * LEG_SWING * walk,
    legRight: -swing * LEG_SWING * walk,
    armLeft: -swing * ARM_SWING * walk + IDLE_ARM * (1 - walk),
    armRight: swing * ARM_SWING * walk - IDLE_ARM * (1 - walk),
    bob: Math.abs(Math.cos(phase)) * 0.42 * walk + idleBreath * (1 - walk),
    sway: Math.sin(phase) * 0.035 * walk,
  };
}
