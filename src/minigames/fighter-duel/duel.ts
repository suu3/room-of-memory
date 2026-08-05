/**
 * 격투 미니게임의 순수 규칙. 화면 없이 검증할 수 있게 계산만 모아둔다.
 *
 * 뼈대는 가위바위보식 삼각 상성이다 — 상대가 무엇을 낼지 예고(tell)를 보고 받아친다.
 * 반사신경이 아니라 읽기 싸움이라 몇 초 안에 끝나고, 못 읽어도 이야기가 이어진다.
 *
 * 그 위에 격투 게임의 문법을 얹었다. 판수를 세는 대신 체력을 깎고, 연속으로
 * 읽어내면 더 아프게 들어가고(콤보), 빨리 읽으면 한 방이 커진다(간파).
 * 대신 상대는 예고를 도중에 바꾼다(페인트) — 서두르면 그 페인트에 당한다.
 *
 * 이 셋이 하나의 선택으로 묶인다: **지금 낼 것인가, 한 박자 더 볼 것인가.**
 * 빨리 내면 간파 보너스, 기다리면 페인트에 안 속는다. 어느 쪽도 공짜가 아니다.
 */

export type Move = "strike" | "guard" | "throw";

export const MOVES: readonly Move[] = ["strike", "guard", "throw"];

/** 무엇이 무엇을 이기는가. 때리기 > 잡기 > 막기 > 때리기. */
const BEATS: Record<Move, Move> = {
  strike: "throw",
  throw: "guard",
  guard: "strike",
};

export type RoundOutcome = "win" | "lose" | "draw";

export function resolveRound(player: Move, opponent: Move): RoundOutcome {
  if (player === opponent) return "draw";
  return BEATS[player] === opponent ? "win" : "lose";
}

/** 상대 예고를 받아치는 수 — 화면의 힌트가 가리키는 정답. */
export function counterTo(move: Move): Move {
  const counter = MOVES.find((candidate) => BEATS[candidate] === move);
  // BEATS는 전단사라 항상 답이 있다. 타입 좁히기용 기본값.
  return counter ?? "strike";
}

/* ------------------------------------------------------------------ 체력 */

export const MAX_HP = 100;

/**
 * 한 방의 기본 대미지. 끊기지 않고 다섯 번을 읽어내면 KO, 다섯 번 맞으면 진다 —
 * 판이 늘어지지 않으면서도 한 번 삐끗한 걸로 끝나지는 않는 길이.
 */
export const BASE_DAMAGE = 16;
/** 연속으로 읽어낼 때마다 붙는 가산. */
export const COMBO_STEP = 4;
/** 콤보 가산 상한(연승 수 기준). 그 위로는 더 붙지 않는다. */
export const COMBO_CAP = 5;
/** 간파(빠른 반응) 배수. 다 간파하면 한 라운드를 앞당긴다. */
export const CRITICAL_SCALE = 1.5;

/** 상대의 기본 대미지와 라운드마다 붙는 가산 — 오래 끌수록 상대가 매워진다. */
export const RIVAL_BASE_DAMAGE = 18;
export const RIVAL_RAMP = 3;
export const RIVAL_DAMAGE_CAP = 30;

export interface DuelState {
  heroHp: number;
  rivalHp: number;
  /** 연속으로 읽어낸 횟수. 맞으면 0으로 돌아간다. */
  combo: number;
  /** 지금까지 치른 라운드 수. 난이도 곡선의 축. */
  round: number;
}

export const DUEL_START: DuelState = { heroHp: MAX_HP, rivalHp: MAX_HP, combo: 0, round: 0 };

export interface RoundResolution {
  /** 시간 안에 아무것도 안 냈으면 null. */
  player: Move | null;
  /** 상대가 실제로 낸 수 (페인트했다면 바꾼 쪽). */
  opponent: Move;
  outcome: RoundOutcome;
  /** 예고를 보고 CRITICAL_MS 안에 받아쳤는가. */
  critical: boolean;
}

/** 이번 승리를 포함한 연승 수(1부터)로 계산한다. */
export function heroDamage(combo: number, critical: boolean): number {
  const bonus = COMBO_STEP * (Math.min(Math.max(combo, 1), COMBO_CAP) - 1);
  return Math.round((BASE_DAMAGE + bonus) * (critical ? CRITICAL_SCALE : 1));
}

export function rivalDamage(round: number): number {
  return Math.min(RIVAL_DAMAGE_CAP, RIVAL_BASE_DAMAGE + RIVAL_RAMP * round);
}

/** 이 라운드에서 실제로 깎이는 체력. 0이면 아무도 안 맞았다는 뜻(무승부). */
export function damageOf(state: DuelState, resolution: RoundResolution): number {
  if (resolution.outcome === "win") return heroDamage(state.combo + 1, resolution.critical);
  if (resolution.outcome === "lose") return rivalDamage(state.round);
  return 0;
}

/**
 * 한 라운드 결과를 상태에 반영한다.
 *
 * 무승부는 아무도 안 맞지만 콤보도 안 끊는다 — 같은 수를 낸 건 읽기에 실패한
 * 것이지 손해를 본 게 아니다. 여기서까지 콤보를 끊으면 운에 벌을 주는 게 된다.
 */
export function applyRound(state: DuelState, resolution: RoundResolution): DuelState {
  const damage = damageOf(state, resolution);
  const round = state.round + 1;
  if (resolution.outcome === "win") {
    return {
      ...state,
      round,
      rivalHp: Math.max(0, state.rivalHp - damage),
      combo: state.combo + 1,
    };
  }
  if (resolution.outcome === "lose") {
    return { ...state, round, heroHp: Math.max(0, state.heroHp - damage), combo: 0 };
  }
  return { ...state, round };
}

export type DuelStatus = "playing" | "won" | "lost";

export function duelStatus(state: DuelState): DuelStatus {
  if (state.rivalHp <= 0) return "won";
  if (state.heroHp <= 0) return "lost";
  return "playing";
}

/** 0~1. 체력 게이지 폭과 상대의 각성 판정에 같이 쓴다. */
export function hpRatio(hp: number): number {
  return Math.min(1, Math.max(0, hp / MAX_HP));
}

/* -------------------------------------------------------------- 시간 압박 */

/** 첫 라운드의 예고 시간. 짧으면 반사신경 게임이 되고, 길면 긴장이 없다. */
export const TELL_START_MS = 1700;
/** 아무리 몰려도 여기보다 짧아지지 않는다 — 읽을 시간은 남겨 둔다. */
export const TELL_FLOOR_MS = 950;
export const TELL_STEP_MS = 80;
/** 상대가 이 체력 아래로 떨어지면 각성한다. */
export const RAGE_HP_RATIO = 0.35;
export const RAGE_CUT_MS = 160;

/**
 * 이번 라운드의 예고 시간.
 *
 * 라운드가 갈수록 짧아지고, 상대가 몰리면 한 번 더 짧아진다. 궁지에서 빨라지는 건
 * 격투 게임의 관용구이기도 하지만, 여기서는 "다 이겼다" 뒤의 마지막 한 방이
 * 제일 어려워야 이긴 게 이긴 것으로 남기 때문이다.
 */
export function tellDurationMs(round: number, rivalHp: number): number {
  const byRound = TELL_START_MS - TELL_STEP_MS * round;
  const rage = hpRatio(rivalHp) <= RAGE_HP_RATIO ? RAGE_CUT_MS : 0;
  return Math.max(TELL_FLOOR_MS, byRound - rage);
}

/** 상대가 각성했는가 — 화면이 이걸 붉은 기색으로 알린다. */
export function isEnraged(rivalHp: number): boolean {
  return rivalHp > 0 && hpRatio(rivalHp) <= RAGE_HP_RATIO;
}

/**
 * 간파 판정 시간. 예고가 화면에 뜬 순간부터 잰다 — 페인트로 자세가 바뀌면
 * 거기서 다시 0이다. 바뀐 걸 빨리 읽어낸 것도 똑같이 읽어낸 것이다.
 */
export const CRITICAL_MS = 520;

export function isCritical(elapsedMs: number): boolean {
  return elapsedMs <= CRITICAL_MS;
}

/* ----------------------------------------------------------------- 페인트 */

/**
 * 페인트가 나오기 시작하는 라운드(0-based). 첫 판은 규칙을 익히는 시간이다.
 *
 * 판이 다섯 판 안팎에서 끝나므로 확률을 아끼면 페인트를 한 번도 못 보고 이기는
 * 판이 생긴다 — 규칙의 절반을 못 만나는 셈이라 두 번째 판부터 꽤 자주 건다.
 */
export const FEINT_FROM_ROUND = 1;
/** 예고 시간의 어느 지점에서 자세를 바꾸는가. 바꾼 뒤에 절반 넘게 남아야 한다. */
export const FEINT_AT = 0.38;
export const FEINT_CHANCE_STEP = 0.22;
export const FEINT_CHANCE_CAP = 0.5;

export function feintChance(round: number): number {
  if (round < FEINT_FROM_ROUND) return 0;
  return Math.min(FEINT_CHANCE_CAP, FEINT_CHANCE_STEP * (round - FEINT_FROM_ROUND + 1));
}

export function shouldFeint(round: number, roll: number): boolean {
  return roll < feintChance(round);
}

/** 습관으로 볼 최근 수의 개수와, 그중 몇 번 나와야 습관인가. */
export const HABIT_WINDOW = 4;
export const HABIT_THRESHOLD = 3;

/**
 * 플레이어의 버릇을 읽는다. 최근 HABIT_WINDOW 수 중 같은 수가
 * HABIT_THRESHOLD번 이상이면 그 수를 돌려준다.
 */
export function readHabit(history: readonly Move[]): Move | null {
  const recent = history.slice(-HABIT_WINDOW);
  for (const move of MOVES) {
    if (recent.filter((played) => played === move).length >= HABIT_THRESHOLD) return move;
  }
  return null;
}

/**
 * 페인트로 바꿔 낼 수.
 *
 * 기본값은 "예고를 보고 받아칠 사람"을 잡는 수다 — 플레이어가 낼 counterTo(tell)를
 * 이기는 쪽. 여기에 버릇이 읽히면 그쪽을 우선한다: 같은 버튼만 누르면 페인트가
 * 정확히 그 버튼을 노린다. 무작위가 아니라 읽혀서 당하는 것이어야 분하다.
 */
export function feintTo(tell: Move, history: readonly Move[] = []): Move {
  const habit = readHabit(history);
  if (habit) {
    const punish = counterTo(habit);
    // 예고와 같은 수면 페인트가 아니게 된다 — 그때는 기본값으로 돌아간다.
    if (punish !== tell) return punish;
  }
  return counterTo(counterTo(tell));
}

/**
 * 다음 상대 수. 인덱스로 정해지는 해시라 같은 판이면 같은 순서가 나온다 —
 * 매번 뒤집히면 "읽었다"는 감각이 안 생긴다.
 */
export function opponentMove(round: number, salt: number): Move {
  const value = Math.sin((round + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  const fraction = value - Math.floor(value);
  return MOVES[Math.floor(fraction * MOVES.length) % MOVES.length];
}

export interface RoundPlan {
  /** 처음 보여주는 예고. */
  tell: Move;
  /** 도중에 바꿔 낼 수. 페인트가 없으면 null. */
  feint: Move | null;
  /** 이 라운드의 예고 시간(ms). */
  durationMs: number;
}

/**
 * 한 라운드를 통째로 짠다. 무작위는 전부 `roll`로 주입받아 이 함수는 순수하게 남는다.
 */
export function planRound(
  state: DuelState,
  salt: number,
  history: readonly Move[],
  roll: number,
): RoundPlan {
  const tell = opponentMove(state.round, salt);
  return {
    tell,
    feint: shouldFeint(state.round, roll) ? feintTo(tell, history) : null,
    durationMs: tellDurationMs(state.round, state.rivalHp),
  };
}
