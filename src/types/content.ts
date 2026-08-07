/**
 * 저작 콘텐츠(content/*.yaml)의 타입 — 어드민과 콘텐츠 파이프라인이 공유한다.
 *
 * 게임이 실제로 읽는 것은 이걸 생성한 결과(src/data/generated/content.ts + i18n
 * 리소스)다. 여기 타입은 "사람이 쓰는 형태"를 가리킨다.
 */
import type { CharacterExpression } from "./interaction";

/** 지원 언어. src/i18n/config.ts의 SUPPORTED_LOCALES와 같아야 한다. */
export const CONTENT_LOCALES = ["ko", "en", "ja"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

/** ko/en/ja가 전부 채워진 텍스트 한 덩어리. */
export type LocalizedText = Record<ContentLocale, string>;

/** 대사 한 줄 — 본문이 줄 안에 같이 있다는 점만 런타임 타입과 다르다. */
export interface ContentLine extends LocalizedText {
  speaker: string;
  expression?: CharacterExpression;
}

export interface ContentPhase {
  /** 미니게임 앞에 트는 진입 대사 (scripts의 id). */
  script?: string;
  /** src/minigames/index.ts 레지스트리의 미니게임 id. */
  minigame?: string;
  /** 미니게임 클리어 뒤에 재생할 결과 대사 (scripts의 id). */
  resultScript?: string;
  /** 같은 페이즈에서 먼저 완료돼야 하는 기억 id. */
  unlockAfter?: string[];
  /** 다시보기에서 대사 뒤에 세우는 정지 그림 (public 기준 경로). */
  replayStill?: string;
}

/** 수첩에 남는 기록. 페이즈와 1:1 — 있는 바퀴의 기록만 쓴다. */
export interface ContentLore {
  title: LocalizedText;
  phase1?: LocalizedText;
  phase2?: LocalizedText;
}

export interface ContentMemory {
  id: string;
  /** @phosphor-icons/react 아이콘 이름 (scripts/content/schema.mjs의 허용 목록). */
  icon: string;
  lore: ContentLore;
  /** 없으면 1바퀴 내내 잠겨 있는 2바퀴 전용 기억이다. 둘 다 없으면 저장이 막힌다. */
  phase1?: ContentPhase;
  phase2?: ContentPhase;
}

export interface ContentCut {
  image?: string;
  /** 대사가 끝난 뒤 그림만 남기는 시간(ms). */
  holdMs?: number;
  lines: ContentLine[];
}

export interface ContentStage {
  monologue: LocalizedText;
  dialogue: LocalizedText;
}

/** content/*.yaml 네 개를 합친 모습. 어드민이 통째로 주고받는 단위다. */
export interface GameContent {
  memories: ContentMemory[];
  scripts: Record<string, ContentLine[]>;
  cutscenes: Record<string, ContentCut[]>;
  stages: Record<string, ContentStage>;
}

/** 어드민이 편집할 때 참고하는 선택지 목록 — 서버가 스키마에서 뽑아 내려준다. */
export interface ContentOptions {
  icons: string[];
  speakers: string[];
  expressions: CharacterExpression[];
  minigameIds: string[];
  stageIds: string[];
}

/** 저장 결과. issues가 비어 있지 않으면 아무것도 쓰이지 않았다. */
export interface SaveResult {
  ok: boolean;
  issues: string[];
  written: string[];
}
