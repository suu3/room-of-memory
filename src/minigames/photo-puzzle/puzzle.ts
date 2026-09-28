/**
 * 조각난 사진 퍼즐의 규칙. 브라우저 없이 검증할 수 있도록 순수 함수만 둔다.
 *
 * 두 조각 맞바꾸기다 (2026-09-28). 처음엔 빈칸으로 미는 슬라이딩 퍼즐이었는데, 맞는
 * 조각도 길을 내주려고 다시 비켜야 해서 클라이맥스 직전에 붙잡는 벽이 됐다. 맞바꾸기는
 * 한 번 제자리에 들어간 조각이 그대로 남으므로 되돌아가는 수가 없다: 많아야 여덟 번이면
 * 끝난다. 키보드로는 방향키로 칸을 고르고 Enter로 집고 놓는다 (.claude/rules/minigames.md).
 */

export const PUZZLE_SIZE = 3;
export const TILE_COUNT = PUZZLE_SIZE * PUZZLE_SIZE;

/** board[자리] = 그 자리에 놓인 조각. 맞춘 상태는 자리와 조각이 같은 상태다. */
export type Board = readonly number[];

/** 칸 고르기의 방향: 방향키가 그대로 이 값이 된다. */
export type CursorDirection = "up" | "down" | "left" | "right";

/** 섞은 판에서 처음부터 제자리인 조각의 상한. 너무 많으면 풀 것이 없다. */
const MAX_PLACED_AT_START = 2;

export function solvedBoard(): Board {
  return Array.from({ length: TILE_COUNT }, (_, index) => index);
}

export function isSolved(board: Board): boolean {
  return board.every((tile, index) => tile === index);
}

/** 그 자리의 조각이 제자리에 들어가 있는가. 들어간 조각은 더 못 집는다. */
export function isPlaced(board: Board, index: number): boolean {
  return board[index] === index;
}

/** 두 자리의 조각을 맞바꾼다. 같은 자리거나 범위 밖이면 원본을 그대로 돌려준다. */
export function swap(board: Board, a: number, b: number): Board {
  if (a === b || a < 0 || b < 0 || a >= TILE_COUNT || b >= TILE_COUNT) return board;
  const next = [...board];
  next[a] = board[b];
  next[b] = board[a];
  return next;
}

/**
 * 섞은 판. 맞바꾸기는 어떤 배치든 풀 수 있으므로(슬라이딩의 패리티 문제가 없다)
 * 통째로 뒤섞는다. 정답이거나 제자리 조각이 너무 많은 배치는 다시 뽑는다.
 */
export function shuffledBoard(random: () => number): Board {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const board = [...solvedBoard()];
    for (let index = board.length - 1; index > 0; index -= 1) {
      const pick = Math.min(index, Math.floor(random() * (index + 1)));
      [board[index], board[pick]] = [board[pick], board[index]];
    }
    const placed = board.filter((tile, index) => tile === index).length;
    if (placed <= MAX_PLACED_AT_START) return board;
  }
  // 여기까지 오면 무작위원이 상수를 뱉고 있다는 뜻: 한 칸씩 돌려 모두 어긋나게 한다
  return solvedBoard().map((_, index) => (index + 1) % TILE_COUNT);
}

/** 방향키로 칸을 옮긴다. 가장자리에서는 그 자리에 머문다. */
export function moveCursor(index: number, direction: CursorDirection): number {
  const row = Math.floor(index / PUZZLE_SIZE);
  const col = index % PUZZLE_SIZE;
  switch (direction) {
    case "left":
      return col > 0 ? index - 1 : index;
    case "right":
      return col < PUZZLE_SIZE - 1 ? index + 1 : index;
    case "up":
      return row > 0 ? index - PUZZLE_SIZE : index;
    case "down":
      return row < PUZZLE_SIZE - 1 ? index + PUZZLE_SIZE : index;
  }
}

/** 조각이 사진의 어느 부분인지: CSS background-position(%)으로 그대로 쓴다. */
export function tileBackgroundPosition(tile: number): { x: number; y: number } {
  const span = PUZZLE_SIZE - 1;
  return {
    x: ((tile % PUZZLE_SIZE) / span) * 100,
    y: (Math.floor(tile / PUZZLE_SIZE) / span) * 100,
  };
}
