import { describe, expect, it } from "vitest";
import { MEMORY_IDS } from "@/data/memory-room";
import { SEATS } from "../player/seats";
import { MIRROR_NEAR_RADIUS, SINK_NEAR, SINK_RADIUS } from "../rooms/bathroom/BathroomFixtures";
import { CURTAIN_NEAR_RADIUS, CURTAIN_X } from "../rooms/room/curtain-motion";
import { BED_BLANKET_FOLDED_Z, BED_BLANKET_TOP_Y, BED_FOOTPRINT, BED_MATTRESS } from "./bed";
import {
  BAT_PLACEMENT,
  BATHROOM_COLLIDERS,
  BATHROOM_DOOR_POSITION,
  BATHROOM_DOORWAY_ZONE,
  BATHROOM_SHELL_BOUNDS,
  CABINET_BODY,
  CABINET_TOP_BOUNDS,
  CABINET_TOP_PROPS,
  CABINET_TOP_Y,
  CAMERA_PRESETS,
  CHAIR_POSITION,
  CHAIR_PULL,
  CHAIR_SEAT,
  CLUE_PROPS,
  CURTAIN_STAND,
  DESK_ROTATION,
  DOORWAY_ZONE,
  DRAWER_NOTE,
  DRAWER_TRAVEL,
  FRONT_DOOR_INTERACTION,
  FRONT_DOOR_INWARD,
  FRONT_DOOR_POSITION,
  hitRadiusOf,
  LIVING_BOUNDS,
  LIVING_COLLIDERS,
  LIVING_ENTRY_BOUNDS,
  LIVING_ENTRY_SHELL,
  LIVING_KITCHEN,
  LIVING_SHELL_BOUNDS,
  MEMORY_PLACEMENTS,
  MEMORY_SPACE,
  OPEN_DOOR_LEAF_COLLIDERS,
  PARENTS_BOUNDS,
  PARENTS_COLLIDERS,
  REFERENCE_ROOM_LAYOUT,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
  ROOM_DOOR_LEAF,
  ROOM_DOOR_POSITION,
  ROOM_DOOR_ROTATION,
  ROOM_SHELL_BOUNDS,
  ROOM_SHELL_CENTER,
} from "./layout";
import { SPACES } from "./spaces";
import { isWalkable as standsClear } from "./spatial";
import type { Aabb2 } from "./types";

const PLAYER_RADIUS = 0.38;
const REACHABILITY_STEP = 0.05;

function clearOf(colliders: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[]) {
  return (x: number, z: number) =>
    colliders.every((box) => {
      const closestX = Math.max(box.minX, Math.min(x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      return (x - closestX) ** 2 + (z - closestZ) ** 2 >= PLAYER_RADIUS ** 2;
    });
}

const isWalkable = clearOf(ROOM_COLLIDERS);
const isWalkableInLiving = clearOf(LIVING_COLLIDERS);
const isWalkableInParents = clearOf(PARENTS_COLLIDERS);

/**
 * 기억 앞에 설 수 있는 자리가 한 칸이라도 있는가.
 *
 * 공간마다 걷는 범위와 가구가 다르므로 어느 방의 물건인지부터 본다.
 * 거실 물건을 방의 격자로 훑으면 닿는 자리가 하나도 없다 (좌표가 벽 너머다).
 */
function hasReachableInteractionPoint(id: (typeof MEMORY_IDS)[number]) {
  const placement = MEMORY_PLACEMENTS[id];
  const space = MEMORY_SPACE[id];
  // 거실은 현관 홈(LIVING_ENTRY_BOUNDS)까지 걷는다
  const areas =
    space === "living"
      ? [LIVING_BOUNDS, LIVING_ENTRY_BOUNDS]
      : space === "parents"
        ? [PARENTS_BOUNDS]
        : [ROOM_BOUNDS];
  const walkable =
    space === "living"
      ? isWalkableInLiving
      : space === "parents"
        ? isWalkableInParents
        : isWalkable;
  for (const bounds of areas) {
    for (
      let x = bounds.minX + PLAYER_RADIUS;
      x <= bounds.maxX - PLAYER_RADIUS;
      x += REACHABILITY_STEP
    ) {
      for (
        let z = bounds.minZ + PLAYER_RADIUS;
        z <= bounds.maxZ - PLAYER_RADIUS;
        z += REACHABILITY_STEP
      ) {
        if (!walkable(x, z)) continue;
        if (
          Math.hypot(x - placement.position[0], z - placement.position[2]) <=
          placement.interactionRadius
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

describe("memory-room layout", () => {
  it("keeps memory click spheres off the seats they sit on", () => {
    /*
     * 침대 위의 폰: 다가서는 반경(1.6)은 콜라이더 밖에서 닿도록 넓지만, 클릭 구가 그만큼
     * 크면 매트리스를 덮어 침대를 눌러도 폰이 눌린다. 클릭 구는 눕는 자리·걸터앉는
     * 자리·다가서는 자리 어디에도 닿지 않아야 침대가 침대로 눌린다.
     */
    for (const seat of Object.values(SEATS)) {
      const spots = [seat.anchor, seat.near, ...(seat.approaches ?? []), seat.perch].filter(
        (spot): spot is { x: number; z: number } => spot !== undefined,
      );
      for (const id of MEMORY_IDS) {
        const placement = MEMORY_PLACEMENTS[id];
        const radius = hitRadiusOf(placement);
        for (const spot of spots) {
          const distance = Math.hypot(
            spot.x - placement.position[0],
            spot.z - placement.position[2],
          );
          expect(distance, `${id} hit sphere covers seat ${seat.id}`).toBeGreaterThan(radius);
        }
      }
    }
  });

  it("keeps the report card clear of the workbook pile and the radio", () => {
    /*
     * 성적표가 문제집 더미 바로 앞(0.5)에 있어 화면에서 종이 뭉치와 포갰다. 클릭 상자만
     * 줄였더니 눌리는 건 갈렸지만 그림은 그대로 겹쳤다. 라디오 뒤로 옮겼다: 성적표의 바닥
     * 반경과 더미의 종이 뭉치(기준점에서 0.65 안팎) 사이가 벌어져야 하고, 라디오도 피해야 한다.
     */
    const card = MEMORY_PLACEMENTS["report-card"];
    expect(card.hitBox).toBeDefined();
    expect(card.hitBox?.[1] ?? 1).toBeLessThan(0.1);
    const reach = hitRadiusOf(card);
    const [wx, wz] = CLUE_PROPS.workbook.near;
    const workbookGap = Math.hypot(wx - card.position[0], wz - card.position[2]);
    expect(workbookGap).toBeGreaterThan(reach + 0.65);
    const radio = MEMORY_PLACEMENTS.radio;
    const radioGap = Math.hypot(
      radio.position[0] - card.position[0],
      radio.position[2] - card.position[2],
    );
    expect(radioGap).toBeGreaterThan(reach + 0.2);
  });

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

  it("rests the bat barrel-down beside the front door", () => {
    // 배트는 3막의 물건이라 현관 옆에 선다 (docs/content-design.md 3-2)
    const bat = BAT_PLACEMENT;
    const modelLength = 0.864 * bat.scale;
    const barrelY = bat.position[1] + Math.cos(bat.rotation[2]) * modelLength;
    // 문이 난 벽을 따라 잰 문과의 거리, 그 벽에서 떨어진 거리 (현관문은 뒷벽 -z에 있다)
    const doorGap = Math.abs(bat.position[0] - FRONT_DOOR_POSITION[0]);
    const wallGap = bat.position[2] - LIVING_ENTRY_SHELL.minZ;

    expect(barrelY).toBeGreaterThan(0.05);
    expect(barrelY).toBeLessThan(0.25);
    expect(barrelY).toBeLessThan(bat.position[1]);
    // 문 옆이되 문짝이 열리는 자리는 비운다
    expect(doorGap).toBeGreaterThan(0.82);
    expect(doorGap).toBeLessThan(1.5);
    expect(wallGap).toBeGreaterThan(0.3);
    expect(wallGap).toBeLessThan(0.9);
    // 배트를 쥐고 여는 것은 현관문이다. 엔딩 카메라도 그 문을 본다
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

  it("gives the bed the larger reference footprint, wrapped in its collider", () => {
    const bed = ROOM_COLLIDERS[1];
    // 콜라이더는 glb 발자국을 감싸되 그 둘레로 손가락 한 마디 이상 벌어지지 않는다
    expect(bed.minX).toBeLessThan(BED_FOOTPRINT.minX);
    expect(bed.maxX).toBeGreaterThan(BED_FOOTPRINT.maxX);
    expect(bed.minZ).toBeLessThan(BED_FOOTPRINT.minZ);
    expect(bed.maxZ).toBeGreaterThan(BED_FOOTPRINT.maxZ);
    expect(BED_FOOTPRINT.minX - bed.minX).toBeLessThan(0.2);
    expect(bed.maxZ - BED_FOOTPRINT.maxZ).toBeLessThan(0.2);
    // 긴 축이 z: 머리판이 창가 쪽이다
    expect(bed.maxZ - bed.minZ).toBeGreaterThan(bed.maxX - bed.minX);
    // 방에서 가장 큰 가구다
    const area = (box: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
      (box.maxX - box.minX) * (box.maxZ - box.minZ);
    for (const other of ROOM_COLLIDERS) {
      if (other !== bed) expect(area(bed)).toBeGreaterThan(area(other));
    }
  });

  /*
   * 열린 문짝은 방 안쪽으로 젖혀져 문간 앞에 선다. 콜라이더가 그 판을 감싸되, 문 한가운데를
   * 향해 걷는 몸이 지나갈 통로는 남아야 한다. 판을 앞벽에 거의 붙게(83°) 여는 이유다.
   */
  it("blocks the open door leaf without sealing the doorway", () => {
    expect(ROOM_DOOR_ROTATION[1]).toBeCloseTo(Math.PI / 2, 5);
    const { width, hingeOffset, openAngle } = ROOM_DOOR_LEAF;
    const hinge = { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] + hingeOffset };
    const tip = {
      x: hinge.x + Math.sin(openAngle) * width,
      z: hinge.z - Math.cos(openAngle) * width,
    };
    // 판은 방 안쪽(+x)에, 앞벽(maxZ) 안에 선다
    expect(tip.x).toBeGreaterThan(ROOM_SHELL_BOUNDS.minX + 1);
    expect(tip.z).toBeLessThan(ROOM_SHELL_BOUNDS.maxZ);
    // 상자들이 경첩부터 판 끝까지 잇는다
    const minX = Math.min(...OPEN_DOOR_LEAF_COLLIDERS.map((box) => box.minX));
    const maxX = Math.max(...OPEN_DOOR_LEAF_COLLIDERS.map((box) => box.maxX));
    expect(minX).toBeLessThan(hinge.x);
    expect(maxX).toBeGreaterThan(tip.x);
    const zones = [ROOM_BOUNDS, DOORWAY_ZONE, LIVING_BOUNDS] as const;
    const blocked = [...ROOM_COLLIDERS, ...OPEN_DOOR_LEAF_COLLIDERS] as const;
    // 판 한가운데에는 설 수 없다
    const middle = { x: (hinge.x + tip.x) / 2, z: (hinge.z + tip.z) / 2 };
    expect(standsClear(middle.x, middle.z, PLAYER_RADIUS, zones, blocked)).toBe(false);
    // 문 한가운데(z 5.35)를 지나는 길은 문턱 양쪽에서 열려 있다
    for (const x of [
      ROOM_SHELL_BOUNDS.minX - 0.6,
      ROOM_SHELL_BOUNDS.minX,
      ROOM_SHELL_BOUNDS.minX + 0.6,
    ]) {
      expect(standsClear(x, ROOM_DOOR_POSITION[2], PLAYER_RADIUS, zones, blocked), `x=${x}`).toBe(
        true,
      );
    }
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
    // 좌석 발자국(±CHAIR_SEAT.half)을 거의 다 덮되 통로를 막을 만큼 부풀지 않는다
    const cover = CHAIR_SEAT.half - 0.06;
    expect(chair?.maxX ?? 0).toBeGreaterThan(CHAIR_POSITION[0] + cover);
    expect(chair?.minX ?? 0).toBeLessThan(CHAIR_POSITION[0] - cover);
    expect(chair?.maxZ ?? 0).toBeGreaterThan(CHAIR_POSITION[2] + cover);
    expect(chair?.minZ ?? 0).toBeLessThan(CHAIR_POSITION[2] - cover);
    expect(chair?.maxX ?? 0).toBeLessThan(CHAIR_POSITION[0] + CHAIR_SEAT.half);
  });

  it("keeps every memory reachable without entering furniture", () => {
    expect(MEMORY_IDS.filter((id) => !hasReachableInteractionPoint(id))).toEqual([]);
  });

  /*
   * 커튼을 잡으면 몸이 여기로 걸어가 벽을 보고 선다. 설 수 없는 자리면 캐비닛 속에 서고,
   * 커튼의 근접 반경 밖이면 한 쪽을 젖히고 선 자리에서 다른 쪽을 잡지 못한다.
   */
  it("gives the curtains a standing spot in front of the cabinet", () => {
    expect(isWalkable(CURTAIN_STAND.x, CURTAIN_STAND.z)).toBe(true);
    expect(CURTAIN_STAND.x).toBeCloseTo(MEMORY_PLACEMENTS.window.position[0], 5);
    expect(CURTAIN_STAND.facing).toBeCloseTo(Math.PI, 5);
    for (const side of ["left", "right"] as const) {
      const distance = Math.hypot(
        CURTAIN_X[side].closed - CURTAIN_STAND.x,
        -3.72 - CURTAIN_STAND.z,
      );
      expect(distance, side).toBeLessThan(CURTAIN_NEAR_RADIUS);
    }
  });

  /*
   * 액자는 캐비닛 상판에 얹는 물건이다. 예전 좌표는 액자를 상판 위 수납상자
   * (x 1.89~2.61) 속에 통째로 파묻었다. 아래 값은 MemoryObjects.tsx의 시각 요소 크기다.
   * (스마트폰도 여기 있었지만 침대로 옮겼다. 아래 매트리스 테스트가 맡는다.)
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

      // 밑면은 상판을 아주 살짝만 파고든다. 딱 맞추면 면이 겹쳐 깜빡이고,
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
   * 스마트폰은 침대에 던져둔 물건이다. 매트리스는 bed.ts(침대 glb 실측 × 배치)의 것:
   * 위에 펼쳐진 이불(BED_BLANKET_TOP_Y)에 얹힌다.
   */
  const MATTRESS = BED_MATTRESS;
  /** 눕힌 폰이 원점에서 뻗는 최대 거리: 본체 길이의 절반(0.18)에 중심 오프셋(0.17)을 더한 값. */
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

    // 펼친 이불 위에 놓이되 눈에 띄게 뜨지는 않는다. 이불이 접혀 나가도 폰 두께 안이다
    const baseY = phone.position[1] - PHONE_HALF_THICKNESS;
    expect(baseY).toBeGreaterThanOrEqual(BED_BLANKET_TOP_Y - 0.005);
    expect(baseY - MATTRESS.topY).toBeLessThan(0.05);
    // 접힌 이불 뭉치 밖: 원점이 뭉치가 끝난 평평한 자락 위에 있다 (본체는 원점에서 0.35까지라 매트리스 끝 안)
    const onFoldedFlatTail = phone.position[2] > BED_BLANKET_FOLDED_Z.max;
    const beforeFold = phone.position[2] + PHONE_REACH < BED_BLANKET_FOLDED_Z.min;
    expect(onFoldedFlatTail || beforeFold).toBe(true);

    // 화면이 천장을 본다. 세워 든 자세로 침대에 서 있으면 안 된다
    expect(phone.rotation[0] + PHONE_VISUAL_TILT).toBeCloseTo(-Math.PI / 2, 5);
    // 손에 쥐는 물건이다. 게임기(가로 0.46)보다 커 보이면 폰으로 안 읽힌다
    expect(phone.scale * 0.48).toBeLessThan(0.46);
  });
});

/**
 * 서랍과 의자는 움직이지만 ROOM_COLLIDERS는 고정이다. 움직인 자리가 콜라이더에서
 * 너무 멀어지면 플레이어가 가구를 뚫고 지나가는 것처럼 보인다. 그 어긋남이
 * 눈에 띄지 않는 범위인지를 여기서 지킨다.
 */
describe("pulled furniture", () => {
  const CHAIR_SEAT_HALF = CHAIR_SEAT.half;

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
    // 돌아간 종이는 z로 두꺼워진다. 축에 나란한 반깊이로 재면 여유를 잘못 센다
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
 * 거실 (v2). 가구 발자국이 두 통로를 막으면 게임이 물리적으로 막힌다.
 * 문간에서 나오는 길과, 엔딩으로 가는 현관문 앞.
 */
describe("living room layout", () => {
  const PLAYER_DIAMETER = 0.76;

  it("keeps every collider inside the living room shell", () => {
    // 현관 홈까지가 거실이다. 신발장은 홈 안에서 거실 쪽으로 걸쳐 선다
    const inside = (box: Aabb2, shell: Aabb2) =>
      box.minX >= shell.minX &&
      box.maxX <= shell.maxX &&
      box.minZ >= shell.minZ &&
      box.maxZ <= shell.maxZ;
    const envelope = {
      ...LIVING_SHELL_BOUNDS,
      minZ: LIVING_ENTRY_SHELL.minZ,
    };
    for (const box of LIVING_COLLIDERS) {
      expect(inside(box, envelope)).toBe(true);
      // 홈 밖의 뒷벽 너머(z < 거실 뒷벽)로는 홈 폭 안에서만 나간다
      if (box.minZ < LIVING_SHELL_BOUNDS.minZ) {
        expect(box.minX).toBeGreaterThanOrEqual(LIVING_ENTRY_SHELL.minX);
        expect(box.maxX).toBeLessThanOrEqual(LIVING_ENTRY_SHELL.maxX);
      }
    }
  });

  it("opens the entry nook into the living room wide enough to walk through", () => {
    // 홈의 걷기 범위가 거실 걷기 범위와 플레이어 지름 이상 겹쳐야 입구에서 안 낀다
    expect(LIVING_ENTRY_BOUNDS.maxZ - LIVING_BOUNDS.minZ).toBeGreaterThan(PLAYER_DIAMETER);
    expect(LIVING_ENTRY_BOUNDS.maxX - LIVING_ENTRY_BOUNDS.minX).toBeGreaterThan(PLAYER_DIAMETER);
    // 신발장은 홈 벽 길이에 맞춰 입구 밖(거실)으로 나오지 않는다
    const cabinet = LIVING_COLLIDERS.find(
      (box) => box.minX === LIVING_ENTRY_SHELL.minX && box.minZ < LIVING_SHELL_BOUNDS.minZ,
    );
    expect(cabinet).toBeDefined();
    expect(cabinet?.maxZ).toBeLessThanOrEqual(LIVING_ENTRY_SHELL.maxZ);
    // 현관문은 홈 뒷벽에 난다
    expect(FRONT_DOOR_POSITION[2]).toBeLessThan(LIVING_ENTRY_BOUNDS.minZ);
    expect(FRONT_DOOR_POSITION[0] - 0.91).toBeGreaterThan(LIVING_ENTRY_SHELL.minX);
    expect(FRONT_DOOR_POSITION[0] + 0.91).toBeLessThan(LIVING_ENTRY_SHELL.maxX);
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
     * 문 바로 앞(x로 지름만큼 떨어진 지점)이 그 자리다. 여기가 어떤 가구
     * 발자국과도 겹치지 않는지 본다.
     */
    const standX = FRONT_DOOR_POSITION[0] + FRONT_DOOR_INWARD[0] * PLAYER_DIAMETER;
    const standZ = FRONT_DOOR_POSITION[2] + FRONT_DOOR_INWARD[1] * PLAYER_DIAMETER;
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
    // 뒷벽(-z) 위, 거실 안쪽을 본다. 문틀(±0.91)이 양옆 벽 모서리를 물지 않는다
    expect(FRONT_DOOR_POSITION[2]).toBeLessThan(LIVING_BOUNDS.minZ);
    expect(FRONT_DOOR_INWARD).toEqual([0, 1]);
    expect(FRONT_DOOR_POSITION[0] - 0.91).toBeGreaterThan(LIVING_BOUNDS.minX);
    expect(FRONT_DOOR_POSITION[0] + 0.91).toBeLessThan(LIVING_BOUNDS.maxX);
  });

  it("keeps the kitchen and the front door apart", () => {
    // 현관문이 부엌 한가운데로 열리지 않는다: 문틀과 부엌 발자국 사이에 사람이 지난다
    const frame = { min: FRONT_DOOR_POSITION[0] - 0.91, max: FRONT_DOOR_POSITION[0] + 0.91 };
    for (const box of [LIVING_KITCHEN.run, LIVING_KITCHEN.peninsula]) {
      const gap = Math.max(box.minX - frame.max, frame.min - box.maxX);
      expect(gap).toBeGreaterThan(PLAYER_DIAMETER);
    }
  });
});

describe("bathroom layout", () => {
  it("세면대는 카메라를 마주 보는 왼쪽(-x) 벽에 붙는다", () => {
    // 카메라는 늘 +x·+z 사분면에 있다 (CAMERA_PRESETS). 안쪽 벽(+z)에 붙이면 하부장
    // 문·다이얼·거울이 전부 등을 보여서 회전 범위 어디에서도 안 보인다
    const [toilet, sink] = BATHROOM_COLLIDERS;
    expect(sink.minX).toBe(BATHROOM_SHELL_BOUNDS.minX);
    expect(sink.maxZ).toBeLessThan(BATHROOM_SHELL_BOUNDS.maxZ);
    // 문간과 변기 사이에 선다: 문 앞은 비우고, 변기와도 겹치지 않는다
    expect(sink.maxX).toBeLessThan(BATHROOM_DOORWAY_ZONE.minX);
    expect(sink.maxZ).toBeLessThan(toilet.minZ);
  });

  it("문간에 막 들어선 자리에서는 거울이 아직 어긋나지 않는다", () => {
    const { landing } = SPACES.bathroom;
    const distance = Math.hypot(landing.x - SINK_NEAR[0], landing.z - SINK_NEAR[1]);
    expect(distance).toBeGreaterThan(MIRROR_NEAR_RADIUS);
    // 글로우는 거기서도 켜진다: 하부장이 "여기 뭔가 있다"고 부르는 건 그대로다
    expect(distance).toBeLessThan(SINK_RADIUS);
  });

  it("열린 문짝이 카메라와 세면대 사이에 서지 않는다", () => {
    // 문짝은 -x 기둥 경첩에서 화장실 쪽(+z)으로 젖혀진다 (SpaceDoor). 카메라는 +x·+z에서
    // 보므로, 문짝 끝이 세면대의 +x 쪽이면서 z가 더 크면 세면대를 가린다
    const [, sink] = BATHROOM_COLLIDERS;
    const hingeX = BATHROOM_DOOR_POSITION[0] - ROOM_DOOR_LEAF.hingeOffset;
    const tipX = hingeX + ROOM_DOOR_LEAF.width * Math.cos(ROOM_DOOR_LEAF.openAngle);
    const tipZ =
      BATHROOM_DOOR_POSITION[2] + ROOM_DOOR_LEAF.width * Math.sin(ROOM_DOOR_LEAF.openAngle);
    expect(tipX).toBeGreaterThan(sink.maxX);
    expect(tipZ).toBeLessThan((sink.minZ + sink.maxZ) / 2);
  });
});
