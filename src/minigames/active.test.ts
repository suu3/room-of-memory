import { describe, expect, it } from "vitest";
import type { ActiveInteraction } from "@/store/memory-room";
import { liveMinigameOf, selectCanvasMinigameMemory } from "./active";

const consolePlay: ActiveInteraction = {
  memoryId: "console",
  gamePhase: 1,
  phase: "minigame",
  lineIndex: 0,
};

const ampoulePlay: ActiveInteraction = {
  memoryId: "ampoule",
  gamePhase: 2,
  phase: "minigame",
  lineIndex: 0,
};

describe("liveMinigameOf", () => {
  it("아무것도 조사하지 않으면 판도 없다", () => {
    expect(liveMinigameOf(null)).toBeNull();
  });

  it("진입 대사 중에는 아직 판이 아니다", () => {
    expect(
      liveMinigameOf({ ...consolePlay, phase: "dialogue", scriptId: "console-intro" }),
    ).toBeNull();
  });

  it("미니게임 단계면 레지스트리의 정의와 함께 판이 선다", () => {
    const live = liveMinigameOf(consolePlay);
    expect(live?.definition.id).toBe("fighter-duel");
    expect(live?.definition.mode).toBe("overlay");
    expect(live?.stage).toBe("play");
  });

  it("결과 대사가 판 위에 뜬 상태는 같은 판의 result 단계다", () => {
    const live = liveMinigameOf({
      ...consolePlay,
      phase: "dialogue",
      scriptId: "console-alone",
      keepMinigame: true,
    });
    expect(live?.definition.id).toBe("fighter-duel");
    expect(live?.stage).toBe("result");
  });

  it("미니게임이 없는 조사(냉장고 문)는 판이 없다", () => {
    expect(liveMinigameOf({ ...ampoulePlay, memoryId: "fridge" })).toBeNull();
  });
});

describe("selectCanvasMinigameMemory", () => {
  it("canvas 판이 도는 기억만 알려준다: overlay 판은 씬에서 아무것도 숨기지 않는다", () => {
    expect(selectCanvasMinigameMemory({ activeInteraction: ampoulePlay })).toBe("ampoule");
    expect(selectCanvasMinigameMemory({ activeInteraction: consolePlay })).toBeNull();
    expect(selectCanvasMinigameMemory({ activeInteraction: null })).toBeNull();
  });

  it("들고 있는 채로 결과 대사가 흐르는 동안에도 계속 숨긴다", () => {
    expect(
      selectCanvasMinigameMemory({
        activeInteraction: {
          ...ampoulePlay,
          phase: "dialogue",
          scriptId: "ampoule-found",
          keepMinigame: true,
        },
      }),
    ).toBe("ampoule");
  });
});
