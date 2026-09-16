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
 * 지금 서 있는 체인 (2026-09-16).
 *
 *   거실 → 화장실(그냥 열림) → 세면대의 열쇠 → 안방(열쇠) → 책상의 악보 조각
 *   → 거실 피아노(조각이 있어야 지워진 마디가 보인다)
 *
 * 한 공간의 물건이 다음 공간을 열고, 마지막에 처음 공간으로 되돌아온다. 왕복이
 * 심부름이 아니라 "저쪽에서 찾은 것을 이쪽에서 쓴다"가 되는 모양이다
 * (docs/content-design.md 3-1).
 */
