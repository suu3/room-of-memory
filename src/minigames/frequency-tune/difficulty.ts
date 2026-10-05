/**
 * 주파수 맞추기의 난이도 곡선.
 *
 * 같은 난이도로 반복시키면 금세 지루한 반복이 된다. 명중할 때마다 대역이 좁아지고
 * 바늘이 빨라져서, 뒤로 갈수록 "겨우 잡는" 판이 되게 한다.
 */

import type { MinigameDifficulty } from "@/types/minigame";

/** 클리어에 필요한 명중 횟수. 2026-09-26에 5에서 3으로: 분기점 앞에서 길게 붙들지 않는다. */
export const GOAL_HITS = 3;
/**
 * 이만큼 놓치면 실패: 실패도 유효한 결말이다(.claude/rules/minigames.md).
 *
 * 명중과 같은 셋이다 (2026-09-26, 8에서). 판이 짧아진 만큼 실패도 짧게 온다.
 * 이지 모드는 그 전에 스킵이 뜬다 (index.tsx의 SKIP_AFTER_MISSES).
 */
export const MAX_MISSES = 3;

/**
 * 난이도별 다이얼. 대역 폭은 %(다이얼 전체 20MHz 기준: 5% = 1MHz), 주기는 바늘이
 * 한 번 왕복하는 시간이다.
 *
 * 이지: 5.6MHz(28%)에서 시작해 5MHz까지, 바늘은 보통의 60% 속도. 보통: 3MHz(15%)에서
 * 2MHz까지. 예전의 14%→8%는 "이지"라는 이름으로 보통보다 어려운 판이었다.
 *
 * 이지의 폭은 2026-10-05에 20%→28%로 넓혔다. 게임이 실제로 내려주는 난이도는 이지뿐인데,
 * 마지막 판(17%, 주기 3.9초)은 바늘이 가장 빠른 한가운데에서 대역을 0.21초 만에 지나갔다.
 * 처음 하는 사람이 못 맞추고 스킵으로 넘어가는 폭이다. 어느 판이든 0.3초는 준다
 * (passWindowMs, 테스트가 지킨다).
 *
 * 주기는 2026-09-16에 전부 3분의 1쯤 줄였다. 바늘이 한 번 왕복하는 데 7초가 걸리니
 * 조준이 어려운 게 아니라 **기다리는 게 지루했다**. 좁히는 건 대역이 맡고, 주기는
 * "지금 움직이고 있다"가 느껴지는 속도를 지킨다. 난이도 사이의 비(약 1.6배)는 그대로다.
 */
export interface DialTuning {
  /** 첫 판의 목표 대역 폭 (%). */
  bandMax: number;
  /** 마지막 판의 목표 대역 폭 (%): 이 아래로는 눈으로 조준이 안 된다. */
  bandMin: number;
  /** 첫 판의 바늘 왕복 주기 (ms). */
  periodMax: number;
  /** 마지막 판의 주기 (ms): 이보다 빠르면 반응이 아니라 운이 된다. */
  periodMin: number;
}

export const DIAL_TUNINGS: Record<MinigameDifficulty, DialTuning> = {
  easy: { bandMax: 28, bandMin: 25, periodMax: 4500, periodMin: 3000 },
  normal: { bandMax: 15, bandMin: 10, periodMax: 2700, periodMin: 1800 },
};

const DEFAULT_DIFFICULTY: MinigameDifficulty = "easy";

/**
 * 2바퀴에서 같은 다이얼을 다시 돌린다. 판 수를 줄이고 대역을 넓혀 두는 이유는
 * 난이도 조절이 아니라 이야기다. 1바퀴의 라디오는 잡히지 않는 물건이었고,
 * 2바퀴의 라디오는 저쪽에서 이미 부르고 있는 물건이다. 손이 덜 드는 것이 맞다.
 */
const SECOND_ROUND_GOAL_HITS = 2;
/** 2바퀴의 대역 보정 (%). 첫 판이 넓게 시작해 "이미 거의 잡혀 있다"로 읽힌다. */
const SECOND_ROUND_BAND_BONUS = 5;

/** 그 바퀴의 목표 명중 횟수. */
export function goalHitsFor(gamePhase: 1 | 2): number {
  return gamePhase === 2 ? SECOND_ROUND_GOAL_HITS : GOAL_HITS;
}

/** 그 바퀴의 대역 보정: 2바퀴는 폭이 한 뼘 넓다. */
export function bandBonusFor(gamePhase: 1 | 2): number {
  return gamePhase === 2 ? SECOND_ROUND_BAND_BONUS : 0;
}

/** 기본 난이도(이지)의 첫 판 대역 폭 (%). 테스트와 조준 가능 하한 검사가 이 값을 본다. */
export const BAND_WIDTH_MAX = DIAL_TUNINGS.easy.bandMax;
/** 기본 난이도의 마지막 판 대역 폭 (%). */
export const BAND_WIDTH_MIN = DIAL_TUNINGS.easy.bandMin;
/** 명중 1회당 좁아지는 폭 (%). */
const BAND_WIDTH_STEP = 1.5;

/** 기본 난이도의 첫 판 주기 (ms). */
export const NEEDLE_PERIOD_MAX_MS = DIAL_TUNINGS.easy.periodMax;
/** 기본 난이도의 마지막 판 주기 (ms). */
export const NEEDLE_PERIOD_MIN_MS = DIAL_TUNINGS.easy.periodMin;
/** 명중 1회당 줄어드는 주기 (ms). 주기를 줄인 만큼 계단도 같이 낮춘다. */
const NEEDLE_SPEEDUP_MS = 300;

/** 지금까지 명중한 횟수에 대한 목표 대역 폭 (%). */
export function bandWidthAt(
  hits: number,
  bandBonus = 0,
  difficulty: MinigameDifficulty = DEFAULT_DIFFICULTY,
): number {
  const tuning = DIAL_TUNINGS[difficulty];
  return Math.max(tuning.bandMin, tuning.bandMax - hits * BAND_WIDTH_STEP) + bandBonus;
}

/** 지금까지 명중한 횟수에 대한 바늘 왕복 주기 (ms). */
export function needlePeriodAt(
  hits: number,
  difficulty: MinigameDifficulty = DEFAULT_DIFFICULTY,
): number {
  const tuning = DIAL_TUNINGS[difficulty];
  return Math.max(tuning.periodMin, tuning.periodMax - hits * NEEDLE_SPEEDUP_MS);
}

/**
 * 바늘이 대역을 지나는 데 걸리는 시간 (ms) 중 가장 짧은 경우. 바늘은 사인으로 움직여
 * 한가운데에서 가장 빠르다 (초당 100π/주기 %).
 */
export function passWindowMs(
  hits: number,
  bandBonus = 0,
  difficulty: MinigameDifficulty = DEFAULT_DIFFICULTY,
): number {
  const peakSpeed = (100 * Math.PI) / needlePeriodAt(hits, difficulty);
  return bandWidthAt(hits, bandBonus, difficulty) / peakSpeed;
}

/** 다이얼 양 끝에 붙지 않는 위치로 목표 대역을 놓는다. */
export function randomBandLeft(bandWidth: number): number {
  return 6 + Math.random() * (100 - bandWidth - 12);
}

/** 잡음이 완전히 걷히지는 않는다. 대역 한가운데서도 남는 양. */
const STATIC_FLOOR = 0.08;
/** 이 거리(%)만큼 벗어나면 잡음이 최대가 된다. */
const STATIC_FALLOFF = 45;

/**
 * 바늘이 목표 대역에서 멀수록 잡음이 커진다.
 *
 * 눈으로만 맞추는 게임이었는데, 귀로도 조준할 수 있게 하면 난이도가 아니라 감각이
 * 붙는다. 실제 라디오를 맞출 때 우리가 보는 건 눈금이 아니라 잡음이 걷히는 지점이다.
 */
export function staticLevel(position: number, bandLeft: number, bandWidth: number): number {
  const inner = bandWidth / 2;
  const distance = Math.abs(position - (bandLeft + inner));
  if (distance <= inner) return STATIC_FLOOR;
  return Math.min(1, STATIC_FLOOR + ((distance - inner) / STATIC_FALLOFF) * (1 - STATIC_FLOOR));
}
