import { describe, expect, it } from "vitest";
import { isOrdered, PAPER_IDS, papersInPlace, SCATTERED, swapPapers } from "./papers";

describe("papers-order", () => {
  it("처음 판은 한 조각도 제자리에 있지 않다", () => {
    expect(isOrdered(SCATTERED)).toBe(false);
    expect(papersInPlace(SCATTERED)).toBe(0);
    expect([...SCATTERED].sort()).toEqual([...PAPER_IDS].sort());
  });

  it("맞바꿔 날짜순이 되면 맞은 것이다", () => {
    let order = swapPapers(SCATTERED, 0, 1); // p1 p3 p4 p2
    order = swapPapers(order, 1, 3); // p1 p2 p4 p3
    expect(isOrdered(order)).toBe(false);
    order = swapPapers(order, 2, 3);
    expect(isOrdered(order)).toBe(true);
  });

  it("범위 밖의 맞바꿈은 무시한다", () => {
    expect(swapPapers(SCATTERED, 0, 9)).toEqual(SCATTERED);
    expect(swapPapers(SCATTERED, 2, 2)).toEqual(SCATTERED);
  });
});
