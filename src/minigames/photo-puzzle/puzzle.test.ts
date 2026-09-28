import { describe, expect, it } from "vitest";
import {
  isPlaced,
  isSolved,
  moveCursor,
  PUZZLE_SIZE,
  shuffledBoard,
  solvedBoard,
  swap,
  TILE_COUNT,
  tileBackgroundPosition,
} from "./puzzle";

/** 정해 둔 값을 차례로 뱉는 결정적 무작위원: 섞기를 재현 가능하게 만든다. */
function cyclicRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("맞바꾸기", () => {
  it("맞춘 판은 자리와 조각이 같다", () => {
    expect(isSolved(solvedBoard())).toBe(true);
    expect(isPlaced(solvedBoard(), 4)).toBe(true);
  });

  it("두 자리를 바꾸고, 같은 자리나 범위 밖이면 그대로 둔다", () => {
    const board = solvedBoard();
    const swapped = swap(board, 0, 8);
    expect(swapped[0]).toBe(8);
    expect(swapped[8]).toBe(0);
    expect(isSolved(swapped)).toBe(false);
    expect(swap(swapped, 0, 8)).toEqual(board);
    expect(swap(board, 3, 3)).toBe(board);
    expect(swap(board, -1, 3)).toBe(board);
  });
});

describe("섞기", () => {
  it("조각을 하나씩 다 쓰고, 정답이 아니며, 제자리 조각은 많아야 둘이다", () => {
    for (const seed of [0.1, 0.37, 0.52, 0.9]) {
      const board = shuffledBoard(cyclicRandom([seed, 0.73, 0.21, 0.64, 0.05]));
      expect([...board].sort((a, b) => a - b)).toEqual(solvedBoard());
      expect(isSolved(board)).toBe(false);
      expect(board.filter((_, index) => isPlaced(board, index)).length).toBeLessThanOrEqual(2);
    }
  });

  it("무작위원이 상수만 뱉어도 풀 것이 남는다", () => {
    const board = shuffledBoard(() => 0.999);
    expect(isSolved(board)).toBe(false);
  });

  it("어떤 섞음이든 여덟 번 안에 맞춰진다 (제자리에 하나씩 넣으면)", () => {
    let board = shuffledBoard(cyclicRandom([0.3, 0.8, 0.1, 0.6]));
    let swaps = 0;
    for (let index = 0; index < TILE_COUNT; index += 1) {
      if (isPlaced(board, index)) continue;
      board = swap(board, index, board.indexOf(index));
      swaps += 1;
    }
    expect(isSolved(board)).toBe(true);
    expect(swaps).toBeLessThanOrEqual(TILE_COUNT - 1);
  });
});

describe("칸 고르기", () => {
  it("방향키로 옆 칸에 가고, 가장자리에서는 머문다", () => {
    const center = Math.floor(TILE_COUNT / 2);
    expect(moveCursor(center, "left")).toBe(center - 1);
    expect(moveCursor(center, "right")).toBe(center + 1);
    expect(moveCursor(center, "up")).toBe(center - PUZZLE_SIZE);
    expect(moveCursor(center, "down")).toBe(center + PUZZLE_SIZE);
    expect(moveCursor(0, "left")).toBe(0);
    expect(moveCursor(0, "up")).toBe(0);
    expect(moveCursor(TILE_COUNT - 1, "right")).toBe(TILE_COUNT - 1);
    expect(moveCursor(TILE_COUNT - 1, "down")).toBe(TILE_COUNT - 1);
  });
});

describe("사진 자르기", () => {
  it("조각마다 사진의 삼분의 일을 가리킨다", () => {
    expect(tileBackgroundPosition(0)).toEqual({ x: 0, y: 0 });
    expect(tileBackgroundPosition(PUZZLE_SIZE - 1)).toEqual({ x: 100, y: 0 });
    expect(tileBackgroundPosition(TILE_COUNT - 1)).toEqual({ x: 100, y: 100 });
  });
});
