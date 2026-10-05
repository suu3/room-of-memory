import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DOOR_RULES } from "@/data/doors";
import { ITEM_IDS, ITEM_PUZZLE, type ItemId } from "@/data/items";
import {
  CUTSCENE_BAT_GRIP,
  CUTSCENE_P2_CLOSE,
  CUTSCENE_P4_CLOSE,
  CUTSCENE_RADIO_BLACKOUT,
  CUTSCENE_TRIP_DOUBT,
  CUTSCENE_WORKBOOK_NAME,
  CUTSCENES,
  MEMORY_BY_ID,
  MEMORY_GOAL,
  MEMORY_IDS,
  type MemoryId,
  P4_FINAL_MEMORY,
  phaseConfigOf,
  REPLAY_MORPH_WITHIN,
  SCRIPTS,
} from "@/data/memory-room";
import { type NotebookTabId, notebookEntries, unreadNotebookTabs } from "@/data/notebook";
import {
  CLUE_AFTER_MEMORY,
  CLUE_AFTER_VISIT,
  CLUE_DISCOVERY,
  CLUE_IDS,
  type ClueId,
  DISCOVERY_IDS,
  type DiscoveryId,
  PUZZLE_IDS,
  type PuzzleId,
  VISIT_AFTER_DISCOVERY,
  VISIT_AFTER_PUZZLE,
} from "@/data/room-clues";
import { DOORWAY_IDS, type DoorwayId, type SpaceId } from "@/data/spaces";
import {
  anyVisitDone,
  deadlineOf,
  lastVisitDone,
  nextVisit,
  packedCount,
  packedForExit,
  phaseAtLeast,
  RECOVERY_VISITS,
  refDone,
  SIGNAL_MEMORY,
  type StoryPhase,
  signalSilence,
  storyPhaseOf,
  type Visit,
  visitDone,
  visitOpen,
} from "@/data/story-phase";
import type { CurtainSide } from "@/types/curtain";
import type { CutsceneCut, DialogueScriptLine, ResultMusic } from "@/types/interaction";
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
 * 막: 이야기의 단계이자 공간의 단계 (docs/story/content-design.md 2장).
 *
 *   1막 방(외면) · 2막 방↔거실(직면의 추리) · 3막 현관(세상)
 *
 * 경계는 문과 물건이 긋는다: 방문이 열리면 2막, 앰플을 쥐면 3막이다.
 */
export type Act = 1 | 2 | 3;
/**
 * 난이도 (2026-09-28 개편).
 *
 * - normal(보통, 기본): 막히면 미니게임 스킵이 열린다. 예전의 "이지"가 이것이다.
 * - guided(이지): 보통에 더해, HUD 목표 줄이 "어디에 가서 무엇을" 할지까지 짚는다
 *   (src/store/next-step.ts).
 *
 * 스킵을 숨기던 예전 "보통"은 없앴다. 값 이름을 easy에서 guided로 바꾼 것은 저장본
 * 때문이다: 옛 저장본의 "easy"(그때의 기본)가 새 이지로 읽히면 고른 적 없는 안내가
 * 켜진다. 옛 값은 전부 새 보통으로 이어진다 (sanitizeProgress).
 */
type Difficulty = "guided" | "normal";
/** 수첩(캐릭터 시트)의 페이지: 프로필과 기록(기억 스크랩북). */
export type CharacterSheetTab = NotebookTabId;
type InteractionPhase = "dialogue" | "minigame";
export type HotspotStatus = "locked" | "available" | "done";
/**
 * 스치는 혼잣말 한 줄 (RemarkLine). 조사도 기록도 아닌, 물건을 눌렀을 때 도해가
 * 흘리는 말이다. 본문은 common.json의 remark.* (문은 door.*).
 */
/** 카메라가 붙들릴 수 있는 대상. 기억이 아닌 물건이라 CameraFocusId와 따로 센다. */
export type CameraHoldId = "nightstand-drawer";

/** 같은 혼잣말을 다시 띄우기까지의 틈(ms). RemarkLine이 한 줄을 세워 두는 최소 시간과 같다. */
const REMARK_REPEAT_MS = 3200;

export type RemarkId =
  | "door-stay"
  | "door-ready"
  | "computer-off"
  | "toothbrush"
  | "drawer-locked"
  | "drawer-open"
  | "piano-done"
  // 안방 책상의 악보 조각을 집은 순간: 거실 피아노의 것임을 짚는다
  | "sheet-taken"
  | "parents-locked"
  // 캐비닛 위 탁상시계: 1막에는 멈춘 시각, 2막부터 다시 가는 초침
  | "clock-stopped"
  | "clock-running"
  // 천장 에어컨 (쉼표 비트): 11월이라 틀 일이 없다. 진행에 아무것도 남기지 않는다
  | "aircon"
  // 세면대 마개를 뽑아 물이 빠진 순간: 시선을 대야 바닥(배지)으로 끈다
  | "sink-drained"
  // 세면대 바닥의 출입증 배지를 들여다보고 내려놓은 순간: 앰플 라벨의 조각과 이어진다
  | "badge-found"
  // 이미 본 기억을 다시 눌렀을 때: 그 기억의 마지막 기록 문장 (remark.memoryId)
  | "seen"
  // 필요한 물건 없이 문제 판을 조작했을 때: 떠 있는 판의 needsItem 한 줄 (피아노: 악보)
  | "needs-item"
  // 아직 안 본 채 잠긴 기억을 눌렀을 때의 기본 한 줄. 아무 반응도 없으면 "클릭이 안 된다"로
  // 읽힌다 (엄마 쪽지 뒤의 냉장고 아래칸). 전용 줄이 있는 물건(컴퓨터)은 그걸 쓴다
  | "locked";

type UiLockId =
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
type PlaybackKind = "cutscene" | "replay";

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
  /** 지금 재생이 끝나면 이어서 흐를 컷씬들 (한 조사에 여러 비트가 걸릴 때). 저장하지 않는다. */
  queuedPlaybacks: ActivePlayback[];
  /** DOM overlay sources currently blocking scene controls. */
  uiLocks: UiLockId[];
  /**
   * DOM이 3D 씬을 통째로 덮고 있다 (엔딩 영상·카드). 캔버스가 그리기를 멈춰 영상 디코딩에
   * GPU를 비켜 준다. 저장하지 않는다.
   */
  sceneCovered: boolean;
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
   * (docs/story/content-design.md 3-3의 예외). 저장된다.
   */
  doorwayDone: boolean;
  /**
   * 방문이 열렸는가: 한 번 열리면 계속 열려 있다. 라디오 목소리를 들은 뒤에만
   * 열 수 있고, **문이 열리는 것이 2막의 시작**이다 (docs/story/content-design.md 2장).
   */
  doorOpened: boolean;
  /**
   * 현관의 배트를 쥐었는가: 3막의 물건이다. 앰플을 손에 넣어야(2막 완료) 켜지고,
   * 쥐어야 현관문이 열린다 (docs/story/content-design.md 3-2).
   */
  batTaken: boolean;
  /**
   * 피아노 악보의 지워진 마디를 봤는가: 악보 조각 없이 피아노 판을 연 순간. 곁가지
   * 피아노의 표식은 이걸 기준으로 켜진다. 무엇을 찾는지 안 뒤에야 안방의 조각이 부른다
   * (선반 책이 아빠 메일 뒤에 부르는 것과 같은 문법). 저장한다.
   */
  pianoGapSeen: boolean;
  /**
   * 세면대의 고인 물을 뺐는가: 마개를 뽑은 순간. 물이 빠지면 대야 바닥의 출입증 배지
   * (단서 raon-badge)가 드러난다. 물은 다시 차지 않는다. 저장한다.
   */
  sinkDrained: boolean;
  /** 엔딩이 시작됐는가: 거실 끝 현관문을 연 순간. */
  endingStarted: boolean;
  /**
   * 엔딩까지 간 저장본을 불러왔고, 아직 이어하기를 누르지 않았는가. 저장본의 엔딩은
   * 불러오는 순간이 아니라 타이틀에서 이어하기를 고른 순간에 다시 열린다 (startGame).
   * 곧장 켜면 타이틀 위로 문이 열리고 영상이 덮였다. 저장할 때는 endingStarted로 적힌다.
   */
  endingPending: boolean;
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
   * 지금 들여다보고 있는 단서 (벽의 달력 · 선반의 책).
   *
   * 전등 스위치와 같은 배경 오브젝트라 진행에는 아무것도 남기지 않는다. 저장도
   * 안 하고 수집·엔딩 조건에도 끼지 않는다. 스토어가 드는 이유는 하나: 만지는
   * 쪽은 Canvas 안의 3D 물건이고 펼쳐지는 쪽은 Canvas 밖 DOM이라, 둘을 잇는
   * 자리가 여기밖에 없다.
   */
  activeClue: ClueId | null;
  /**
   * 문제집에서 이름을 막 찾았고, 아직 자기소개 대사(workbook-name)가 안 흘렀다.
   * 인스펙트 화면 위로 대사창을 겹치지 않으려고 문제집을 내려놓는 순간(closeClue)에
   * 튼다. 저장하지 않는다: 이름을 찾는 일은 한 번뿐이라 다시 설 일이 없다.
   */
  nameIntroPending: boolean;
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
   * 남는다 (docs/story/content-design.md 3-2).
   */
  activePuzzle: PuzzleId | null;
  /**
   * 붙잡은 문제를 방금 풀었다: 결과 카드가 떠 있다. 카드의 "계속"이 finishPuzzle을
   * 불러 보상(열쇠·혼잣말·카메라)이 나가기 전까지는 activePuzzle도 그대로다.
   * 이게 없으면 판이 풀리자마자 조용히 닫혀서, 맞힌 건지 그냥 꺼진 건지 알 수 없었다.
   * 저장하지 않는다.
   */
  puzzleCleared: boolean;
  /** 풀어낸 미궁 문제. 저장된다. */
  solvedPuzzles: PuzzleId[];
  /**
   * 방을 뒤지다 알게 된 자기 자신에 대한 사실 (지금은 이름 하나). 저장된다.
   * 수첩의 흐린 칸을 열고 대사창의 화자 이름표를 바꾼다 (src/data/room-clues.ts).
   */
  discoveries: DiscoveryId[];
  /**
   * 수첩을 한 번이라도 펼쳤는가. 저장된다. 처음 이름을 알게 된 뒤 수첩 손잡이가
   * 부르는 것(onboardingStep의 "notebook")을 끄는 데만 쓴다.
   */
  notebookOpened: boolean;
  /**
   * 수첩에서 펼쳐 본 항목의 이름 (src/data/notebook.ts의 notebookEntries). 저장된다.
   * 적혀 있는데 여기 없는 항목이 "안 읽은 알림"이다: 수첩 손잡이와 그 페이지 탭에 점이 선다.
   */
  notebookRead: string[];
  /**
   * 지금 흐르는 혼잣말 한 줄과 그 시각 (없으면 null). 닫힌 방문·꺼진 컴퓨터·칫솔컵·
   * 잠긴 협탁 서랍처럼 눌러도 조사가 아닌 물건이 한 줄을 흘리는 신호다 (RemarkLine).
   * 방문의 줄은 잠긴 게 아니라 **안 여는** 것이라는 걸 말한다 (docs/story/content-design.md 3-1).
   */
  remark: { id: RemarkId; at: number; memoryId?: MemoryId } | null;
  /**
   * 끝까지 들은 진입 대사 (`기억@차수`). 미니게임을 닫고 다시 누르면 같은 줄을 처음부터
   * 다시 넘기게 하지 않고 곧장 미니게임을 세운다 (공 8줄, 컴퓨터 3줄). 저장하지 않는다:
   * 새로 켠 판에서는 무엇을 하려던 참인지 한 번 더 듣는 편이 낫다.
   */
  heardIntros: string[];
  /**
   * 카메라가 붙들려 있는 대상 (없으면 null). 조사도 재생도 아닌 연출 한 컷: 협탁 서랍이 열리는
   * 순간 열쇠가 있던 칸으로 밀고 들어가는 크레인 샷 (scenes/memory-room/camera/crane-shot.ts).
   * 붙들린 동안 씬 입력은 잠기고(selectSceneInputLocked), 씬이 시간을 재서 놓는다(endCameraHold).
   * 화면 상태라 저장하지 않는다.
   */
  cameraHold: CameraHoldId | null;
  /**
   * 과거편에서 돌아온 방에 라디오 신호가 잡혔는가. 잡히기 전이 분기점의 정적 구간이다
   * (story-phase의 signalSilence): 라디오는 꺼진 채 깜빡이지 않고, 2차도 안 열린다.
   *
   * 저장하지 않는다. 정적 구간에서 새로고침하면 정적부터 다시 흐른다. 그 구간을 지난
   * 진행은 페이즈가 이미 넘어갔거나 라디오 2차를 마쳐서 이 값을 보지 않는다.
   */
  signalCaught: boolean;
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
  setSceneCovered: (covered: boolean) => void;
  /** tab을 주면 그 페이지를 펼친 채 연다. 안 주면 마지막 페이지 그대로. */
  setCharacterSheetOpen: (open: boolean, tab?: CharacterSheetTab) => void;
  setCharacterSheetTab: (tab: CharacterSheetTab) => void;
  /** 이 페이지에 지금 적힌 것을 전부 읽은 것으로 친다. 수첩이 그 페이지를 펼쳤을 때 부른다. */
  markNotebookRead: (tab: CharacterSheetTab) => void;
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
  /** 세면대 마개를 뽑는다. 물이 빠지고 바닥의 배지가 드러난다 (BathroomFixtures). */
  drainSink: () => void;
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
  /** 판이 풀렸다: 결과 카드를 세운다. 실제 완료는 카드를 넘길 때 finishPuzzle로. */
  settlePuzzle: () => void;
  /** 판이 손에 없는 물건 때문에 입력을 막았다 (MinigameProps.onBlocked). */
  blockPuzzle: () => void;
  /** 문제가 끝났다 (클리어 또는 스킵: 미니게임 계약상 스킵도 cleared다). */
  finishPuzzle: (result: MinigameResult) => void;
  /** 닫힌 방문을 두드렸다. 문이 열려 있으면 아무 일도 없다. */
  nudgeDoor: () => void;
  /** 혼잣말 한 줄을 흘린다. 다른 화면이 떠 있으면 아무 일도 없다. */
  /** `seen`은 어느 기억의 기록인지(memoryId)를 같이 받는다. */
  sayRemark: (id: RemarkId, memoryId?: MemoryId) => void;
  /** 라디오에 신호가 잡힌다. 정적 구간이 아니면 아무 일도 없다 (SignalCatch만 부른다). */
  catchSignal: () => void;
  /** 붙들린 카메라를 놓는다. 크레인 샷이 머무는 시간이 끝났을 때 씬이 부른다. */
  endCameraHold: () => void;
  /** 엔딩 시작: 조건을 못 채웠으면 아무 일도 일어나지 않는다. */
  startEnding: () => void;
  reset: () => void;
}

/** 진입 대사를 들은 기록의 열쇠: 기억과 차수. */
const introKeyOf = (id: MemoryId, visit: number) => `${id}@${visit}`;

type StateSnapshot = Pick<MemoryRoomState, "collected" | "revisited" | "doorOpened"> &
  Partial<
    Pick<
      MemoryRoomState,
      | "rechecked"
      | "openedDoorways"
      | "introDone"
      | "endingStarted"
      | "discoveries"
      | "notebookOpened"
      | "signalCaught"
      | "sinkDrained"
      | "solvedPuzzles"
    >
  >;

export type OnboardingStep = "workbook" | "notebook";

/**
 * 1페이즈 첫머리의 안내 두 걸음. 저장하지 않고 진행에서 파생된다.
 *
 *   workbook  불을 켜고 아직 이름을 모른다. 책상 위 문제집만 부르고, 기억은 잠가 둔다.
 *             돌려 보는 조작(3D 인스펙트)을 처음 배우는 자리이고, 기억부터 누르면
 *             이 조작을 한참 뒤(카드·출입증)에야 처음 만난다.
 *   notebook  이름을 알았는데 수첩을 한 번도 안 열었다. 수첩 손잡이가 부른다. 막지는
 *             않는다: 기억은 이미 열려 있다. 이름을 알았다는 건 수첩이 말하는데, 수첩이
 *             있는 줄 모르면 그 말이 닿지 않는다.
 *
 * 기억을 하나라도 모았으면 둘 다 지난 것으로 본다. 이 안내 전의 저장본이 그렇다.
 * `discoveries`를 모르는 스냅샷(이름표를 안 넘기는 호출부)은 안내 없이 본다.
 */
export function onboardingStep(state: StateSnapshot): OnboardingStep | null {
  if (state.discoveries === undefined || state.collected.length > 0) return null;
  if (storyPhaseOf(state) !== "p1") return null;
  if (!state.discoveries.includes("hero-name")) return "workbook";
  return state.notebookOpened ? null : "notebook";
}

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
  // 방에서 알게 된 것이 있어야 열리는 차수 (컴퓨터 3차 = 세면대 바닥의 배지 뒤)
  const after = (
    VISIT_AFTER_DISCOVERY as Partial<Record<string, { visit: Visit; discovery: DiscoveryId }>>
  )[id];
  const waitingDiscovery =
    after !== undefined &&
    after.visit === visit &&
    !(state.discoveries ?? []).includes(after.discovery);
  // 미궁 문제를 풀어야 열리는 차수 (액자 2차 = 거실 피아노 뒤)
  const gate = (VISIT_AFTER_PUZZLE as Partial<Record<string, { visit: Visit; puzzle: PuzzleId }>>)[
    id
  ];
  const waitingPuzzle =
    gate !== undefined &&
    gate.visit === visit &&
    !(state.solvedPuzzles ?? []).includes(gate.puzzle);
  if (!waitingDiscovery && !waitingPuzzle && visitOpen(progress, id, visit)) {
    // 문제집을 뒤집어 보기 전에는 강도 1도 잠가 둔다 (onboardingStep)
    return onboardingStep(state) === "workbook" ? "locked" : "available";
  }
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

/**
 * 이 단서를 지금 펼칠 수 있는가.
 *
 * 대부분은 늘 열려 있다 (거울 = 방에 처음부터 놓인 물건). 예외는 조사를
 * 마친 뒤에야 배경 오브젝트가 되는 달력이다. 조사 전에 열면 미니게임이 보여줄
 * 것을 먼저 보여주는 셈이고, 그 안의 표시가 컴퓨터 비밀번호라 순서가 무너진다.
 */
export function clueUnlocked(state: StateSnapshot, id: ClueId): boolean {
  // 세면대 바닥의 배지는 물 밑에 있다. 물을 빼기 전에는 보이지도 만져지지도 않는다
  if (id === "raon-badge" && state.sinkDrained !== true) return false;
  const owner = Object.entries(CLUE_AFTER_MEMORY).find(([, clue]) => clue === id)?.[0];
  if (owner !== undefined && !state.collected.includes(owner as MemoryId)) return false;
  // 조사를 마쳐야 만질 수 있는 단서 (거꾸로 꽂힌 책 = 아빠 메일 뒤)
  const after = (CLUE_AFTER_VISIT as Partial<Record<ClueId, { id: string; visit: Visit }>>)[id];
  if (after === undefined) return true;
  return visitDone(
    { ...state, rechecked: state.rechecked ?? [] },
    after.id as MemoryId,
    after.visit,
  );
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

/** 한 번이라도 본 기억의 수: 수첩 손잡이의 숫자와 타이틀의 "모아 둔 기억"이 같은 값을 쓴다. */
export const selectSeenCount = (state: StateSnapshot) =>
  MEMORY_IDS.filter((id) => isSeen(state, id)).length;

/**
 * 결심(resolve)에 들어섰는가: 4페이즈를 마치고 정적 비트까지 지났다는 뜻이다.
 * 곁가지(게임기·공의 2차, 피아노)는 여기 끼지 않는다.
 */
function endingReady(state: StateSnapshot): boolean {
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
 * 다시보기 재생을 엮는다. 미니게임은 빼고 그때의 그림과 수첩 기록 한 줄만 세운다.
 *
 * 이미 푼 판을 다시 풀리는 것은 되짚기가 아니라 재도전이다. 기억 패널과 수첩은
 * "무엇을 봤는지"를 다시 보여주는 자리라, 손을 다시 쓰게 만들면 안 된다.
 *
 * 대사를 통째로 다시 틀지 않는다. 예전에는 진입·결과 대사를 이어 붙여 야구공이 11줄,
 * 성적표가 8줄이었다. 되짚기는 한 번 본 장면을 다시 읽는 게 아니라 무엇이었는지를
 * 떠올리는 자리라, 그때 수첩에 남긴 기록(lore) 한 문단이면 된다 (2026-09-27).
 */
export function buildMemoryReplay(id: MemoryId, gamePhase: Visit): ActivePlayback | null {
  const config = phaseConfigOf(id, gamePhase);
  if (!config) return null;

  const lines = [
    { speaker: "narrator", textKey: `lore.${id}.phase${gamePhase}` } as DialogueScriptLine,
  ];

  /*
   * 되짚는 그림이 1막에도 있었고 2막에 다른 한 장으로 바뀌었다면, 그 한 장으로 열었다가
   * 이 장으로 밀어 넘긴다 (PhotoMorph). 지금은 액자 하나가 해당한다: 같은 장면을 두 장
   * 가진 기억이 거기뿐이다. 데이터가 정하므로 다른 기억에 두 장이 생기면 저절로 따라온다.
   */
  const earlier = gamePhase > 1 ? phaseConfigOf(id, 1)?.replayStill : undefined;
  // 밀림은 그림이 **둘 다** 있고 서로 다를 때만 성립한다. 2막에 그림이 없는 기억
  // (야구공)은 앞 그림만 실리면 갈 곳 없는 밀림이 된다
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
function nextPlaybackStep(active: ActivePlayback): ActivePlayback | null {
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
 * 캐리어 개수 추리 (v4.1 3장): 신발장(등산화 · 비어 있는 캐리어 두 자리)과 컴퓨터 2차
 * (아빠 메일의 "2박 3일")를 둘 다 본 순간 결론 한 줄이 흐른다. 옷장 옷걸이는 신발장
 * 대사로 합쳤다. 둘 다 2페이즈 필수 조사라 `tripDoubted`는 2페이즈를 마치기 전에 반드시 선다.
 */
const TRIP_CLUES: readonly MemoryId[] = ["shoes", "computer"] as MemoryId[];

/** 캐리어 개수 추리를 마쳤는가 (v4.1 4장의 tripDoubted). */
export function tripDoubted(state: Pick<MemoryRoomState, "revisited">): boolean {
  return TRIP_CLUES.every((id) => state.revisited.includes(id));
}

/** 4페이즈의 마지막 칸(액자 2차)에 닿았는가: 앞선 조사를 다 마쳤다. */
function p4FinalReached(state: MemoryRoomState): boolean {
  return nextVisit(state, P4_FINAL_MEMORY) === 2 && visitOpen(state, P4_FINAL_MEMORY, 2);
}

/**
 * 조사를 마친 순간 곧장 트는 컷씬들, 트는 순서대로. 방을 한 바퀴 더 둘러보게 두면
 * 그 순간의 밀도가 흩어진다. 한 번에 여럿이 걸리면 차례로 이어서 흐른다
 * (queuedPlaybacks).
 *
 *   1. 1차를 다 모았다 = 라디오 재난방송이 막 끝났다 → 이미지 나열 (radio-blackout)
 *   2. 조사 자체에 붙은 컷씬 (생존자 방송 · 정적 비트: memories.yaml의 cutscene)
 *   3. 캐리어 개수 추리가 방금 맞물렸다 → trip-doubt
 *   4. 2페이즈를 방금 마쳤다 → p2-close
 *   5. 4페이즈의 마지막 칸(액자 2차) 앞의 조사를 방금 다 마쳤다 → p4-close
 */
function cutscenesAfter(
  before: MemoryRoomState,
  after: MemoryRoomState,
  id: MemoryId,
  visit: Visit,
): ActivePlayback[] {
  const queue: (ActivePlayback | null)[] = [];
  if (visit === 1 && before.collected.length < MEMORY_GOAL && after.collected.length >= MEMORY_GOAL)
    queue.push(openCutscene(CUTSCENE_RADIO_BLACKOUT, { intro: true }));
  const own = phaseConfigOf(id, visit)?.cutscene;
  if (own) queue.push(openCutscene(own));
  if (tripDoubted(after) && !tripDoubted(before)) queue.push(openCutscene(CUTSCENE_TRIP_DOUBT));
  const was = storyPhaseOf(before);
  const now = storyPhaseOf(after);
  if (was === "p2" && now === "p3") queue.push(openCutscene(CUTSCENE_P2_CLOSE));
  // 액자 2차의 조사 조건(서류·출입증)이 방금 찼다. 피아노 자물쇠(VISIT_AFTER_PUZZLE)는 안 본다:
  // 이 줄은 안방에서 본 것에 대한 대답이지 액자가 열렸다는 알림이 아니다
  if (now === "p4" && p4FinalReached(after) && !p4FinalReached(before))
    queue.push(openCutscene(CUTSCENE_P4_CLOSE));
  return queue.filter((playback): playback is ActivePlayback => playback !== null);
}

function complete(state: MemoryRoomState, id: MemoryId, visit: Visit) {
  const marked = markVisit(state, id, visit);
  const after = { ...state, ...marked };
  const [first, ...rest] = cutscenesAfter(state, after, id, visit);
  return {
    ...marked,
    activeInteraction: null,
    activePlayback: first ?? state.activePlayback,
    queuedPlaybacks: first ? [...state.queuedPlaybacks, ...rest] : state.queuedPlaybacks,
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
  | "notebookOpened"
  | "notebookRead"
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
  | "pianoGapSeen"
  | "sinkDrained"
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
 * 이름이 바뀐 기억 id (옛 → 지금). 옛 저장본의 id를 그대로 두면 sanitizeProgress가
 * 모르는 id로 버려서, 이미 조사한 기억의 진행이 사라진다.
 */
const RENAMED_MEMORY_IDS: Record<string, string> = { nintendo: "console" };
const renamedMemoryId = (id: string) => RENAMED_MEMORY_IDS[id] ?? id;

/**
 * 이름이 바뀐 퍼즐·발견 id (옛 → 지금). 세 자리 자물쇠가 세면대 하부장에서 협탁 서랍으로
 * 옮겨가며 이름도 바뀌었다 (2026-10-05). 옛 저장본이 이미 푼 자물쇠를 다시 풀게 하지 않는다.
 */
const RENAMED_SAVE_IDS: Record<string, string> = {
  "sink-dial": "drawer-dial",
  "sink-code": "drawer-code",
};

/** 저장본의 목록에 이 id가 들어 있는가 (옛 이름으로 적힌 것도 센다). */
function savedHas(list: unknown, id: string): boolean {
  return (
    Array.isArray(list) &&
    list.some((item) => typeof item === "string" && (RENAMED_SAVE_IDS[item] ?? item) === id)
  );
}

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
            value
              .map((id) => (typeof id === "string" ? renamedMemoryId(id) : id))
              .filter((id): id is MemoryId => typeof id === "string" && id in MEMORY_BY_ID),
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
  const sinkDrained = saved.sinkDrained === true && openedDoorways.includes("living-bathroom");
  const discoveries = DISCOVERY_IDS.filter(
    (id) =>
      savedHas(saved.discoveries, id) &&
      // 배지는 물 밑에 있었다. 물을 안 뺀 저장본이 봤을 리 없다
      (id !== "raon-badge" || sinkDrained),
  );
  const inventory = Array.isArray(saved.inventory)
    ? ITEM_IDS.filter((id) => (saved.inventory as unknown[]).includes(id))
    : [];

  return {
    collected,
    revisited,
    rechecked,
    doorOpened,
    batTaken,
    solvedPuzzles: PUZZLE_IDS.filter((id) => savedHas(saved.solvedPuzzles, id)),
    discoveries,
    endingStarted: saved.endingStarted === true && batTaken,
    // 이 값을 모르는 옛 저장본은 기억을 하나라도 봤으면 수첩도 안다고 본다
    notebookOpened: saved.notebookOpened === true || collected.length > 0,
    soundMuted: saved.soundMuted === true,
    // 이지(guided)를 고른 저장본만 이지다. 옛 값(easy·normal)과 모르는 값은 보통으로
    difficulty: saved.difficulty === "guided" ? "guided" : "normal",
    // 불은 켜진 상태가 기본: 저장본에 명시적으로 false일 때만 꺼진 채로 돌아온다
    lightsOn: saved.lightsOn !== false,
    // 인트로 도입 전의 저장본(기억을 하나라도 모았다)은 인트로를 이미 지난 것으로 본다
    introDone: saved.introDone === true || collected.length > 0,
    // 문이 안 열렸으면 문 넘기도 없다. 이 값을 모르는 옛 저장본은 문이 열렸으면 지난 것으로
    doorwayDone: doorOpened && saved.doorwayDone !== false,
    inventory,
    // 오토는 껐다 켰다 하는 설정이라, 모르는 값이면 꺼진 쪽이 기본이다
    autoPlay: saved.autoPlay === true,
    // 피아노는 거실에 있다. 방문이 안 열린 저장본이 빈 마디를 봤을 리 없다
    pianoGapSeen: saved.pianoGapSeen === true && doorOpened,
    // 세면대는 화장실에 있다. 그 문을 안 연 저장본이 마개를 뽑았을 리 없다
    sinkDrained,
    // 본 적 있는 단서. 목록에서 사라진 id는 조용히 버린다 (기억 id와 같은 규칙)
    cluesSeen: Array.isArray(saved.cluesSeen)
      ? CLUE_IDS.filter((id) => (saved.cluesSeen as unknown[]).includes(id))
      : [],
    openedDoorways,
    notebookRead: Array.isArray(saved.notebookRead)
      ? Array.from(
          new Set(
            (saved.notebookRead as unknown[])
              .filter((entry): entry is string => typeof entry === "string")
              // 수첩 기록의 키(lore:<id>@<차수>)에도 기억 id가 들어 있다
              .map((entry) =>
                entry.replace(/^lore:([^@]+)@/, (_, id: string) => `lore:${renamedMemoryId(id)}@`),
              ),
          ),
        )
      : // 알림이 생기기 전의 저장본: 이미 적혀 있던 것은 읽은 것으로 본다. 이어하기 하자마자
        // 모든 페이지에 점이 서면 정작 새로 생긴 것이 묻힌다
        Object.values(
          notebookEntries({
            collected,
            revisited,
            rechecked,
            doorOpened,
            openedDoorways,
            discoveries,
            inventory,
          }),
        ).flat(),
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
      queuedPlaybacks: [],
      uiLocks: [],
      sceneCovered: false,
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
      difficulty: "normal",
      lightsOn: true,
      introDone: false,
      doorwayDone: false,
      doorOpened: false,
      batTaken: false,
      pianoGapSeen: false,
      sinkDrained: false,
      endingStarted: false,
      endingPending: false,
      space: "room",
      openedDoorways: [],
      inventory: [],
      seatedAt: null,
      warpTarget: null,
      walkTarget: null,
      curtainGrab: null,
      activeClue: null,
      nameIntroPending: false,
      activePuzzle: null,
      puzzleCleared: false,
      solvedPuzzles: [],
      discoveries: [],
      notebookOpened: false,
      notebookRead: [],
      remark: null,
      heardIntros: [],
      cameraHold: null,
      signalCaught: false,
      beginInteraction: (id) =>
        set((state) => {
          if (state.activePlayback) return state;
          // 1인칭에 있는 동안은 조사하지 않는다. 어둠 속의 할 일은 스위치 하나, 문 앞의 할 일은 나가기 하나다
          if (viewpointOf(state) !== null) return state;
          if (state.activeInteraction || hotspotStatus(state, id) !== "available") return state;
          const gamePhase = nextVisit(state, id);
          if (gamePhase === undefined) return state;
          const interaction = phaseConfigOf(id, gamePhase)?.interaction;
          // 이미 끝까지 들은 진입 대사는 건너뛴다: 미니게임을 닫았다 다시 연 것이다
          const introHeard =
            interaction?.minigameId !== undefined &&
            state.heardIntros.includes(introKeyOf(id, gamePhase));
          if (interaction?.scriptId && !introHeard) {
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
            const heard = introKeyOf(active.memoryId, active.gamePhase);
            return {
              activeInteraction: { ...active, phase: "minigame" as const, scriptId: undefined },
              heardIntros: state.heardIntros.includes(heard)
                ? state.heardIntros
                : [...state.heardIntros, heard],
            };
          }
          return complete(state, active.memoryId, active.gamePhase);
        }),
      advancePlayback: () =>
        set((state) => {
          if (!state.activePlayback) return state;
          const stepped = nextPlaybackStep(state.activePlayback);
          // 한 컷씬이 끝나면 줄 서 있던 다음 컷씬이 이어서 흐른다
          const [queued, ...rest] = stepped === null ? state.queuedPlaybacks : [];
          const next = stepped ?? queued ?? null;
          return {
            activePlayback: next,
            ...(stepped === null ? { queuedPlaybacks: rest } : {}),
            // 두 줄이 다 흘렀으면 그때 배트가 손에 들어온다. 재생의 끝이 곧 손잡이다.
            // 뒤에 줄 선 컷씬이 있어도 같다 (건너뛰기 endPlayback와 같은 조건)
            ...(stepped === null && batGripEnding(state) ? { batTaken: true } : {}),
          };
        }),
      endPlayback: () =>
        set((state) =>
          state.activePlayback
            ? {
                // 건너뛰면 지금 컷씬만 닫힌다. 줄 서 있던 다음 컷씬은 그대로 흐른다
                activePlayback: state.queuedPlaybacks[0] ?? null,
                queuedPlaybacks: state.queuedPlaybacks.slice(1),
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
      setSceneCovered: (covered) =>
        set((state) => (state.sceneCovered === covered ? state : { sceneCovered: covered })),
      setCharacterSheetOpen: (open, tab) =>
        set((state) => ({
          characterSheetOpen: open,
          characterSheetTab: tab ?? state.characterSheetTab,
          notebookOpened: state.notebookOpened || open,
        })),
      setCharacterSheetTab: (tab) => set({ characterSheetTab: tab }),
      markNotebookRead: (tab) =>
        set((state) => {
          const unread = notebookEntries(state)[tab].filter(
            (entry) => !state.notebookRead.includes(entry),
          );
          return unread.length === 0 ? state : { notebookRead: [...state.notebookRead, ...unread] };
        }),
      setContactOpen: (open) => set({ contactOpen: open }),
      setFeedbackOpen: (open) => set({ feedbackOpen: open }),
      // 새 게임은 불 꺼진 방에서 시작한다 (인트로). 인트로를 지난 저장본은 불을 건드리지 않는다.
      // 엔딩까지 간 저장본은 여기서 엔딩이 다시 열린다 (endingPending)
      startGame: () =>
        set((state) => ({
          started: true,
          lightsOn: state.introDone ? state.lightsOn : false,
          endingStarted: state.endingStarted || state.endingPending,
          endingPending: false,
        })),
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
                // 배지는 펼치는 순간이 발견이다: 뒤집을 면이 없다 (CLUE_DISCOVERY 주석)
                ...(id === "raon-badge" && !state.discoveries.includes(CLUE_DISCOVERY[id])
                  ? { discoveries: [...state.discoveries, CLUE_DISCOVERY[id]] }
                  : {}),
              },
        ),
      closeClue: () =>
        set((state) => {
          if (!state.activeClue) return state;
          // 배지를 내려놓는 순간 한 줄: 확대 화면 위에 대사창을 겹치지 않는다 (문제집과 같은 문법)
          if (state.activeClue === "raon-badge")
            return {
              activeClue: null,
              nameIntroPending: false,
              remark: { id: "badge-found", at: Date.now() },
            };
          if (!state.nameIntroPending || state.activePlayback)
            return { activeClue: null, nameIntroPending: false };
          return {
            activeClue: null,
            nameIntroPending: false,
            activePlayback: openCutscene(CUTSCENE_WORKBOOK_NAME),
          };
        }),
      discover: (id) =>
        set((state) =>
          state.discoveries.includes(id)
            ? state
            : {
                discoveries: [...state.discoveries, id],
                // 문제집의 이름: 내려놓는 순간 자기소개가 흐른다 (closeClue)
                ...(id === CLUE_DISCOVERY.workbook ? { nameIntroPending: true } : {}),
              },
        ),
      // 문·물건·현관·판은 씬의 클릭이다. 판·대사·크레인 샷이 떠 있는 동안은 캔버스가 여전히
      // 클릭을 받으므로(뒤가 비치는 판) 여기서 막아야 판 뒤의 문이 열리지 않는다
      openRoomDoor: () =>
        set((state) =>
          selectDoorReady(state) && !selectSceneInputLocked(state) ? { doorOpened: true } : state,
        ),
      takeItem: (id) =>
        set((state) =>
          state.inventory.includes(id) || selectSceneInputLocked(state)
            ? state
            : {
                inventory: [...state.inventory, id],
                // 조각만 집으면 어디 쓰는 물건인지 알 길이 없다: 피아노를 먼저 보지 않은 사람도
                // 여기서 둘이 이어진다 (2026-10-05)
                ...(id === "piano-sheet" ? { remark: { id: "sheet-taken", at: Date.now() } } : {}),
              },
        ),
      // 마개는 씬의 클릭이다 (openRoomDoor와 같은 가드). 화장실에 들어서야 닿는 물건이라
      // 그 문이 열렸는지는 다시 묻지 않는다
      drainSink: () =>
        set((state) =>
          state.sinkDrained || selectSceneInputLocked(state)
            ? state
            : { sinkDrained: true, remark: { id: "sink-drained", at: Date.now() } },
        ),
      setAutoPlay: (next) => set({ autoPlay: next }),
      logDialogue: (entry) =>
        set((state) => {
          const next = appendDialogueLog(state.dialogueLog, [entry]);
          return next === state.dialogueLog ? state : { dialogueLog: next };
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
          id === "room-living" ||
          !doorwayReady(state, id) ||
          state.openedDoorways.includes(id) ||
          selectSceneInputLocked(state)
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
          puzzleCleared: false,
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
          // 다른 화면(대사·미니게임·재생·단서·크레인 샷·모달)이 떠 있으면 위에 얹지 않는다
          if (selectSceneInputLocked(state) || state.activeClue) return state;
          if (state.activePuzzle || state.solvedPuzzles.includes(id)) return state;
          // 협탁 서랍 다이얼은 아빠 메일 힌트(컴퓨터 3차)를 본 뒤에만 연다 (v4 3-5)
          if (id === "drawer-dial" && !selectDrawerCodeRead(state)) return state;
          /*
           * 악보 조각 없이 피아노를 열면 판은 서되(지워진 마디를 보는 화면이다) 여는
           * 순간 "한 마디가 안 보인다"는 줄을 먼저 띄운다. 건반을 눌러야 나오면 판이
           * "치는 화면"으로 읽혀서 못 치는 걸 제 탓으로 돌린다. 이 순간부터 안방의 조각이
           * 부른다 (pianoGapSeen).
           */
          if (id === "piano-melody" && !state.inventory.includes("piano-sheet")) {
            return {
              activePuzzle: id,
              pianoGapSeen: true,
              remark: { id: "needs-item" as const, at: Date.now() },
            };
          }
          return { activePuzzle: id };
        }),
      closePuzzle: () =>
        set((state) =>
          // 풀린 뒤에는 내려놓을 수 없다: 카드의 "계속"만이 문제를 닫는다
          state.activePuzzle && !state.puzzleCleared ? { activePuzzle: null } : state,
        ),
      blockPuzzle: () =>
        set((state) => {
          if (!state.activePuzzle) return state;
          /*
           * 손에 없는 물건 때문에 판이 입력을 막았다. 막힐 때마다 바닥의 혼잣말(RemarkLine)로
           * 한 줄을 흘린다. 판에 앉은 채라 sayRemark의 입력 잠금을 거치지 않는다. 건반을
           * 연달아 두드려도 떠 있는 줄을 매번 새로 띄우지 않는다: 다 읽히고 사라진 뒤에
           * 누르면 다시 선다.
           */
          const showing =
            state.remark?.id === "needs-item" && Date.now() - state.remark.at < REMARK_REPEAT_MS;
          return showing ? state : { remark: { id: "needs-item" as const, at: Date.now() } };
        }),
      settlePuzzle: () =>
        set((state) =>
          state.activePuzzle && !state.puzzleCleared ? { puzzleCleared: true } : state,
        ),
      finishPuzzle: (result) =>
        set((state) => {
          if (!state.activePuzzle) return state;
          if (!result.cleared) return { activePuzzle: null, puzzleCleared: false };
          const solved = state.activePuzzle;
          /*
           * 협탁 서랍이 열리면 그 안의 안방 열쇠가 손에 들어온다. 집는 동작을 따로
           * 두지 않는다: 열린 서랍 안에 열쇠 하나뿐이라 한 번 더 누르게 하면 심부름이다.
           */
          const reward: Partial<MemoryRoomState> =
            solved === "drawer-dial"
              ? {
                  inventory: state.inventory.includes("parents-key")
                    ? state.inventory
                    : [...state.inventory, "parents-key"],
                  remark: { id: "drawer-open", at: Date.now() },
                  // 열쇠가 있던 서랍으로 카메라가 밀고 들어간다 (crane-shot.ts)
                  cameraHold: "nightstand-drawer" as const,
                }
              : solved === "piano-melody"
                ? { remark: { id: "piano-done", at: Date.now() } }
                : {};
          return {
            activePuzzle: null,
            puzzleCleared: false,
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
      sayRemark: (id, memoryId) =>
        set((state) =>
          selectSceneInputLocked(state) || viewpointOf(state) !== null
            ? state
            : { remark: { id, at: Date.now(), memoryId } },
        ),
      catchSignal: () => set((state) => (signalSilence(state) ? { signalCaught: true } : state)),
      endCameraHold: () => set((state) => (state.cameraHold ? { cameraHold: null } : state)),
      // 챙길 것(가방·앰플·배트)을 다 챙겨야 현관문이 열린다
      startEnding: () =>
        set((state) =>
          packedForExit(state) && !selectSceneInputLocked(state) ? { endingStarted: true } : state,
        ),
      reset: () => {
        set((state) => ({
          collected: [],
          revisited: [],
          rechecked: [],
          activeInteraction: null,
          activePlayback: null,
          queuedPlaybacks: [],
          uiLocks: [],
          sceneCovered: false,
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
          pianoGapSeen: false,
          sinkDrained: false,
          endingStarted: false,
          endingPending: false,
          space: "room",
          openedDoorways: [],
          inventory: [],
          seatedAt: null,
          warpTarget: null,
          walkTarget: null,
          curtainGrab: null,
          activeClue: null,
          nameIntroPending: false,
          cluesSeen: [],
          dialogueLog: [],
          dialogueLogOpen: false,
          activePuzzle: null,
          puzzleCleared: false,
          solvedPuzzles: [],
          discoveries: [],
          notebookOpened: false,
          notebookRead: [],
          remark: null,
          heardIntros: [],
          cameraHold: null,
          signalCaught: false,
          resetRevision: state.resetRevision + 1,
        }));
      },
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
        pianoGapSeen: state.pianoGapSeen,
        sinkDrained: state.sinkDrained,
        solvedPuzzles: state.solvedPuzzles,
        discoveries: state.discoveries,
        notebookOpened: state.notebookOpened,
        notebookRead: state.notebookRead,
        // 이어하기를 누르기 전에 다시 저장돼도 엔딩까지 간 판이라는 사실은 남는다
        endingStarted: state.endingStarted || state.endingPending,
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
      merge: (persisted, current) => {
        const saved = sanitizeProgress(persisted);
        // 저장본의 엔딩은 타이틀 뒤에서 바로 돌지 않고 이어하기를 기다린다 (endingPending)
        return {
          ...current,
          ...saved,
          endingStarted: false,
          endingPending: saved.endingStarted === true,
        };
      },
      /*
       * 버전이 다른 저장본도 버리지 않고 merge(sanitizeProgress)로 넘긴다. migrate가 없으면
       * zustand가 그 저장본을 통째로 버려서, 버전을 올리는 순간 모든 진행이 새 게임이 됐다
       * (2→3에서 실제로 그랬다). 걸러내는 것은 어차피 sanitizeProgress의 몫이다.
       */
      migrate: (persisted) => persisted as Partial<PersistedProgress>,
      /*
       * 예전에는 3D로 집어 본 판을 플레이 중에 찍어 `rom-stills`에 쌓았다 (장당 수십 KB).
       * 지금은 미리 찍은 파일을 쓰므로, 남아 있는 옛 덩어리를 한 번 치운다.
       */
      onRehydrateStorage: () => () => {
        try {
          localStorage.removeItem("rom-stills");
        } catch {
          // 저장소를 못 쓰는 환경이면 치울 것도 없다
        }
      },
    },
  ),
);

export const selectCollected = (state: MemoryRoomState) => state.collected;
export const selectOnboardingStep = (state: MemoryRoomState) => onboardingStep(state);
/**
 * 안 읽은 것이 있는 수첩 페이지를 쉼표로 이은 한 줄 (없으면 빈 문자열).
 * 배열을 돌려주면 부를 때마다 새 배열이라 구독하는 쪽이 매번 다시 그린다. 글자는 같으면 같다.
 */
export const selectUnreadNotebookTabs = (state: MemoryRoomState) =>
  unreadNotebookTabs(state).join(",");
/** 주인공의 이름을 아는가: 수첩 이름·나이 칸과 대사창 화자 이름표가 이걸 본다. */
export const selectHeroNameKnown = (state: MemoryRoomState) =>
  state.discoveries.includes("hero-name");
export const selectActiveInteraction = (state: MemoryRoomState) => state.activeInteraction;
export const selectActivePlayback = (state: MemoryRoomState) => state.activePlayback;
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

/** 배트를 쥐었는가. 챙길 것 셋 중 하나다 (packedForExit). */
/** 팔을 들고 있어야 하는가: Player가 프레임마다 본다 (구독하지 않는다). */
/** 커튼이 손을 따라도 되는가: 몸이 창가에 닿은 뒤다. */
export const isAtCurtain = (state: MemoryRoomState) => state.curtainGrab?.arrived === true;

/**
 * 이 물건은 할 일을 다 했는가: 여는 문이 열렸거나, 쓰는 미궁 문제를 풀었다.
 *
 * 인벤토리에서 지우지는 않는다. 가진 적이 있다는 기록은 진행이라 저장본과 다른 판정이
 * 그대로 본다. 소지품 줄(InventoryStrip)만 다 쓴 물건을 내린다: 안방이 열린 뒤에도
 * 열쇠가 끝까지 떠 있어 "아직 쓸 데가 있나"로 읽혔다.
 */
export function itemSpent(
  state: Pick<MemoryRoomState, "openedDoorways" | "solvedPuzzles">,
  id: ItemId,
): boolean {
  const opens = Object.entries(DOOR_RULES).find(([, rule]) => rule.item === id)?.[0];
  if (opens && state.openedDoorways.includes(opens as DoorwayId)) return true;
  const puzzle = ITEM_PUZZLE[id];
  return puzzle !== undefined && (state.solvedPuzzles as readonly string[]).includes(puzzle);
}

/** 아직 쓸 데가 남은 물건을 들고 있는가. 헤더의 소지품 줄이 서는가와 같다. */
export const selectCarrying = (state: MemoryRoomState) =>
  state.inventory.some((id) => !itemSpent(state, id));

/** 떠나기 전 챙길 것을 챙기는 중인가: resolve에 들어섰고 아직 다 못 챙겼다. */
export const selectPacking = (state: MemoryRoomState) =>
  storyPhaseOf(state) === "resolve" && !packedForExit(state) && state.activePlayback === null;

/** 챙긴 수. 안내 줄의 "n/3"이 본다. */
export const selectPackedCount = (state: MemoryRoomState) => packedCount(state);

/** 현관문을 열 수 있는가: 가방·앰플·배트를 다 챙겼다. */
export const selectExitReady = (state: MemoryRoomState) =>
  packedForExit(state) && !state.endingStarted;

/** 방문이 열려 있는가: 걷기 영역과 문짝 회전이 같이 본다. */
export const selectDoorOpened = (state: MemoryRoomState) => state.doorOpened;

/**
 * 지금 카메라가 도해의 1인칭에 있는가, 있다면 어느 구간인가.
 *
 * 셋 다 "빛 하나를 향해 걸어간다"는 같은 그림이고, 빛의 정체만 다르다: 인트로는
 * 전등 스위치, 2막 도입은 열린 방문, 엔딩은 열린 현관문 밖의 햇빛. 앞의 둘은 도해의
 * 눈이고 플레이어가 걷는다. 엔딩만 도해의 등 뒤에서, 제 발로 빛 속으로 걸어 나가는
 * 뒷모습을 본다. 그 뒤는 영상이 받는다 (docs/story/content-design.md 3-3).
 *
 * - intro:   새 게임 시작 직후, 불을 켜기 전까지
 * - doorway: 방문이 열린 뒤, 거실에 처음 들어서기 전까지
 * - exit:    현관문을 연 뒤 (엔딩 영상이 방을 덮을 때까지. 덮인 뒤에는 그리지 않는다)
 *
 * 값이 아닌 문자열을 돌려준다. 객체를 새로 만들면 zustand가 매 렌더 새 스냅샷으로 본다.
 */
export type Viewpoint = "intro" | "doorway" | "exit" | null;

export function viewpointOf(
  state: Pick<
    MemoryRoomState,
    "started" | "endingStarted" | "introDone" | "doorOpened" | "doorwayDone"
  >,
): Viewpoint {
  if (!state.started) return null;
  if (state.endingStarted) return "exit";
  if (!state.introDone) return "intro";
  if (state.doorOpened && !state.doorwayDone) return "doorway";
  return null;
}

export const selectViewpoint = (state: MemoryRoomState) => viewpointOf(state);

export const selectSceneInputLocked = (state: MemoryRoomState) =>
  state.activeInteraction !== null ||
  state.activePlayback !== null ||
  state.activePuzzle !== null ||
  // 크레인 샷이 도는 동안 걸어 나가면 카메라가 빈자리를 본다
  state.cameraHold !== null ||
  state.uiLocks.length > 0;

/**
 * 라디오가 저 혼자 살아나 있는가.
 *
 * 재난방송이 끊기면서 라디오는 확실히 죽는다. 2바퀴의 문은 도해가 다시 만지는 게
 * 아니라 라디오가 먼저 말을 거는 것이라, 저 혼자 지직거린다. 컷씬이 끝나자마자가 아니라
 * 정적 구간(signalSilence) 뒤에 깨어난다: 절망이 내려앉을 틈 없이 희망이 들면 둘 다 가볍다.
 * 목소리를 잡고 나면(revisited) 더는 깜빡이지 않는다. 할 말을 이미 했으니까.
 */
export const selectRadioSignaling = (state: MemoryRoomState) =>
  storyPhaseOf(state) === "turning" &&
  state.signalCaught &&
  !state.revisited.includes(SIGNAL_MEMORY) &&
  state.activePlayback === null;

/**
 * 분기점의 정적이 흐르고 있는가: 과거편에서 돌아와 신호가 잡히기 전이고, 방이 비어 있다.
 *
 * 대사·컷씬·메뉴가 떠 있는 동안은 정적이 아니라 그 화면이다. 그 사이에는 시간을 세지
 * 않는다 (SignalCatch가 이 값이 참인 동안만 잰다).
 */
export const selectSignalSilenceRunning = (state: MemoryRoomState) =>
  signalSilence(state) &&
  state.started &&
  state.activePlayback === null &&
  state.queuedPlaybacks.length === 0 &&
  state.activeInteraction === null &&
  state.uiLocks.length === 0;

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
 * 이 정적 위에 처음 든다 (selectMusicPhase, docs/story/content-design.md 8장).
 */
/**
 * 상단 독백(혼잣말·목표 배너)이 물러나야 하는가. 말은 한 번에 하나만: 대사창·컷씬·미니게임·
 * 단서가 떠 있는 동안, 그리고 메뉴 패널이 내려와 있는 동안. 메뉴는 오른쪽 위에서 내려오는
 * 판이라 좁은 화면에서는 혼잣말 줄을 그대로 덮었다 (수첩 손잡이가 같은 잠금을 보고 숨는 것과 같다).
 * 엔딩이 시작된 뒤에도 물러난다: 엔딩 화면 위에 방의 줄이 남으면 안 된다.
 */
export const selectMonologueHidden = (state: MemoryRoomState) =>
  state.endingStarted ||
  state.activeInteraction !== null ||
  state.activePlayback !== null ||
  state.activePuzzle !== null ||
  state.activeClue !== null ||
  state.uiLocks.includes("hud-menu");

/**
 * 수첩 손잡이가 물러나야 하는가. 메뉴 패널이 내려와 있는 동안(패널과 겹친다), 그리고
 * 대사·미니게임·컷씬이 떠 있는 동안: 그때 수첩을 펴면 대사창 위에 수첩이 겹친다.
 */
export const selectNotebookTabTucked = (state: MemoryRoomState) =>
  state.uiLocks.includes("hud-menu") ||
  state.activeInteraction !== null ||
  state.activePlayback !== null;

export const selectMusicPlaying = (state: MemoryRoomState) =>
  state.started &&
  // 곡은 스위치를 켜는 순간 시작한다. 어둠 속에서는 정적뿐이다 (인트로)
  state.introDone &&
  !state.endingStarted &&
  state.activePlayback?.kind !== "cutscene" &&
  !(gamePhaseOf(state) === 2 && !state.doorOpened) &&
  /*
   * 안방(p4)은 곡이 없다 (docs/direction/visual-experiments.md 14장 "새"). 부모님의 서류를 읽는
   * 동안은 방의 소리만 남고, 정적 비트를 지나 결심(resolve)에 들어서는 순간 곡이 그
   * 정적 위에 다시 든다. 안방 문이 열리는 순간이 곡이 멎는 순간이다.
   */
  storyPhaseOf(state) !== "p4";

/**
 * BGM이 몇 번째 곡을 틀어야 하는가. 곡은 막이 아니라 **전환 컷씬**을 기준으로
 * 둘로 갈린다 (docs/story/content-design.md 8장).
 *
 * gamePhaseOf(수집 완주 즉시 2)가 아니라 doorOpened를 본다. 문이 열리는 것이
 * 2막의 시작이다(selectDoorReady 주석). 수집 완료부터 문이 열리기까지의 구간
 * (라디오 목소리)은 아직 1막의 끝자락이라 곡도 1막 것이 남아야 한다.
 */
export const selectMusicPhase = (state: MemoryRoomState): 1 | 2 => (state.doorOpened ? 2 : 1);

/**
 * 결과 대사 동안 방 곡 대신 들어야 하는 곡 (content/memories.yaml의 resultMusic).
 *
 * 방 곡이 흐르는 자리에서만 든다. 곡이 멎은 구간(전환·안방·컷씬)은 정적이 연출이라,
 * 대본에 걸려 있어도 그 정적을 깨지 않는다.
 */
export const selectResultMusic = (state: MemoryRoomState): ResultMusic | null => {
  const active = state.activeInteraction;
  if (active?.phase !== "dialogue" || !active.keepMinigame) return null;
  if (!selectMusicPlaying(state)) return null;
  return phaseConfigOf(active.memoryId, active.gamePhase)?.interaction?.resultMusic ?? null;
};

/** 로그 한 줄: 누가 무엇을 말했는가. 본문은 키로 남는다 (dialogueLog 주석). */
export type DialogueLogEntry = Pick<DialogueScriptLine, "speaker" | "textKey">;

/** 로그에 남기는 최대 줄 수. 넘치면 오래된 줄부터 버린다. */
const DIALOGUE_LOG_MAX = 200;

/**
 * 지난 대사 기록에 줄을 잇는다. 바로 앞 줄과 같은 줄은 리마운트지 새 대사가 아니라 건너뛴다.
 * 오래된 줄부터 버린다: 한 판에 수백 줄이 흐르는데 다 들고 있을 이유가 없다.
 * 아무것도 안 붙었으면 받은 배열을 그대로 돌려준다 (구독자가 헛돌지 않게).
 */
function appendDialogueLog(
  log: readonly DialogueLogEntry[],
  entries: readonly DialogueLogEntry[],
): DialogueLogEntry[] {
  let next = log as DialogueLogEntry[];
  for (const entry of entries) {
    const last = next.at(-1);
    if (last && last.speaker === entry.speaker && last.textKey === entry.textKey) continue;
    next = [...next, entry];
  }
  return next.length > DIALOGUE_LOG_MAX ? next.slice(-DIALOGUE_LOG_MAX) : next;
}

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
 * 협탁 서랍 번호를 알았는가 (v4.1의 dadHintRead). 아빠 메일("선반 정리 좀 해라.")을 읽고,
 * 거꾸로 꽂힌 책을 넘겨 끼워 둔 쪽지의 번호를 본 순간 선다 (discoveries의 drawer-code).
 */
/** 피아노의 지워진 마디를 봤는가: 안방 악보 조각의 표식이 이걸로 켜진다. */
/**
 * 안방 책상의 악보 조각이 부르는가. 피아노의 빈 마디를 본 뒤(pianoGapSeen)이거나, 안방의
 * 조사를 다 마쳐 액자 앞에 피아노만 남았을 때다. 뒤쪽이 없으면 피아노를 한 번도 안 눌러 본
 * 사람은 다음에 무엇을 해야 하는지 알 길이 없다 (액자는 피아노 뒤에 선다: VISIT_AFTER_PUZZLE).
 */
export const selectSheetBeckons = (state: MemoryRoomState) =>
  !state.solvedPuzzles.includes("piano-melody") && (state.pianoGapSeen || p4FinalReached(state));
export const selectDrawerCodeRead = (state: Pick<MemoryRoomState, "discoveries">) =>
  state.discoveries.includes("drawer-code");
/** 세면대 바닥의 출입증 배지를 봤는가: 컴퓨터 3차(로고 고르기)가 이것 뒤에 열린다. */
export const selectBadgeSeen = (state: Pick<MemoryRoomState, "discoveries">) =>
  state.discoveries.includes("raon-badge");

/** 엄마 대화방의 "1"을 열었는가 (v4 1-3의 momChatRead): 폰 2차 조사. */
export const selectMomChatRead = (state: Pick<MemoryRoomState, "revisited">) =>
  state.revisited.includes("phone" as MemoryId);

/*
 * v4.1 4장의 추리 플래그. 저장하지 않고 조사 기록에서 읽는다 (페이즈와 같은 원칙):
 * 조사를 마친 순간이 곧 그 추리를 마친 순간이라 따로 적으면 두 기록이 어긋날 수만 있다.
 */

/* 시각 대조(timeGapNoticed)는 폰 2차 그 자체라 selectMomChatRead를 그대로 쓴다. */

/** 서류 조각을 날짜순으로 놓았는가 (papersOrdered): 연구 일지 2차. */
export const selectPapersOrdered = (state: Pick<MemoryRoomState, "revisited">) =>
  state.revisited.includes("research-note" as MemoryId);

/** 출입증 뒷면의 로고를 봤는가 (idCardFlipped): 출입증 2차. */
export const selectIdCardFlipped = (state: Pick<MemoryRoomState, "revisited">) =>
  state.revisited.includes("id-card" as MemoryId);

/** 생존자 방송을 들었는가 (v4 1-3의 heardSurvivorBroadcast): 라디오 2차 조사. */
export const selectHeardSurvivorBroadcast = (state: Pick<MemoryRoomState, "revisited">) =>
  state.revisited.includes("radio" as MemoryId);

/** 정적 비트를 지났는가 (v4 1-3의 stillBeatDone): 결심에 들어섰다. */
export const selectStillBeatDone = (state: MemoryRoomState) =>
  phaseAtLeast(storyPhaseOf(state), "resolve");
