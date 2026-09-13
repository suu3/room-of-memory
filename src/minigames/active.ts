import { type MemoryId, phaseConfigOf } from "@/data/memory-room";
import type { ActiveInteraction, MemoryRoomState } from "@/store/memory-room";
import type { MinigameDefinition } from "@/types/minigame";
import { getMinigame } from ".";

/** 지금 화면에 서 있어야 하는 미니게임. 판이 도는 중이거나, 판 위에 결과 대사가 뜬 상태. */
export interface LiveMinigame {
  memoryId: MemoryId;
  gamePhase: 1 | 2;
  definition: MinigameDefinition;
  /** "result"는 판이 끝나고 결과 대사가 그 위에 뜬 상태다 (src/types/minigame.ts의 stage). */
  stage: "play" | "result";
}

/**
 * 인터랙션 상태에서 살아 있는 미니게임을 읽는다. overlay 호스트(DOM)와 canvas 호스트
 * (씬)가 같은 판정을 써야 한 판이 두 곳에 서거나 어디에도 안 서는 일이 없다.
 *
 * 등록되지 않은 id면 null: 호스트가 건너뛰기(cleared: true)로 진행을 살린다.
 */
export function liveMinigameOf(active: ActiveInteraction | null): LiveMinigame | null {
  if (!active) return null;
  const resultStage = active.phase === "dialogue" && active.keepMinigame === true;
  if (active.phase !== "minigame" && !resultStage) return null;
  const minigameId = phaseConfigOf(active.memoryId, active.gamePhase)?.interaction?.minigameId;
  const definition = minigameId ? getMinigame(minigameId) : undefined;
  if (!definition) return null;
  return {
    memoryId: active.memoryId,
    gamePhase: active.gamePhase,
    definition,
    stage: resultStage ? "result" : "play",
  };
}

/**
 * canvas 모드 미니게임이 지금 어느 기억 자리에 서 있는가 (없으면 null).
 *
 * 그 기억의 평소 모습(MemoryObjects)은 이 동안 숨는다. 미니게임이 같은 자리에
 * 같은 물건을 움직이는 모습으로 그리기 때문이다. 원시값을 돌려주므로 zustand
 * 셀렉터로 그대로 쓴다.
 */
export const selectCanvasMinigameMemory = (
  state: Pick<MemoryRoomState, "activeInteraction">,
): MemoryId | null => {
  const live = liveMinigameOf(state.activeInteraction);
  return live?.definition.mode === "canvas" ? live.memoryId : null;
};
