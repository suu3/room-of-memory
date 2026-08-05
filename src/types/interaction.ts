import type { ParseKeys } from "i18next";
import type { MemoryId } from "@/data/memory-room";
import type { CharacterId } from "./scenario";

/** memoryRoom 네임스페이스에서 유효한 번역 키만 허용. */
export type MemoryRoomTextKey = ParseKeys<"memoryRoom">;

/** 초상 프레임. 대사가 다 찍히면 이 표정으로 돌아온다 (타이핑 중에는 입 열린 프레임). */
export type CharacterExpression = "neutral" | "smile" | "surprised";

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
   * 이 대사 동안 미니게임 화면은 뒤에 남는다 — 방금 드러난 장면을 보며 듣는다.
   */
  resultScriptId?: string;
}

/**
 * 컷씬 한 컷 — 일러스트 한 장과 그 위로 흐르는 대사.
 *
 * 대사는 컷씬 전용 창을 새로 만들지 않고 기존 대사창(DialogueBox)이 그대로 받는다.
 * 그림 안에 말풍선을 넣지 않는 것이 이 연출의 규칙이라, 그림과 글의 레이어가
 * 갈라져 있어야 한다.
 */
export interface CutsceneCut {
  /** 일러스트 경로(ASSETS.images.*). 파일이 아직 없으면 회색 판이 대신 선다. */
  image: string;
  lines: DialogueScriptLine[];
  /**
   * 대사가 끝난 뒤 대사창 없이 그림만 남기는 시간(ms).
   * "정적 몇 초"가 연출의 일부인 컷에만 준다 — 없으면 곧장 다음 컷으로 넘어간다.
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
}
