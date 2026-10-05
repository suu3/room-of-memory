import type { DoorwayId } from "@/data/spaces";
import type { ItemId } from "./items";

/**
 * 거실 너머의 문이 열리는 조건 (v3 방탈출 축).
 *
 * 방문(room-living)은 여기 없다. 그 문은 라디오 목소리가 열고, 열리는 순간이 2막의
 * 시작이라 스토어가 따로 든다 (doorOpened). 나머지 문은 이 표대로 열린다:
 * 물건이 있어야 하는 문은 `item`, 조건 없이 방문과 함께 열리는 문은 빈 규칙이다.
 *
 * v4 체인: 화장실은 거실과 함께 열린다(잠그지 않는다). 안방은 열쇠가 연다. 열쇠는
 * 협탁 서랍(세 자리 자물쇠)이 열리는 순간 손에 들어오고, 협탁 서랍은 아빠의 메모 힌트
 * (컴퓨터 3차) 뒤에만 열린다. 안방 문이 열리는 순간이 4페이즈의 시작이다
 * (src/data/story-phase.ts).
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
