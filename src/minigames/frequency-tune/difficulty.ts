/**
 * 주파수 맞추기의 난이도 곡선.
 *
 * 5번을 같은 난이도로 반복시키면 3번째부터는 지루한 반복이 된다 — 명중할 때마다
 * 대역이 좁아지고 바늘이 빨라져서, 뒤로 갈수록 "겨우 잡는" 판이 되게 한다.
 */

/** 클리어에 필요한 명중 횟수. */
export const GOAL_HITS = 5;
/** 이만큼 놓치면 실패 — 실패도 유효한 결말이다(.claude/rules/minigames.md). */
export const MAX_MISSES = 5;

/** 첫 판의 목표 대역 폭 (%). */
export const BAND_WIDTH_MAX = 14;
/** 마지막 판의 목표 대역 폭 (%) — 이 아래로는 눈으로 조준이 안 된다. */
export const BAND_WIDTH_MIN = 8;
/** 명중 1회당 좁아지는 폭 (%). */
const BAND_WIDTH_STEP = 1.5;

/** 첫 판의 바늘 왕복 주기 (ms). */
export const NEEDLE_PERIOD_MAX_MS = 4200;
/** 마지막 판의 주기 (ms) — 이보다 빠르면 반응이 아니라 운이 된다. */
export const NEEDLE_PERIOD_MIN_MS = 2600;
/** 명중 1회당 줄어드는 주기 (ms). */
const NEEDLE_SPEEDUP_MS = 400;

/** 지금까지 명중한 횟수에 대한 목표 대역 폭 (%). */
export function bandWidthAt(hits: number): number {
  return Math.max(BAND_WIDTH_MIN, BAND_WIDTH_MAX - hits * BAND_WIDTH_STEP);
}

/** 지금까지 명중한 횟수에 대한 바늘 왕복 주기 (ms). */
export function needlePeriodAt(hits: number): number {
  return Math.max(NEEDLE_PERIOD_MIN_MS, NEEDLE_PERIOD_MAX_MS - hits * NEEDLE_SPEEDUP_MS);
}

/** 다이얼 양 끝에 붙지 않는 위치로 목표 대역을 놓는다. */
export function randomBandLeft(bandWidth: number): number {
  return 6 + Math.random() * (100 - bandWidth - 12);
}

/** 잡음이 완전히 걷히지는 않는다 — 대역 한가운데서도 남는 양. */
const STATIC_FLOOR = 0.08;
/** 이 거리(%)만큼 벗어나면 잡음이 최대가 된다. */
const STATIC_FALLOFF = 45;

/**
 * 바늘이 목표 대역에서 멀수록 잡음이 커진다.
 *
 * 눈으로만 맞추는 게임이었는데, 귀로도 조준할 수 있게 하면 난이도가 아니라 감각이
 * 붙는다 — 실제 라디오를 맞출 때 우리가 보는 건 눈금이 아니라 잡음이 걷히는 지점이다.
 */
export function staticLevel(position: number, bandLeft: number, bandWidth: number): number {
  const inner = bandWidth / 2;
  const distance = Math.abs(position - (bandLeft + inner));
  if (distance <= inner) return STATIC_FLOOR;
  return Math.min(1, STATIC_FLOOR + ((distance - inner) / STATIC_FALLOFF) * (1 - STATIC_FLOOR));
}
