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

/**
 * 2바퀴에서 같은 다이얼을 다시 돌린다. 판 수를 줄이고 대역을 넓혀 두는 이유는
 * 난이도 조절이 아니라 이야기다 — 1바퀴의 라디오는 잡히지 않는 물건이었고,
 * 2바퀴의 라디오는 저쪽에서 이미 부르고 있는 물건이다. 손이 덜 드는 것이 맞다.
 */
export const SECOND_ROUND_GOAL_HITS = 3;
/** 2바퀴의 대역 보정 (%). 첫 판이 넓게 시작해 "이미 거의 잡혀 있다"로 읽힌다. */
const SECOND_ROUND_BAND_BONUS = 5;

/** 그 바퀴의 목표 명중 횟수. */
export function goalHitsFor(gamePhase: 1 | 2): number {
  return gamePhase === 2 ? SECOND_ROUND_GOAL_HITS : GOAL_HITS;
}

/** 그 바퀴의 대역 보정 — 2바퀴는 폭이 한 뼘 넓다. */
export function bandBonusFor(gamePhase: 1 | 2): number {
  return gamePhase === 2 ? SECOND_ROUND_BAND_BONUS : 0;
}

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
export function bandWidthAt(hits: number, bandBonus = 0): number {
  return Math.max(BAND_WIDTH_MIN, BAND_WIDTH_MAX - hits * BAND_WIDTH_STEP) + bandBonus;
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
