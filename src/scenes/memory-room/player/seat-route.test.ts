import { describe, expect, it } from "vitest";
import {
  DOORWAY_ZONE,
  LIVING_BOUNDS,
  LIVING_COLLIDERS,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
} from "../world/layout";
import { isWalkable, type Vec2 } from "../world/spatial";
import { planSeatRoute, pointAlong } from "./seat-route";
import { SEATS } from "./seats";

/** Player.tsx의 값: 여기서 다시 부르지 않고 같은 수치를 쓴다. */
const PLAYER_RADIUS = 0.38;
const ZONES = [ROOM_BOUNDS, DOORWAY_ZONE, LIVING_BOUNDS] as const;
const COLLIDERS = [...ROOM_COLLIDERS, ...LIVING_COLLIDERS] as const;

const chair = SEATS["desk-chair"];

/** 길을 촘촘히 짚어 가며 가구·벽에 걸리는 점이 있는지 본다. */
function routeClear(start: Vec2, seat = chair): boolean {
  const route = planSeatRoute(start, seat, PLAYER_RADIUS, ZONES, COLLIDERS);
  const at: Vec2 = { x: 0, z: 0 };
  for (let i = 0; i <= 200; i += 1) {
    pointAlong(route, i / 200, at);
    if (!isWalkable(at.x, at.z, PLAYER_RADIUS, ZONES, COLLIDERS)) return false;
  }
  return true;
}

describe("seat route", () => {
  it("모든 자리에 서는 자리가 있고, 전부 걸을 수 있다", () => {
    for (const seat of Object.values(SEATS)) {
      expect(seat.approaches?.length, seat.id).toBeGreaterThan(0);
      for (const spot of seat.approaches ?? []) {
        expect(
          isWalkable(spot.x, spot.z, PLAYER_RADIUS, ZONES, COLLIDERS),
          `${seat.id} ${spot.x.toFixed(2)},${spot.z.toFixed(2)}`,
        ).toBe(true);
      }
    }
  });

  it("빠져 나온 의자 발자국 밖에 선다", () => {
    for (const seat of Object.values(SEATS)) {
      if (!seat.pull || seat.footprintHalf === undefined) continue;
      const x = seat.near.x + seat.pull.x;
      const z = seat.near.z + seat.pull.z;
      const half = seat.footprintHalf;
      for (const spot of seat.approaches ?? []) {
        const pulled = [{ minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half }];
        expect(isWalkable(spot.x, spot.z, PLAYER_RADIUS, ZONES, pulled), seat.id).toBe(true);
      }
    }
  });

  it("책상 의자는 양옆에 서는 자리가 있고, 둘 다 걸을 수 있다", () => {
    expect(chair.approaches).toHaveLength(2);
    for (const spot of chair.approaches ?? []) {
      expect(isWalkable(spot.x, spot.z, PLAYER_RADIUS, ZONES, COLLIDERS)).toBe(true);
    }
  });

  it("의자 뒤에서 눌러도 의자·책상을 뚫지 않고 옆으로 돌아간다", () => {
    // 등받이 뒤(+x), 문 쪽 옆(+z), 창 쪽 옆(-z)
    for (const start of [
      { x: -1.6, z: -1.2 },
      { x: -2.4, z: 0.6 },
      { x: -2.4, z: -2.8 },
    ]) {
      expect(routeClear(start), `${start.x},${start.z}`).toBe(true);
    }
  });

  it("거실 어디에서 눌러도 가구를 뚫지 않고 서는 자리까지 간다", () => {
    // 소파 뒤(식탁 옆) · 피아노 앞 · 안방문 쪽 · 방문 쪽
    const starts = [
      { x: -10.5, z: -2.6 },
      { x: -8.3, z: 4.5 },
      { x: -14.5, z: 3 },
      { x: -7, z: 0 },
    ];
    for (const seat of Object.values(SEATS)) {
      if (seat.space !== "living") continue;
      for (const start of starts) {
        expect(routeClear(start, seat), `${seat.id} from ${start.x},${start.z}`).toBe(true);
      }
    }
  });

  it("양옆 중 걸어서 가까운 쪽으로 간다", () => {
    // 창 쪽이 -z, 문 쪽이 +z
    const [windowSide, doorSide] = [...(chair.approaches ?? [])].sort((a, b) => a.z - b.z);
    const fromDoor = planSeatRoute({ x: -2.4, z: 0.6 }, chair, PLAYER_RADIUS, ZONES, COLLIDERS);
    expect(fromDoor.points.at(-1)).toEqual(doorSide);
    const fromWindow = planSeatRoute({ x: -2.4, z: -2.8 }, chair, PLAYER_RADIUS, ZONES, COLLIDERS);
    expect(fromWindow.points.at(-1)).toEqual(windowSide);
  });

  it("길을 따라간 자리는 끝점에서 멈춘다", () => {
    const route = planSeatRoute({ x: -1.6, z: -1.2 }, chair, PLAYER_RADIUS, ZONES, COLLIDERS);
    const at = pointAlong(route, 0, { x: 0, z: 0 });
    expect(at).toEqual({ x: -1.6, z: -1.2 });
    const end = pointAlong(route, 1, { x: 0, z: 0 });
    expect(end).toEqual(route.points.at(-1));
  });
});
