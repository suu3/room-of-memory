/**
 * 잔상의 양 (AfterimagePass의 damp). 걷는 속도가 정한다.
 *
 * 서 있으면 잔상이 거의 없다(0.55: 몇 프레임 안에 사라진다). 걸으면 길게 끌린다(0.94).
 * 1보다 작은 값의 거듭제곱이라 화면은 언제나 현재 프레임으로 수렴한다.
 */
export const AFTERIMAGE_DAMP: readonly [number, number] = [0.55, 0.94];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isNaN(value) ? 0 : value));
}

/** 이동 입력의 크기(0~1) → damp. */
export function afterimageDamp(speed: number): number {
  const s = clamp01(speed);
  return AFTERIMAGE_DAMP[0] + (AFTERIMAGE_DAMP[1] - AFTERIMAGE_DAMP[0]) * s;
}

/** 이동 축 입력 → 속도(0~1). 대각선도 1을 넘지 않는다. */
export function movementSpeed(input: { horizontal: number; vertical: number }): number {
  return Math.min(1, Math.hypot(input.horizontal, input.vertical));
}
