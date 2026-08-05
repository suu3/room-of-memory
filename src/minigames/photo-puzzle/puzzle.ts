/**
 * 조각난 사진 퍼즐의 규칙. 브라우저 없이 검증할 수 있도록 순수 함수만 둔다.
 *
 * 슬라이딩 퍼즐을 고른 이유는 조작이다. 조각을 집어 옮기는 직소는 사실상
 * 드래그 전용이라 키보드만으로 못 푸는데, 미니게임은 키보드만으로 플레이할 수
 * 있어야 한다 (.claude/rules/minigames.md). 빈칸을 미는 방식은 방향키 네 개로 끝난다.
 */

export const PUZZLE_SIZE = 3;
export const TILE_COUNT = PUZZLE_SIZE * PUZZLE_SIZE;
/** 빈칸이 되는 조각. 사진의 오른쪽 아래 한 칸이 비어 있는 셈이다. */
export const BLANK_TILE = TILE_COUNT - 1;

/** board[자리] = 그 자리에 놓인 조각. 맞춘 상태는 자리와 조각이 같은 상태다. */
export type Board = readonly number[];

/** 조각이 미끄러지는 방향 — 방향키가 그대로 이 값이 된다. */
export type SlideDirection = "up" | "down" | "left" | "right";

export function solvedBoard(): Board {
  return Array.from({ length: TILE_COUNT }, (_, index) => index);
}

export function isSolved(board: Board): boolean {
  return board.every((tile, index) => tile === index);
}

export function blankIndex(board: Board): number {
  return board.indexOf(BLANK_TILE);
}

/** 빈칸과 자리를 맞바꿀 수 있는가 — 같은 행/열에서 딱 한 칸 떨어져 있어야 한다. */
export function canMove(board: Board, index: number): boolean {
  if (index < 0 || index >= TILE_COUNT) return false;
  const blank = blankIndex(board);
  const rowDelta = Math.abs(Math.floor(index / PUZZLE_SIZE) - Math.floor(blank / PUZZLE_SIZE));
  const colDelta = Math.abs((index % PUZZLE_SIZE) - (blank % PUZZLE_SIZE));
  return rowDelta + colDelta === 1;
}

/** 못 움직이는 자리를 누르면 원본을 그대로 돌려준다 (호출부가 판정할 필요 없게). */
export function moveAt(board: Board, index: number): Board {
  if (!canMove(board, index)) return board;
  const blank = blankIndex(board);
  const next = [...board];
  next[blank] = board[index];
  next[index] = BLANK_TILE;
  return next;
}

/**
 * 그 방향으로 미끄러질 조각의 자리. "왼쪽"은 빈칸의 오른쪽 조각이 왼쪽으로
 * 밀려오는 것이다 — 화면에서 움직이는 방향과 키가 일치한다.
 */
export function slideSource(board: Board, direction: SlideDirection): number {
  const blank = blankIndex(board);
  const row = Math.floor(blank / PUZZLE_SIZE);
  const col = blank % PUZZLE_SIZE;
  switch (direction) {
    case "left":
      return col + 1 < PUZZLE_SIZE ? blank + 1 : -1;
    case "right":
      return col - 1 >= 0 ? blank - 1 : -1;
    case "up":
      return row + 1 < PUZZLE_SIZE ? blank + PUZZLE_SIZE : -1;
    case "down":
      return row - 1 >= 0 ? blank - PUZZLE_SIZE : -1;
  }
}

export function slide(board: Board, direction: SlideDirection): Board {
  return moveAt(board, slideSource(board, direction));
}

/**
 * 맞춘 판에서 무작위 수를 되짚어 섞는다.
 *
 * 조각을 통째로 뒤섞으면 절반은 풀 수 없는 배치가 나온다(15퍼즐의 패리티). 합법
 * 수만 밟으면 풀 수 있다는 것이 공짜로 보장된다. 직전 자리로 되돌아가는 수는
 * 빼서 제자리걸음을 막는다.
 */
export function scramble(moves: number, random: () => number): Board {
  let board = solvedBoard();
  let previousBlank = -1;
  for (let step = 0; step < moves; step += 1) {
    const blank = blankIndex(board);
    const candidates = Array.from({ length: TILE_COUNT }, (_, index) => index).filter(
      (index) => canMove(board, index) && index !== previousBlank,
    );
    if (candidates.length === 0) continue;
    const picked =
      candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
    board = moveAt(board, picked);
    previousBlank = blank;
  }
  return board;
}

/**
 * 섞되 이미 맞춰진 판이 나오지 않게 한다. 첫 화면이 정답이면 게임이 성립하지 않는다.
 * 되돌이 수를 뺐어도 짝수 번 되돌아오는 경로는 남으므로 결과를 확인해야 한다.
 */
export function scrambledBoard(moves: number, random: () => number): Board {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const board = scramble(moves + attempt, random);
    if (!isSolved(board)) return board;
  }
  // 여기까지 오면 무작위원이 상수를 뱉고 있다는 뜻 — 한 수만 밀어 정답만 피한다
  return slide(solvedBoard(), "left");
}

/** 조각이 사진의 어느 부분인지 — CSS background-position(%)으로 그대로 쓴다. */
export function tileBackgroundPosition(tile: number): { x: number; y: number } {
  const span = PUZZLE_SIZE - 1;
  return {
    x: ((tile % PUZZLE_SIZE) / span) * 100,
    y: (Math.floor(tile / PUZZLE_SIZE) / span) * 100,
  };
}
