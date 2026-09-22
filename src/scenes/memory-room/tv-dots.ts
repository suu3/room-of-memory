/**
 * 꺼진 TV 유리에 비치는 거실의 도트 굵기 (docs/visual-experiments.md 11장, TvReflection.tsx).
 *
 * 반사는 그대로 두고 인광체 격자만 굵기를 바꾼다. 어두울수록 도트가 굵어 형체가 안
 * 잡히고, 되찾을수록 촘촘해져 거실이 유리에 서서히 맺힌다. 도트 하나가 화소라면 이
 * 곡선은 "이 방을 몇 화소로 기억하는가"다.
 */

/** 화면 가로에 놓이는 도트 수의 양 끝. 0에서 굵고(22) 1에서 촘촘하다(88). */
export const TV_DOTS = {
  coarse: 22,
  fine: 88,
} as const;

/**
 * TV 유리의 세로/가로 비 (TvReflection의 판 크기 1.04/1.86). 도트를 정사각으로
 * 두려면 세로 개수는 가로 개수에 이 비를 곱한 값이다.
 */
export const TV_DOT_ASPECT = 1.04 / 1.86;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isNaN(value) ? 0 : value));
}

/**
 * 방 밝기(0~1)에서 가로 도트 수. 선형이고 단조증가, 범위 밖은 끝값에 붙는다.
 *
 * 선형인 이유: 밝기 자체가 이미 V자 곡선(roomLightLevel)이라 여기서 또 휘면
 * 조명과 도트가 다른 박자로 움직인다. 유리는 방을 따라가기만 한다.
 */
export function dotsForLevel(level: number): number {
  const t = clamp01(level);
  return TV_DOTS.coarse + (TV_DOTS.fine - TV_DOTS.coarse) * t;
}

/** 가로 도트 수에 맞는 세로 도트 수. 판의 비를 곱해 도트가 찌그러지지 않게 한다. */
export function dotsAcrossHeight(dotsAcrossWidth: number): number {
  return dotsAcrossWidth * TV_DOT_ASPECT;
}
