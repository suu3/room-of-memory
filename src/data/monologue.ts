import type { MemoryId } from "./generated/content";
import { PHASE2_MEMORIES } from "./memory-room";
import { type StoryProgress, storyPhaseOf } from "./story-phase";

/**
 * 상단 독백의 구간 id. content/stages.yaml의 키와 같아야 한다
 * (scripts/content/schema.mjs의 STAGE_IDS가 그걸 검증한다).
 *
 * 페이즈(v4 설계서 1-1)로 갈리고, 1페이즈 안에서는 강도 단계로 한 번 더 갈린다.
 * 기한 독백(p2 "사흘." · p3 "이틀 남았다." · p4 "오늘 밤이다.")은 그 페이즈에 들어서는
 * 순간 한 번 찍히고, 페이즈가 이어지는 동안 그대로 걸려 있다.
 */
export const MONOLOGUE_IDS = [
  "p0-dark",
  "p1-0",
  "p1-mid",
  "p1-late",
  "turn-bottom",
  "turn-signal",
  "p2-enter",
  "p3-enter",
  "p4-enter",
  "resolve",
] as const;
export type MonologueId = (typeof MONOLOGUE_IDS)[number];

/** 1페이즈에서 강도 2에 들어섰다고 보는 수: 강도 1(게임기·공) 둘을 다 봤다. */
const P1_MID_AT = 2;
/** 강도 3에 들어섰다고 보는 수: 강도 2까지 넷을 봤다. */
const P1_LATE_AT = 4;

/** 2바퀴에서 다시 조사한 개수: 진행 표시(HUD)와 같은 목록을 센다. */
export function phaseTwoCount(revisited: readonly MemoryId[]): number {
  return PHASE2_MEMORIES.filter((memory) => revisited.includes(memory.id)).length;
}

/** 지금 화면 상단에 걸릴 독백. */
export function monologueIdFor(state: StoryProgress): MonologueId {
  const phase = storyPhaseOf(state);
  switch (phase) {
    case "intro":
      return "p0-dark";
    case "p1": {
      const collected = state.collected.length;
      if (collected >= P1_LATE_AT) return "p1-late";
      if (collected >= P1_MID_AT) return "p1-mid";
      return "p1-0";
    }
    case "turning":
      // 생존자 방송을 들었다(라디오 2차) = 문이 금빛이다
      return state.revisited.includes("radio" as MemoryId) ? "turn-signal" : "turn-bottom";
    case "p2":
      return "p2-enter";
    case "p3":
      return "p3-enter";
    case "p4":
      return "p4-enter";
    default:
      return "resolve";
  }
}
