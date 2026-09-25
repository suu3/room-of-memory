/** scripts/content/schema.mjs의 타입 선언: 어드민이 선택지 목록을 여기서 받는다. */
import type { CharacterExpression } from "@/types/interaction";

export const LOCALES: readonly string[];
export const BASE_LOCALE: string;
export const EXPRESSIONS: readonly CharacterExpression[];
export const SPEAKERS: readonly string[];
export const ICONS: readonly string[];
export const STAGE_IDS: readonly string[];
export const STORY_PHASES: readonly string[];
export const FROM_PHASES: readonly string[];
export const VISIT_KEYS: readonly string[];
export const CUT_SFX: readonly string[];
export const CUT_PANELS: readonly string[];
export const CUT_KEYS: readonly string[];
export const PHASE_KEYS: readonly string[];
export const MEMORY_KEYS: readonly string[];
export const ID_PATTERN: RegExp;
export const SOURCES: Record<string, { file: string; root: string }>;
