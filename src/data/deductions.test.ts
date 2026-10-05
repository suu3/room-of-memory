import { describe, expect, it } from "vitest";
import {
  DEDUCTION_IDS,
  DEDUCTIONS,
  deductionOfCutscene,
  deductionReady,
  pairSolves,
  pendingDeduction,
} from "./deductions";
import { CUTSCENE_P2_CLOSE, CUTSCENE_TRIP_DOUBT, CUTSCENES, MEMORY_BY_ID } from "./memory-room";

describe("추리 표", () => {
  it("답이 되는 두 장은 조건에 들어 있고, 조건은 전부 2차 조사가 있는 기억이다", () => {
    for (const id of DEDUCTION_IDS) {
      const { needs, answer, cutscene } = DEDUCTIONS[id];
      // 조건에 없는 기록이 답이면 판에 그 카드가 없을 수 있다: 풀 수 없는 물음이 된다
      for (const memory of answer) expect(needs).toContain(memory);
      for (const memory of needs) expect(MEMORY_BY_ID[memory].phase2).toBeDefined();
      expect(answer[0]).not.toBe(answer[1]);
      expect(CUTSCENES[cutscene]).toBeDefined();
    }
  });

  it("단서를 다 봐야 물음이 서고, 이은 뒤에는 다시 서지 않는다", () => {
    expect(deductionReady("trip-doubt", ["fridge", "shoes"])).toBe(false);
    expect(pendingDeduction(["fridge", "shoes"], [])).toBeNull();
    expect(pendingDeduction(["fridge", "shoes", "computer"], [])).toBe("trip-doubt");
    expect(pendingDeduction(["fridge", "shoes", "computer"], ["trip-doubt"])).toBeNull();
  });

  it("결론 컷씬만 추리에 걸린다", () => {
    expect(deductionOfCutscene(CUTSCENE_TRIP_DOUBT)).toBe("trip-doubt");
    expect(deductionOfCutscene(CUTSCENE_P2_CLOSE)).toBeNull();
    // 다시보기에는 컷씬 id가 없다
    expect(deductionOfCutscene(undefined)).toBeNull();
  });

  it("두 장은 순서 없이 맞아야 하고, 한 장을 두 번 고른 것은 답이 아니다", () => {
    expect(pairSolves("trip-doubt", ["fridge", "shoes"])).toBe(true);
    expect(pairSolves("trip-doubt", ["shoes", "fridge"])).toBe(true);
    expect(pairSolves("trip-doubt", ["fridge", "computer"])).toBe(false);
    expect(pairSolves("trip-doubt", ["fridge"])).toBe(false);
    expect(pairSolves("trip-doubt", ["fridge", "fridge"])).toBe(false);
    expect(pairSolves("time-gap", ["phone", "computer"])).toBe(true);
    expect(pairSolves("ampoule-origin", ["ampoule", "cards"])).toBe(true);
    expect(pairSolves("ampoule-origin", ["ampoule", "research-note"])).toBe(false);
  });
});
