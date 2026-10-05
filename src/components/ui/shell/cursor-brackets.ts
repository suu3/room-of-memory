/**
 * 커스텀 커서의 꺾쇠 ⌜ ⌟ 가 갈 자리 (CustomCursor의 순수한 부분).
 *
 * 평소에는 꺾쇠 넷이 점 둘레에 모여 작은 네모를 이룬다. 만질 수 있는 3D 오브젝트에 얹히면
 * 그 네모가 벌어져 물건을 감싸고, 손이 떠나면 다시 손 둘레의 네모로 모인다.
 * - DOM 버튼은 감싸지 않는다. 버튼마다 테두리가 번쩍이면 화면이 부산하고 웹사이트처럼
 *   보인다. 버튼 위에서는 네모가 물러나고 점이 금빛이 될 뿐이다 (CustomCursor).
 * - 침대·창문처럼 큰 물건은 상한까지만 벌어지고, 그 틀이 물건 안에서 손을 따라다닌다.
 *   꺾쇠가 화면을 가로지르면 조준선이 아니라 화면 테두리로 읽힌다.
 */

/** 평소 점 둘레에 서는 네모의 변 (px). 꺾쇠의 팔(9px) 둘이 거의 맞닿아 네모로 읽힌다 */
export const BRACKET_IDLE = 20;
/** 물건과 꺾쇠 사이의 숨 (px) */
export const BRACKET_PAD = 6;
/** 꺾쇠 틀의 가장 작은 변. 이보다 작으면 꺾쇠끼리 붙어 네모로 보인다 */
export const BRACKET_MIN = 28;
/** 꺾쇠 틀의 가장 큰 변 */
export const BRACKET_MAX = 280;
/** 누르는 동안 틀이 사방에서 조여드는 만큼 (px) */
export const BRACKET_PRESS_INSET = 3;
/** 화면 가장자리에서 꺾쇠가 물러서는 거리 (px) */
export const BRACKET_EDGE = 4;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 한 축의 [시작, 끝]. 틀이 물건보다 작으면 물건 안에서 손을 따라가고, 아니면 가운데에 선다 */
function span(
  pointer: number,
  start: number,
  end: number,
  inset: number,
  limit: number,
): [number, number] {
  const size = clamp(end - start + BRACKET_PAD * 2, BRACKET_MIN, BRACKET_MAX);
  const lowest = start - BRACKET_PAD + size / 2;
  const highest = end + BRACKET_PAD - size / 2;
  const center = lowest > highest ? (start + end) / 2 : clamp(pointer, lowest, highest);
  const half = size / 2 - inset;
  // 화면 끝에 걸친 물건은 꺾쇠가 화면 밖으로 나가 반쪽만 보인다. 가장자리 안쪽에 세운다
  return [Math.max(BRACKET_EDGE, center - half), Math.min(limit - BRACKET_EDGE, center + half)];
}

/**
 * 꺾쇠 틀이 갈 자리.
 *
 * @param target 얹힌 3D 오브젝트의 화면상 사각형. 없으면 틀은 손 둘레의 작은 네모다.
 */
export function bracketGoal(
  pointer: Point,
  target: Rect | null,
  pressed: boolean,
  viewport: Size,
): Rect {
  const inset = pressed ? BRACKET_PRESS_INSET : 0;
  if (!target) {
    const half = BRACKET_IDLE / 2 - inset;
    return {
      left: pointer.x - half,
      top: pointer.y - half,
      right: pointer.x + half,
      bottom: pointer.y + half,
    };
  }
  const [left, right] = span(pointer.x, target.left, target.right, inset, viewport.width);
  const [top, bottom] = span(pointer.y, target.top, target.bottom, inset, viewport.height);
  return { left, top, right, bottom };
}

/** 지수 감쇠. three의 MathUtils.damp와 같은 식이되 UI 쪽에서 three를 물어 오지 않는다. */
export function damp(from: number, to: number, lambda: number, deltaSeconds: number): number {
  return from + (to - from) * (1 - Math.exp(-lambda * deltaSeconds));
}
