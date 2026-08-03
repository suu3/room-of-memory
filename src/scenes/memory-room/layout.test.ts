import { describe, expect, it } from "vitest";
import { MEMORY_IDS } from "@/data/memory-room";
import {
  CABINET_TOP_BOUNDS,
  CABINET_TOP_PROPS,
  CABINET_TOP_Y,
  CAMERA_PRESETS,
  CHAIR_POSITION,
  DESK_ROTATION,
  MEMORY_PLACEMENTS,
  REFERENCE_ROOM_LAYOUT,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
  ROOM_DOOR_POSITION,
  ROOM_DOOR_ROTATION,
  ROOM_SHELL_BOUNDS,
  ROOM_SHELL_CENTER,
} from "./layout";

const PLAYER_RADIUS = 0.38;
const REACHABILITY_STEP = 0.05;

function isWalkable(x: number, z: number) {
  return ROOM_COLLIDERS.every((box) => {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    return (x - closestX) ** 2 + (z - closestZ) ** 2 >= PLAYER_RADIUS ** 2;
  });
}

function hasReachableInteractionPoint(id: (typeof MEMORY_IDS)[number]) {
  const placement = MEMORY_PLACEMENTS[id];
  for (
    let x = ROOM_BOUNDS.minX + PLAYER_RADIUS;
    x <= ROOM_BOUNDS.maxX - PLAYER_RADIUS;
    x += REACHABILITY_STEP
  ) {
    for (
      let z = ROOM_BOUNDS.minZ + PLAYER_RADIUS;
      z <= ROOM_BOUNDS.maxZ - PLAYER_RADIUS;
      z += REACHABILITY_STEP
    ) {
      if (!isWalkable(x, z)) continue;
      if (
        Math.hypot(x - placement.position[0], z - placement.position[2]) <=
        placement.interactionRadius
      ) {
        return true;
      }
    }
  }
  return false;
}

describe("memory-room layout", () => {
  it("places every memory exactly once and gives it a camera preset", () => {
    expect(Object.keys(MEMORY_PLACEMENTS).sort()).toEqual([...MEMORY_IDS].sort());
    for (const id of MEMORY_IDS) {
      expect(MEMORY_PLACEMENTS[id].id).toBe(id);
      expect(MEMORY_PLACEMENTS[id].interactionRadius).toBeGreaterThan(0);
      expect(CAMERA_PRESETS[id]).toBeDefined();
    }
  });

  it("defines valid room and obstacle bounds", () => {
    for (const bounds of [ROOM_BOUNDS, ...ROOM_COLLIDERS]) {
      expect(bounds.minX).toBeLessThan(bounds.maxX);
      expect(bounds.minZ).toBeLessThan(bounds.maxZ);
    }
  });

  it("uses the reference camera with the short wall on the left", () => {
    expect(CAMERA_PRESETS.room.position[0]).toBeGreaterThan(0);
    expect(CAMERA_PRESETS.room.position[0]).toBeGreaterThan(13);
    // 시선 중심이 방 상단을 향해야 다이오라마가 화면 위쪽에 붙지 않는다
    expect(CAMERA_PRESETS.room.target[1]).toBeGreaterThan(2);
    expect(CAMERA_PRESETS.room.target).toEqual([0.8, 2.35, 1.2]);
  });

  it("makes the window wall longer than the left side wall", () => {
    const backWallLength = ROOM_SHELL_BOUNDS.maxX - ROOM_SHELL_BOUNDS.minX;
    const sideWallLength = ROOM_SHELL_BOUNDS.maxZ - ROOM_SHELL_BOUNDS.minZ;

    expect(backWallLength).toBeGreaterThan(sideWallLength);
    expect(ROOM_BOUNDS.maxX).toBeLessThan(ROOM_SHELL_BOUNDS.maxX);
    expect(ROOM_BOUNDS.minX).toBeGreaterThan(ROOM_SHELL_BOUNDS.minX);
    expect(ROOM_BOUNDS.maxZ).toBeLessThan(ROOM_SHELL_BOUNDS.maxZ);
    expect(ROOM_SHELL_CENTER).toEqual([1, 1.25]);
  });

  it("places memories on the same room zones as the reference", () => {
    expect(MEMORY_PLACEMENTS.calendar.position[0]).toBeLessThan(-5.4);
    expect(MEMORY_PLACEMENTS.calendar.position[2]).toBeGreaterThan(-3);
    expect(MEMORY_PLACEMENTS.bat.position[0]).toBeLessThan(-5);
    expect(MEMORY_PLACEMENTS.ball.position[0]).toBeLessThan(-4.8);
    expect(MEMORY_PLACEMENTS.frame.position[0]).toBeGreaterThan(0);
    expect(MEMORY_PLACEMENTS.frame.position[2]).toBeLessThan(-2.5);
    expect(MEMORY_PLACEMENTS.bat.scale).toBeGreaterThanOrEqual(1.5);
    expect(MEMORY_PLACEMENTS.frame.rotation[1]).toBeCloseTo(-0.3);
  });

  it("rests the bat barrel-down in the clear strip beside the door", () => {
    const bat = MEMORY_PLACEMENTS.bat;
    const modelLength = 0.864 * bat.scale;
    const barrelY = bat.position[1] + Math.cos(bat.rotation[2]) * modelLength;
    const doorGap = ROOM_DOOR_POSITION[2] - bat.position[2];
    const wallGap = bat.position[0] - ROOM_SHELL_BOUNDS.minX;

    expect(barrelY).toBeGreaterThan(0.05);
    expect(barrelY).toBeLessThan(0.25);
    expect(barrelY).toBeLessThan(bat.position[1]);
    expect(doorGap).toBeGreaterThan(0.82);
    expect(doorGap).toBeLessThan(1.3);
    expect(wallGap).toBeGreaterThan(0.5);
    expect(wallGap).toBeLessThan(0.9);
    expect(
      Math.hypot(
        CAMERA_PRESETS.bat.target[0] - bat.position[0],
        CAMERA_PRESETS.bat.target[2] - bat.position[2],
      ),
    ).toBeLessThan(0.35);
  });

  it("matches the reference diorama shell", () => {
    expect(REFERENCE_ROOM_LAYOUT.openEdge).toBe("front");
    expect(REFERENCE_ROOM_LAYOUT.hasVisibleWallDoor).toBe(true);
    expect(REFERENCE_ROOM_LAYOUT.doorSide).toBe("left");
    expect(REFERENCE_ROOM_LAYOUT.deskSide).toBe("left");
    expect(REFERENCE_ROOM_LAYOUT.bedSide).toBe("right");
    expect(ROOM_DOOR_POSITION[0]).toBeCloseTo(ROOM_SHELL_BOUNDS.minX + 0.14);
    expect(ROOM_DOOR_POSITION[2]).toBeGreaterThan(5);
    expect(ROOM_DOOR_ROTATION[1]).toBeCloseTo(Math.PI / 2);
  });

  it("gives the bed the larger reference footprint", () => {
    const bed = ROOM_COLLIDERS[1];
    expect(bed.maxX - bed.minX).toBeGreaterThanOrEqual(3.2);
    expect(bed.maxZ - bed.minZ).toBeGreaterThanOrEqual(5.4);
  });

  it("rotates the desk along the left wall and tucks in the chair", () => {
    const desk = ROOM_COLLIDERS[0];
    expect(DESK_ROTATION[1]).toBeCloseTo(Math.PI / 2);
    expect(desk.maxZ - desk.minZ).toBeGreaterThan(desk.maxX - desk.minX);
    expect(CHAIR_POSITION[0]).toBeGreaterThan(desk.maxX);
    expect(CHAIR_POSITION[0] - desk.maxX).toBeLessThan(0.7);
    expect(CHAIR_POSITION[2]).toBeGreaterThan(desk.minZ);
    expect(CHAIR_POSITION[2]).toBeLessThan(desk.maxZ);
  });

  it("blocks the player from walking through the chair", () => {
    const chair = ROOM_COLLIDERS.find(
      (box) =>
        CHAIR_POSITION[0] > box.minX &&
        CHAIR_POSITION[0] < box.maxX &&
        CHAIR_POSITION[2] > box.minZ &&
        CHAIR_POSITION[2] < box.maxZ,
    );

    expect(chair).toBeDefined();
    expect(isWalkable(CHAIR_POSITION[0], CHAIR_POSITION[2])).toBe(false);
    // 좌석 발자국(±0.525)을 실제로 덮되 통로를 다 막을 만큼 부풀지 않는다
    expect(chair?.maxX ?? 0).toBeGreaterThan(CHAIR_POSITION[0] + 0.4);
    expect(chair?.minX ?? 0).toBeLessThan(CHAIR_POSITION[0] - 0.4);
    expect(chair?.maxZ ?? 0).toBeGreaterThan(CHAIR_POSITION[2] + 0.4);
    expect(chair?.minZ ?? 0).toBeLessThan(CHAIR_POSITION[2] - 0.4);
  });

  it("keeps every memory reachable without entering furniture", () => {
    expect(MEMORY_IDS.filter((id) => !hasReachableInteractionPoint(id))).toEqual([]);
  });

  /*
   * 액자와 스마트폰은 캐비닛 상판에 얹는 물건이다. 예전 좌표는 스마트폰을 상판 아래로
   * 0.14 밀어 넣으면서 동시에 캐비닛 앞면 바깥으로 띄웠고, 액자는 상판 위 수납상자
   * (x 1.89~2.61) 속에 통째로 파묻었다. 아래 값은 MemoryObjects.tsx의 시각 요소 크기다.
   */
  const CABINET_TOP_MEMORIES = [
    // 액자: 폭 0.52, 받침까지 합친 최저점이 로컬 y = -0.2244
    { id: "frame", halfWidth: 0.26, halfDepth: 0.09, lowestLocalY: -0.2244 },
    // 스마트폰: 폭 0.48, 기울인 뒤 본체 최저점이 로컬 y = -0.034
    { id: "phone", halfWidth: 0.24, halfDepth: 0.13, lowestLocalY: -0.034 },
  ] as const;

  function footprint(entry: (typeof CABINET_TOP_MEMORIES)[number]) {
    const placement = MEMORY_PLACEMENTS[entry.id];
    const yaw = Math.abs(placement.rotation[1]);
    const spreadX = entry.halfWidth * Math.cos(yaw) + entry.halfDepth * Math.sin(yaw);
    const spreadZ = entry.halfWidth * Math.sin(yaw) + entry.halfDepth * Math.cos(yaw);
    return {
      minX: placement.position[0] - spreadX,
      maxX: placement.position[0] + spreadX,
      minZ: placement.position[2] - spreadZ,
      maxZ: placement.position[2] + spreadZ,
      baseY: placement.position[1] + entry.lowestLocalY,
    };
  }

  it("rests the cabinet-top memories on the surface instead of through or in front of it", () => {
    for (const entry of CABINET_TOP_MEMORIES) {
      const box = footprint(entry);

      // 상판 바깥으로 삐져나가면 허공에 뜬다
      expect(box.minX).toBeGreaterThan(CABINET_TOP_BOUNDS.minX);
      expect(box.maxX).toBeLessThan(CABINET_TOP_BOUNDS.maxX);
      expect(box.minZ).toBeGreaterThan(CABINET_TOP_BOUNDS.minZ);
      expect(box.maxZ).toBeLessThan(CABINET_TOP_BOUNDS.maxZ);

      // 밑면은 상판을 아주 살짝만 파고든다 — 딱 맞추면 면이 겹쳐 깜빡이고,
      // 많이 파고들면 물건이 상판을 뚫고 내려간 것처럼 보인다.
      expect(box.baseY).toBeLessThan(CABINET_TOP_Y);
      expect(CABINET_TOP_Y - box.baseY).toBeLessThan(0.05);
    }
  });

  it("keeps the cabinet-top memories from overlapping each other or the props", () => {
    const boxes = CABINET_TOP_MEMORIES.map(footprint);
    const [frame, phone] = boxes;
    expect(frame.maxX < phone.minX || phone.maxX < frame.minX).toBe(true);

    for (const box of boxes) {
      for (const prop of Object.values(CABINET_TOP_PROPS)) {
        const propMinX = prop.x - prop.halfWidth;
        const propMaxX = prop.x + prop.halfWidth;
        expect(box.maxX < propMinX || propMaxX < box.minX).toBe(true);
      }
    }
  });
});
