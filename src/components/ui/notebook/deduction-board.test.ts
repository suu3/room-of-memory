import { describe, expect, it } from "vitest";
import { DEDUCTION_IDS, DEDUCTIONS } from "@/data/deductions";
import { MEMORY_IDS } from "@/data/memory-room";
import { BOARD_CARD_LIMIT, boardCards, hintedCards, pickCard } from "./deduction-board";

describe("추리 판", () => {
  it("카드는 2차 조사를 마친 기록만, 수첩에 실린 순서대로 놓인다", () => {
    const cards = boardCards("trip-doubt", ["shoes", "radio", "fridge"]);
    expect(cards).toHaveLength(3);
    expect(cards).toEqual(MEMORY_IDS.filter((id) => cards.includes(id)));
  });

  it("여덟 장을 넘으면 덜어 내되 답과 단서는 남기고, 순서는 수첩 그대로다", () => {
    // 4페이즈: 2차 조사가 있는 기억을 전부 마쳤다
    const all = [...MEMORY_IDS];
    for (const id of DEDUCTION_IDS) {
      const cards = boardCards(id, all);
      expect(cards, id).toHaveLength(BOARD_CARD_LIMIT);
      for (const memory of DEDUCTIONS[id].needs) expect(cards, id).toContain(memory);
      expect(cards, id).toEqual(MEMORY_IDS.filter((memory) => cards.includes(memory)));
    }
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
