import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
  /**
   * 방의 전등. 진행과 무관한 배경 오브젝트라 수집·엔딩 조건에 전혀 끼지 않는다 —
   * 순전히 플레이어가 방을 만질 수 있다는 감각을 위한 스위치다.
   */
  lightsOn: boolean;
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
  toggleLights: () => void;
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

/**
 * 저장되는 것 — 진행과 방의 상태뿐이다.
 *
 * 화면 상태(열린 모달, 진행 중인 인터랙션, uiLocks)는 저장하지 않는다. 대사 도중에
 * 탭을 닫았다가 돌아왔을 때 대사창이 반쯤 열린 채로 되살아나면 어디서 이어지는지
 * 알 수 없고, 미니게임은 아예 마운트 상태를 복원할 수 없다.
 *
 * started도 저장하지 않는다. 저장하면 새로고침이 곧장 방 안으로 떨어져서 타이틀
 * 화면을 건너뛰는데, 그러면 "이어하기"를 고를 기회 자체가 없어진다. 대신 타이틀에
 * 남아 있고, 저장본이 있으면 시작 버튼이 "이어하기"로 바뀐다.
 */
type PersistedProgress = Pick<
  MemoryRoomState,
  "collected" | "revisited" | "endingStarted" | "soundMuted" | "lightsOn"
>;

const PERSIST_KEY = "rom-progress";
const PERSIST_VERSION = 1;

/**
 * 저장본을 지금 스키마에 맞춰 걸러낸다.
 *
 * 저장된 뒤에 기억 목록이 바뀌면(이름 변경·삭제) 없는 id가 남는다. 그대로 두면
 * 수집 개수가 실제보다 많아져 엔딩 조건이 잘못 열리거나, MEMORY_BY_ID 조회가
 * undefined를 물고 터진다. 모르는 id는 조용히 버린다 — 저장본이 조금 어긋났다고
 * 게임을 못 하게 만드는 쪽이 더 나쁘다.
 */
export function sanitizeProgress(raw: unknown): Partial<PersistedProgress> {
  if (typeof raw !== "object" || raw === null) return {};
  const saved = raw as Partial<Record<keyof PersistedProgress, unknown>>;

  const ids = (value: unknown): MemoryId[] =>
    Array.isArray(value)
      ? Array.from(
          new Set(
            value.filter((id): id is MemoryId => typeof id === "string" && id in MEMORY_BY_ID),
          ),
        )
      : [];

  const collected = ids(saved.collected);
  // 2바퀴는 1바퀴를 마친 기억에만 붙는다 — 순서가 뒤집힌 저장본은 앞뒤가 맞게 자른다
  const revisited = ids(saved.revisited).filter((id) => collected.includes(id));

  return {
    collected,
    revisited,
    endingStarted: saved.endingStarted === true && collected.length === MEMORIES.length,
    soundMuted: saved.soundMuted === true,
    // 불은 켜진 상태가 기본 — 저장본에 명시적으로 false일 때만 꺼진 채로 돌아온다
    lightsOn: saved.lightsOn !== false,
  };
}

export const useMemoryRoomStore = create<MemoryRoomState>()(
  persist<MemoryRoomState, [], [], Partial<PersistedProgress>>(
    (set) => ({
      collected: [],
      revisited: [],
      activeInteraction: null,
      uiLocks: [],
      characterSheetOpen: false,
      contactOpen: false,
      started: false,
      resetRevision: 0,
      soundMuted: false,
      lightsOn: true,
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
              activeInteraction: {
                memoryId: id,
                gamePhase,
                phase: "minigame" as const,
                lineIndex: 0,
              },
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
      toggleLights: () => set((state) => ({ lightsOn: !state.lightsOn })),
      startEnding: () =>
        set((state) => (selectEndingReady(state) ? { endingStarted: true } : state)),
      reset: () =>
        set((state) => ({
          collected: [],
          revisited: [],
          activeInteraction: null,
          uiLocks: [],
          characterSheetOpen: false,
          contactOpen: false,
          started: false,
          lightsOn: true,
          endingStarted: false,
          resetRevision: state.resetRevision + 1,
        })),
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        collected: state.collected,
        revisited: state.revisited,
        endingStarted: state.endingStarted,
        soundMuted: state.soundMuted,
        lightsOn: state.lightsOn,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeProgress(persisted) }),
    },
  ),
);

export const selectCollected = (state: MemoryRoomState) => state.collected;
export const selectActiveInteraction = (state: MemoryRoomState) => state.activeInteraction;
export const selectGamePhase = (state: MemoryRoomState) => gamePhaseOf(state);
export const selectEndingReady = (state: MemoryRoomState) => endingReady(state);
export const selectSceneInputLocked = (state: MemoryRoomState) =>
  state.activeInteraction !== null || state.uiLocks.length > 0;

/**
 * BGM이 뒤로 물러나야 하는 정도를 정하는 축. 미니게임은 효과음이, 대사는 글이
 * 주인공이라 눌러야 하는 깊이가 다르다 (lib/audio의 useRoomMusic).
 *
 * 원시 문자열로 돌려준다 — 객체를 새로 만들면 zustand가 매 렌더 새 스냅샷으로 본다.
 */
export const selectMusicForeground = (state: MemoryRoomState): "room" | "dialogue" | "minigame" => {
  if (state.activeInteraction?.phase === "minigame") return "minigame";
  if (state.activeInteraction !== null || state.uiLocks.length > 0) return "dialogue";
  return "room";
};

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
