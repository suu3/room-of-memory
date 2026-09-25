/**
 * 커스텀 커서 링이 갈 자리 (CustomCursor의 순수한 부분).
 *
 * 링은 늘 손 위의 작은 원이고, 세 가지 상태 사이를 damp로 오간다.
 * - 평소: 손 위의 28px 원.
 * - 만질 수 있는 DOM 위(hot): 같은 자리에서 조금 조여든다. 버튼을 감싸는 모양으로
 *   늘어나지 않는다. 버튼마다 테두리가 번쩍이면 화면이 부산하고 웹사이트처럼 보인다.
 * - 흡수(absorb): 얹힌 3D 오브젝트의 가운데로 빨려들며 0으로 줄어든다. 점만 남는다.
 */
export const RING_SIZE = 28;
/** 만질 수 있는 DOM 위에서 링이 조여드는 비율 */
export const RING_HOT_SCALE = 0.7;

export interface Point {
  x: number;
  y: number;
}

export interface RingGoal {
  /** 가운데 */
  x: number;
  y: number;
  /** 1 = 제 크기, 0 = 사라짐 */
  scale: number;
}

export function ringGoal(pointer: Point, hot: boolean, absorb: Point | null): RingGoal {
  if (absorb) return { x: absorb.x, y: absorb.y, scale: 0 };
  return { x: pointer.x, y: pointer.y, scale: hot ? RING_HOT_SCALE : 1 };
}

/** 지수 감쇠. three의 MathUtils.damp와 같은 식이되 UI 쪽에서 three를 물어 오지 않는다. */
export function damp(from: number, to: number, lambda: number, deltaSeconds: number): number {
  return from + (to - from) * (1 - Math.exp(-lambda * deltaSeconds));
}
