import type { CurtainSide } from "@/types/curtain";

export type { CurtainSide };

export const CURTAIN_X = {
  left: { closed: 0.22, open: -0.55 },
  right: { closed: 2.08, open: 2.85 },
} as const;

/**
 * 커튼이 켜지고 잡히는 거리 (닫혀 있을 때의 자리 기준).
 *
 * 커튼은 뒷벽에 붙어 있고(z=-3.72) 그 앞에 캐비닛이 있어 플레이어는 z로 1.9쯤 떨어져
 * 선다 (layout의 CURTAIN_STAND). 창문 기억의 반경(1.6)보다 넉넉히 잡아야 "창가에 왔다"
 * 싶은 자리에서 양쪽 커튼이 함께 켜지고 (한 쪽만 켜지면 나머지 한 쪽이 있는 줄 모른다)
 * 한 쪽을 젖히고 선 자리에서 다른 쪽도 잡힌다 (서는 자리에서 양쪽 손잡이까지 2.13).
 */
export const CURTAIN_NEAR_RADIUS = 2.3;

export function curtainTargetX(side: CurtainSide, open: boolean) {
  return CURTAIN_X[side][open ? "open" : "closed"];
}

/**
 * 커튼은 클릭 한 번이 아니라 양쪽을 각각 잡아당겨 연다.
 *
 * 진행도(0=닫힘, 1=열림)를 쪽마다 따로 들고, 둘 다 임계값을 넘겨야 열린 것으로 친다.
 * "커튼을 젖힌다"는 몸짓을 손으로 하게 만드는 게 목적이라 한 쪽만 당겨서는 밖이
 * 보이지 않는다.
 */
export const CURTAIN_OPEN_THRESHOLD = 0.98;
/** 손을 뗐을 때 끝까지 붙는 기준. 끝까지 끌게 하면 손만 아프다. */
export const CURTAIN_SNAP_THRESHOLD = 0.55;

export interface CurtainPull {
  left: number;
  right: number;
}

export const CURTAIN_CLOSED: CurtainPull = { left: 0, right: 0 };

/** 그 쪽 커튼이 완전히 열리려면 x로 얼마나 움직여야 하는지. */
export function curtainTravel(side: CurtainSide): number {
  return Math.abs(CURTAIN_X[side].open - CURTAIN_X[side].closed);
}

/** 드래그한 거리(월드 x)를 그 쪽 커튼의 진행도로 바꾼다. */
export function pullProgress(side: CurtainSide, deltaX: number, from: number): number {
  // 왼쪽 커튼은 -x로, 오른쪽은 +x로 당겨야 열린다.
  const direction = side === "left" ? -1 : 1;
  const gained = (deltaX * direction) / curtainTravel(side);
  return clamp01(from + gained);
}

/** 손을 뗐을 때 어디로 붙을지: 충분히 당겼으면 끝까지, 아니면 도로 닫힌다. */
export function settleProgress(progress: number): number {
  return progress >= CURTAIN_SNAP_THRESHOLD ? 1 : 0;
}

/**
 * 끌지 않고 그냥 눌렀다고 볼 이동량(월드 x).
 *
 * 커튼은 젖히는 몸짓이 곧 조작이지만, 그렇다고 누르기만 해서는 아무 일도 안 일어나는
 * 물건이면 곤란하다. 방의 다른 인터랙션(서랍·의자·전등 스위치)은 전부 한 번 누르면
 * 여닫히고, 커튼만 "끌 줄 알아야 열리는" 물건이면 손이 어디까지 가야 하는지 알 수 없다.
 * 이 폭 안에서 손을 떼면 끌 생각이 없었던 것으로 보고 반대쪽으로 뒤집는다.
 */
export const CURTAIN_TAP_SLOP = 0.1;

/** 한 번 눌러 여닫기: 젖혀져 있으면 닫고, 아니면 끝까지 젖힌다. */
export function toggleProgress(progress: number): number {
  return progress >= CURTAIN_SNAP_THRESHOLD ? 0 : 1;
}

/**
 * 놓는 순간의 속도가 앞으로 이만큼(초) 더 미끄러진 자리로 셈한다.
 *
 * 천에는 무게가 있다. 반쯤 당기다 놓아도 세게 튕겼으면 끝까지 가고, 거의 다 당겼어도
 * 되돌리는 손짓으로 놓았으면 도로 닫힌다. 어디서 놓았느냐가 아니라 어디로 가고
 * 있었느냐를 본다. 화면의 천은 그 자리로 damp로 따라가므로(Curtain) 관성으로 읽힌다.
 */
export const CURTAIN_FLICK_PROJECT_S = 0.12;

/**
 * 손을 뗐을 때 갈 자리. 끌었으면 손이 가던 방향으로 조금 더 간 자리에서 가까운 끝으로
 * 붙고, 누르기만 했으면 뒤집힌다.
 *
 * @param velocity 놓는 순간의 진행도 속도 (1/초, 열리는 쪽이 양수). 모르면 0.
 */
export function releaseProgress(progress: number, tapped: boolean, velocity = 0): number {
  if (tapped) return toggleProgress(progress);
  const projected = Number.isFinite(velocity) ? velocity * CURTAIN_FLICK_PROJECT_S : 0;
  return settleProgress(clamp01(progress + projected));
}

/**
 * 끌리는 동안의 진행도 속도(1/초)를 갱신한다. 지수 이동 평균이라 포인터 이벤트 한 개가
 * 튀어도 속도가 널뛰지 않는다. dt가 0이거나 음수면(같은 프레임의 중복 이벤트) 그대로 둔다.
 */
export function pullVelocity(
  previousVelocity: number,
  from: number,
  to: number,
  deltaSeconds: number,
): number {
  if (!(deltaSeconds > 0)) return previousVelocity;
  const instant = (to - from) / deltaSeconds;
  return previousVelocity + (instant - previousVelocity) * 0.5;
}

/** 두 쪽 모두 젖혀졌는가. 한 쪽만 열어서는 밖이 보이지 않는다. */
export function isCurtainOpen(pull: CurtainPull): boolean {
  return pull.left >= CURTAIN_OPEN_THRESHOLD && pull.right >= CURTAIN_OPEN_THRESHOLD;
}

/** 진행도에 따른 커튼 x 위치. */
export function curtainX(side: CurtainSide, progress: number): number {
  const { closed, open } = CURTAIN_X[side];
  return closed + (open - closed) * clamp01(progress);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
