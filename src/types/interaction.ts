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

/** 핫스팟 클릭 시 실행할 인터랙션. 대사(scriptId) → 미니게임(minigameId) → 완료 순. */
export interface MemoryInteraction {
  scriptId?: string;
  /** src/minigames/index.ts 레지스트리의 미니게임 id. */
  minigameId?: string;
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
