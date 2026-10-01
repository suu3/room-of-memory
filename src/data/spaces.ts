import type { MemoryId } from "@/data/memory-room";

/*
 * 집의 얼개: 어떤 공간이 있고, 어느 문간이 어디를 잇고, 기억이 어느 공간에 있는가.
 *
 * 좌표는 없다. 걷기 범위·발자국·문틀 자리는 씬의 몫이고(`scenes/memory-room/spaces.ts`,
 * `layout.ts`) 그쪽이 이 표 위에 좌표를 얹는다. 스토어와 데이터는 얼개만 알면 되므로 씬을
 * 들여다보지 않고 여기를 본다 (계층 방향: `.claude/rules/architecture.md`).
 */

export const SPACE_IDS = ["room", "living", "bathroom", "parents"] as const;
export type SpaceId = (typeof SPACE_IDS)[number];

export const DOORWAY_IDS = ["room-living", "living-bathroom", "living-parents"] as const;
export type DoorwayId = (typeof DOORWAY_IDS)[number];

/** 문간이 잇는 두 공간. 순서는 [안쪽, 바깥쪽]: 열리면 두 번째 공간이 새로 열린다. */
export const DOORWAY_BETWEEN = {
  "room-living": ["room", "living"],
  "living-bathroom": ["living", "bathroom"],
  "living-parents": ["living", "parents"],
} as const satisfies Record<DoorwayId, readonly [SpaceId, SpaceId]>;

/** 기억이 놓인 공간. */
export const MEMORY_SPACE = {
  "report-card": "room",
  console: "room",
  window: "room",
  frame: "room",
  fridge: "living",
  duffel: "living",
  computer: "room",
  radio: "room",
  phone: "room",
  calendar: "room",
  ball: "room",
  shoes: "living",
  cards: "living",
  ampoule: "living",
  "research-note": "parents",
  "id-card": "parents",
} as const satisfies Record<MemoryId, "room" | "living" | "parents">;

export type MemorySpace = (typeof MEMORY_SPACE)[MemoryId];
