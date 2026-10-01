/**
 * 악보의 번진 마디가 다시 모이는 곡선 (docs/direction/visual-experiments.md 11장 "잉크가 모인다").
 *
 * 조각 없이 보는 악보에서 그 마디는 물에 번진 얼룩이다. 안방의 찢어진 조각을 들고
 * 피아노 앞에 서면 번짐이 **거꾸로** 걷히며 음표와 계이름이 된다. 재질 규칙의 문장
 * ("흩어진 것이 모인다")을 가장 글자 그대로 하는 자리라, 곡선은 끝에서 느려지는
 * ease-out이다: 마지막 순간에 또렷해지는 것이 모임의 맛이다.
 */

/** 모이는 데 걸리는 시간(초). */
export const GATHER_DURATION_S = 1.5;
/** 모임 0에서의 번짐(px, 악보 텍스처 기준). 음표 머리(rx 7)가 얼룩으로 풀릴 만큼. */
export const NOTE_BLUR_MAX_PX = 11;
/** 얼룩의 불투명도. 조각 없이 볼 때의 값이 곧 원래 악보의 값이다. */
export const BLOT_ALPHA = 0.14;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isNaN(value) ? 0 : value));
}

/** 흐른 시간 → 모임 정도(0~1). ease-out cubic. */
export function gatherProgress(elapsedS: number, durationS = GATHER_DURATION_S): number {
  if (durationS <= 0) return 1;
  const t = clamp01(elapsedS / durationS);
  return 1 - (1 - t) ** 3;
}

/** 모임 정도 → 음표의 번짐(px). 모일수록 또렷하다. */
export function noteBlurPx(gather: number): number {
  return NOTE_BLUR_MAX_PX * (1 - clamp01(gather));
}

/** 모임 정도 → 얼룩의 불투명도. 모일수록 옅어진다. */
export function blotAlpha(gather: number): number {
  return BLOT_ALPHA * (1 - clamp01(gather));
}
