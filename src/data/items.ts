/**
 * 가지고 다니는 물건 (v3 방탈출 축).
 *
 * 기억(수집)과 다르다. 기억은 이야기를 밀고, 물건은 **다른 곳에서 쓴다**: 이 방에서
 * 집은 열쇠가 저 방의 문을 연다 (src/data/doors.ts). 진행에 남으므로 저장된다
 * (store의 inventory).
 *
 * 지금 목록은 **자리 표시자**다 (2026-09-16). 방탈출 퍼즐 설계가 정해지면 물건과
 * 그 자리를 바꾼다. 한 가지 규칙만 미리 정한다: id는 kebab-case이고, 물건은 집으면
 * 사라지고 되돌아오지 않는다 (다시 놓는 퍼즐이 생기면 그때 스키마를 넓힌다).
 */
export const ITEM_IDS = ["parents-key", "piano-sheet"] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** 어느 공간에서 집는가. 씬이 그 공간의 껍데기 안에 물건을 세운다. */
export const ITEM_SPACE = {
  "parents-key": "bathroom",
  "piano-sheet": "parents",
} as const satisfies Record<ItemId, string>;

/**
 * 지금 서 있는 체인 (v4 설계서 3-5 · 3-7).
 *
 *   컴퓨터 3차(아빠 메일: "네 번호로 해놨다") → 화장실 세면대 하부장 다이얼(선반 책 속 쪽지의 세 자리)
 *   → 안방 열쇠 → 안방(4페이즈) → 책상의 악보 조각 → 거실 피아노(곁가지)
 *
 * 열쇠는 집는 물건이 아니라 하부장이 열리는 순간 손에 들어온다 (store의 finishPuzzle).
 */

/**
 * 미궁 문제에 쓰는 물건과 그 문제. 문제를 풀면 물건은 할 일을 다 했다 (store의 itemSpent).
 * 문을 여는 물건은 여기 없다: 그건 문 규칙(src/data/doors.ts)이 안다.
 */
export const ITEM_PUZZLE: Partial<Record<ItemId, string>> = {
  "piano-sheet": "piano-melody",
};
