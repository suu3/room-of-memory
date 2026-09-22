import type { ParseKeys } from "i18next";
import type { MemoryId } from "@/data/memory-room";
import type { CharacterId } from "./scenario";

/** memoryRoom 네임스페이스에서 유효한 번역 키만 허용. */
export type MemoryRoomTextKey = ParseKeys<"memoryRoom">;

/** 초상 프레임. 대사가 다 찍히면 이 표정으로 돌아온다 (타이핑 중에는 입 열린 프레임). */
export type CharacterExpression = "neutral" | "smile" | "surprised" | "embarrassed";

export interface DialogueScriptLine {
  speaker: CharacterId;
  textKey: MemoryRoomTextKey;
  /** 생략하면 "neutral". */
  expression?: CharacterExpression;
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
export interface MemoryInteraction {
  scriptId?: string;
  /** src/minigames/index.ts 레지스트리의 미니게임 id. */
  minigameId?: string;
  /**
   * 미니게임 클리어 뒤에 재생할 결과 대사 (기획서 5-1 ③).
   * 이 대사 동안 미니게임 화면은 뒤에 남는다. 방금 드러난 장면을 보며 듣는다.
   */
  resultScriptId?: string;
}

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
   * 대사가 끝난 뒤 대사창 없이 그림만 남기는 시간(ms).
   * "정적 몇 초"가 연출의 일부인 컷에만 준다. 없으면 곧장 다음 컷으로 넘어간다.
   */
  holdMs?: number;
}

/** 컷씬 하나. CUTSCENES 레지스트리(src/data)에 id로 등록. */
export interface Cutscene {
  id: string;
  cuts: CutsceneCut[];
}

/**
 * 페이즈별 핫스팟 설정. 페이즈 규칙이 늘어나면 여기에 필드를 더한다.
 * MemoryId는 type-only import라 data ↔ types 순환이 런타임에 존재하지 않는다.
 */
export interface MemoryPhaseConfig {
  /** 클릭 시 실행할 인터랙션. 없으면 즉시 완료. */
  interaction?: MemoryInteraction;
  /** 같은 페이즈에서 이 아이템들이 먼저 완료되어야 클릭 가능 (순서 게이트). */
  unlockAfter?: MemoryId[];
  /**
   * 다시보기에서 대사 뒤에 세우는 정지 그림.
   *
   * 되짚어 볼 만한 한 장이 있는 기억에만 준다. 미니게임 화면을 스크린샷처럼
   * 재현하는 것이 목적이 아니라, "그때 본 것"이 한 장으로 남는 기억만 해당한다.
   * 없으면 대사만 흐르고 방이 뒤에 비친다.
   */
  replayStill?: string;
}
