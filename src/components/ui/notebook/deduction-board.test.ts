import { describe, expect, it } from "vitest";
import { MEMORY_IDS } from "@/data/memory-room";
import { boardCards, hintedCards, pickCard } from "./deduction-board";

describe("추리 판", () => {
  it("카드는 2차 조사를 마친 기록만, 수첩에 실린 순서대로 놓인다", () => {
    const cards = boardCards(["shoes", "radio", "fridge"]);
    expect(cards).toHaveLength(3);
    expect(cards).toEqual(MEMORY_IDS.filter((id) => cards.includes(id)));
  });

  it("어긋날수록 답을 한 장, 또 두 장 짚어 준다. 이지는 더 일찍 짚는다", () => {
    expect(hintedCards("trip-doubt", 2, false)).toEqual([]);
    expect(hintedCards("trip-doubt", 3, false)).toEqual(["fridge"]);
    expect(hintedCards("trip-doubt", 5, false)).toEqual(["fridge", "shoes"]);
    expect(hintedCards("trip-doubt", 0, true)).toEqual([]);
    expect(hintedCards("trip-doubt", 1, true)).toEqual(["fridge"]);
    expect(hintedCards("trip-doubt", 3, true)).toEqual(["fridge", "shoes"]);
  });

  it("고른 것을 다시 누르면 내려놓고, 어긋난 한 쌍 위에서 누르면 그 카드부터 새로 고른다", () => {
    expect(pickCard([], "fridge")).toEqual(["fridge"]);
    expect(pickCard(["fridge"], "shoes")).toEqual(["fridge", "shoes"]);
    expect(pickCard(["fridge"], "fridge")).toEqual([]);
    expect(pickCard(["fridge", "computer"], "shoes")).toEqual(["shoes"]);
    expect(pickCard(["fridge", "computer"], "fridge")).toEqual(["fridge"]);
  });
});
