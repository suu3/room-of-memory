import {
  BATHROOM_BOUNDS,
  BATHROOM_COLLIDERS,
  BATHROOM_DOOR_POSITION,
  BATHROOM_DOOR_ROTATION,
  BATHROOM_DOORWAY_ZONE,
  BATHROOM_SHELL_BOUNDS,
  DOORWAY_ZONE,
  LIVING_BOUNDS,
  LIVING_COLLIDERS,
  LIVING_SHELL_BOUNDS,
  OPEN_DOOR_LEAF_COLLIDERS,
  PARENTS_BOUNDS,
  PARENTS_COLLIDERS,
  PARENTS_DOOR_POSITION,
  PARENTS_DOOR_ROTATION,
  PARENTS_DOORWAY_ZONE,
  PARENTS_SHELL_BOUNDS,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
  ROOM_DOOR_POSITION,
  ROOM_DOOR_ROTATION,
  ROOM_SHELL_BOUNDS,
} from "./layout";
import type { Aabb2, EulerTuple, Vec3Tuple } from "./types";

/*
 * 집의 공간 목록과 그 사이의 문간 (v3).
 *
 * 예전에는 방과 거실 둘뿐이라 "거실에 있는가"라는 boolean 하나와 문간 하나로 충분했다.
 * 2막부터 집이 한 공간씩 열리면서(docs/content-design.md 3-1) 공간이 곧 데이터가 된다:
 * 걷기 범위·가구 발자국·카메라 중심·밝기 오프셋을 공간마다 갖고, 문간은 두 공간을
 * 잇는 판정 구간이다. Player·CameraRig·씬은 이 표만 보고 공간 수를 모른다.
 *
 * 좌표 자체는 layout.ts에 있다. 여기는 그것들을 공간 단위로 묶은 표와, 표를 읽는 순수
 * 함수다 (three 객체 없음: 테스트가 가볍다).
 */

export const SPACE_IDS = ["room", "living", "bathroom", "parents"] as const;
export type SpaceId = (typeof SPACE_IDS)[number];

export interface SpaceDef {
  id: SpaceId;
  /** 벽 안쪽 면까지의 껍데기. 어느 공간에 서 있는지는 이걸로 판정한다. */
  shell: Aabb2;
  /** 걷기 범위. 껍데기에서 벽 여유만큼 물러선다. */
  bounds: Aabb2;
  colliders: readonly Aabb2[];
  /**
   * 밝기 오프셋. 밝기는 진행도가 정하고 공간이 정하지 않는다는 원칙 위에서, 방이 아닌
   * 공간은 한 단계 어둡게 출발한다 (visual-state의 LIVING_ROOM_LIGHT_OFFSET).
   */
  lightOffset: number;
  /** 창이 있는가: 볕(warm)은 창이 있는 공간에서만 든다. */
  hasWindow: boolean;
}

/** 방이 아닌 공간이 방보다 어두운 몫 (docs/content-design.md 5장). */
const AWAY_LIGHT_OFFSET = 0.12;

export const SPACES = {
  room: {
    id: "room",
    shell: ROOM_SHELL_BOUNDS,
    bounds: ROOM_BOUNDS,
    colliders: ROOM_COLLIDERS,
    lightOffset: 0,
    hasWindow: true,
  },
  living: {
    id: "living",
    shell: LIVING_SHELL_BOUNDS,
    bounds: LIVING_BOUNDS,
    colliders: LIVING_COLLIDERS,
    lightOffset: AWAY_LIGHT_OFFSET,
    hasWindow: false,
  },
  bathroom: {
    id: "bathroom",
    shell: BATHROOM_SHELL_BOUNDS,
    bounds: BATHROOM_BOUNDS,
    colliders: BATHROOM_COLLIDERS,
    lightOffset: AWAY_LIGHT_OFFSET,
    hasWindow: false,
  },
  parents: {
    id: "parents",
    shell: PARENTS_SHELL_BOUNDS,
    bounds: PARENTS_BOUNDS,
    colliders: PARENTS_COLLIDERS,
    // 부모님 방은 가장 오래 닫혀 있던 공간이다. 한 단계 더 어둡다
    lightOffset: AWAY_LIGHT_OFFSET * 2,
    hasWindow: false,
  },
} as const satisfies Record<SpaceId, SpaceDef>;

export const DOORWAY_IDS = ["room-living", "living-bathroom", "living-parents"] as const;
export type DoorwayId = (typeof DOORWAY_IDS)[number];

export interface DoorwayDef {
  id: DoorwayId;
  /** 잇는 두 공간. 순서는 [안쪽, 바깥쪽]: 열리면 두 번째 공간이 새로 열린다. */
  between: readonly [SpaceId, SpaceId];
  /** 두 공간의 걷기 범위를 잇는 다리. 문이 열려 있을 때만 걷기 영역에 든다. */
  zone: Aabb2;
  /** 문틀의 자리와 방향. 그리는 쪽(문짝 컴포넌트)이 쓴다. */
  position: Vec3Tuple;
  rotation: EulerTuple;
  /** 열린 문짝의 발자국. 방문만 갖고 있다: 안쪽으로 젖혀지는 판이 통로를 문다. */
  openLeafColliders: readonly Aabb2[];
}

export const DOORWAYS = {
  "room-living": {
    id: "room-living",
    between: ["room", "living"],
    zone: DOORWAY_ZONE,
    position: ROOM_DOOR_POSITION,
    rotation: ROOM_DOOR_ROTATION,
    openLeafColliders: OPEN_DOOR_LEAF_COLLIDERS,
  },
  "living-bathroom": {
    id: "living-bathroom",
    between: ["living", "bathroom"],
    zone: BATHROOM_DOORWAY_ZONE,
    position: BATHROOM_DOOR_POSITION,
    rotation: BATHROOM_DOOR_ROTATION,
    openLeafColliders: [],
  },
  "living-parents": {
    id: "living-parents",
    between: ["living", "parents"],
    zone: PARENTS_DOORWAY_ZONE,
    position: PARENTS_DOOR_POSITION,
    rotation: PARENTS_DOOR_ROTATION,
    openLeafColliders: [],
  },
} as const satisfies Record<DoorwayId, DoorwayDef>;

/** 모든 공간의 가구 발자국. 문이 닫힌 공간 것도 늘 합쳐 본다: 어차피 닿을 수 없다. */
export const ALL_COLLIDERS: readonly Aabb2[] = SPACE_IDS.flatMap((id) => SPACES[id].colliders);

function contains(box: Aabb2, x: number, z: number): boolean {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

/**
 * (x, z)가 어느 공간의 껍데기 안인가. 껍데기끼리는 변만 맞닿으므로 변 위의 점은 먼저
 * 적힌 공간이 갖는다. 어느 껍데기에도 안 들면(문간을 지나는 중의 벽 두께 안) 지금
 * 공간을 유지한다: 문턱을 넘는 순간은 한 번만 바뀌어야 한다.
 */
export function spaceAt(x: number, z: number, current: SpaceId): SpaceId {
  if (contains(SPACES[current].shell, x, z)) return current;
  for (const id of SPACE_IDS) {
    if (contains(SPACES[id].shell, x, z)) return id;
  }
  return current;
}

/**
 * 방에서 열린 문간을 따라 닿을 수 있는 공간들. 방은 늘 든다.
 * 문이 열렸다고 그 너머 공간이 곧장 열리는 게 아니라, 거기까지 문이 이어져야 한다.
 */
export function reachableSpaces(openDoorways: readonly DoorwayId[]): SpaceId[] {
  const reached: SpaceId[] = ["room"];
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of openDoorways) {
      const [from, to] = DOORWAYS[id].between;
      const hasFrom = reached.includes(from);
      const hasTo = reached.includes(to);
      if (hasFrom && !hasTo) {
        reached.push(to);
        grew = true;
      } else if (hasTo && !hasFrom) {
        reached.push(from);
        grew = true;
      }
    }
  }
  return reached;
}

/**
 * 지금 걸을 수 있는 영역: 닿을 수 있는 공간의 걷기 범위와 열린 문간.
 * 닫힌 공간의 범위는 넣지 않는다. 넣어도 다리가 없어 못 가지만, 경로 탐색 격자가
 * 그만큼 커진다.
 */
export function walkZones(openDoorways: readonly DoorwayId[]): Aabb2[] {
  const spaces = reachableSpaces(openDoorways);
  return [...spaces.map((id) => SPACES[id].bounds), ...openDoorways.map((id) => DOORWAYS[id].zone)];
}

/** 지금 막는 것: 모든 가구와 열린 문짝. */
export function walkColliders(openDoorways: readonly DoorwayId[]): Aabb2[] {
  return [...ALL_COLLIDERS, ...openDoorways.flatMap((id) => DOORWAYS[id].openLeafColliders)];
}

/**
 * 카메라 목표점이 머물 수 있는 범위: 닿을 수 있는 공간들의 걷기 범위를 안쪽으로 물린
 * 상자의 합집합(AABB). 공간마다 한계를 갈라 문턱에서 바꾸면 목표점이 한 번에 수 유닛
 * 건너뛰어 카메라가 출렁인다 (CameraRig). 합집합 상자는 ㄱ자로 이어진 집에서 빈
 * 모서리까지 품지만, 플레이어가 거기 설 수 없으니 실제로는 안 간다.
 */
export function followLimits(openDoorways: readonly DoorwayId[], inset: number): Aabb2 {
  const spaces = reachableSpaces(openDoorways);
  const union = { ...SPACES[spaces[0]].bounds };
  for (const id of spaces) {
    const box = SPACES[id].bounds;
    union.minX = Math.min(union.minX, box.minX);
    union.maxX = Math.max(union.maxX, box.maxX);
    union.minZ = Math.min(union.minZ, box.minZ);
    union.maxZ = Math.max(union.maxZ, box.maxZ);
  }
  return {
    minX: union.minX + inset,
    maxX: union.maxX - inset,
    minZ: union.minZ + inset,
    maxZ: union.maxZ - inset,
  };
}

/** 축소했을 때 카메라가 향하는 공간의 가운데. */
export function spaceCenter(id: SpaceId): { x: number; z: number } {
  const { bounds } = SPACES[id];
  return { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
}
