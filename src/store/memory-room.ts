import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CUTSCENE_RADIO_BLACKOUT,
  CUTSCENES,
  MEMORIES,
  MEMORY_BY_ID,
  MEMORY_GOAL,
  type MemoryId,
  phaseConfigOf,
  SCRIPTS,
} from "@/data/memory-room";
import { CLUE_AFTER_MEMORY, type ClueId } from "@/data/room-clues";
import type { CutsceneCut, DialogueScriptLine } from "@/types/interaction";
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
  | "ending"
  | "clue";

export interface ActiveInteraction {
  memoryId: MemoryId;
  /** 인터랙션이 시작된 시점의 게임 페이즈 (완료 기록이 이 값을 따른다) */
  gamePhase: GamePhase;
  phase: InteractionPhase;
  /** 재생 중인 대사 스크립트. 인트로 대사와 미니게임 결과 대사가 같은 대사창을 쓴다. */
  scriptId?: string;
  /** 결과 대사 단계 — 대사창 뒤로 미니게임 화면이 그대로 남는다. */
  keepMinigame?: boolean;
  lineIndex: number;
}

/**
 * 재생의 성격. 같은 기계를 쓰지만 화면의 태도가 다르다 — 컷씬은 방을 덮고
 * 진행을 밀어붙이는 장면이고, 다시보기는 이미 지나간 것을 들춰 보는 것뿐이다.
 */
export type PlaybackKind = "cutscene" | "replay";

/**
 * 재생 중인 장면. 인터랙션과 같은 자리를 쓰지 않는다 — 여기에는 미니게임이 없고,
 * 끝나도 진행이 바뀌지 않는다.
 *
 * 컷씬과 다시보기가 이 하나를 공유한다. 둘 다 "그림 한 장 위로 대사가 흐르고
 * 끝나면 방으로 돌아가는" 같은 모양이라, 기계를 두 벌 만들 이유가 없다.
 */
export interface ActivePlayback {
  kind: PlaybackKind;
  /** 등록된 컷씬이면 그 id. 다시보기는 즉석에서 엮이므로 없다. */
  cutsceneId?: string;
  /** 다시보기 대상 기억 — 무엇을 보고 있는지 화면에 적기 위해서. */
  memoryId?: MemoryId;
  /** 재생할 컷들. 레지스트리를 다시 뒤지지 않도록 펼쳐서 들고 있는다. */
  cuts: CutsceneCut[];
  cutIndex: number;
  lineIndex: number;
  /**
   * 첫 컷이 뜨기 전, 라디오가 지직거리다 꺼지는 도입 구간 (컷씬 전용).
   * 이 동안에는 대사창도 그림도 뜨지 않는다 — 화면에 남는 건 끊기는 소리뿐이다.
   */
  intro: boolean;
  /** 대사가 끝나고 그림만 남은 정적 구간 (CutsceneCut.holdMs). */
  holding: boolean;
}

interface MemoryRoomState {
  /** Phase 1 수집 완료 */
  collected: MemoryId[];
  /** Phase 2 재클릭 완료 */
  revisited: MemoryId[];
  /** 진행 중인 인터랙션. 활성이면 다른 핫스팟 입력은 잠긴다. */
  activeInteraction: ActiveInteraction | null;
  /** 재생 중인 장면 (컷씬 또는 다시보기). 인터랙션과 마찬가지로 저장하지 않는다. */
  activePlayback: ActivePlayback | null;
  /** DOM overlay sources currently blocking scene controls. */
  uiLocks: UiLockId[];
  /** 캐릭터 시트 모달 — HUD 메뉴와 대사창 초상 두 곳에서 열리므로 스토어가 소유한다. */
  characterSheetOpen: boolean;
  /** 타이틀 화면을 지나 방에 들어왔는지. 리셋하면 다시 타이틀로 돌아간다. */
  started: boolean;
  /**
   * 3D 에셋이 얼마나 들어왔는지 (0~1). 타이틀 화면의 로딩 바가 이걸 읽는다.
   *
   * 진행이 아니라 이 세션의 사정이라 저장하지 않고, 리셋해도 되돌리지 않는다 —
   * 한 번 받아 둔 모델은 타이틀로 돌아가도 그대로 있다.
   */
  roomLoadProgress: number;
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
  /**
   * 지금 들여다보고 있는 단서 (책상 위 기록 노트 · 서랍 속 쪽지).
   *
   * 전등 스위치와 같은 배경 오브젝트라 진행에는 아무것도 남기지 않는다 — 저장도
   * 안 하고 수집·엔딩 조건에도 끼지 않는다. 스토어가 드는 이유는 하나: 만지는
   * 쪽은 Canvas 안의 3D 물건이고 펼쳐지는 쪽은 Canvas 밖 DOM이라, 둘을 잇는
   * 자리가 여기밖에 없다.
   */
  activeClue: ClueId | null;
  beginInteraction: (id: MemoryId) => void;
  advanceDialogue: () => void;
  /** 재생을 한 칸 진행한다 — 다음 줄 → 정적 → 다음 컷 → 종료 순. */
  advancePlayback: () => void;
  /** 재생을 통째로 닫는다 (끝까지 봤거나 건너뛰었거나). */
  endPlayback: () => void;
  finishMinigame: (result: MinigameResult) => void;
  /** 미니게임을 완료 처리 없이 중단한다 (모달 닫기) — 핫스팟은 다시 클릭 가능. */
  cancelMinigame: () => void;
  /** 수집한 기억을 다시 재생한다 (수집 상태는 그대로). */
  replayMemory: (id: MemoryId) => void;
  setUiLock: (id: UiLockId, locked: boolean) => void;
  setCharacterSheetOpen: (open: boolean) => void;
  setContactOpen: (open: boolean) => void;
  startGame: () => void;
  /** 로딩 진행률 보고. **올리기만 한다** — 뒤늦게 붙는 모델 때문에 바가 되감기면 안 된다. */
  setRoomLoadProgress: (progress: number) => void;
  setSoundMuted: (muted: boolean) => void;
  toggleLights: () => void;
  openClue: (id: ClueId) => void;
  closeClue: () => void;
  /** 엔딩 시작 — 조건을 못 채웠으면 아무 일도 일어나지 않는다. */
  startEnding: () => void;
  reset: () => void;
}

type StateSnapshot = Pick<MemoryRoomState, "collected" | "revisited">;

export function gamePhaseOf(state: StateSnapshot): GamePhase {
  return state.collected.length >= MEMORY_GOAL ? 2 : 1;
}

export function hotspotStatus(state: StateSnapshot, id: MemoryId): HotspotStatus {
  const gamePhase = gamePhaseOf(state);
  if (gamePhase === 1) {
    if (state.collected.includes(id)) return "done";
    const config = MEMORY_BY_ID[id].phase1;
    /*
     * 1바퀴에 없는 기억(컴퓨터)은 잠겨 있다 — done이 아니라 locked다. done으로
     * 두면 표식이 켜지고 다시보기까지 열려서, 아직 아무것도 안 본 물건이 이미
     * 본 것처럼 보인다.
     */
    if (!config) return "locked";
    const unlockAfter = config.unlockAfter ?? [];
    return unlockAfter.every((dep) => state.collected.includes(dep)) ? "available" : "locked";
  }
  const config = MEMORY_BY_ID[id].phase2;
  if (!config || state.revisited.includes(id)) return "done";
  const unlockAfter = config.unlockAfter ?? [];
  return unlockAfter.every((dep) => state.revisited.includes(dep)) ? "available" : "locked";
}

/**
 * 이 단서를 지금 펼칠 수 있는가.
 *
 * 대부분은 늘 열려 있다 (서랍 속 쪽지 = 방에 처음부터 놓인 물건). 예외는 조사를
 * 마친 뒤에야 배경 오브젝트가 되는 달력이다 — 조사 전에 열면 미니게임이 보여줄
 * 것을 먼저 보여주는 셈이고, 그 안의 표시가 컴퓨터 비밀번호라 순서가 무너진다.
 */
export function clueUnlocked(state: StateSnapshot, id: ClueId): boolean {
  const owner = Object.entries(CLUE_AFTER_MEMORY).find(([, clue]) => clue === id)?.[0];
  return owner === undefined || state.collected.includes(owner as MemoryId);
}

/**
 * 이 기억을 한 번이라도 봤는가 — 수첩·기억 패널·다시보기가 열어 줄지 정하는 기준.
 *
 * 대부분은 1바퀴 수집이 첫 관문이지만, 1바퀴가 없는 기억(컴퓨터)은 2바퀴 재조사가
 * 그 자리를 대신한다. collected만 보면 그 기억은 영영 잠긴 채로 남는다.
 */
export function isSeen(state: StateSnapshot, id: MemoryId): boolean {
  return state.collected.includes(id) || state.revisited.includes(id);
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

/** 컷씬의 도입 구간부터 시작하는 재생. 등록되지 않은 id면 null이라 진행이 막히지 않는다. */
export function openCutscene(id: string): ActivePlayback | null {
  const cutscene = CUTSCENES[id];
  if (!cutscene) return null;
  return {
    kind: "cutscene",
    cutsceneId: id,
    cuts: cutscene.cuts,
    cutIndex: 0,
    lineIndex: 0,
    intro: true,
    holding: false,
  };
}

/**
 * 다시보기 재생을 엮는다 — 미니게임은 빼고 그때의 대사와 그림만 잇는다.
 *
 * 이미 푼 판을 다시 풀리는 것은 되짚기가 아니라 재도전이다. 기억 패널과 수첩은
 * "무엇을 봤는지"를 다시 보여주는 자리라, 손을 다시 쓰게 만들면 안 된다.
 *
 * 대사가 한 줄도 없는 기억(조사 자체가 미니게임뿐이었던 것들)은 그때 남긴
 * 기록을 나레이션으로 대신 세운다 — 눌렀는데 아무 일도 없는 줄을 만들지 않는다.
 */
export function buildMemoryReplay(id: MemoryId, gamePhase: GamePhase): ActivePlayback | null {
  const config = phaseConfigOf(id, gamePhase);
  if (!config) return null;

  const spoken = [config.interaction?.scriptId, config.interaction?.resultScriptId].flatMap(
    (scriptId) => (scriptId ? (SCRIPTS[scriptId]?.lines ?? []) : []),
  );
  const lines =
    spoken.length > 0
      ? spoken
      : [
          {
            speaker: "narrator",
            textKey: `lore.${id}.phase${gamePhase}`,
          } as DialogueScriptLine,
        ];

  return {
    kind: "replay",
    memoryId: id,
    cuts: [{ image: config.replayStill, fit: "contain", lines }],
    cutIndex: 0,
    lineIndex: 0,
    // 다시보기에는 도입이 없다 — 라디오가 꺼지는 비트는 그 컷씬만의 것이다
    intro: false,
    holding: false,
  };
}

/**
 * 재생을 한 칸 진행한 결과. 끝났으면 null.
 *
 * 정적(holding)은 컷의 마지막 줄과 다음 컷 사이에 낀 한 칸이다. 한 칸으로 두면
 * "다음"을 누르는 것과 시간이 흐르는 것이 같은 함수로 처리돼서, 화면 쪽은
 * 타이머를 걸어 이 함수를 한 번 더 부르기만 하면 된다.
 */
export function nextPlaybackStep(active: ActivePlayback): ActivePlayback | null {
  const cut = active.cuts[active.cutIndex];
  if (!cut) return null;

  const toNextCut = (): ActivePlayback | null =>
    active.cutIndex + 1 < active.cuts.length
      ? { ...active, cutIndex: active.cutIndex + 1, lineIndex: 0, holding: false }
      : null;

  // 도입(라디오가 꺼지는 비트)이 끝나면 같은 컷의 첫 줄부터 시작한다
  if (active.intro) return { ...active, intro: false };
  if (active.holding) return toNextCut();
  if (active.lineIndex + 1 < cut.lines.length) {
    return { ...active, lineIndex: active.lineIndex + 1 };
  }
  // 마지막 줄을 넘겼다 — 정적이 걸린 컷이면 그림만 남기고 한 박자 쉰다
  if (cut.holdMs && cut.holdMs > 0) return { ...active, holding: true };
  return toNextCut();
}

function complete(state: MemoryRoomState, id: MemoryId, gamePhase: GamePhase) {
  if (gamePhase === 1) {
    const collected = state.collected.includes(id) ? state.collected : [...state.collected, id];
    /*
     * 1바퀴를 방금 완주했다 = 라디오 재난방송이 막 끊긴 순간이다(라디오가 1바퀴의
     * 마지막 관문이므로). 절망의 바닥에서 전환 컷씬으로 곧장 넘어간다 — 방을 한 번
     * 둘러보게 두면 바닥의 밀도가 흩어진다.
     */
    const finished = collected.length >= MEMORY_GOAL;
    return {
      collected,
      activeInteraction: null,
      activePlayback: finished ? openCutscene(CUTSCENE_RADIO_BLACKOUT) : state.activePlayback,
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

  /*
   * 1바퀴가 없는 기억(컴퓨터)은 collected에 들어갈 수 없다. 옛 저장본에는 들어
   * 있으므로 여기서 턴다 — 남겨 두면 수집 개수가 목표를 넘어서 엔딩 조건이
   * 어긋난다.
   */
  const collected = ids(saved.collected).filter((id) => MEMORY_BY_ID[id].phase1);
  /*
   * 2바퀴는 1바퀴를 마친 기억에만 붙는다 — 순서가 뒤집힌 저장본은 앞뒤가 맞게 자른다.
   * 단, 1바퀴가 아예 없는 기억(컴퓨터)은 collected에 들어갈 길이 없으므로 예외다.
   */
  const revisited = ids(saved.revisited).filter(
    (id) => collected.includes(id) || !MEMORY_BY_ID[id].phase1,
  );

  return {
    collected,
    revisited,
    endingStarted: saved.endingStarted === true && collected.length === MEMORY_GOAL,
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
      activePlayback: null,
      uiLocks: [],
      characterSheetOpen: false,
      contactOpen: false,
      started: false,
      roomLoadProgress: 0,
      resetRevision: 0,
      soundMuted: false,
      lightsOn: true,
      endingStarted: false,
      activeClue: null,
      beginInteraction: (id) =>
        set((state) => {
          if (state.activePlayback) return state;
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
          return complete(state, active.memoryId, active.gamePhase);
        }),
      advancePlayback: () =>
        set((state) =>
          state.activePlayback ? { activePlayback: nextPlaybackStep(state.activePlayback) } : state,
        ),
      endPlayback: () => set((state) => (state.activePlayback ? { activePlayback: null } : state)),
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
          /*
           * 실패는 인터랙션을 닫되 수집으로 적지 않는다. 못 되찾은 기억을 되찾았다고
           * 적으면 진행도(n/7)와 방 밝기가 실제보다 앞서가고, 캐릭터 시트의 항목도
           * 거저 열린다 — 미니게임을 푸는 의미가 사라진다.
           *
           * 핫스팟은 available로 남으므로 다시 눌러 재도전할 수 있다. 막다른 길이
           * 되지는 않는다. 스킵은 접근성 계약상 cleared: true라 이 갈래로 오지 않고
           * 그대로 수집된다 (src/types/minigame.ts).
           */
          if (!result.cleared) return { activeInteraction: null };
          return complete(state, active.memoryId, active.gamePhase);
        }),
      cancelMinigame: () =>
        set((state) =>
          state.activeInteraction?.phase === "minigame" ? { activeInteraction: null } : state,
        ),
      replayMemory: (id) =>
        set((state) => {
          // 이미 본 것만 되짚을 수 있다. beginInteraction은 available일 때만 돌아서 쓸 수 없다.
          if (state.activeInteraction || state.activePlayback) return state;
          if (!isSeen(state, id)) return state;
          // 2바퀴까지 본 기억이면 마지막으로 본 쪽(phase2)을 되돌려준다
          const item = MEMORY_BY_ID[id];
          const gamePhase: GamePhase =
            !item.phase1 || (state.revisited.includes(id) && item.phase2) ? 2 : 1;
          const playback = buildMemoryReplay(id, gamePhase);
          return playback ? { activePlayback: playback } : state;
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
      setRoomLoadProgress: (progress) =>
        set((state) =>
          progress > state.roomLoadProgress ? { roomLoadProgress: progress } : state,
        ),
      setSoundMuted: (muted) => set({ soundMuted: muted }),
      toggleLights: () => set((state) => ({ lightsOn: !state.lightsOn })),
      // 대사·미니게임·컷씬이 도는 중에는 단서를 펼치지 않는다 — 화면이 두 겹이 된다
      openClue: (id) =>
        set((state) =>
          state.activeInteraction || state.activePlayback || !clueUnlocked(state, id)
            ? state
            : { activeClue: id },
        ),
      closeClue: () => set((state) => (state.activeClue ? { activeClue: null } : state)),
      startEnding: () =>
        set((state) => (selectEndingReady(state) ? { endingStarted: true } : state)),
      reset: () =>
        set((state) => ({
          collected: [],
          revisited: [],
          activeInteraction: null,
          activePlayback: null,
          uiLocks: [],
          characterSheetOpen: false,
          contactOpen: false,
          started: false,
          lightsOn: true,
          endingStarted: false,
          activeClue: null,
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
export const selectActivePlayback = (state: MemoryRoomState) => state.activePlayback;
export const selectGamePhase = (state: MemoryRoomState) => gamePhaseOf(state);
export const selectEndingReady = (state: MemoryRoomState) => endingReady(state);
export const selectSceneInputLocked = (state: MemoryRoomState) =>
  state.activeInteraction !== null || state.activePlayback !== null || state.uiLocks.length > 0;

/**
 * 라디오가 저 혼자 살아나 있는가.
 *
 * 재난방송이 끊기면서 라디오는 확실히 죽는다. 2바퀴의 문은 도해가 다시 만지는 게
 * 아니라 라디오가 먼저 말을 거는 것이라, 컷씬이 끝난 자리에서 저절로 지직거린다.
 * 목소리를 잡고 나면(revisited) 더는 깜빡이지 않는다 — 할 말을 이미 했으니까.
 */
export const selectRadioSignaling = (state: MemoryRoomState) =>
  gamePhaseOf(state) === 2 && !state.revisited.includes("radio") && state.activePlayback === null;

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

/**
 * 곡이 흐르고 있어야 하는가. 컷씬은 방송이 끊긴 정적 위에 서는 장면이라 곡도 같이
 * 멎는다 — 여기서 BGM이 계속 흐르면 "뚝 끊김"이 소리로 전달되지 않는다.
 */
export const selectMusicPlaying = (state: MemoryRoomState) =>
  state.started && !state.endingStarted && state.activePlayback?.kind !== "cutscene";

/** 2바퀴 재조사 대상 수. 밝기 상승 구간의 분모다. */
export const REVISIT_TOTAL = MEMORIES.filter((memory) => memory.phase2).length;

/** 1바퀴 수집 목표. 밝기 하강 구간의 분모다 — 데이터 쪽 MEMORY_GOAL과 같은 수. */
export const MEMORY_TOTAL = MEMORY_GOAL;

/*
 * 밝기 입력은 원시값으로만 노출한다. 객체를 새로 만들어 돌려주면 zustand가
 * 매 렌더 새 스냅샷으로 보고 무한 루프에 빠진다 (getServerSnapshot 경고).
 */
export const selectCollectedCount = (state: MemoryRoomState) => state.collected.length;
export const selectRevisitedCount = (state: MemoryRoomState) => state.revisited.length;
