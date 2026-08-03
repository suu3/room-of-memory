export type CurtainSide = "left" | "right";

export const CURTAIN_X = {
  left: { closed: 0.22, open: -0.55 },
  right: { closed: 2.08, open: 2.85 },
} as const;

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

/** 손을 뗐을 때 어디로 붙을지 — 충분히 당겼으면 끝까지, 아니면 도로 닫힌다. */
export function settleProgress(progress: number): number {
  return progress >= CURTAIN_SNAP_THRESHOLD ? 1 : 0;
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
