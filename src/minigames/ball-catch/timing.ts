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
 * 궤적이 사실상 하나뿐이었다. 타이밍만 외우면 끝났다. 좌우로 확실히 벌리면
 * 공이 비스듬히 들어오면서 링에 겹치는 순간이 눈에 다르게 잡힌다.
 */
export const PITCH_OFFSET_MIN = 8;
export const PITCH_OFFSET_MAX = 22;

/**
 * 다음 공이 날아올 자리. 같은 쪽이 연달아 나오면 "변주"가 안 느껴지므로
 * 직전과 반대편에서 던지고, 치우친 정도만 그 안에서 무작위로 정한다.
 *
 * `random`은 0 이상 1 미만: 테스트에서 양 끝을 고정해 넣을 수 있게 인자로 받는다.
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

/** 안타를 하나씩 쌓을수록 기본 비행 시간이 이만큼 짧아진다. */
export const ROUND_MS_START = 1700;
export const ROUND_MS_MIN = 1200;
export const ROUND_MS_STEP = 150;
/**
 * 변주까지 얹은 뒤의 절대 하한. 이 아래로 내려가면 보고 반응하는 게 아니라
 * 찍는 게임이 된다. 판정 구간(CATCH_WINDOW 폭 0.34)이 280ms 밑으로 좁아진다.
 */
export const ROUND_MS_FLOOR = 820;

/**
 * 구종. 방향만 바뀌고 속도가 늘 같으면 몇 번 만에 손이 박자를 외워서,
 * 공을 보지 않고 스윙해도 맞는다. 느린 공과 빠른 공을 섞어 매번 다시 보게 한다.
 */
export const PITCH_TEMPOS = [
  { key: "slow", scale: 1.18 },
  { key: "normal", scale: 1 },
  { key: "fast", scale: 0.82 },
] as const;

export type PitchTempo = (typeof PITCH_TEMPOS)[number];
export type PitchTempoKey = PitchTempo["key"];

/**
 * 다음 구종. 직전과 같은 속도는 뽑지 않는다. 같은 게 두 번 이어지면
 * 그 두 번째는 변주가 아니라 그냥 기준이 되어 버린다.
 *
 * `random`은 0 이상 1 미만. `nextPitch`와 같은 이유로 인자로 받는다.
 */
export function nextTempo(lastKey: PitchTempoKey, random: number): PitchTempo {
  const candidates = PITCH_TEMPOS.filter((tempo) => tempo.key !== lastKey);
  const spread = Math.min(0.999_999, Math.max(0, random));
  return candidates[Math.floor(spread * candidates.length)];
}

/** 안타 수(기본 난이도)와 구종(변주)을 합친 이번 공의 비행 시간(ms). */
export function roundDuration(catches: number, scale: number): number {
  const base = Math.max(ROUND_MS_MIN, ROUND_MS_START - catches * ROUND_MS_STEP);
  return Math.max(ROUND_MS_FLOOR, Math.round(base * scale));
}
