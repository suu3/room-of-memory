import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DOOR_RULES } from "@/data/doors";
import { ITEM_IDS, type ItemId } from "@/data/items";
import {
  CUTSCENE_BAT_GRIP,
  CUTSCENE_P2_CLOSE,
  CUTSCENE_P4_CLOSE,
  CUTSCENE_RADIO_BLACKOUT,
  CUTSCENES,
  MEMORY_BY_ID,
  MEMORY_GOAL,
  type MemoryId,
  P4_FINAL_MEMORY,
  phaseConfigOf,
  REPLAY_MORPH_WITHIN,
  SCRIPTS,
} from "@/data/memory-room";
import {
  CLUE_AFTER_MEMORY,
  CLUE_IDS,
  type ClueId,
  DISCOVERY_IDS,
  type DiscoveryId,
  PUZZLE_IDS,
  type PuzzleId,
} from "@/data/room-clues";
import {
  anyVisitDone,
  deadlineOf,
  lastVisitDone,
  nextVisit,
  phaseAtLeast,
  RECOVERY_VISITS,
  refDone,
  type StoryPhase,
  storyPhaseOf,
  type Visit,
  visitOpen,
  visitsOf,
} from "@/data/story-phase";
import { DOORWAY_IDS, type DoorwayId, type SpaceId } from "@/scenes/memory-room/spaces";
import type { CurtainSide } from "@/types/curtain";
import type { CutsceneCut, DialogueScriptLine } from "@/types/interaction";
import type { MinigameResult } from "@/types/minigame";
import type { SeatId } from "@/types/seat";

/**
 * 바퀴. 1 = 1차 조사를 모으는 1페이즈, 2 = 그 뒤 전부 (분기점부터 결말까지).
 *
 * 이야기의 페이즈(StoryPhase: intro/p1/turning/p2/p3/p4/resolve/ending)보다 거친
 * 축이다. 밝기·BGM·진행 표시처럼 "1막인가 아닌가"만 보면 되는 곳이 쓴다.
 * 조사 차수(Visit: 1·2·3차)는 또 다른 축이다: 콘텐츠의 phase1/2/3과 짝이 맞는다.
 */
export type GamePhase = 1 | 2;

export type { StoryPhase, Visit };

/**
 * 막: 이야기의 단계이자 공간의 단계 (docs/content-design.md 2장).
 *
 *   1막 방(외면) · 2막 방↔거실(직면의 추리) · 3막 현관(세상)
 *
 * 경계는 문과 물건이 긋는다: 방문이 열리면 2막, 앰플을 쥐면 3막이다.
 */
export type Act = 1 | 2 | 3;
/**
 * 난이도: 이지(기본)는 미니게임 스킵이 열리고, 보통은 숨는다.
 * 게이트는 useSkipEligible(src/minigames/shell.tsx) 한 곳이 담당한다.
 */
export type Difficulty = "easy" | "normal";
/** 수첩(캐릭터 시트)의 페이지: 프로필과 기록(기억 스크랩북). */
export type CharacterSheetTab = "profile" | "lore" | "map" | "items";
export type InteractionPhase = "dialogue" | "minigame";
export type HotspotStatus = "locked" | "available" | "done";
/**
 * 스치는 혼잣말 한 줄 (RemarkLine). 조사도 기록도 아닌, 물건을 눌렀을 때 도해가
 * 흘리는 말이다. 본문은 common.json의 remark.* (문은 door.*).
 */
export type RemarkId =
  | "door-stay"
  | "door-ready"
  | "computer-off"
  | "toothbrush"
  | "sink-locked"
  | "sink-open"
  | "piano-done"
  | "parents-locked";

export type UiLockId =
  | "hud-menu"
  | "character-sheet"
  | "title"
  | "contact"
  | "feedback"
  | "ending"
  | "clue"
  | "dialogue-log";

export interface ActiveInteraction {
  memoryId: MemoryId;
  /** 몇 차 조사인가 (1·2·3). 완료 기록이 이 값을 따른다 */
  gamePhase: Visit;
  phase: InteractionPhase;
  /** 재생 중인 대사 스크립트. 인트로 대사와 미니게임 결과 대사가 같은 대사창을 쓴다. */
  scriptId?: string;
  /** 결과 대사 단계: 대사창 뒤로 미니게임 화면이 그대로 남는다. */
  keepMinigame?: boolean;
  lineIndex: number;
}

/**
 * 재생의 성격. 같은 기계를 쓰지만 화면의 태도가 다르다. 컷씬은 방을 덮고
 * 진행을 밀어붙이는 장면이고, 다시보기는 이미 지나간 것을 들춰 보는 것뿐이다.
 */
export type PlaybackKind = "cutscene" | "replay";

/**
 * 재생 중인 장면. 인터랙션과 같은 자리를 쓰지 않는다. 여기에는 미니게임이 없고,
 * 끝나도 진행이 바뀌지 않는다.
 *
 * 컷씬과 다시보기가 이 하나를 공유한다. 둘 다 "그림 한 장 위로 대사가 흐르고
 * 끝나면 방으로 돌아가는" 같은 모양이라, 기계를 두 벌 만들 이유가 없다.
 */
export interface ActivePlayback {
  kind: PlaybackKind;
  /** 등록된 컷씬이면 그 id. 다시보기는 즉석에서 엮이므로 없다. */
  cutsceneId?: string;
  /** 다시보기 대상 기억: 무엇을 보고 있는지 화면에 적기 위해서. */
  memoryId?: MemoryId;
  /** 재생할 컷들. 레지스트리를 다시 뒤지지 않도록 펼쳐서 들고 있는다. */
  cuts: CutsceneCut[];
  cutIndex: number;
  lineIndex: number;
  /**
   * 첫 컷이 뜨기 전, 라디오가 지직거리다 꺼지는 도입 구간 (컷씬 전용).
   * 이 동안에는 대사창도 그림도 뜨지 않는다. 화면에 남는 건 끊기는 소리뿐이다.
   */
  intro: boolean;
  /** 대사가 끝나고 그림만 남은 정적 구간 (CutsceneCut.holdMs). */
  holding: boolean;
}

export interface MemoryRoomState {
  /** 1차 조사 완료 */
  collected: MemoryId[];
  /** 2차 조사 완료 */
  revisited: MemoryId[];
  /** 3차 조사 완료 (v4: 컴퓨터의 로고 매칭 하나) */
  rechecked: MemoryId[];
  /** 진행 중인 인터랙션. 활성이면 다른 핫스팟 입력은 잠긴다. */
  activeInteraction: ActiveInteraction | null;
  /** 재생 중인 장면 (컷씬 또는 다시보기). 인터랙션과 마찬가지로 저장하지 않는다. */
  activePlayback: ActivePlayback | null;
  /** DOM overlay sources currently blocking scene controls. */
  uiLocks: UiLockId[];
  /** 캐릭터 시트 모달: HUD 메뉴와 대사창 초상 두 곳에서 열리므로 스토어가 소유한다. */
  characterSheetOpen: boolean;
  /**
   * 수첩이 펼쳐질 페이지. 여는 곳마다 목적이 다르다. 오른쪽 "기억 수집" 탭은
   * 기록(스크랩북)으로, HUD 메뉴는 마지막으로 보던 페이지로 연다.
   */
  characterSheetTab: CharacterSheetTab;
  /** 타이틀 화면을 지나 방에 들어왔는지. 리셋하면 다시 타이틀로 돌아간다. */
  started: boolean;
  /**
   * 3D 에셋이 얼마나 들어왔는지 (0~1). 타이틀 화면의 로딩 바가 이걸 읽는다.
   *
   * 진행이 아니라 이 세션의 사정이라 저장하지 않고, 리셋해도 되돌리지 않는다.
   * 한 번 받아 둔 모델은 타이틀로 돌아가도 그대로 있다.
   */
  roomLoadProgress: number;
  /**
   * 부팅 커튼이 다 걷혔는가. 에셋을 받는 동안 화면을 덮고 있다가 다 받으면 위로
   * 올라가고, 그 아래에서 타이틀 화면이 드러난다 (BootCurtain).
   *
   * 이 페이지를 연 뒤 한 번뿐인 사건이라 **리셋해도 되돌리지 않는다**. 되돌리면
   * 타이틀로 돌아갈 때마다 이미 받아 둔 방을 다시 받는 척하는 커튼이 내려온다.
   */
  booted: boolean;
  /**
   * 부팅 커튼이 걷히기 **시작**했다. booted보다 1.1초 앞선다. 커튼이 올라가는 동안
   * 그 밑에서 드러날 화면(타이틀)이 이 신호에 맞춰 놓이기 시작한다. 다 올라간 뒤에
   * 놓이기 시작하면 걷히는 동안은 빈 판이다.
   */
  bootRising: boolean;
  /** 연락처 모달. HUD 메뉴와 타이틀 화면 두 곳에서 열린다. */
  contactOpen: boolean;
  /** 피드백 모달: HUD 메뉴에서만 열린다 (플레이 전엔 보낼 피드백이 없다). */
  feedbackOpen: boolean;
  /** Monotonic signal for local UI state that must close when progress resets. */
  resetRevision: number;
  /** 효과음 음소거. 리셋해도 유지된다. 언어 설정과 같은 성격의 환경설정이다. */
  soundMuted: boolean;
  /** 난이도. 음소거처럼 환경설정이라 리셋해도 유지된다. */
  difficulty: Difficulty;
  /**
   * 방의 전등. 진행과 무관한 배경 오브젝트라 수집·엔딩 조건에 전혀 끼지 않는다.
   * 순전히 플레이어가 방을 만질 수 있다는 감각을 위한 스위치다.
   */
  lightsOn: boolean;
  /**
   * 인트로(어두운 방에서 전등 스위치를 찾아 켜는 1인칭 구간)를 마쳤는가.
   *
   * 새 게임은 불 꺼진 방의 1인칭에서 시작한다. 스위치를 켜는 순간 끝나고, 그 뒤로는
   * 스위치를 아무리 껐다 켜도 다시 오지 않는다. 저장된다: 이어하기가 어둠에서 다시
   * 시작되면 안 된다 (selectViewpoint).
   */
  introDone: boolean;
  /**
   * 2막의 첫 문 넘기(방문이 열린 뒤 거실에 처음 들어서기까지의 1인칭 구간)를
   * 마쳤는가. 문턱을 넘는 순간 끝난다. 그 뒤의 왕복은 평소처럼 이동이다
   * (docs/content-design.md 3-3의 예외). 저장된다.
   */
  doorwayDone: boolean;
  /**
   * 방문이 열렸는가: 한 번 열리면 계속 열려 있다. 라디오 목소리를 들은 뒤에만
   * 열 수 있고, **문이 열리는 것이 2막의 시작**이다 (docs/content-design.md 2장).
   */
  doorOpened: boolean;
  /**
   * 현관의 배트를 쥐었는가: 3막의 물건이다. 앰플을 손에 넣어야(2막 완료) 켜지고,
   * 쥐어야 현관문이 열린다 (docs/content-design.md 3-2).
   */
  batTaken: boolean;
  /** 엔딩이 시작됐는가: 거실 끝 현관문을 연 순간. */
  endingStarted: boolean;
  /**
   * 플레이어가 지금 서 있는 공간. 저장하지 않는다. 위치에서 파생되는 값이고,
   * 새로고침하면 방에서 다시 시작한다. 스토어에 드는 이유는 공유벽 컬링과 카메라가
   * Canvas 트리 곳곳에서 이 사실을 봐야 해서다 (Player가 문턱을 넘을 때만 갱신).
   */
  space: SpaceId;
  /**
   * 열린 문간 (방문 제외: 방문은 doorOpened가 2막의 시작이라 따로 산다). 화장실·안방
   * 문은 조건이 차면(selectDoorwayReady) 금빛이 돌고, 누르면 열린다. 저장된다.
   */
  openedDoorways: DoorwayId[];
  /**
   * 가지고 다니는 물건 (src/data/items.ts). 집은 순서대로. 이 방의 열쇠가 저 방의
   * 문을 연다 (src/data/doors.ts). 저장된다.
   */
  inventory: ItemId[];
  /**
   * 지금 앉아 있는 자리 (없으면 서 있다).
   *
   * 위치와 같은 성격이라 저장하지 않는다. 새로고침하면 방 한가운데에 서서 시작한다.
   * 스토어에 드는 이유는 앉히는 쪽(가구)과 앉는 쪽(Player)이 트리에서 멀리 떨어져
   * 있어서다. 진행에는 아무것도 남기지 않는다 (전등 스위치와 같은 곁가지 인터랙션).
   */
  seatedAt: SeatId | null;
  /**
   * 몸을 옮기라는 신호 (개발 도구 전용).
   *
   * 위치는 스토어에 없다. Player 그룹의 변환에만 있어서, 스토어를 아무리 고쳐도 몸은
   * 제자리다. `inLivingRoom`만 켜면 거실이 그려지는데 몸은 방에 서 있어서 카메라가 벽
   * 속을 비춘다. 그래서 "어디로 가라"를 여기 두고 Player가 그걸 보고 자기 몸을 옮긴다.
   *
   * 부를 때마다 새 객체라 같은 좌표를 다시 눌러도 신호가 다시 간다. 저장하지 않는다.
   */
  warpTarget: { x: number; z: number } | null;
  /**
   * 바닥을 눌러 걸어갈 자리 (없으면 걷고 있지 않다).
   *
   * 마우스만 쥔 사람의 이동 수단이다. 이 방의 조작은 전부 "누르면 걸어가서 한다"
   * (기억·의자·커튼·침대)라 바닥도 같은 규칙을 따른다. 도착하거나 막히거나 키로
   * 걷기 시작하면 Player가 지운다. 위치와 같은 성격이라 저장하지 않는다.
   */
  walkTarget: { x: number; z: number } | null;
  /**
   * 커튼을 잡는 몸짓 (없으면 잡고 있지 않다).
   *
   * 잡으면 Player가 창가로 **걸어가서** 벽을 보고 서고, 그제야(`arrived`) 팔을 들어
   * 커튼이 손을 따른다. 도착 전에 젖혀지면 방 저쪽에서 커튼이 혼자 열린다. 놓아도
   * (`held: false`) 팔은 잠깐 남았다가 내려오고, 다 내려오면 Player가 지운다.
   * 앉기와 같은 성격이라 저장하지 않는다.
   */
  curtainGrab: { side: CurtainSide; held: boolean; arrived: boolean } | null;
  /**
   * 지금 들여다보고 있는 단서 (책상 위 기록 노트 · 서랍 속 쪽지).
   *
   * 전등 스위치와 같은 배경 오브젝트라 진행에는 아무것도 남기지 않는다. 저장도
   * 안 하고 수집·엔딩 조건에도 끼지 않는다. 스토어가 드는 이유는 하나: 만지는
   * 쪽은 Canvas 안의 3D 물건이고 펼쳐지는 쪽은 Canvas 밖 DOM이라, 둘을 잇는
   * 자리가 여기밖에 없다.
   */
  activeClue: ClueId | null;
  /**
   * 대사가 저절로 넘어가는가 (비주얼 노벨의 오토). 저장된다.
   *
   * 한 줄이 다 찍힌 뒤 읽을 만큼 기다렸다가 다음 줄로 간다. 기다리는 시간은 글자 수를
   * 따른다(DialogueBox): 길이와 무관하게 같은 시간을 주면 긴 줄은 잘리고 짧은 줄은 늘어진다.
   */
  autoPlay: boolean;
  /**
   * 지나간 대사. 화자와 본문 키만 남긴다.
   *
   * 본문이 아니라 키를 쌓는 이유: 로그를 여는 동안 언어를 바꿔도 지나간 줄이 그 언어로
   * 읽혀야 한다. 저장하지 않는다. 한 판을 도는 동안의 기록이고, 저장본에 넣으면 진행과
   * 무관한 덩어리가 계속 자란다.
   */
  dialogueLog: DialogueLogEntry[];
  /** 로그 화면이 떠 있는가. 떠 있는 동안 Enter는 대사를 넘기지 않는다. */
  dialogueLogOpen: boolean;
  /**
   * 펼쳐 본 단서. 저장된다.
   *
   * activeClue가 "지금 보고 있는 것"이라면 이쪽은 "본 적 있는 것"이다. 진행을
   * 막지도 열지도 않고, 수첩 평면도가 어느 공간에서 무엇을 봤는지 표시하는 데만
   * 쓴다 (src/data/room-clues.ts의 CLUE_SPACE). 방탈출 축에서 "여긴 이미 뒤졌다"를
   * 플레이어 대신 기억해 두는 자리다.
   */
  cluesSeen: ClueId[];
  /**
   * 지금 붙잡고 있는 미궁 문제: 지금은 현관 잠금장치 하나뿐이다.
   *
   * 기억 인터랙션(activeInteraction)과 다른 자리인 이유: 미궁 문제는 기억이
   * 아니다. 수집·재조사에 안 세어지고, 대사도 안 딸리고, 완료는 solvedPuzzles에만
   * 남는다 (docs/content-design.md 3-2).
   */
  activePuzzle: PuzzleId | null;
  /** 풀어낸 미궁 문제. 저장된다. 현관 잠금(angle-turn)이 엔딩의 두 번째 조건이다. */
  solvedPuzzles: PuzzleId[];
  /**
   * 방을 뒤지다 알게 된 자기 자신에 대한 사실 (지금은 이름 하나). 저장된다.
   * 수첩의 흐린 칸을 열고 대사창의 화자 이름표를 바꾼다 (src/data/room-clues.ts).
   */
  discoveries: DiscoveryId[];
  /**
   * 지금 흐르는 혼잣말 한 줄과 그 시각 (없으면 null). 닫힌 방문·꺼진 컴퓨터·칫솔컵·
   * 잠긴 하부장처럼 눌러도 조사가 아닌 물건이 한 줄을 흘리는 신호다 (RemarkLine).
   * 방문의 줄은 잠긴 게 아니라 **안 여는** 것이라는 걸 말한다 (docs/content-design.md 3-1).
   */
  remark: { id: RemarkId; at: number } | null;
  beginInteraction: (id: MemoryId) => void;
  advanceDialogue: () => void;
  /** 재생을 한 칸 진행한다. 다음 줄 → 정적 → 다음 컷 → 종료 순. */
  advancePlayback: () => void;
  /** 재생을 통째로 닫는다 (끝까지 봤거나 건너뛰었거나). */
  endPlayback: () => void;
  finishMinigame: (result: MinigameResult) => void;
  /** 미니게임을 완료 처리 없이 중단한다 (모달 닫기): 핫스팟은 다시 클릭 가능. */
  cancelMinigame: () => void;
  /** 수집한 기억을 다시 재생한다 (수집 상태는 그대로). */
  replayMemory: (id: MemoryId) => void;
  setUiLock: (id: UiLockId, locked: boolean) => void;
  /** tab을 주면 그 페이지를 펼친 채 연다. 안 주면 마지막 페이지 그대로. */
  setCharacterSheetOpen: (open: boolean, tab?: CharacterSheetTab) => void;
  setCharacterSheetTab: (tab: CharacterSheetTab) => void;
  setContactOpen: (open: boolean) => void;
  setFeedbackOpen: (open: boolean) => void;
  startGame: () => void;
  /** 로딩 진행률 보고. **올리기만 한다**. 뒤늦게 붙는 모델 때문에 바가 되감기면 안 된다. */
  setRoomLoadProgress: (progress: number) => void;
  /** 부팅 커튼이 걷히기 시작했다고 알린다. finishBoot처럼 되돌리는 짝은 없다. */
  beginBootRise: () => void;
  /** 부팅 커튼이 다 올라갔다고 알린다. 되돌리는 짝은 없다. */
  finishBoot: () => void;
  setSoundMuted: (muted: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  toggleLights: () => void;
  openClue: (id: ClueId) => void;
  closeClue: () => void;
  /** 방에서 알게 된 사실을 적는다. 이미 아는 것이면 아무 일도 없다. */
  discover: (id: DiscoveryId) => void;
  /**
   * 방문을 연다. 30일 만에 처음으로. 라디오 목소리를 못 들었으면 아무 일도
   * 일어나지 않는다. 이 순간이 2막의 시작이다.
   */
  openRoomDoor: () => void;
  /**
   * 현관의 배트를 쥔다. 곧장 쥐는 게 아니라 두 줄(bat-grip)을 먼저 흘리고,
   * 그 재생이 끝나는 모든 경로(완주·스킵)에서 배트가 손에 들어온다.
   */
  takeBat: () => void;
  /** 다른 공간에 들어섰다고 알린다. Player만 부른다. */
  setSpace: (space: SpaceId) => void;
  /** 문간을 연다. 조건이 안 찼거나 방문이면 아무 일도 없다 (방문은 openRoomDoor). */
  openDoorway: (id: DoorwayId) => void;
  /** 물건을 집는다. 이미 가진 것이면 아무 일도 없다. */
  takeItem: (id: ItemId) => void;
  setAutoPlay: (next: boolean) => void;
  /** 화면에 선 대사 한 줄을 로그에 남긴다. 같은 줄이 두 번 들어오지 않는다. */
  logDialogue: (entry: DialogueLogEntry) => void;
  setDialogueLogOpen: (next: boolean) => void;
  /** 자리에 앉는다. 대사·미니게임이 떠 있으면 아무 일도 없다. */
  sitOnSeat: (id: SeatId) => void;
  /** 일어선다. 앉기 전 서 있던 자리로 돌아간다 (몸의 자리는 Player가 기억한다). */
  standUp: () => void;
  /** 바닥의 (x, z)로 걸어간다. 앉아 있으면 일어나고, 커튼 몸짓은 접는다. 시작 전·대사 중이면 무시. */
  walkTo: (x: number, z: number) => void;
  /** 도착했거나 막혔거나 다른 입력이 끼어들었다. Player만 부른다. */
  clearWalk: () => void;
  /** 커튼을 잡는다. 몸이 창가로 간다. 앉아 있거나 대사·미니게임이 떠 있으면 아무 일도 없다. */
  grabCurtain: (side: CurtainSide) => void;
  /** 커튼을 놓는다. 팔은 잠깐 더 남는다 (Player가 내린다). */
  releaseCurtain: () => void;
  /** 창가에 닿았다. Player만 부른다. 이때부터 커튼이 손을 따른다. */
  arriveAtCurtain: () => void;
  /** 팔을 다 내렸다. Player만 부른다. 몸짓이 끝난다. */
  endCurtainGrab: () => void;
  /** 몸을 그 자리로 옮긴다 (개발 도구). 걷는 연출 없이 그냥 서 있게 된다. */
  warpPlayer: (x: number, z: number) => void;
  /** 미궁 문제를 붙잡는다. 이미 푼 문제나 다른 화면이 떠 있으면 아무 일도 없다. */
  openPuzzle: (id: PuzzleId) => void;
  /** 풀지 않고 내려놓는다. 물건은 다시 클릭할 수 있다. */
  closePuzzle: () => void;
  /** 문제가 끝났다 (클리어 또는 스킵: 미니게임 계약상 스킵도 cleared다). */
  finishPuzzle: (result: MinigameResult) => void;
  /** 닫힌 방문을 두드렸다. 문이 열려 있으면 아무 일도 없다. */
  nudgeDoor: () => void;
  /** 혼잣말 한 줄을 흘린다. 다른 화면이 떠 있으면 아무 일도 없다. */
  sayRemark: (id: RemarkId) => void;
  /** 엔딩 시작: 조건을 못 채웠으면 아무 일도 일어나지 않는다. */
  startEnding: () => void;
  reset: () => void;
}

type StateSnapshot = Pick<MemoryRoomState, "collected" | "revisited" | "doorOpened"> &
  Partial<Pick<MemoryRoomState, "rechecked" | "openedDoorways" | "introDone" | "endingStarted">>;

export function gamePhaseOf(state: StateSnapshot): GamePhase {
  return state.collected.length >= MEMORY_GOAL ? 2 : 1;
}

/** 이야기의 페이즈 (v4 설계서 1-1). 진행에서 파생된다 (src/data/story-phase.ts). */
export function storyPhase(state: StateSnapshot): StoryPhase {
  return storyPhaseOf(state);
}

/**
 * 지금 몇 막인가: 밝기·창밖처럼 거친 단계만 보면 되는 곳의 축.
 *
 *   1막 방 (intro · p1 · turning) · 2막 방↔거실↔안방 (p2 · p3 · p4) · 3막 현관 (resolve)
 *
 * 경계는 문과 비트가 긋는다: 방문이 열리면 2막, 정적 비트(액자 2차)가 끝나면 3막이다.
 */
export function actOf(state: StateSnapshot): Act {
  if (phaseAtLeast(storyPhaseOf(state), "resolve")) return 3;
  return state.doorOpened ? 2 : 1;
}

/**
 * 밝기가 얼마나 되살아났는가 (0~1). 분기점부터 결심까지의 필수 조사
 * (RECOVERY_VISITS)를 센다. 곁가지는 분모에 안 낀다: 안 본 사람의 방이 덜 밝으면
 * 곁가지가 사실상 필수가 된다.
 */
export function actTwoProgress(state: StateSnapshot): number {
  if (RECOVERY_VISITS.length === 0) return 1;
  const progress = { ...state, rechecked: state.rechecked ?? [] };
  const done = RECOVERY_VISITS.filter((ref) => refDone(progress, ref)).length;
  return done / RECOVERY_VISITS.length;
}

/**
 * 이 기억의 핫스팟이 지금 어떤 상태인가.
 *
 *   available  다음 차수가 열려 있다 (페이즈가 됐고 해금 조건이 찼다)
 *   locked     다음 차수가 아직 안 열렸는데, 아무 차수도 안 봤다 (처음 보는 물건)
 *              또는 그 페이즈에 들어섰지만 해금 조건이 안 찼다
 *   done       다 봤거나, 본 뒤 다음 차수가 아직 먼 페이즈에 있다 (금빛이 남는다)
 */
export function hotspotStatus(state: StateSnapshot, id: MemoryId): HotspotStatus {
  const progress = {
    ...state,
    rechecked: state.rechecked ?? [],
    openedDoorways: state.openedDoorways ?? [],
  };
  const visit = nextVisit(progress, id);
  if (visit === undefined) return "done";
  if (visitOpen(progress, id, visit)) return "available";
  const seen = anyVisitDone(progress, id);
  if (!seen) return "locked";
  // 본 물건: 다음 차수의 페이즈에 이미 들어섰으면 조건을 기다리는 중(locked),
  // 아직 먼 페이즈면 본 물건으로 가라앉아 있다(done)
  const config = phaseConfigOf(id, visit);
  const phase = storyPhaseOf(progress);
  return config?.from && phaseAtLeast(phase, config.from) ? "locked" : "done";
}

/** 남은 밤 (3·2·1). 생존자 방송 전에는 null. */
export const selectDeadline = (state: MemoryRoomState) => deadlineOf(storyPhaseOf(state));
export const selectStoryPhase = (state: MemoryRoomState) => storyPhaseOf(state);

/**
 * 이 단서를 지금 펼칠 수 있는가.
 *
 * 대부분은 늘 열려 있다 (서랍 속 쪽지 = 방에 처음부터 놓인 물건). 예외는 조사를
 * 마친 뒤에야 배경 오브젝트가 되는 달력이다. 조사 전에 열면 미니게임이 보여줄
 * 것을 먼저 보여주는 셈이고, 그 안의 표시가 컴퓨터 비밀번호라 순서가 무너진다.
 */
export function clueUnlocked(state: StateSnapshot, id: ClueId): boolean {
  const owner = Object.entries(CLUE_AFTER_MEMORY).find(([, clue]) => clue === id)?.[0];
  return owner === undefined || state.collected.includes(owner as MemoryId);
}

/**
 * 이 기억을 한 번이라도 봤는가: 수첩·기억 패널·다시보기가 열어 줄지 정하는 기준.
 *
 * 대부분은 1바퀴 수집이 첫 관문이지만, 1바퀴가 없는 기억(컴퓨터)은 2바퀴 재조사가
 * 그 자리를 대신한다. collected만 보면 그 기억은 영영 잠긴 채로 남는다.
 */
export function isSeen(state: StateSnapshot, id: MemoryId): boolean {
  return anyVisitDone({ ...state, rechecked: state.rechecked ?? [] }, id);
}

/**
 * 결심(resolve)에 들어섰는가: 4페이즈를 마치고 정적 비트까지 지났다는 뜻이다.
 * 곁가지(게임기·공의 2차, 피아노)는 여기 끼지 않는다.
 */
export function endingReady(state: StateSnapshot): boolean {
  return actOf(state) === 3;
}

/**
 * 지금 끝나는 재생이 배트를 쥐는 두 줄인가: 그렇다면 배트가 같이 손에 들어와야
 * 한다. advancePlayback(완주)과 endPlayback(스킵) 두 출구가 같은 판정을 쓴다.
 */
function batGripEnding(state: Pick<MemoryRoomState, "activePlayback" | "batTaken">): boolean {
  return state.activePlayback?.cutsceneId === CUTSCENE_BAT_GRIP && !state.batTaken;
}

/**
 * 컷씬 재생을 연다. 등록되지 않은 id면 null이라 진행이 막히지 않는다.
 *
 * `intro`(라디오가 지직거리다 꺼지는 도입 구간)는 전환 컷씬만의 것이라 기본이
 * false다. 그림 없이 대사만 뜨는 컷씬(작별·배트)에 붙이면 아무 일도 안 일어나는
 * 몇 초가 먼저 흐른다.
 */
export function openCutscene(id: string, { intro = false } = {}): ActivePlayback | null {
  const cutscene = CUTSCENES[id];
  if (!cutscene) return null;
  return {
    kind: "cutscene",
    cutsceneId: id,
    cuts: cutscene.cuts,
    cutIndex: 0,
    lineIndex: 0,
    intro,
    // 대사가 없는 컷(그림만 서는 정적)은 처음부터 정적이다
    holding: !intro && cutscene.cuts[0]?.lines.length === 0,
  };
}

/**
 * 다시보기 재생을 엮는다. 미니게임은 빼고 그때의 대사와 그림만 잇는다.
 *
 * 이미 푼 판을 다시 풀리는 것은 되짚기가 아니라 재도전이다. 기억 패널과 수첩은
 * "무엇을 봤는지"를 다시 보여주는 자리라, 손을 다시 쓰게 만들면 안 된다.
 *
 * 대사가 한 줄도 없는 기억(조사 자체가 미니게임뿐이었던 것들)은 그때 남긴
 * 기록을 나레이션으로 대신 세운다. 눌렀는데 아무 일도 없는 줄을 만들지 않는다.
 */
export function buildMemoryReplay(id: MemoryId, gamePhase: Visit): ActivePlayback | null {
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

  /*
   * 되짚는 그림이 1막에도 있었고 2막에 다른 한 장으로 바뀌었다면, 그 한 장으로 열었다가
   * 이 장으로 밀어 넘긴다 (PhotoMorph). 지금은 액자 하나가 해당한다: 같은 장면을 두 장
   * 가진 기억이 거기뿐이다. 데이터가 정하므로 다른 기억에 두 장이 생기면 저절로 따라온다.
   */
  const earlier = gamePhase > 1 ? phaseConfigOf(id, 1)?.replayStill : undefined;
  // 밀림은 그림이 **둘 다** 있고 서로 다를 때만 성립한다. 2막에 그림이 없는 기억
  // (사인볼)은 앞 그림만 실리면 갈 곳 없는 밀림이 된다
  const morphFrom =
    earlier && config.replayStill && earlier !== config.replayStill ? earlier : undefined;
  const morphWithin = morphFrom ? REPLAY_MORPH_WITHIN[id] : undefined;

  return {
    kind: "replay",
    memoryId: id,
    cuts: [{ image: config.replayStill, fit: "contain", morphFrom, morphWithin, lines }],
    cutIndex: 0,
    lineIndex: 0,
    // 다시보기에는 도입이 없다. 라디오가 꺼지는 비트는 그 컷씬만의 것이다
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

  // 대사가 없는 컷은 들어서자마자 정적이다. 한 칸을 더 누르게 하지 않는다
  const toNextCut = (): ActivePlayback | null =>
    active.cutIndex + 1 < active.cuts.length
      ? {
          ...active,
          cutIndex: active.cutIndex + 1,
          lineIndex: 0,
          holding: active.cuts[active.cutIndex + 1].lines.length === 0,
        }
      : null;

  // 도입(라디오가 꺼지는 비트)이 끝나면 같은 컷의 첫 줄부터 시작한다
  if (active.intro) return { ...active, intro: false, holding: cut.lines.length === 0 };
  if (active.holding) return toNextCut();
  if (active.lineIndex + 1 < cut.lines.length) {
    return { ...active, lineIndex: active.lineIndex + 1 };
  }
  // 마지막 줄을 넘겼다. 정적이 걸린 컷이면 그림만 남기고 한 박자 쉰다
  if (cut.holdMs && cut.holdMs > 0) return { ...active, holding: true };
  return toNextCut();
}

/** N차 조사를 마쳤다고 적은 진행 목록들. */
function markVisit(state: MemoryRoomState, id: MemoryId, visit: Visit) {
  const add = (list: MemoryId[]) => (list.includes(id) ? list : [...list, id]);
  if (visit === 1) return { collected: add(state.collected) };
  if (visit === 2) return { revisited: add(state.revisited) };
  return { rechecked: add(state.rechecked) };
}

/**
 * 조사를 마친 순간 곧장 트는 컷씬. 방을 한 바퀴 더 둘러보게 두면 그 순간의 밀도가
 * 흩어진다. 한 번에 하나만 튼다: 앞의 것이 이긴다.
 *
 *   1. 1차를 다 모았다 = 라디오 재난방송이 막 끝났다 → 이미지 나열 (radio-blackout)
 *   2. 조사 자체에 붙은 컷씬 (생존자 방송 · 정적 비트: memories.yaml의 cutscene)
 *   3. 2페이즈를 방금 마쳤다 → p2-close
 *   4. 4페이즈의 마지막 칸(액자 2차)이 방금 열렸다 → p4-close
 */
function cutsceneAfter(
  before: MemoryRoomState,
  after: MemoryRoomState,
  id: MemoryId,
  visit: Visit,
): ActivePlayback | null {
  if (visit === 1 && before.collected.length < MEMORY_GOAL && after.collected.length >= MEMORY_GOAL)
    return openCutscene(CUTSCENE_RADIO_BLACKOUT, { intro: true });
  const own = phaseConfigOf(id, visit)?.cutscene;
  if (own) return openCutscene(own);
  const was = storyPhaseOf(before);
  const now = storyPhaseOf(after);
  if (was === "p2" && now === "p3") return openCutscene(CUTSCENE_P2_CLOSE);
  if (
    now === "p4" &&
    hotspotStatus(after, P4_FINAL_MEMORY) === "available" &&
    hotspotStatus(before, P4_FINAL_MEMORY) !== "available"
  )
    return openCutscene(CUTSCENE_P4_CLOSE);
  return null;
}

function complete(state: MemoryRoomState, id: MemoryId, visit: Visit) {
  const marked = markVisit(state, id, visit);
  const after = { ...state, ...marked };
  return {
    ...marked,
    activeInteraction: null,
    activePlayback: cutsceneAfter(state, after, id, visit) ?? state.activePlayback,
  };
}

/**
 * 저장되는 것: 진행과 방의 상태뿐이다.
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
  | "collected"
  | "revisited"
  | "rechecked"
  | "doorOpened"
  | "batTaken"
  | "solvedPuzzles"
  | "discoveries"
  | "endingStarted"
  | "soundMuted"
  | "difficulty"
  | "lightsOn"
  | "introDone"
  | "doorwayDone"
  | "openedDoorways"
  | "inventory"
  | "cluesSeen"
  | "autoPlay"
>;

const PERSIST_KEY = "rom-progress";
/**
 * 2: 3막 개편. 배트가 방문 트리거에서 현관의 3막 물건으로 옮겨가고(batTaken),
 * 거실 추리 기억들이 생겼다.
 * 3: v4 페이즈 개편. 3차 조사(rechecked)가 생기고 페이즈가 진행에서 파생된다.
 * 옛 저장본은 sanitizeProgress가 걸러 낸다. 목록이 어긋나도 페이즈가 파생값이라
 * 저장본은 그대로 이어진다 (모르는 id만 버린다).
 */
const PERSIST_VERSION = 3;

/**
 * 저장본을 지금 스키마에 맞춰 걸러낸다.
 *
 * 저장된 뒤에 기억 목록이 바뀌면(이름 변경·삭제) 없는 id가 남는다. 그대로 두면
 * 수집 개수가 실제보다 많아져 엔딩 조건이 잘못 열리거나, MEMORY_BY_ID 조회가
 * undefined를 물고 터진다. 모르는 id는 조용히 버린다. 저장본이 조금 어긋났다고
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
   * 있으므로 여기서 턴다. 남겨 두면 수집 개수가 목표를 넘어서 엔딩 조건이
   * 어긋난다.
   */
  const collected = ids(saved.collected).filter((id) => MEMORY_BY_ID[id].phase1);
  /*
   * 2바퀴는 1바퀴를 마친 기억에만 붙는다. 순서가 뒤집힌 저장본은 앞뒤가 맞게 자른다.
   * 단, 1바퀴가 아예 없는 기억(컴퓨터)은 collected에 들어갈 길이 없으므로 예외다.
   */
  const revisited = ids(saved.revisited).filter(
    (id) => MEMORY_BY_ID[id].phase2 && (collected.includes(id) || !MEMORY_BY_ID[id].phase1),
  );
  // 3차는 2차를 마친 기억에만 붙는다
  const rechecked = ids(saved.rechecked).filter(
    (id) => MEMORY_BY_ID[id].phase3 && revisited.includes(id),
  );

  // 방문은 라디오 목소리를 들은 뒤에만 열린다. 조건이 안 맞는 저장본은 닫고 시작
  const doorOpened = saved.doorOpened === true && revisited.includes("radio" as MemoryId);
  // 방문이 닫혀 있으면 그 너머의 문도 열려 있을 수 없다
  const openedDoorways = doorOpened
    ? DOORWAY_IDS.filter(
        (id) =>
          id !== "room-living" &&
          Array.isArray(saved.openedDoorways) &&
          (saved.openedDoorways as unknown[]).includes(id),
      )
    : [];
  // 배트는 결심(resolve)의 물건이다. 거기 못 간 저장본에서 쥐고 있으면 손에서 내려놓는다
  const batTaken =
    saved.batTaken === true &&
    endingReady({ collected, revisited, rechecked, doorOpened, openedDoorways });

  return {
    collected,
    revisited,
    rechecked,
    doorOpened,
    batTaken,
    solvedPuzzles: Array.isArray(saved.solvedPuzzles)
      ? PUZZLE_IDS.filter((id) => (saved.solvedPuzzles as unknown[]).includes(id))
      : [],
    discoveries: Array.isArray(saved.discoveries)
      ? DISCOVERY_IDS.filter((id) => (saved.discoveries as unknown[]).includes(id))
      : [],
    endingStarted: saved.endingStarted === true && batTaken,
    soundMuted: saved.soundMuted === true,
    // 모르는 값은 스킵이 보이는 쪽(easy)으로: normal이 잘못 살아나면 접근성 장치가 사라진다
    difficulty: saved.difficulty === "normal" ? "normal" : "easy",
    // 불은 켜진 상태가 기본: 저장본에 명시적으로 false일 때만 꺼진 채로 돌아온다
    lightsOn: saved.lightsOn !== false,
    // 인트로 도입 전의 저장본(기억을 하나라도 모았다)은 인트로를 이미 지난 것으로 본다
    introDone: saved.introDone === true || collected.length > 0,
    // 문이 안 열렸으면 문 넘기도 없다. 이 값을 모르는 옛 저장본은 문이 열렸으면 지난 것으로
    doorwayDone: doorOpened && saved.doorwayDone !== false,
    inventory: Array.isArray(saved.inventory)
      ? ITEM_IDS.filter((id) => (saved.inventory as unknown[]).includes(id))
      : [],
    // 오토는 껐다 켰다 하는 설정이라, 모르는 값이면 꺼진 쪽이 기본이다
    autoPlay: saved.autoPlay === true,
    // 본 적 있는 단서. 목록에서 사라진 id는 조용히 버린다 (기억 id와 같은 규칙)
    cluesSeen: Array.isArray(saved.cluesSeen)
      ? CLUE_IDS.filter((id) => (saved.cluesSeen as unknown[]).includes(id))
      : [],
    openedDoorways,
  };
}

export const useMemoryRoomStore = create<MemoryRoomState>()(
  persist<MemoryRoomState, [], [], Partial<PersistedProgress>>(
    (set) => ({
      collected: [],
      revisited: [],
      rechecked: [],
      activeInteraction: null,
      activePlayback: null,
      uiLocks: [],
      characterSheetOpen: false,
      characterSheetTab: "profile",
      contactOpen: false,
      feedbackOpen: false,
      started: false,
      cluesSeen: [],
      autoPlay: false,
      dialogueLog: [],
      dialogueLogOpen: false,
      roomLoadProgress: 0,
      booted: false,
      bootRising: false,
      resetRevision: 0,
      soundMuted: false,
      difficulty: "easy",
      lightsOn: true,
      introDone: false,
      doorwayDone: false,
      doorOpened: false,
      batTaken: false,
      endingStarted: false,
      space: "room",
      openedDoorways: [],
      inventory: [],
      seatedAt: null,
      warpTarget: null,
      walkTarget: null,
      curtainGrab: null,
      activeClue: null,
      activePuzzle: null,
      solvedPuzzles: [],
      discoveries: [],
      remark: null,
      beginInteraction: (id) =>
        set((state) => {
          if (state.activePlayback) return state;
          // 1인칭에 있는 동안은 조사하지 않는다. 어둠 속의 할 일은 스위치 하나, 문 앞의 할 일은 나가기 하나다
          if (viewpointOf(state) !== null) return state;
          if (state.activeInteraction || hotspotStatus(state, id) !== "available") return state;
          const gamePhase = nextVisit(state, id);
          if (gamePhase === undefined) return state;
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
        set((state) => {
          if (!state.activePlayback) return state;
          const next = nextPlaybackStep(state.activePlayback);
          return {
            activePlayback: next,
            // 두 줄이 다 흘렀으면 그때 배트가 손에 들어온다. 재생의 끝이 곧 손잡이다
            ...(next === null && batGripEnding(state) ? { batTaken: true } : {}),
          };
        }),
      endPlayback: () =>
        set((state) =>
          state.activePlayback
            ? {
                activePlayback: null,
                // 건너뛰어도 배트는 손에 들어온다. 스킵은 유효한 결말이다
                ...(batGripEnding(state) ? { batTaken: true } : {}),
              }
            : state,
        ),
      finishMinigame: (result) =>
        set((state) => {
          const active = state.activeInteraction;
          if (active?.phase !== "minigame") return state;
          const interaction = phaseConfigOf(active.memoryId, active.gamePhase)?.interaction;
          // 클리어했으면 결과 대사로: 미니게임 화면을 뒤에 남긴 채 대사창이 뜬다
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
           * 거저 열린다. 미니게임을 푸는 의미가 사라진다.
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
          // 여러 차수를 본 기억이면 마지막으로 본 차수를 되돌려준다
          const gamePhase = lastVisitDone(state, id);
          if (gamePhase === undefined) return state;
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
      setCharacterSheetOpen: (open, tab) =>
        set((state) => ({
          characterSheetOpen: open,
          characterSheetTab: tab ?? state.characterSheetTab,
        })),
      setCharacterSheetTab: (tab) => set({ characterSheetTab: tab }),
      setContactOpen: (open) => set({ contactOpen: open }),
      setFeedbackOpen: (open) => set({ feedbackOpen: open }),
      // 새 게임은 불 꺼진 방에서 시작한다 (인트로). 인트로를 지난 저장본은 불을 건드리지 않는다
      startGame: () =>
        set((state) => ({ started: true, lightsOn: state.introDone ? state.lightsOn : false })),
      setRoomLoadProgress: (progress) =>
        set((state) =>
          progress > state.roomLoadProgress ? { roomLoadProgress: progress } : state,
        ),
      beginBootRise: () => set({ bootRising: true }),
      finishBoot: () => set({ booted: true, bootRising: true }),
      setSoundMuted: (muted) => set({ soundMuted: muted }),
      setDifficulty: (difficulty) => set({ difficulty }),
      // 불이 켜지는 첫 순간이 인트로의 끝이다. 이미 지났으면 그냥 스위치다
      toggleLights: () =>
        set((state) => ({
          lightsOn: !state.lightsOn,
          introDone: state.introDone || !state.lightsOn,
        })),
      // 대사·미니게임·컷씬이 도는 중에는 단서를 펼치지 않는다. 화면이 두 겹이 된다.
      // 1인칭 구간에서도 안 펼친다: 어둠 속의 할 일은 스위치 하나, 문 앞의 할 일은 나가기 하나다
      openClue: (id) =>
        set((state) =>
          state.activeInteraction ||
          state.activePlayback ||
          viewpointOf(state) !== null ||
          !clueUnlocked(state, id)
            ? state
            : {
                activeClue: id,
                cluesSeen: state.cluesSeen.includes(id)
                  ? state.cluesSeen
                  : [...state.cluesSeen, id],
              },
        ),
      closeClue: () => set((state) => (state.activeClue ? { activeClue: null } : state)),
      discover: (id) =>
        set((state) =>
          state.discoveries.includes(id) ? state : { discoveries: [...state.discoveries, id] },
        ),
      openRoomDoor: () => set((state) => (selectDoorReady(state) ? { doorOpened: true } : state)),
      takeItem: (id) =>
        set((state) =>
          state.inventory.includes(id) ? state : { inventory: [...state.inventory, id] },
        ),
      setAutoPlay: (next) => set({ autoPlay: next }),
      logDialogue: (entry) =>
        set((state) => {
          const last = state.dialogueLog.at(-1);
          // 같은 줄이 다시 들어오는 건 리마운트지 새 대사가 아니다
          if (last && last.speaker === entry.speaker && last.textKey === entry.textKey)
            return state;
          const next = [...state.dialogueLog, entry];
          // 오래된 줄부터 버린다. 한 판에 수백 줄이 흐르는데 다 들고 있을 이유가 없다
          return {
            dialogueLog: next.length > DIALOGUE_LOG_MAX ? next.slice(-DIALOGUE_LOG_MAX) : next,
          };
        }),
      setDialogueLogOpen: (next) => set({ dialogueLogOpen: next }),
      takeBat: () =>
        set((state) => {
          // 3막이 아니거나 다른 장면이 도는 중이면 배트는 그냥 현관에 선 소품이다
          if (!selectBatReady(state) || state.activePlayback || state.activeInteraction)
            return state;
          const playback = openCutscene(CUTSCENE_BAT_GRIP);
          // 컷씬 데이터가 없으면(등록 누락) 대사 없이라도 쥐어진다. 진행이 먼저다
          return playback ? { activePlayback: playback } : { batTaken: true };
        }),
      setSpace: (space) =>
        set((state) => {
          if (state.space === space) return state;
          // 문이 열린 뒤 처음 거실에 들어서는 순간 1인칭 문 넘기가 끝난다
          const doorwayDone = state.doorwayDone || (space === "living" && state.doorOpened);
          return { space, doorwayDone };
        }),
      openDoorway: (id) =>
        set((state) =>
          id === "room-living" || !doorwayReady(state, id) || state.openedDoorways.includes(id)
            ? state
            : { openedDoorways: [...state.openedDoorways, id] },
        ),
      // 1인칭에 있는 동안은 앉지 않는다. 카메라가 머리 안에 있는데 몸만 의자로 가면 시야가 뒤집힌다
      sitOnSeat: (id) =>
        set((state) =>
          state.seatedAt === id || selectSceneInputLocked(state) || viewpointOf(state) !== null
            ? state
            : { seatedAt: id },
        ),
      standUp: () => set((state) => (state.seatedAt === null ? state : { seatedAt: null })),
      // 앉은 채로 옮기면 몸만 가고 의자는 남는다. 옮기기 전에 일어선다.
      // 평면도로 옮기면 들여다보던 문제(피아노)와 판(앰플)도 내려놓는다. 두고 오면 붙박이
      // 카메라와 판이 저쪽 공간에 남는다.
      warpPlayer: (x, z) =>
        set((state) => ({
          warpTarget: { x, z },
          seatedAt: null,
          curtainGrab: null,
          walkTarget: null,
          activePuzzle: null,
          activeInteraction:
            state.activeInteraction?.phase === "minigame" ? null : state.activeInteraction,
        })),
      walkTo: (x, z) =>
        set((state) =>
          !state.started || selectSceneInputLocked(state)
            ? state
            : { walkTarget: { x, z }, seatedAt: null, curtainGrab: null },
        ),
      clearWalk: () => set((state) => (state.walkTarget ? { walkTarget: null } : state)),
      grabCurtain: (side) =>
        set((state) =>
          state.seatedAt !== null || selectSceneInputLocked(state) || viewpointOf(state) !== null
            ? state
            : { curtainGrab: { side, held: true, arrived: false } },
        ),
      releaseCurtain: () =>
        set((state) =>
          state.curtainGrab?.held ? { curtainGrab: { ...state.curtainGrab, held: false } } : state,
        ),
      arriveAtCurtain: () =>
        set((state) =>
          state.curtainGrab && !state.curtainGrab.arrived
            ? { curtainGrab: { ...state.curtainGrab, arrived: true } }
            : state,
        ),
      endCurtainGrab: () => set((state) => (state.curtainGrab ? { curtainGrab: null } : state)),
      openPuzzle: (id) =>
        set((state) => {
          // 다른 화면(대사·미니게임·재생·단서)이 떠 있으면 위에 얹지 않는다
          if (state.activeInteraction || state.activePlayback || state.activeClue) return state;
          if (state.activePuzzle || state.solvedPuzzles.includes(id)) return state;
          // 하부장 다이얼은 아빠 메일 힌트(컴퓨터 3차)를 본 뒤에만 연다 (v4 3-5)
          if (id === "sink-dial" && !selectSinkHintRead(state)) return state;
          return { activePuzzle: id };
        }),
      closePuzzle: () => set((state) => (state.activePuzzle ? { activePuzzle: null } : state)),
      finishPuzzle: (result) =>
        set((state) => {
          if (!state.activePuzzle) return state;
          if (!result.cleared) return { activePuzzle: null };
          const solved = state.activePuzzle;
          /*
           * 하부장이 열리면 그 안의 안방 열쇠가 손에 들어온다 (v4 3-5). 집는 동작을 따로
           * 두지 않는다: 열린 칸 안에 열쇠 하나뿐이라 한 번 더 누르게 하면 심부름이다.
           */
          const reward: Partial<MemoryRoomState> =
            solved === "sink-dial"
              ? {
                  inventory: state.inventory.includes("parents-key")
                    ? state.inventory
                    : [...state.inventory, "parents-key"],
                  remark: { id: "sink-open", at: Date.now() },
                }
              : solved === "piano-melody"
                ? { remark: { id: "piano-done", at: Date.now() } }
                : {};
          return {
            activePuzzle: null,
            solvedPuzzles: [...state.solvedPuzzles, solved],
            ...reward,
          };
        }),
      nudgeDoor: () =>
        set((state) =>
          state.doorOpened || selectSceneInputLocked(state)
            ? state
            : {
                remark: {
                  id: selectDoorReady(state) ? "door-ready" : "door-stay",
                  at: Date.now(),
                },
              },
        ),
      sayRemark: (id) =>
        set((state) =>
          selectSceneInputLocked(state) || viewpointOf(state) !== null
            ? state
            : { remark: { id, at: Date.now() } },
        ),
      startEnding: () =>
        set((state) =>
          state.batTaken && selectFrontDoorUnlocked(state) ? { endingStarted: true } : state,
        ),
      reset: () =>
        set((state) => ({
          collected: [],
          revisited: [],
          rechecked: [],
          activeInteraction: null,
          activePlayback: null,
          uiLocks: [],
          characterSheetOpen: false,
          characterSheetTab: "profile",
          contactOpen: false,
          feedbackOpen: false,
          started: false,
          lightsOn: true,
          introDone: false,
          doorwayDone: false,
          doorOpened: false,
          batTaken: false,
          endingStarted: false,
          space: "room",
          openedDoorways: [],
          inventory: [],
          seatedAt: null,
          warpTarget: null,
          walkTarget: null,
          curtainGrab: null,
          activeClue: null,
          cluesSeen: [],
          dialogueLog: [],
          dialogueLogOpen: false,
          activePuzzle: null,
          solvedPuzzles: [],
          discoveries: [],
          remark: null,
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
        rechecked: state.rechecked,
        doorOpened: state.doorOpened,
        batTaken: state.batTaken,
        solvedPuzzles: state.solvedPuzzles,
        discoveries: state.discoveries,
        endingStarted: state.endingStarted,
        soundMuted: state.soundMuted,
        difficulty: state.difficulty,
        lightsOn: state.lightsOn,
        introDone: state.introDone,
        doorwayDone: state.doorwayDone,
        openedDoorways: state.openedDoorways,
        inventory: state.inventory,
        cluesSeen: state.cluesSeen,
        autoPlay: state.autoPlay,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeProgress(persisted) }),
    },
  ),
);

export const selectCollected = (state: MemoryRoomState) => state.collected;
/** 주인공의 이름을 아는가: 수첩 이름·나이 칸과 대사창 화자 이름표가 이걸 본다. */
export const selectHeroNameKnown = (state: MemoryRoomState) =>
  state.discoveries.includes("hero-name");
export const selectActiveInteraction = (state: MemoryRoomState) => state.activeInteraction;
export const selectActivePlayback = (state: MemoryRoomState) => state.activePlayback;
export const selectGamePhase = (state: MemoryRoomState) => gamePhaseOf(state);
export const selectAct = (state: MemoryRoomState) => actOf(state);
export const selectActTwoProgress = (state: MemoryRoomState) => actTwoProgress(state);
export const selectEndingReady = (state: MemoryRoomState) => endingReady(state);

/**
 * 방문을 열 수 있는가: 라디오 목소리를 들은 뒤, 아직 안 열었을 때.
 *
 * 순서가 정해져 있다: 1막 끝(라디오 방송·암전) → 라디오가 저 혼자 다시 켜짐 →
 * 목소리를 잡음(revisited) → 방문에 금빛이 돈다 → 열면 **그때가 2막의 시작**.
 * 문이 열리기 전의 방은 아직 1막이다. 나머지 재조사도 문이 열려야 풀린다
 * (hotspotStatus의 doorOpened 게이트).
 */
export const selectDoorReady = (state: MemoryRoomState) =>
  state.revisited.includes("radio") && !state.doorOpened;

/**
 * 어느 문간이 열려 있는가. 방문은 doorOpened, 나머지는 openedDoorways.
 * 원시값 배열이 아니라 매번 새 배열이라 zustand 셀렉터로는 쓰지 말고 getState()에서 읽는다.
 */
export function openDoorwayIds(
  state: Pick<MemoryRoomState, "doorOpened" | "openedDoorways">,
): DoorwayId[] {
  return state.doorOpened ? ["room-living", ...state.openedDoorways] : [];
}

export const selectDoorwayOpen = (id: DoorwayId) => (state: MemoryRoomState) =>
  id === "room-living" ? state.doorOpened : state.openedDoorways.includes(id);

/**
 * 이 문간을 열 수 있는가 (아직 안 열렸고 조건이 찼다).
 *
 * 거실 너머의 문은 모두 방문이 열린 뒤(2막)의 것이고, 그 위에 src/data/doors.ts의
 * 규칙(필요한 물건)이 얹힌다. 방문 자체는 여기서 열지 않는다 (openRoomDoor).
 */
export function doorwayReady(
  state: StateSnapshot & Pick<MemoryRoomState, "inventory">,
  id: DoorwayId,
): boolean {
  if (id === "room-living" || !state.doorOpened) return false;
  const rule = DOOR_RULES[id];
  return rule.item === undefined || state.inventory.includes(rule.item);
}

export const selectDoorwayReady = (id: DoorwayId) => (state: MemoryRoomState) =>
  !state.openedDoorways.includes(id) && doorwayReady(state, id);

/**
 * 현관의 배트를 쥘 수 있는가: 결심(resolve)에 들어선 뒤, 아직 안 쥐었을 때.
 *
 * 배트가 1막부터 현관에 서 있어도 켜지지 않는 이유다. 무기가 필요해지는 것은
 * 나갈 이유가 생긴 다음이고, 나갈 이유는 안방의 서류와 액자 앞의 정적 비트가 만든다.
 * 정적 비트가 도는 동안에는 아직 아니다: 한 줄이 끝나야 금빛이 돈다.
 */
export const selectBatReady = (state: MemoryRoomState) =>
  storyPhaseOf(state) === "resolve" && !state.batTaken && state.activePlayback === null;

/** 배트를 쥐었는가: 현관문이 이걸 본다. */
/** 팔을 들고 있어야 하는가: Player가 프레임마다 본다 (구독하지 않는다). */
/** 커튼이 손을 따라도 되는가: 몸이 창가에 닿은 뒤다. */
export const isAtCurtain = (state: MemoryRoomState) => state.curtainGrab?.arrived === true;

export const selectBatTaken = (state: MemoryRoomState) => state.batTaken;

/** 방문이 열려 있는가: 걷기 영역과 문짝 회전이 같이 본다. */
export const selectDoorOpened = (state: MemoryRoomState) => state.doorOpened;

/**
 * 현관 잠금(angle-turn 미궁)이 풀렸는가: 엔딩의 두 번째 조건이다.
 * 기억을 다 되찾아도(endingReady) 이게 안 풀리면 현관문은 잠금 화면을 연다.
 */
export const selectFrontDoorUnlocked = (state: MemoryRoomState) =>
  state.solvedPuzzles.includes("angle-turn");
/**
 * 지금 카메라가 도해의 1인칭에 있는가, 있다면 어느 구간인가.
 *
 * 두 번뿐이다. 둘 다 "어둠 속에서 빛 하나를 찾아 걸어간다"는 같은 그림이고,
 * 빛의 정체만 다르다: 인트로는 전등 스위치, 2막 도입은 열린 문. 세 번째는 없다.
 * 엔딩은 영상이 받는다 (docs/content-design.md 3-3).
 *
 * - intro:   새 게임 시작 직후, 불을 켜기 전까지
 * - doorway: 방문이 열린 뒤, 거실에 처음 들어서기 전까지
 *
 * 값이 아닌 문자열을 돌려준다. 객체를 새로 만들면 zustand가 매 렌더 새 스냅샷으로 본다.
 */
export type Viewpoint = "intro" | "doorway" | null;

export function viewpointOf(
  state: Pick<
    MemoryRoomState,
    "started" | "endingStarted" | "introDone" | "doorOpened" | "doorwayDone"
  >,
): Viewpoint {
  if (!state.started || state.endingStarted) return null;
  if (!state.introDone) return "intro";
  if (state.doorOpened && !state.doorwayDone) return "doorway";
  return null;
}

export const selectViewpoint = (state: MemoryRoomState) => viewpointOf(state);

export const selectSceneInputLocked = (state: MemoryRoomState) =>
  state.activeInteraction !== null ||
  state.activePlayback !== null ||
  state.activePuzzle !== null ||
  state.uiLocks.length > 0;

/**
 * 라디오가 저 혼자 살아나 있는가.
 *
 * 재난방송이 끊기면서 라디오는 확실히 죽는다. 2바퀴의 문은 도해가 다시 만지는 게
 * 아니라 라디오가 먼저 말을 거는 것이라, 컷씬이 끝난 자리에서 저절로 지직거린다.
 * 목소리를 잡고 나면(revisited) 더는 깜빡이지 않는다. 할 말을 이미 했으니까.
 */
export const selectRadioSignaling = (state: MemoryRoomState) =>
  storyPhaseOf(state) === "turning" &&
  !state.revisited.includes("radio") &&
  state.activePlayback === null;

/**
 * BGM이 뒤로 물러나야 하는 정도를 정하는 축. 미니게임은 효과음이, 대사는 글이
 * 주인공이라 눌러야 하는 깊이가 다르다 (lib/audio의 useRoomMusic).
 *
 * 원시 문자열로 돌려준다. 객체를 새로 만들면 zustand가 매 렌더 새 스냅샷으로 본다.
 */
export const selectMusicForeground = (state: MemoryRoomState): "room" | "dialogue" | "minigame" => {
  if (state.activeInteraction?.phase === "minigame" || state.activePuzzle !== null)
    return "minigame";
  if (state.activeInteraction !== null || state.uiLocks.length > 0) return "dialogue";
  return "room";
};

/**
 * 곡이 흐르고 있어야 하는가. 컷씬은 방송이 끊긴 정적 위에 서는 장면이라 곡도 같이
 * 멎는다. 여기서 BGM이 계속 흐르면 "뚝 끊김"이 소리로 전달되지 않는다.
 *
 * **전환 구간은 통째로 정적이다.** 1막을 다 모은 순간(라디오)부터 방문이 열리기까지,
 * 컷씬만이 아니라 그 앞뒤까지 곡이 없다. 컷씬 동안만 멎게 했더니 컷씬이 끝나는 자리에서
 * 1막 곡이 처음부터 다시 들었다: 재난방송이 끊긴 정적 위에서 라디오가 말을 거는
 * 구간인데 곡이 돌아와 버리면 그 정적이 사라진다. 2막 곡은 문이 열리는 순간,
 * 이 정적 위에 처음 든다 (selectMusicPhase, docs/content-design.md 8장).
 */
export const selectMusicPlaying = (state: MemoryRoomState) =>
  state.started &&
  // 곡은 스위치를 켜는 순간 시작한다. 어둠 속에서는 정적뿐이다 (인트로)
  state.introDone &&
  !state.endingStarted &&
  state.activePlayback?.kind !== "cutscene" &&
  !(gamePhaseOf(state) === 2 && !state.doorOpened);

/**
 * BGM이 몇 번째 곡을 틀어야 하는가. 곡은 막이 아니라 **전환 컷씬**을 기준으로
 * 둘로 갈린다 (docs/content-design.md 8장).
 *
 * gamePhaseOf(수집 완주 즉시 2)가 아니라 doorOpened를 본다. 문이 열리는 것이
 * 2막의 시작이다(selectDoorReady 주석). 수집 완료부터 문이 열리기까지의 구간
 * (라디오 목소리)은 아직 1막의 끝자락이라 곡도 1막 것이 남아야 한다.
 */
export const selectMusicPhase = (state: MemoryRoomState): 1 | 2 => (state.doorOpened ? 2 : 1);

/** 로그 한 줄: 누가 무엇을 말했는가. 본문은 키로 남는다 (dialogueLog 주석). */
export type DialogueLogEntry = Pick<DialogueScriptLine, "speaker" | "textKey">;

/** 로그에 남기는 최대 줄 수. 넘치면 오래된 줄부터 버린다. */
const DIALOGUE_LOG_MAX = 200;

/** 되살아나는 길의 필수 조사 수. 밝기 상승 구간의 분모다 (actTwoProgress). */
export const ACT2_TOTAL = RECOVERY_VISITS.length;

/** 1막 조사 목표. 밝기 하강 구간의 분모다. 데이터 쪽 MEMORY_GOAL과 같은 수. */
export const MEMORY_TOTAL = MEMORY_GOAL;

/*
 * 밝기 입력은 원시값으로만 노출한다. 객체를 새로 만들어 돌려주면 zustand가
 * 매 렌더 새 스냅샷으로 보고 무한 루프에 빠진다 (getServerSnapshot 경고).
 */
export const selectCollectedCount = (state: MemoryRoomState) => state.collected.length;
export const selectRevisitedCount = (state: MemoryRoomState) => state.revisited.length;

/**
 * 아빠 메일의 하부장 힌트를 봤는가 (v4 1-3의 dadHintRead · logoMatched).
 * 둘 다 컴퓨터 3차 조사(로고 매칭 → 메일) 한 번에 선다.
 */
export const selectSinkHintRead = (state: Pick<MemoryRoomState, "rechecked">) =>
  state.rechecked.includes("computer" as MemoryId);

/** 엄마 대화방의 "1"을 열었는가 (v4 1-3의 momChatRead): 폰 2차 조사. */
export const selectMomChatRead = (state: Pick<MemoryRoomState, "revisited">) =>
  state.revisited.includes("phone" as MemoryId);

/** 생존자 방송을 들었는가 (v4 1-3의 heardSurvivorBroadcast): 라디오 2차 조사. */
export const selectHeardSurvivorBroadcast = (state: Pick<MemoryRoomState, "revisited">) =>
  state.revisited.includes("radio" as MemoryId);

/** 정적 비트를 지났는가 (v4 1-3의 stillBeatDone): 결심에 들어섰다. */
export const selectStillBeatDone = (state: MemoryRoomState) =>
  phaseAtLeast(storyPhaseOf(state), "resolve");

/** 이 기억의 차수 목록 (수첩·패널이 쓴다). */
export { visitsOf };
