import { FOCUS_ZOOM_SCALE } from "@/components/canvas/room-canvas-runtime";

/**
 * 크레인 샷: 하부장이 열리고 안방 열쇠가 손에 들어오는 순간 (docs/direction/visual-experiments.md 14장
 * "노토리어스"). 화장실 전체를 잡고 있던 카메라가 열쇠가 있던 칸 하나까지 천천히 밀고
 * 들어갔다가, 혼잣말("…안방 열쇠.")이 스러진 뒤 제자리로 돌아온다.
 *
 * 직교 카메라라 "밀고 들어간다"는 배율이 오르는 것이다 (room-canvas-runtime의 focusZoomFor
 * 주석). 조사 확대(1.45)보다 깊고, 프리셋 전환(lambda 7)보다 훨씬 느리다. 컷이 아니라
 * 한 호흡으로 이어지는 이동이어야 한다.
 */
export const CRANE_SHOT = {
  /** 기본 배율에 곱하는 값. 조사 확대의 한 단계 위. */
  zoomScale: FOCUS_ZOOM_SCALE * 1.6,
  /** 미는 속도 (damp lambda). 1.15면 3초 남짓에 거의 닿는다. */
  lambda: 1.15,
  /** 열쇠에 머무는 시간(ms). 혼잣말 한 줄(RemarkLine 3.2초)이 사라진 뒤에도 한 박자 남는다. */
  holdMs: 4200,
} as const;

/** 크레인이 닿는 배율. */
export function craneZoomFor(baseZoom: number): number {
  if (!Number.isFinite(baseZoom)) return baseZoom;
  return baseZoom * CRANE_SHOT.zoomScale;
}
