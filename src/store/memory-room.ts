import { create } from "zustand";
import { MEMORIES, MEMORY_BY_ID, type MemoryId, phaseConfigOf, SCRIPTS } from "@/data/memory-room";
import type { MinigameResult } from "@/types/minigame";

export type GamePhase = 1 | 2;
export type InteractionPhase = "dialogue" | "minigame";
export type HotspotStatus = "locked" | "available" | "done";
export type UiLockId =
  | "hud-menu"
  | "memory-panel"
  | "character-sheet"
  | "title"
  | "contact"
  | "ending";

export interface ActiveInteraction {
  memoryId: MemoryId;
  /** 인터랙션이 시작된 시점의 게임 페이즈 (완료 기록이 이 값을 따른다) */
  gamePhase: GamePhase;
  phase: InteractionPhase;
  /** 재생 중인 대사 스크립트. 인트로 대사와 미니게임 결과 대사가 같은 대사창을 쓴다. */
  scriptId?: string;
  /** 결과 대사 단계 — 대사창 뒤로 미니게임 화면이 그대로 남는다. */
  keepMinigame?: boolean;
  /** 이미 본 기억을 다시 재생하는 중. 끝나도 수집 상태를 건드리지 않는다. */
  replaying?: boolean;
  lineIndex: number;
}

interface MemoryRoomState {
  /** Phase 1 수집 완료 */
  collected: MemoryId[];
  /** Phase 2 재클릭 완료 */
  revisited: MemoryId[];
  /** 진행 중인 인터랙션. 활성이면 다른 핫스팟 입력은 잠긴다. */
  activeInteraction: ActiveInteraction | null;
  /** DOM overlay sources currently blocking scene controls. */
  uiLocks: UiLockId[];
  /** 캐릭터 시트 모달 — HUD 메뉴와 대사창 초상 두 곳에서 열리므로 스토어가 소유한다. */
  characterSheetOpen: boolean;
  /** 타이틀 화면을 지나 방에 들어왔는지. 리셋하면 다시 타이틀로 돌아간다. */
  started: boolean;
  /** 연락처 모달. HUD 메뉴와 타이틀 화면 두 곳에서 열린다. */
  contactOpen: boolean;
  /** Monotonic signal for local UI state that must close when progress resets. */
  resetRevision: number;
  /** 효과음 음소거. 리셋해도 유지된다 — 언어 설정과 같은 성격의 환경설정이다. */
  soundMuted: boolean;
  /** 문 옆 배트를 쥐었는가. 2바퀴를 다 돌아야 쥘 수 있고, 쥐면 문이 열린다. */
  endingStarted: boolean;
  beginInteraction: (id: MemoryId) => void;
  advanceDialogue: () => void;
  finishMinigame: (result: MinigameResult) => void;
  /** 미니게임을 완료 처리 없이 중단한다 (모달 닫기) — 핫스팟은 다시 클릭 가능. */
  cancelMinigame: () => void;
  /** 수집한 기억을 다시 재생한다 (수집 상태는 그대로). */
  replayMemory: (id: MemoryId) => void;
  setUiLock: (id: UiLockId, locked: boolean) => void;
  setCharacterSheetOpen: (open: boolean) => void;
  setContactOpen: (open: boolean) => void;
  startGame: () => void;
  setSoundMuted: (muted: boolean) => void;
  /** 엔딩 시작 — 조건을 못 채웠으면 아무 일도 일어나지 않는다. */
  startEnding: () => void;
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

/**
 * 인터랙션을 닫는다. 다시보기는 이미 본 것을 되짚는 것뿐이라 수집·재조사 기록을
 * 남기지 않는다 — 남기면 2바퀴 진행도와 방 밝기가 멋대로 올라간다.
 */
function finishInteraction(state: MemoryRoomState, active: ActiveInteraction) {
  if (active.replaying) return { activeInteraction: null };
  return complete(state, active.memoryId, active.gamePhase);
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
  uiLocks: [],
  characterSheetOpen: false,
  contactOpen: false,
  started: false,
  resetRevision: 0,
  soundMuted: false,
  endingStarted: false,
  beginInteraction: (id) =>
    set((state) => {
      if (state.activeInteraction || hotspotStatus(state, id) !== "available") return state;
      const gamePhase = gamePhaseOf(state);
      const interaction = phaseConfigOf(id, gamePhase)?.interaction;
      if (interaction?.scriptId) {
        return {
          activeInteraction: {
            memoryId: id,
            gamePhase,
            phase: "dialogue" as const,
            scriptId: interaction.scriptId,
            lineIndex: 0,
          },
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
      const script = active.scriptId ? SCRIPTS[active.scriptId] : undefined;
      if (script && active.lineIndex + 1 < script.lines.length) {
        return { activeInteraction: { ...active, lineIndex: active.lineIndex + 1 } };
      }
      // 결과 대사는 미니게임 뒤에 오므로 다시 미니게임으로 돌아가지 않는다
      if (!active.keepMinigame && interaction?.minigameId) {
        return {
          activeInteraction: { ...active, phase: "minigame" as const, scriptId: undefined },
        };
      }
      return finishInteraction(state, active);
    }),
  finishMinigame: (result) =>
    set((state) => {
      const active = state.activeInteraction;
      if (active?.phase !== "minigame") return state;
      const interaction = phaseConfigOf(active.memoryId, active.gamePhase)?.interaction;
      // 클리어했으면 결과 대사로 — 미니게임 화면을 뒤에 남긴 채 대사창이 뜬다
      if (result.cleared && interaction?.resultScriptId) {
        return {
          activeInteraction: {
            ...active,
            phase: "dialogue" as const,
            scriptId: interaction.resultScriptId,
            keepMinigame: true,
            lineIndex: 0,
          },
        };
      }
      // 실패도 유효한 결말 — 결과와 무관하게 완료. 플래그/분기는 추후 확장.
      return finishInteraction(state, active);
    }),
  cancelMinigame: () =>
    set((state) =>
      state.activeInteraction?.phase === "minigame" ? { activeInteraction: null } : state,
    ),
  replayMemory: (id) =>
    set((state) => {
      // 이미 본 것만 되짚을 수 있다. beginInteraction은 available일 때만 돌아서 쓸 수 없다.
      if (state.activeInteraction || !state.collected.includes(id)) return state;
      // 2바퀴까지 본 기억이면 마지막으로 본 쪽(phase2)을 되돌려준다
      const item = MEMORY_BY_ID[id];
      const gamePhase: GamePhase = state.revisited.includes(id) && item.phase2 ? 2 : 1;
      const interaction = phaseConfigOf(id, gamePhase)?.interaction;
      if (!interaction) return state;

      const base = { memoryId: id, gamePhase, replaying: true, lineIndex: 0 } as const;
      if (interaction.scriptId) {
        return {
          activeInteraction: {
            ...base,
            phase: "dialogue" as const,
            scriptId: interaction.scriptId,
          },
        };
      }
      if (interaction.minigameId) {
        return { activeInteraction: { ...base, phase: "minigame" as const } };
      }
      return state;
    }),
  setUiLock: (id, locked) =>
    set((state) => {
      const present = state.uiLocks.includes(id);
      if (present === locked) return state;
      return {
        uiLocks: locked ? [...state.uiLocks, id] : state.uiLocks.filter((lock) => lock !== id),
      };
    }),
  setCharacterSheetOpen: (open) => set({ characterSheetOpen: open }),
  setContactOpen: (open) => set({ contactOpen: open }),
  startGame: () => set({ started: true }),
  setSoundMuted: (muted) => set({ soundMuted: muted }),
  startEnding: () => set((state) => (selectEndingReady(state) ? { endingStarted: true } : state)),
  reset: () =>
    set((state) => ({
      collected: [],
      revisited: [],
      activeInteraction: null,
      uiLocks: [],
      characterSheetOpen: false,
      contactOpen: false,
      started: false,
      endingStarted: false,
      resetRevision: state.resetRevision + 1,
    })),
}));

export const selectCollected = (state: MemoryRoomState) => state.collected;
export const selectActiveInteraction = (state: MemoryRoomState) => state.activeInteraction;
export const selectGamePhase = (state: MemoryRoomState) => gamePhaseOf(state);
export const selectEndingReady = (state: MemoryRoomState) => endingReady(state);
export const selectSceneInputLocked = (state: MemoryRoomState) =>
  state.activeInteraction !== null || state.uiLocks.length > 0;

/** 2바퀴 재조사 대상 수. 밝기 상승 구간의 분모다. */
export const REVISIT_TOTAL = MEMORIES.filter((memory) => memory.phase2).length;

/** 전체 기억 수. 밝기 하강 구간의 분모다. */
export const MEMORY_TOTAL = MEMORIES.length;

/*
 * 밝기 입력은 원시값으로만 노출한다. 객체를 새로 만들어 돌려주면 zustand가
 * 매 렌더 새 스냅샷으로 보고 무한 루프에 빠진다 (getServerSnapshot 경고).
 */
export const selectCollectedCount = (state: MemoryRoomState) => state.collected.length;
export const selectRevisitedCount = (state: MemoryRoomState) => state.revisited.length;
