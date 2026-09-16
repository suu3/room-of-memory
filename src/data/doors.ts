import type { DoorwayId } from "@/scenes/memory-room/spaces";
import type { ItemId } from "./items";

/**
 * 거실 너머의 문이 열리는 조건 (v3 방탈출 축).
 *
 * 방문(room-living)은 여기 없다. 그 문은 라디오 목소리가 열고, 열리는 순간이 2막의
 * 시작이라 스토어가 따로 든다 (doorOpened). 나머지 문은 이 표대로 열린다:
 * 물건이 있어야 하는 문은 `item`, 조건 없이 방문과 함께 열리는 문은 빈 규칙이다.
 *
 * **자리 표시자**다 (2026-09-16). 지금 체인은 "거실 → 화장실(그냥 열림) → 세면대의
 * 열쇠 → 안방(열쇠)"이다. 이쪽 공간의 단서가 저쪽 공간의 문을 연다는 꼴만 세워 둔 것이고,
 * 무엇이 무엇을 여는지는 퍼즐 설계와 함께 바꾼다. 조건의 종류가 늘면(문제를 풀어야,
 * 기억을 되찾아야) 이 표에 칸을 더한다.
 */
export interface DoorRule {
  /** 이 물건을 가지고 있어야 열린다. */
  item?: ItemId;
}

/** 규칙이 있는 문: 방문을 뺀 전부. 여기 없는 문은 영영 안 열린다 (doors.test가 지킨다). */
export type RuledDoorwayId = Exclude<DoorwayId, "room-living">;

export const DOOR_RULES: Record<RuledDoorwayId, DoorRule> = {
  "living-bathroom": {},
  "living-parents": { item: "parents-key" },
};
