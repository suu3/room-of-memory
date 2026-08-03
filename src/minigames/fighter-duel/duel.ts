/**
 * 격투 미니게임의 순수 규칙. 화면 없이 검증할 수 있게 계산만 모아둔다.
 *
 * 가위바위보식 삼각 상성이다 — 상대가 무엇을 낼지 예고(tell)를 보고 받아친다.
 * 반사신경이 아니라 읽기 싸움이라 몇 초 안에 끝나고, 못 읽어도 이야기가 이어진다.
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

export const ROUNDS_TO_WIN = 3;
export const MAX_LOSSES = 3;

export interface DuelScore {
  wins: number;
  losses: number;
}

export const DUEL_START: DuelScore = { wins: 0, losses: 0 };

/** 한 라운드 결과를 점수에 반영한다. 비기면 아무것도 안 쌓인다. */
export function applyOutcome(score: DuelScore, outcome: RoundOutcome): DuelScore {
  if (outcome === "win") return { ...score, wins: score.wins + 1 };
  if (outcome === "lose") return { ...score, losses: score.losses + 1 };
  return score;
}

export type DuelStatus = "playing" | "won" | "lost";

export function duelStatus(score: DuelScore): DuelStatus {
  if (score.wins >= ROUNDS_TO_WIN) return "won";
  if (score.losses >= MAX_LOSSES) return "lost";
  return "playing";
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
