export type SwingResult = "hit" | "early" | "late";

export function classifySwing(progress: number, window: readonly [number, number]): SwingResult {
  if (progress < window[0]) return "early";
  if (progress > window[1]) return "late";
  return "hit";
}

export function remainingChances(misses: number, maximum: number): number {
  return Math.max(0, maximum - misses);
}

export type PitchSide = -1 | 1;

/**
 * 공이 출발하는 x 위치(%)가 마운드 한가운데(50)에서 벗어나는 폭.
 *
 * 예전에는 46~54 사이에서 뽑았는데, 그 폭에서는 매번 정면에서 곧게 날아와
 * 궤적이 사실상 하나뿐이었다 — 타이밍만 외우면 끝났다. 좌우로 확실히 벌리면
 * 공이 비스듬히 들어오면서 링에 겹치는 순간이 눈에 다르게 잡힌다.
 */
export const PITCH_OFFSET_MIN = 8;
export const PITCH_OFFSET_MAX = 22;

/**
 * 다음 공이 날아올 자리. 같은 쪽이 연달아 나오면 "변주"가 안 느껴지므로
 * 직전과 반대편에서 던지고, 치우친 정도만 그 안에서 무작위로 정한다.
 *
 * `random`은 0 이상 1 미만 — 테스트에서 양 끝을 고정해 넣을 수 있게 인자로 받는다.
 */
export function nextPitch(
  lastSide: PitchSide,
  random: number,
): { startX: number; side: PitchSide } {
  const side: PitchSide = lastSide === 1 ? -1 : 1;
  const spread = Math.min(1, Math.max(0, random));
  const offset = PITCH_OFFSET_MIN + spread * (PITCH_OFFSET_MAX - PITCH_OFFSET_MIN);
  return { startX: 50 + side * offset, side };
}
