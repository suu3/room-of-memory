import type { MemoryId } from "@/data/memory-room";
import type { Visit } from "@/data/story-phase";

/**
 * 수첩 기록 한 장의 글 (제목 · 본문)이 어느 번역 키에 있는가. 기록 페이지(LoreEntries)와
 * 추리 판(DeductionBoard)이 같은 문장을 세운다.
 */

/** 그 차수의 본문 키. */
export function loreBodyKey(id: MemoryId, visit: Visit): string {
  return `lore.${id}.phase${visit}`;
}

/**
 * 그 차수의 제목 키. 제목은 어느 차수부터 바뀔 수 있어서(lore.phaseNTitle) 가장 가까운 앞
 * 차수의 것을 쓰고, 없으면 기본 제목이다. `exists`는 번역이 있는 키인지 묻는다.
 */
export function loreTitleKey(id: MemoryId, visit: Visit, exists: (key: string) => boolean): string {
  const changed = ([3, 2, 1] as const)
    .filter((each) => each <= visit)
    .map((each) => `lore.${id}.phase${each}Title`)
    .find(exists);
  return changed ?? `lore.${id}.title`;
}
