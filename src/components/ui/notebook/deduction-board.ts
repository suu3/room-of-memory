import { DEDUCTIONS, type DeductionId } from "@/data/deductions";
import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";

/**
 * 추리 판의 순수 로직 (DeductionBoard.tsx). 브라우저 없이 검사한다.
 */

/**
 * 판에 놓는 카드: 방문이 열린 뒤에 적힌 기록(2차 조사를 마친 기억), 수첩에 실린 순서대로.
 *
 * 1막의 기록까지 다 놓으면 카드가 열 장을 넘어 고르기 전에 읽다 지친다. 추리는 집을
 * 뒤지며 본 것들 사이의 일이라, 그 뒤의 기록만 놓는다.
 */
export function boardCards(revisited: readonly MemoryId[]): MemoryId[] {
  return MEMORY_IDS.filter((id) => revisited.includes(id));
}

/** 몇 번 어긋나야 한 장을, 또 두 장을 다 짚어 주는가. 이지는 더 일찍 짚는다. */
const HINT_AFTER = { normal: [3, 5], guided: [1, 3] } as const;

/**
 * 어긋난 횟수에 따라 짚어 주는 카드. 미니게임의 스킵처럼 막힌 채로 두지 않는다:
 * 두 장을 다 짚은 뒤에는 누르기만 하면 풀린다.
 */
export function hintedCards(id: DeductionId, misses: number, guided: boolean): MemoryId[] {
  const [first, second] = DEDUCTIONS[id].answer;
  const [one, both] = HINT_AFTER[guided ? "guided" : "normal"];
  if (misses >= both) return [first, second];
  return misses >= one ? [first] : [];
}

/**
 * 카드 한 장을 누른 뒤의 고른 목록. 고른 것을 다시 누르면 내려놓고, 두 장이 이미 놓여
 * 있으면(어긋난 한 쌍) 그 쌍을 걷고 이 카드부터 새로 고른다.
 */
export function pickCard(picked: readonly MemoryId[], card: MemoryId): MemoryId[] {
  if (picked.length >= 2) return [card];
  if (picked.includes(card)) return picked.filter((each) => each !== card);
  return [...picked, card];
}
