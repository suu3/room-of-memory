import type { ParseKeys } from "i18next";
import type { MemoryId } from "@/data/memory-room";
import type { CharacterId } from "./scenario";

/** memoryRoom 네임스페이스에서 유효한 번역 키만 허용. */
type MemoryRoomTextKey = ParseKeys<"memoryRoom">;

/** 초상 프레임. 대사가 찍히는 동안에도 이 표정을 그대로 든다. */
export type CharacterExpression = "neutral" | "smile" | "surprised" | "sad" | "puzzled";

export interface DialogueScriptLine {
  speaker: CharacterId;
  textKey: MemoryRoomTextKey;
  /** 생략하면 "neutral". */
  expression?: CharacterExpression;
  /**
   * 회상 속에서 그때의 도해가 한 말. 지금의 도해가 하는 말이 아니라 초상을 세우지 않는다
   * (성적표를 내밀던 날 저녁의 "…위로 맞죠?"). 컷씬·다시보기는 그림이 인물을 보여 주므로
   * 이 플래그 없이도 초상이 없다.
   */
  recall?: boolean;
}

/** 재사용 가능한 대사 스크립트. SCRIPTS 레지스트리(src/data)에 id로 등록. */
export interface DialogueScript {
  id: string;
  lines: DialogueScriptLine[];
}

/**
 * 핫스팟 클릭 시 실행할 인터랙션.
 * 대사(scriptId) → 미니게임(minigameId) → 결과 대사(resultScriptId) → 완료 순.
 */
interface MemoryInteraction {
  scriptId?: string;
  /** src/minigames/index.ts 레지스트리의 미니게임 id. */
  minigameId?: string;
  /**
   * 미니게임 클리어 뒤에 재생할 결과 대사 (기획서 5-1 ③).
   * 이 대사 동안 미니게임 화면은 뒤에 남는다. 방금 드러난 장면을 보며 듣는다.
   */
  resultScriptId?: string;
  /**
   * 결과 대사 동안 방 곡을 비우고 드는 곡. 타이틀 곡이 게임 안에서 다시 들리는 자리라
   * 감정이 가장 높은 몇 곳에만 건다 (content/memories.yaml의 resultMusic).
   */
  resultMusic?: ResultMusic;
}

/** 결과 대사에 걸 수 있는 곡 (scripts/content/schema.mjs의 RESULT_MUSIC와 같아야 한다). */
export type ResultMusic = "title";

/**
 * 컷씬 한 컷: 일러스트 한 장과 그 위로 흐르는 대사.
 *
 * 대사는 컷씬 전용 창을 새로 만들지 않고 기존 대사창(DialogueBox)이 그대로 받는다.
 * 그림 안에 말풍선을 넣지 않는 것이 이 연출의 규칙이라, 그림과 글의 레이어가
 * 갈라져 있어야 한다.
 */
export interface CutsceneCut {
  /**
   * 일러스트 경로(ASSETS.images.*). 컷씬에서는 파일이 아직 없어도 회색 판이 자리를
   * 지킨다. 다시보기처럼 애초에 보여줄 그림이 없는 재생에서는 생략한다.
   * 그때는 빈 판 대신 방이 그대로 비친다.
   */
  image?: string;
  /**
   * 검정 화면 컷. 그림도 신호의 판도 세우지 않고, 어둠(scene-void) 위에 대사창만 뜬다.
   * 과거편이 끝나고 방으로 돌아오기 직전, 회상이 아니라 "지금"을 말하는 한 컷이다.
   * `image`·`page`와 같이 쓰지 않는다 (scripts/content/validate.mjs가 막는다).
   */
  black?: boolean;
  /**
   * 그림을 판에 맞추는 방식. 컷씬 일러는 판에 맞춰 그려지므로 "cover"(기본),
   * 다시보기 스틸은 비율이 제각각이라 잘리지 않게 "contain"으로 세운다.
   */
  fit?: "cover" | "contain";
  /**
   * 이 컷이 **먼저 세웠다가 밀어낼** 그림. 있으면 컷이 이 그림으로 열렸다가 `image`로
   * 넘어간다 (PhotoMorph).
   *
   * 지금은 액자 다시보기 하나다. 같은 장면을 두 장 가진 기억이 거기뿐이라, 2막에
   * 되짚으면 1막의 사진(부모 얼굴이 틀 밖으로 잘린 것)으로 열렸다가 2막의 사진으로
   * 넘어간다. 글로 "이제야 보인다"고 말하기 전에 그림이 먼저 그렇게 된다.
   */
  morphFrom?: string;
  /**
   * `morphFrom`이 `image`의 어느 부분을 담고 있는가 (정규화 0~1). 두 그림을 겹쳐
   * 세우는 값이라, 없으면 겹치지 않고 그냥 지나간다 (data의 REPLAY_MORPH_WITHIN).
   */
  morphWithin?: { x: number; y: number; width: number; height: number };
  lines: DialogueScriptLine[];
  /**
   * 웹툰 칸의 페이지 (1부터). 있으면 이 컷씬은 웹툰 뷰어(WebtoonViewer)로 돈다: 페이지
   * 안에서 칸이 번호순으로 떠오르고, 대사는 대사창이 아니라 칸 안의 라디오 말풍선이다.
   * 페이지 없는 컷은 맨 뒤에만 선다: 웹툰이 걷힌 뒤 방에서 대사창으로 흐르는 한마디다.
   */
  page?: number;
  /** 웹툰 칸의 비율. 16:9는 페이지 폭 한 줄, 3:4는 둘이 나란히 한 줄. */
  ratio?: "16:9" | "3:4";
  /** 컷이 뜨는 순간 한 번 나는 효과음 (src/lib/audio/voices.ts의 이름). */
  sfx?: CutSfx;
  /**
   * 대사가 끝난 뒤 대사창 없이 그림만 남기는 시간(ms).
   * "정적 몇 초"가 연출의 일부인 컷에만 준다. 없으면 곧장 다음 컷으로 넘어간다.
   */
  holdMs?: number;
  /**
   * 내레이션 컷. 누르지 않아도 줄이 한 줄씩 타자기로 찍힌다. 줄마다 창을 비우고 새로 친다.
   * 다 찍히면 다음 컷으로 넘어간다 (분기점 과거편). 오토 설정과 무관하게 흐른다:
   * 회상은 사람이 넘기는 대화가 아니라 저절로 떠오르는 것이라서다. 눌러서 당길 수는 있다.
   */
  narration?: boolean;
  /**
   * 그림이 서는 순간 판을 한 번 흔든다 (덮쳐 오는 컷). 앞 컷에 없던 클래스가 붙으며
   * 도는 애니메이션이라, 흔들리는 컷을 연달아 두면 둘째는 흔들리지 않는다.
   */
  shake?: boolean;
  /**
   * 속말의 i18n 키들. 컷이 서 있는 동안 화면 위 혼잣말 자리에 한 줄씩 떠올랐다
   * 가라앉기를 되풀이한다 (라디오 방송 위의 "…듣고 싶지 않아.").
   */
  whisperKeys?: string[];
}

/** 컷에 붙는 효과음. scripts/content/schema.mjs의 CUT_SFX와 같아야 한다. */
type CutSfx = "mittTap" | "radioCut" | "radioWake" | "radioStatic" | "radioSignOff";

/** 컷씬 하나. CUTSCENES 레지스트리(src/data)에 id로 등록. */
export interface Cutscene {
  id: string;
  cuts: CutsceneCut[];
}

/** 조사 차수: 1차(phase1) · 2차(phase2) · 3차(phase3). */
export type Visit = 1 | 2 | 3;

/** "어느 기억의 몇 차 조사"라는 한 칸. */
export interface VisitRef {
  id: MemoryId;
  visit: Visit;
}

/**
 * 이야기의 페이즈 (v4 설계서 1-1). 저장하지 않고 진행 상태에서 파생된다
 * (src/data/story-phase.ts). 순서가 곧 진행 순서다.
 */
export const STORY_PHASES = [
  "intro",
  "p1",
  "turning",
  "p2",
  "p3",
  "p4",
  "resolve",
  "ending",
] as const;
export type StoryPhase = (typeof STORY_PHASES)[number];

/** 조사 설정의 from에 쓸 수 있는 페이즈. */
export type FromPhase = "turning" | "p2" | "p3" | "p4" | "resolve";

/**
 * 페이즈별 핫스팟 설정. 페이즈 규칙이 늘어나면 여기에 필드를 더한다.
 * MemoryId는 type-only import라 data ↔ types 순환이 런타임에 존재하지 않는다.
 */
export interface MemoryPhaseConfig {
  /** 클릭 시 실행할 인터랙션. 없으면 즉시 완료. */
  interaction?: MemoryInteraction;
  /**
   * 이 조사들이 먼저 끝나야 클릭 가능 (순서 게이트). 차수는 생성 때 확정된다:
   * `{ id: "computer", visit: 3 }`은 컴퓨터의 3차 조사다.
   */
  unlockAfter?: VisitRef[];
  /** 이 페이즈부터 열린다 (2차 이후 조사). 1차 조사는 늘 p1이다. */
  from?: FromPhase;
  /** 곁가지: 페이즈를 넘기는 데 필요 없다. 밝기 곡선의 분모에도 안 낀다. */
  side?: boolean;
  /** 이 조사를 마치는 순간 트는 컷씬 (content/cutscenes.yaml의 id). */
  cutscene?: string;
  /**
   * 다시보기에서 대사 뒤에 세우는 정지 그림.
   *
   * 되짚어 볼 만한 한 장이 있는 기억에만 준다. 미니게임 화면을 스크린샷처럼
   * 재현하는 것이 목적이 아니라, "그때 본 것"이 한 장으로 남는 기억만 해당한다.
   * 없으면 대사만 흐르고 방이 뒤에 비친다.
   *
   * 규격·결·아직 비어 있는 칸은 docs/story/replay-stills.md.
   */
  replayStill?: string;
}
