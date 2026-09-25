/**
 * 안방 책상 위 연구 서류 조각 (v4.1 7장: 서류 순서 맞추기).
 *
 * 조각마다 날짜가 적혀 있고, 날짜순으로 놓으면 엄마의 기록이 한 줄로 이어진다:
 * 연구원이었다는 것, 앰플이 치료제 후보였다는 것, 여행이 아니라 연구소 소집이었다는 것
 * (not-a-trip은 v4.1에서 이 판에 합쳐졌다). 본문은 i18n `minigame.papersOrder.pieces.<id>`.
 */
export const PAPER_IDS = ["p1", "p2", "p3", "p4"] as const;
export type PaperId = (typeof PAPER_IDS)[number];

/**
 * 처음 흩어진 순서. 날짜순(PAPER_IDS)과 한 자리도 겹치지 않게 고정해 둔다: 무작위로
 * 섞으면 우연히 맞은 판이 설 수 있고, 판마다 난이도가 달라진다.
 */
export const SCATTERED: readonly PaperId[] = ["p3", "p1", "p4", "p2"];

export function isOrdered(order: readonly PaperId[]): boolean {
  return order.length === PAPER_IDS.length && order.every((id, index) => id === PAPER_IDS[index]);
}

/** 두 자리를 맞바꾼다. 범위를 벗어나면 그대로. */
export function swapPapers(order: readonly PaperId[], from: number, to: number): PaperId[] {
  const next = [...order];
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** 제자리에 놓인 조각 수. 맞은 조각은 판에서 표시해 준다. */
export function papersInPlace(order: readonly PaperId[]): number {
  return order.filter((id, index) => id === PAPER_IDS[index]).length;
}
