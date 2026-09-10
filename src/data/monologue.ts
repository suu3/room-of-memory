import type { MemoryId } from "./generated/content";
import { MEMORY_GOAL, PHASE2_MEMORIES } from "./memory-room";

/**
 * 상단 독백의 구간 id. content/stages.yaml의 키와 같아야 한다
 * (scripts/content/schema.mjs의 STAGE_IDS가 그걸 검증한다).
 *
 * 밝기 단계(dark/dim/gold)가 아니라 조사 개수로 갈린다. 기억 0개일 때와 6개일 때
 * 같은 말이 걸려 있으면 방은 어두워지는데 사람만 그대로인 것처럼 읽힌다.
 */
export const MONOLOGUE_IDS = [
  "p1-0",
  "p1-1",
  "p1-3",
  "p1-5",
  "p1-7",
  "p2-0",
  "p2-1",
  "p2-4",
  "p2-8",
  "p2-11",
] as const;
export type MonologueId = (typeof MONOLOGUE_IDS)[number];

interface ProgressSnapshot {
  collected: readonly MemoryId[];
  revisited: readonly MemoryId[];
  doorOpened: boolean;
}

/** 2바퀴에서 다시 조사한 개수: 진행 표시(HUD)와 같은 목록을 센다. */
export function phaseTwoCount(revisited: readonly MemoryId[]): number {
  return PHASE2_MEMORIES.filter((memory) => revisited.includes(memory.id)).length;
}

/**
 * 지금 화면 상단에 걸릴 독백.
 *
 * 1바퀴는 수집 개수(0 / 1~2 / 3~4 / 5~6)로 내려가다 7개에서 바닥(p1-7)을 찍는다.
 * 바닥 줄은 라디오 목소리를 잡기 전까지만 걸린다. 목소리를 잡으면(문은 아직) 조심스러운
 * 희망(p2-0)으로 넘어가고, 문이 열려 2바퀴가 시작되면 재조사 개수(1~3 / 4~7 / 8~10 / 완주)로
 * 올라간다. 13번의 조사 동안 열 줄이 차례로 바뀐다.
 */
export function monologueIdFor(state: ProgressSnapshot): MonologueId {
  const collected = state.collected.length;
  if (collected < MEMORY_GOAL) {
    if (collected >= 5) return "p1-5";
    if (collected >= 3) return "p1-3";
    if (collected >= 1) return "p1-1";
    return "p1-0";
  }
  if (!state.doorOpened) {
    return state.revisited.includes("radio" as MemoryId) ? "p2-0" : "p1-7";
  }
  const count = phaseTwoCount(state.revisited);
  if (count >= PHASE2_MEMORIES.length) return "p2-11";
  if (count >= 8) return "p2-8";
  if (count >= 4) return "p2-4";
  if (count >= 1) return "p2-1";
  return "p2-0";
}
