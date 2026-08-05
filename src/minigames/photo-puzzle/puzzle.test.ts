import { describe, expect, it } from "vitest";
import {
  BLANK_TILE,
  type Board,
  blankIndex,
  canMove,
  isSolved,
  moveAt,
  PUZZLE_SIZE,
  scramble,
  scrambledBoard,
  slide,
  slideSource,
  solvedBoard,
  TILE_COUNT,
  tileBackgroundPosition,
} from "./puzzle";

/** 0,1,2,… 를 차례로 뱉는 결정적 무작위원 — 섞기를 재현 가능하게 만든다. */
function cyclicRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("판 뒤집기", () => {
  it("맞춘 판은 자리와 조각이 같다", () => {
    expect(isSolved(solvedBoard())).toBe(true);
    expect(blankIndex(solvedBoard())).toBe(TILE_COUNT - 1);
  });

  it("빈칸과 맞닿은 자리만 움직인다", () => {
    const board = solvedBoard();
    const blank = blankIndex(board);

    expect(canMove(board, blank - 1)).toBe(true);
    expect(canMove(board, blank - PUZZLE_SIZE)).toBe(true);
    // 대각선은 맞닿은 것이 아니다
    expect(canMove(board, blank - PUZZLE_SIZE - 1)).toBe(false);
    // 판 밖
    expect(canMove(board, TILE_COUNT)).toBe(false);
    expect(canMove(board, -1)).toBe(false);
  });

  it("못 움직이는 자리를 누르면 판이 그대로다", () => {
    const board = solvedBoard();

    expect(moveAt(board, 0)).toBe(board);
  });

  it("한 번 민 판을 되밀면 원래대로 돌아온다", () => {
    const board = solvedBoard();
    const moved = moveAt(board, blankIndex(board) - 1);

    expect(isSolved(moved)).toBe(false);
    expect(isSolved(moveAt(moved, blankIndex(board)))).toBe(true);
  });
});

describe("방향키", () => {
  it("빈칸 반대편 조각이 그 방향으로 밀려온다", () => {
    const board = solvedBoard();
    const blank = blankIndex(board);

    // 오른쪽 아래가 비어 있으니 왼쪽·위로는 밀어올 조각이 없다
    expect(slideSource(board, "left")).toBe(-1);
    expect(slideSource(board, "up")).toBe(-1);
    expect(slideSource(board, "right")).toBe(blank - 1);
    expect(slideSource(board, "down")).toBe(blank - PUZZLE_SIZE);
  });

  it("밀 수 없는 방향은 판을 바꾸지 않는다", () => {
    const board = solvedBoard();

    expect(slide(board, "left")).toBe(board);
  });

  it("네 방향만으로 맞춘 판을 흐트러뜨렸다 되돌릴 수 있다", () => {
    let board: Board = solvedBoard();
    board = slide(board, "right");
    board = slide(board, "down");
    expect(isSolved(board)).toBe(false);

    board = slide(board, "up");
    board = slide(board, "left");
    expect(isSolved(board)).toBe(true);
  });
});

describe("섞기", () => {
  it("합법 수만 밟으므로 언제나 풀 수 있는 배치가 나온다", () => {
    // 합법 수의 결과라는 것 자체가 풀이 가능성의 증명이다 — 조각 구성이 온전한지 본다
    for (let seed = 0; seed < 12; seed += 1) {
      const board = scramble(30, cyclicRandom([seed / 12, 0.5, 0.9, 0.2]));
      expect([...board].sort((a, b) => a - b)).toEqual(
        Array.from({ length: TILE_COUNT }, (_, index) => index),
      );
    }
  });

  it("첫 화면이 정답인 판은 내놓지 않는다", () => {
    // 늘 0을 뱉는 무작위원은 되돌이 경로를 타기 쉬워 정답으로 되돌아오기 쉽다
    expect(isSolved(scrambledBoard(24, () => 0))).toBe(false);
    expect(isSolved(scrambledBoard(24, () => 0.999))).toBe(false);
    expect(isSolved(scrambledBoard(24, Math.random))).toBe(false);
  });

  it("빈칸은 하나뿐이다", () => {
    const board = scrambledBoard(24, cyclicRandom([0.1, 0.7, 0.4, 0.95]));

    expect(board.filter((tile) => tile === BLANK_TILE)).toHaveLength(1);
  });
});

describe("조각이 사진의 어느 부분인지", () => {
  it("첫 조각은 왼쪽 위, 마지막 조각은 오른쪽 아래다", () => {
    expect(tileBackgroundPosition(0)).toEqual({ x: 0, y: 0 });
    expect(tileBackgroundPosition(TILE_COUNT - 1)).toEqual({ x: 100, y: 100 });
  });

  it("같은 행의 조각은 세로 위치가 같다", () => {
    expect(tileBackgroundPosition(0).y).toBe(tileBackgroundPosition(PUZZLE_SIZE - 1).y);
  });
});
