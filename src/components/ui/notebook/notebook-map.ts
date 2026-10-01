import { DOOR_HOLE_HALF_WIDTH } from "@/scenes/memory-room/space-shell";
import {
  DOORWAY_IDS,
  DOORWAYS,
  type DoorwayId,
  reachableSpaces,
  SPACES,
  type SpaceDef,
  type SpaceId,
  spaceCenter,
} from "@/scenes/memory-room/spaces";
import type { Aabb2 } from "@/scenes/memory-room/types";

/**
 * 수첩 평면도의 도형. 씬의 월드 좌표를 그대로 쓴다: 평면도의 x는 월드 x, y는 월드 z다.
 *
 * 좌표를 새로 만들지 않는 게 요점이다. 방 크기를 손보면 평면도가 같이 움직여야 하는데,
 * 여기에 숫자를 따로 적어 두면 어느 날 둘이 다른 집이 된다 (씬의 3D 좌표를 시나리오
 * 데이터에 넣지 않는 것과 같은 이유, .claude/rules/r3f.md).
 *
 * 화면과의 방향도 맞는다. 카메라는 +x·+z 쪽에서 내려다보므로 월드 -x가 화면 왼쪽이고,
 * 평면도에서도 거실(-x)이 내 방 왼쪽에 선다.
 */
export interface PlanRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlanRoom extends PlanRect {
  id: SpaceId;
  /** 이름표와 표식이 앉는 자리 (걷기 범위의 한가운데). */
  center: { x: number; y: number };
  /** 껍데기 밖으로 파인 홈 (거실의 현관). 같은 칸이라 같은 색으로 칠한다. */
  nooks: PlanRect[];
}

/** 열린 문간: 벽 선을 지우는 구멍이다. 벽선 양쪽을 다 덮을 만큼만 두껍다. */
export interface PlanDoor extends PlanRect {
  id: DoorwayId;
}

export interface FloorPlan {
  /** SVG viewBox 문자열. 그려진 공간만 감싸므로 방이 열릴수록 종이가 넓어진다. */
  viewBox: string;
  rooms: PlanRoom[];
  doors: PlanDoor[];
  /** 칸과 홈 사이의 트인 변: 문 없이 이어지므로 문간처럼 벽선을 지운다. */
  openings: PlanRect[];
}

/** 도형 바깥 여백 (월드 단위). 벽선이 종이 끝에 붙지 않을 만큼. */
const PLAN_PADDING = 0.9;

/** 문구멍이 벽선을 가로지르는 깊이. 벽선(0.16)이 양쪽에 하나씩 있어도 덮는다. */
const DOOR_GAP_DEPTH = 0.36;

function rectOf(box: Aabb2): PlanRect {
  return {
    x: box.minX,
    y: box.minZ,
    width: box.maxX - box.minX,
    height: box.maxZ - box.minZ,
  };
}

/**
 * 두 공간이 맞대고 있는 벽. 껍데기가 정확히 같은 선을 공유하므로 그 선을 찾는다.
 *
 * 문짝의 좌표(DOORWAYS.position)를 쓰지 않는 이유: 문은 벽 두께의 절반만큼 안으로
 * 들어와 서 있어서, 그 자리에 구멍을 뚫으면 벽선 한쪽이 지워지지 않고 남는다.
 */
function sharedWall(a: Aabb2, b: Aabb2): { axis: "x" | "z"; at: number } | null {
  if (a.minX === b.maxX) return { axis: "x", at: a.minX };
  if (a.maxX === b.minX) return { axis: "x", at: a.maxX };
  if (a.minZ === b.maxZ) return { axis: "z", at: a.minZ };
  if (a.maxZ === b.minZ) return { axis: "z", at: a.maxZ };
  return null;
}

/**
 * 지금까지 열린 문간으로 닿을 수 있는 공간만 그린 평면도.
 *
 * 못 가본 공간은 아예 안 그린다. 흐릿하게라도 그려 두면 집의 생김새를 먼저 알려주는
 * 셈이라, 문을 하나씩 여는 일이 "이미 아는 칸을 채우는 일"로 내려앉는다
 * (docs/content-design.md 3-1의 공간 하나씩 열기).
 */
export function floorPlan(openDoorways: readonly DoorwayId[]): FloorPlan {
  const open = DOORWAY_IDS.filter((id) => openDoorways.includes(id));
  const drawn = reachableSpaces(open);

  const rooms: PlanRoom[] = drawn.map((id) => {
    const { x, z } = spaceCenter(id);
    const space: SpaceDef = SPACES[id];
    const nooks = (space.nooks ?? []).map((nook) => rectOf(nook.shell));
    return { id, ...rectOf(space.shell), center: { x, y: z }, nooks };
  });

  const openings: PlanRect[] = [];
  for (const id of drawn) {
    const space: SpaceDef = SPACES[id];
    for (const nook of space.nooks ?? []) {
      const wall = sharedWall(space.shell, nook.shell);
      if (!wall) continue;
      // 트인 변의 양 끝은 벽선 반폭만큼 남긴다: 모서리까지 지우면 꺾인 윤곽이 끊긴다
      const inset = DOOR_GAP_DEPTH / 2;
      openings.push(
        wall.axis === "z"
          ? {
              x: nook.shell.minX + inset,
              y: wall.at - DOOR_GAP_DEPTH / 2,
              width: nook.shell.maxX - nook.shell.minX - inset * 2,
              height: DOOR_GAP_DEPTH,
            }
          : {
              x: wall.at - DOOR_GAP_DEPTH / 2,
              y: nook.shell.minZ + inset,
              width: DOOR_GAP_DEPTH,
              height: nook.shell.maxZ - nook.shell.minZ - inset * 2,
            },
      );
    }
  }

  const doors: PlanDoor[] = [];
  for (const id of open) {
    const [from, to] = DOORWAYS[id].between;
    if (!drawn.includes(from) || !drawn.includes(to)) continue;
    const wall = sharedWall(SPACES[from].shell, SPACES[to].shell);
    if (!wall) continue;
    // 문의 좌표 중 벽을 따라가는 축만 쓴다. 벽을 가로지르는 축은 공유 벽선이 정한다
    const [doorX, , doorZ] = DOORWAYS[id].position;
    doors.push(
      wall.axis === "x"
        ? {
            id,
            x: wall.at - DOOR_GAP_DEPTH / 2,
            y: doorZ - DOOR_HOLE_HALF_WIDTH,
            width: DOOR_GAP_DEPTH,
            height: DOOR_HOLE_HALF_WIDTH * 2,
          }
        : {
            id,
            x: doorX - DOOR_HOLE_HALF_WIDTH,
            y: wall.at - DOOR_GAP_DEPTH / 2,
            width: DOOR_HOLE_HALF_WIDTH * 2,
            height: DOOR_GAP_DEPTH,
          },
    );
  }

  const shapes = rooms.flatMap((room) => [room, ...room.nooks]);
  const minX = Math.min(...shapes.map((shape) => shape.x)) - PLAN_PADDING;
  const minY = Math.min(...shapes.map((shape) => shape.y)) - PLAN_PADDING;
  const maxX = Math.max(...shapes.map((shape) => shape.x + shape.width)) + PLAN_PADDING;
  const maxY = Math.max(...shapes.map((shape) => shape.y + shape.height)) + PLAN_PADDING;

  return { viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`, rooms, doors, openings };
}
