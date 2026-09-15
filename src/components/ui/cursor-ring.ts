/**
 * 커스텀 커서 링이 갈 자리 (CustomCursor의 순수한 부분).
 *
 * 링은 세 가지 상태 사이를 damp로 오간다.
 * - 평소: 손 위의 28px 원.
 * - 붙기(magnet): 얹힌 DOM 버튼을 감싸는 알약. 버튼 사각형에 여백을 두르고 버튼의
 *   라운드를 이어받는다.
 * - 흡수(absorb): 얹힌 3D 오브젝트의 가운데로 빨려들며 0으로 줄어든다. 점만 남는다.
 */
export const RING_SIZE = 28;
export const RING_PADDING = 4;

export interface Point {
  x: number;
  y: number;
}

export interface MagnetRect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 버튼의 모서리 라운드(px). */
  radius: number;
}

export interface RingGoal {
  /** 가운데 */
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  /** 1 = 제 크기, 0 = 사라짐 */
  scale: number;
}

export function ringGoal(
  pointer: Point,
  magnet: MagnetRect | null,
  absorb: Point | null,
): RingGoal {
  if (absorb) {
    return {
      x: absorb.x,
      y: absorb.y,
      width: RING_SIZE,
      height: RING_SIZE,
      radius: RING_SIZE / 2,
      scale: 0,
    };
  }
  if (magnet) {
    return {
      x: magnet.left + magnet.width / 2,
      y: magnet.top + magnet.height / 2,
      width: magnet.width + RING_PADDING * 2,
      height: magnet.height + RING_PADDING * 2,
      radius: magnet.radius + RING_PADDING,
      scale: 1,
    };
  }
  return {
    x: pointer.x,
    y: pointer.y,
    width: RING_SIZE,
    height: RING_SIZE,
    radius: RING_SIZE / 2,
    scale: 1,
  };
}

/** 지수 감쇠. three의 MathUtils.damp와 같은 식이되 UI 쪽에서 three를 물어 오지 않는다. */
export function damp(from: number, to: number, lambda: number, deltaSeconds: number): number {
  return from + (to - from) * (1 - Math.exp(-lambda * deltaSeconds));
}
