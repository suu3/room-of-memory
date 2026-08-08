import { describe, expect, it } from "vitest";
import { MEMORY_IDS } from "@/data/memory-room";
import {
  BAT_PLACEMENT,
  CABINET_BODY,
  CABINET_TOP_BOUNDS,
  CABINET_TOP_PROPS,
  CABINET_TOP_Y,
  CAMERA_PRESETS,
  CHAIR_POSITION,
  CHAIR_PULL,
  DESK_ROTATION,
  DOORWAY_ZONE,
  DRAWER_NOTE,
  DRAWER_TRAVEL,
  FRONT_DOOR_POSITION,
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
    expect(MEMORY_PLACEMENTS.console.position[2]).toBeGreaterThan(3);
    expect(MEMORY_PLACEMENTS.ball.position[0]).toBeLessThan(-4.8);
    expect(MEMORY_PLACEMENTS.frame.position[0]).toBeGreaterThan(0);
    expect(MEMORY_PLACEMENTS.frame.position[2]).toBeLessThan(-2.5);
    expect(BAT_PLACEMENT.scale).toBeGreaterThanOrEqual(1.5);
    expect(MEMORY_PLACEMENTS.frame.rotation[1]).toBeCloseTo(-0.3);
  });

  it("rests the bat barrel-down in the clear strip beside the door", () => {
    const bat = BAT_PLACEMENT;
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
    // 엔딩 카메라는 이제 배트가 아니라 거실 끝 현관문을 본다 (v2)
    expect(
      Math.hypot(
        CAMERA_PRESETS.ending.target[0] - FRONT_DOOR_POSITION[0],
        CAMERA_PRESETS.ending.target[2] - FRONT_DOOR_POSITION[2],
      ),
    ).toBeLessThan(0.6);
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
   * 액자는 캐비닛 상판에 얹는 물건이다. 예전 좌표는 액자를 상판 위 수납상자
   * (x 1.89~2.61) 속에 통째로 파묻었다. 아래 값은 MemoryObjects.tsx의 시각 요소 크기다.
   * (스마트폰도 여기 있었지만 침대로 옮겼다 — 아래 매트리스 테스트가 맡는다.)
   */
  const CABINET_TOP_MEMORIES = [
    // 액자: 폭 0.52, 받침까지 합친 최저점이 로컬 y = -0.2244
    { id: "frame", halfWidth: 0.26, halfDepth: 0.09, lowestLocalY: -0.2244 },
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

  it("keeps the cabinet-top memories out of the props already up there", () => {
    for (const box of CABINET_TOP_MEMORIES.map(footprint)) {
      for (const prop of Object.values(CABINET_TOP_PROPS)) {
        const propMinX = prop.x - prop.halfWidth;
        const propMaxX = prop.x + prop.halfWidth;
        expect(box.maxX < propMinX || propMaxX < box.minX).toBe(true);
      }
    }
  });

  /*
   * 스마트폰은 침대에 던져둔 물건이다. 매트리스 판은 RoomFurniture의 BED_PARTS —
   * 중심 [4.65, 0.6, 2.86], 크기 3.02 x 0.42 x 5.05라 윗면이 y=0.81이다.
   */
  const MATTRESS = { minX: 3.14, maxX: 6.16, minZ: 0.335, maxZ: 5.385, topY: 0.81 } as const;
  /** 눕힌 폰이 원점에서 뻗는 최대 거리 — 본체 길이의 절반(0.18)에 중심 오프셋(0.17)을 더한 값. */
  const PHONE_REACH = 0.36;
  /** 눕힌 폰의 두께 절반 (본체 0.16에 scale 0.5). */
  const PHONE_HALF_THICKNESS = 0.04;
  /** PhoneMemory가 시각 요소 안에 갖고 있는 기울기. 배치 회전과 합쳐져야 정확히 눕는다. */
  const PHONE_VISUAL_TILT = -0.18;

  it("lays the phone flat on the mattress", () => {
    const phone = MEMORY_PLACEMENTS.phone;

    expect(phone.position[0] - PHONE_REACH).toBeGreaterThan(MATTRESS.minX);
    expect(phone.position[0] + PHONE_REACH).toBeLessThan(MATTRESS.maxX);
    expect(phone.position[2] - PHONE_REACH).toBeGreaterThan(MATTRESS.minZ);
    expect(phone.position[2] + PHONE_REACH).toBeLessThan(MATTRESS.maxZ);

    // 매트리스 위에 놓이되 눈에 띄게 뜨지는 않는다
    const baseY = phone.position[1] - PHONE_HALF_THICKNESS;
    expect(baseY).toBeGreaterThanOrEqual(MATTRESS.topY);
    expect(baseY - MATTRESS.topY).toBeLessThan(0.05);

    // 화면이 천장을 본다 — 세워 든 자세로 침대에 서 있으면 안 된다
    expect(phone.rotation[0] + PHONE_VISUAL_TILT).toBeCloseTo(-Math.PI / 2, 5);
    // 손에 쥐는 물건이다. 게임기(가로 0.46)보다 커 보이면 폰으로 안 읽힌다
    expect(phone.scale * 0.48).toBeLessThan(0.46);
  });
});

/**
 * 서랍과 의자는 움직이지만 ROOM_COLLIDERS는 고정이다. 움직인 자리가 콜라이더에서
 * 너무 멀어지면 플레이어가 가구를 뚫고 지나가는 것처럼 보인다 — 그 어긋남이
 * 눈에 띄지 않는 범위인지를 여기서 지킨다.
 */
describe("pulled furniture", () => {
  const CHAIR_SEAT_HALF = 0.525;

  it("keeps a fully open cabinet drawer inside the room", () => {
    // 캐비닛 몸통 앞면 + 나온 거리. 뒷벽 쪽 가구라 방 안으로만 나온다.
    const front = CABINET_BODY.position[2] + CABINET_BODY.size[2] / 2 + DRAWER_TRAVEL.cabinet;
    expect(front).toBeLessThan(ROOM_BOUNDS.maxZ);

    // 콜라이더가 잡아 둔 여유 안에서 멈춰야 서랍이 플레이어를 뚫고 나오지 않는다
    const cabinet = ROOM_COLLIDERS.find((box) => box.minX === 0.15);
    expect(cabinet).toBeDefined();
    expect(front).toBeLessThanOrEqual((cabinet?.maxZ ?? 0) + PLAYER_RADIUS);
  });

  it("keeps the nightstand drawer inside the room", () => {
    const nightstand = ROOM_COLLIDERS.find((box) => box.minX === 6.3);
    expect(nightstand).toBeDefined();
    const front = 1.16 + DRAWER_TRAVEL.nightstand;
    expect(front).toBeLessThan(ROOM_BOUNDS.maxZ);
    expect(front).toBeLessThanOrEqual((nightstand?.maxZ ?? 0) + PLAYER_RADIUS);
  });

  it("keeps the pulled-out chair covered by its fixed collider", () => {
    const chair = ROOM_COLLIDERS.find(
      (box) => CHAIR_POSITION[0] > box.minX && CHAIR_POSITION[0] < box.maxX,
    );
    expect(chair).toBeDefined();

    // 물러난 좌석의 바깥 끝. 플레이어 중심은 콜라이더에서 반지름만큼 떨어져 서므로,
    // 좌석 끝이 그 선을 넘지 않으면 의자를 통과하는 장면이 나오지 않는다.
    const seatEdge = CHAIR_POSITION[0] + CHAIR_PULL.distance + CHAIR_SEAT_HALF;
    expect(seatEdge).toBeLessThanOrEqual((chair?.maxX ?? 0) + PLAYER_RADIUS);

    // 책상 쪽으로는 자리가 남아야 물러나는 게 보인다
    expect(CHAIR_PULL.distance).toBeGreaterThan(0.2);
    expect(CHAIR_PULL.turn).toBeGreaterThan(0);
  });
});

/**
 * 비밀번호 단서를 든 배경 오브젝트. 기억이 아니라 소품이라 표식이 없으므로,
 * "만져지는 자리에 있는가"를 좌표로만 지켜야 한다.
 */
describe("clue props", () => {
  it("hides the drawer note until the drawer opens", () => {
    const body = { topY: 0.955, frontZ: 1.16 };
    const [, noteY, noteZ] = DRAWER_NOTE.position;
    const [width, thickness, depth] = DRAWER_NOTE.size;
    const turn = DRAWER_NOTE.rotation[1];
    // 돌아간 종이는 z로 두꺼워진다 — 축에 나란한 반깊이로 재면 여유를 잘못 센다
    const halfDepth =
      (depth / 2) * Math.abs(Math.cos(turn)) + (width / 2) * Math.abs(Math.sin(turn));
    const drawerFaceTopY = 0.72 + 0.28 / 2;

    // 닫혀 있으면 협탁 몸통 안에 완전히 잠긴다
    expect(noteY + thickness / 2).toBeLessThan(body.topY);
    expect(noteZ + halfDepth).toBeLessThan(body.frontZ);

    // 열리면 몸통 밖으로 나오고, 서랍판 윗변보다 높아 위에서 내려다보인다
    expect(noteZ + DRAWER_TRAVEL.nightstand - halfDepth).toBeGreaterThan(body.frontZ);
    expect(noteY).toBeGreaterThan(drawerFaceTopY);
  });
});

/**
 * 거실 (v2). 가구 발자국이 두 통로를 막으면 게임이 물리적으로 막힌다 —
 * 문간에서 나오는 길과, 엔딩으로 가는 현관문 앞.
 */
describe("living room layout", () => {
  const PLAYER_DIAMETER = 0.76;

  it("keeps every collider inside the living room shell", () => {
    for (const box of LIVING_COLLIDERS) {
      expect(box.minX).toBeGreaterThanOrEqual(LIVING_SHELL_BOUNDS.minX);
      expect(box.maxX).toBeLessThanOrEqual(LIVING_SHELL_BOUNDS.maxX);
      expect(box.minZ).toBeGreaterThanOrEqual(LIVING_SHELL_BOUNDS.minZ);
      expect(box.maxZ).toBeLessThanOrEqual(LIVING_SHELL_BOUNDS.maxZ);
    }
  });

  it("leaves the doorway exit clear", () => {
    // 문간 영역과 겹치는 가구가 있으면 문을 열고 나오자마자 낀다
    for (const box of LIVING_COLLIDERS) {
      const overlapsX = box.maxX > DOORWAY_ZONE.minX && box.minX < DOORWAY_ZONE.maxX;
      const overlapsZ = box.maxZ > DOORWAY_ZONE.minZ && box.minZ < DOORWAY_ZONE.maxZ;
      expect(overlapsX && overlapsZ).toBe(false);
    }
  });

  it("leaves room to stand in front of the front door", () => {
    /*
     * 현관문 상호작용 반경 안에, 가구에 안 닿고 설 수 있는 자리가 있어야 한다.
     * 문 바로 앞(x로 지름만큼 떨어진 지점)이 그 자리다 — 여기가 어떤 가구
     * 발자국과도 겹치지 않는지 본다.
     */
    const standX = FRONT_DOOR_POSITION[0] + PLAYER_DIAMETER;
    const standZ = FRONT_DOOR_POSITION[2];
    expect(
      Math.hypot(standX - FRONT_DOOR_INTERACTION.near[0], standZ - FRONT_DOOR_INTERACTION.near[1]),
    ).toBeLessThan(FRONT_DOOR_INTERACTION.interactionRadius);
    for (const box of LIVING_COLLIDERS) {
      const inX = standX > box.minX - 0.38 && standX < box.maxX + 0.38;
      const inZ = standZ > box.minZ - 0.38 && standZ < box.maxZ + 0.38;
      expect(inX && inZ).toBe(false);
    }
  });

  it("keeps the front door on the far wall, inside the walkable range", () => {
    expect(FRONT_DOOR_POSITION[0]).toBeLessThan(LIVING_BOUNDS.minX);
    expect(FRONT_DOOR_POSITION[2]).toBeGreaterThan(LIVING_BOUNDS.minZ);
    expect(FRONT_DOOR_POSITION[2]).toBeLessThan(LIVING_BOUNDS.maxZ);
  });
});
