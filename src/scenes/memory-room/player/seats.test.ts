import { describe, expect, it } from "vitest";
import type { SeatId } from "@/types/seat";
import { DINING_SET } from "../rooms/living/LivingRoomFurniture";
import { BED_HEADBOARD_FRONT_Z, BED_MATTRESS, BED_PILLOW } from "../world/bed";
import {
  DOORWAY_ZONE,
  LIVING_BOUNDS,
  LIVING_COLLIDERS,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
  ROOM_SHELL_BOUNDS,
} from "../world/layout";
import { isWalkable } from "../world/spatial";
import {
  LIE_BACK_Z,
  LIE_HEAD,
  LIE_TILT,
  SIT_CONTACT_Y,
  SIT_CONTACT_Z,
  SIT_LEG_Z,
  SIT_TORSO_HALF_WIDTH,
} from "./player-rig";
import { SEAT_HALF_DEPTH, SEAT_IDS, SEATS, SIT_SEAT_IDS } from "./seats";

/** Player.tsx의 값: 여기서 다시 부르지 않고 같은 수치를 쓴다. */
const PLAYER_RADIUS = 0.38;
const ZONES = [ROOM_BOUNDS, DOORWAY_ZONE, LIVING_BOUNDS] as const;
const COLLIDERS = [...ROOM_COLLIDERS, ...LIVING_COLLIDERS] as const;

/** 좌면 기준 앞뒤 좌표계로 옮긴다. 앞(+)이 몸이 바라보는 쪽이다. */
function alongFacing(id: Exclude<SeatId, "bed">): { anchor: number; halfDepth: number } {
  const seat = SEATS[id];
  const center = seat.pull
    ? { x: seat.near.x + seat.pull.x, z: seat.near.z + seat.pull.z }
    : seat.near;
  const forward = { x: Math.sin(seat.facing), z: Math.cos(seat.facing) };
  const anchor = (seat.anchor.x - center.x) * forward.x + (seat.anchor.z - center.z) * forward.z;
  return { anchor, halfDepth: SEAT_HALF_DEPTH[id] };
}

describe("seats", () => {
  it("keeps every seat id in the registry with a body above the floor", () => {
    expect(SEAT_IDS.length).toBe(9);
    expect(SIT_SEAT_IDS.length).toBe(8);
    for (const id of SEAT_IDS) expect(SEATS[id].id, id).toBe(id);
    for (const id of SIT_SEAT_IDS) {
      const seat = SEATS[id];
      // 좌면이 몸의 접촉 높이보다 낮으면 바닥을 뚫고 앉는다.
      expect(seat.bodyY, id).toBeGreaterThan(0);
      expect(seat.bodyY + SIT_CONTACT_Y, id).toBeLessThan(1);
    }
  });

  /*
   * 이 방의 가구는 캐릭터보다 크다. 앉으면 발이 바닥에 안 닿고 무릎 아래가 늘어진다.
   * 그래서 몸은 좌면 앞턱에 걸쳐 앉는다: 뒤로 물리면 정강이가 좌면 판을 관통하고,
   * 앞으로 빼면 엉덩이가 허공에 뜬다. 두 경계를 여기서 지킨다.
   */
  it("hangs the lower legs past the seat edge while the hips stay on the seat", () => {
    for (const id of SIT_SEAT_IDS) {
      if (id === "bed") continue;
      const { anchor, halfDepth } = alongFacing(id);
      // 정강이·발은 전부 앞턱 밖 (좌면은 -halfDepth ~ +halfDepth).
      expect(anchor + SIT_LEG_Z.back, id).toBeGreaterThan(halfDepth);
      // 엉덩이 뒤는 좌면 위에 남는다.
      expect(anchor + SIT_CONTACT_Z.back, id).toBeLessThan(halfDepth);
      expect(anchor + SIT_CONTACT_Z.back, id).toBeGreaterThan(-halfDepth);
      // 좌면에 실제로 얹히는 길이: 이보다 얕으면 앉은 게 아니라 걸친 것으로 보인다.
      const contact = halfDepth - (anchor + SIT_CONTACT_Z.back);
      expect(contact, id).toBeGreaterThan(0.15);
    }
  });

  it("puts every seat within reach of a spot the player can stand on", () => {
    for (const id of SEAT_IDS) {
      const seat = SEATS[id];
      // 좌석 둘레를 훑어 설 수 있는 자리를 찾는다. 하나도 없으면 닿을 수 없는 의자다.
      const reachable = Array.from({ length: 72 }, (_, step) => (step / 72) * Math.PI * 2).some(
        (angle) => {
          for (let radius = 0.5; radius <= seat.reach; radius += 0.1) {
            const x = seat.near.x + Math.cos(angle) * radius;
            const z = seat.near.z + Math.sin(angle) * radius;
            if (isWalkable(x, z, PLAYER_RADIUS, ZONES, COLLIDERS)) return true;
          }
          return false;
        },
      );
      expect(reachable, id).toBe(true);
    }
  });

  /*
   * 침대는 눕는 자리다. 옆에 서는 자리(approach)는 걸을 수 있어야 하고, 눕는 자리(anchor)는
   * 침대 발자국 안이어야 하며, 눕힌 머리는 베개 위에 와야 한다. 수치는 bed.ts(침대 glb
   * 실측 × 배치)에서 온다. BedModel이 그리는 것과 같은 수다.
   */
  it("lies on the bed with the head on the pillow, entered from a standing spot beside it", () => {
    const bed = SEATS.bed;
    const bedFootprint = ROOM_COLLIDERS[1];
    expect(bed.pose).toBe("lie");
    expect(bed.approaches).toHaveLength(1);
    const approach = bed.approaches?.[0] ?? bed.anchor;
    expect(isWalkable(approach.x, approach.z, PLAYER_RADIUS, ZONES, COLLIDERS)).toBe(true);
    expect(bed.anchor.x).toBeGreaterThan(bedFootprint.minX);
    expect(bed.anchor.x).toBeLessThan(bedFootprint.maxX);
    expect(bed.anchor.z).toBeGreaterThan(bedFootprint.minZ);
    expect(bed.anchor.z).toBeLessThan(bedFootprint.maxZ);
    // 발 원점을 축으로 (π/2 - LIE_TILT)만큼 뒤로 젖힌 몸: 로컬 (y, z) → 월드 (z, y)
    const lean = Math.PI / 2 - LIE_TILT;
    const world = (localY: number, localZ: number) => ({
      z: bed.anchor.z - localY * Math.sin(lean) + localZ * Math.cos(lean),
      y: bed.bodyY + localY * Math.cos(lean) + localZ * Math.sin(lean),
    });
    const headCenter = world(LIE_HEAD.centerY, 0);
    const headBack = world(LIE_HEAD.centerY, LIE_HEAD.backZ);
    const headTop = world(LIE_HEAD.topY, 0);
    expect(bed.bodyY).toBeCloseTo(BED_MATTRESS.topY, 5);
    expect(headCenter.z).toBeGreaterThan(BED_PILLOW.minZ);
    expect(headCenter.z).toBeLessThan(BED_PILLOW.maxZ);
    // 머리 꼭대기가 머리판 앞면을 넘어가지 않는다
    expect(headTop.z).toBeGreaterThan(BED_HEADBOARD_FRONT_Z);
    // 뒤통수는 베개 속으로 조금 잠기되(위에서 보면 파묻힌다) 베개 밑으로 꺼지지는 않는다
    expect(headBack.y).toBeLessThan(BED_PILLOW.topY);
    expect(headBack.y).toBeGreaterThan(bed.bodyY);
    // 등은 매트리스 위에 있다 (이불 두께만큼 뜨는 건 허용)
    const torsoBack = world(0.65, LIE_BACK_Z);
    expect(torsoBack.y).toBeGreaterThanOrEqual(bed.bodyY - 0.01);
    expect(torsoBack.y).toBeLessThan(bed.bodyY + 0.15);
  });

  /*
   * 눕기 전에 걸터앉는 자리. 의자와 같은 앞턱 규칙이다. 매트리스 왼쪽 변(방 쪽)에
   * 엉덩이는 올라가 있고 무릎 아래는 밖으로 나와야 한다. 방 쪽(-x)을 보고 앉는다.
   */
  it("perches on the mattress edge facing the room before lying down", () => {
    const bed = SEATS.bed;
    const MATTRESS = BED_MATTRESS;
    const perch = bed.perch;
    expect(perch).toBeDefined();
    if (!perch) return;
    expect(perch.facing).toBeCloseTo(-Math.PI / 2, 5);
    // 로컬 z(정면)를 월드 x로: 정면이 -x라 앞으로 갈수록 x가 준다
    const worldX = (localZ: number) => perch.x + Math.sin(perch.facing) * localZ;
    expect(worldX(SIT_LEG_Z.back)).toBeLessThan(MATTRESS.minX);
    expect(worldX(SIT_CONTACT_Z.back)).toBeGreaterThan(MATTRESS.minX);
    expect(perch.bodyY + SIT_CONTACT_Y).toBeCloseTo(MATTRESS.topY, 5);
    // 젖힐 때 발 원점이 x로만 옮겨 가도록 z는 눕는 자리와 같다
    expect(perch.z).toBe(bed.anchor.z);
  });

  it("places each seat in the space its furniture stands in", () => {
    for (const id of SEAT_IDS) {
      const seat = SEATS[id];
      const inRoom = seat.anchor.x > ROOM_SHELL_BOUNDS.minX;
      expect(inRoom ? "room" : "living", id).toBe(seat.space);
    }
  });

  /** 식탁 의자는 배치 데이터(DINING_SET)와 좌석이 어긋나면 안 된다. 둘 다 손으로 적은 좌표다. */
  it("anchors the dining seats on the chairs they belong to", () => {
    for (const chair of DINING_SET.chairs) {
      const seat = SEATS[chair.seat];
      expect(seat.near.x).toBeCloseTo(chair.position[0], 5);
      expect(seat.near.z).toBeCloseTo(chair.position[2], 5);
      expect(seat.facing).toBeCloseTo(chair.rotationY, 5);
    }
  });

  /**
   * 상판 밑에 밀어 넣은 의자는 앉는 동안 빠져야 한다. 안 빼면 몸통(가슴 높이가 상판과
   * 겹친다)이 식탁을 뚫고 앉는다. 앉기 전에는 안 보이는 겹침이다.
   */
  it("pulls the tucked dining chairs clear of the table top", () => {
    const { tableTop } = DINING_SET;
    const torso = SIT_TORSO_HALF_WIDTH;
    for (const id of ["dining-window", "dining-door"] as const) {
      const { anchor } = SEATS[id];
      const clearsX = anchor.x - torso > tableTop.maxX || anchor.x + torso < tableTop.minX;
      const clearsZ = anchor.z - torso > tableTop.maxZ || anchor.z + torso < tableTop.minZ;
      expect(clearsX || clearsZ, id).toBe(true);
    }
  });
});
