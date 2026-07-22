import { create } from "zustand";
import { MEMORIES, MEMORY_BY_ID, type MemoryId, phaseConfigOf, SCRIPTS } from "@/data/memory-room";
import type { MinigameResult } from "@/types/minigame";

export type GamePhase = 1 | 2;
export type InteractionPhase = "dialogue" | "minigame";
export type HotspotStatus = "locked" | "available" | "done";

export interface ActiveInteraction {
  memoryId: MemoryId;
  /** 인터랙션이 시작된 시점의 게임 페이즈 (완료 기록이 이 값을 따른다) */
  gamePhase: GamePhase;
  phase: InteractionPhase;
  lineIndex: number;
}

interface MemoryRoomState {
  /** Phase 1 수집 완료 */
  collected: MemoryId[];
  /** Phase 2 재클릭 완료 */
  revisited: MemoryId[];
  /** 진행 중인 인터랙션. 활성이면 다른 핫스팟 입력은 잠긴다. */
  activeInteraction: ActiveInteraction | null;
  beginInteraction: (id: MemoryId) => void;
  advanceDialogue: () => void;
  finishMinigame: (result: MinigameResult) => void;
  /** 미니게임을 완료 처리 없이 중단한다 (모달 닫기) — 핫스팟은 다시 클릭 가능. */
  cancelMinigame: () => void;
  reset: () => void;
}

type StateSnapshot = Pick<MemoryRoomState, "collected" | "revisited">;

export function gamePhaseOf(state: StateSnapshot): GamePhase {
  return state.collected.length >= MEMORIES.length ? 2 : 1;
}

export function hotspotStatus(state: StateSnapshot, id: MemoryId): HotspotStatus {
  const gamePhase = gamePhaseOf(state);
  if (gamePhase === 1) {
    if (state.collected.includes(id)) return "done";
    const unlockAfter = MEMORY_BY_ID[id].phase1.unlockAfter ?? [];
    return unlockAfter.every((dep) => state.collected.includes(dep)) ? "available" : "locked";
  }
  const config = MEMORY_BY_ID[id].phase2;
  if (!config || state.revisited.includes(id)) return "done";
  const unlockAfter = config.unlockAfter ?? [];
  return unlockAfter.every((dep) => state.revisited.includes(dep)) ? "available" : "locked";
}

/**
 * phase2 대상이 하나도 없으면 6/6 수집 즉시 문이 열린다(수집-완료-즉시-엔딩으로
 * 자연 퇴화) — 데이터 작성 시 인지할 것.
 * 엔딩(문 열림) 조건: Phase 2 대상 전원이 revisited에 있다.
 */
export function endingReady(state: StateSnapshot): boolean {
  return (
    gamePhaseOf(state) === 2 &&
    MEMORIES.every((memory) => !memory.phase2 || state.revisited.includes(memory.id))
  );
}

function complete(state: MemoryRoomState, id: MemoryId, gamePhase: GamePhase) {
  if (gamePhase === 1) {
    return {
      collected: state.collected.includes(id) ? state.collected : [...state.collected, id],
      activeInteraction: null,
    };
  }
  return {
    revisited: state.revisited.includes(id) ? state.revisited : [...state.revisited, id],
    activeInteraction: null,
  };
}

export const useMemoryRoomStore = create<MemoryRoomState>()((set) => ({
  collected: [],
  revisited: [],
  activeInteraction: null,
  beginInteraction: (id) =>
    set((state) => {
      if (state.activeInteraction || hotspotStatus(state, id) !== "available") return state;
      const gamePhase = gamePhaseOf(state);
      const interaction = phaseConfigOf(id, gamePhase)?.interaction;
      if (interaction?.scriptId) {
        return {
          activeInteraction: { memoryId: id, gamePhase, phase: "dialogue" as const, lineIndex: 0 },
        };
      }
      if (interaction?.minigameId) {
        return {
          activeInteraction: { memoryId: id, gamePhase, phase: "minigame" as const, lineIndex: 0 },
        };
      }
      return complete(state, id, gamePhase);
    }),
  advanceDialogue: () =>
    set((state) => {
      const active = state.activeInteraction;
      if (active?.phase !== "dialogue") return state;
      const interaction = phaseConfigOf(active.memoryId, active.gamePhase)?.interaction;
      const script = interaction?.scriptId ? SCRIPTS[interaction.scriptId] : undefined;
      if (script && active.lineIndex + 1 < script.lines.length) {
        return { activeInteraction: { ...active, lineIndex: active.lineIndex + 1 } };
      }
      if (interaction?.minigameId) {
        return { activeInteraction: { ...active, phase: "minigame" as const } };
      }
      return complete(state, active.memoryId, active.gamePhase);
    }),
  finishMinigame: () =>
    set((state) => {
      const active = state.activeInteraction;
      if (active?.phase !== "minigame") return state;
      // 실패도 유효한 결말 — 결과와 무관하게 완료. 플래그/분기는 추후 확장.
      return complete(state, active.memoryId, active.gamePhase);
    }),
  cancelMinigame: () =>
    set((state) =>
      state.activeInteraction?.phase === "minigame" ? { activeInteraction: null } : state,
    ),
  reset: () => set({ collected: [], revisited: [], activeInteraction: null }),
}));

export const selectCollected = (state: MemoryRoomState) => state.collected;
export const selectActiveInteraction = (state: MemoryRoomState) => state.activeInteraction;
export const selectGamePhase = (state: MemoryRoomState) => gamePhaseOf(state);
export const selectEndingReady = (state: MemoryRoomState) => endingReady(state);
