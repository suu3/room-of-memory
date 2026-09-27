import { describe, expect, it } from "vitest";
import {
  DOORWAY_ZONE,
  LIVING_BOUNDS,
  LIVING_COLLIDERS,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
} from "./layout";
import { planSeatRoute, pointAlong } from "./seat-route";
import { SEATS } from "./seats";
import { isWalkable, type Vec2 } from "./spatial";

/** Player.tsx의 값: 여기서 다시 부르지 않고 같은 수치를 쓴다. */
const PLAYER_RADIUS = 0.38;
const ZONES = [ROOM_BOUNDS, DOORWAY_ZONE, LIVING_BOUNDS] as const;
const COLLIDERS = [...ROOM_COLLIDERS, ...LIVING_COLLIDERS] as const;

const chair = SEATS["desk-chair"];

/** 길을 촘촘히 짚어 가며 가구·벽에 걸리는 점이 있는지 본다. */
function routeClear(start: Vec2): boolean {
  const route = planSeatRoute(start, chair, PLAYER_RADIUS, ZONES, COLLIDERS);
  const at: Vec2 = { x: 0, z: 0 };
  for (let i = 0; i <= 200; i += 1) {
    pointAlong(route, i / 200, at);
    if (!isWalkable(at.x, at.z, PLAYER_RADIUS, ZONES, COLLIDERS)) return false;
  }
  return true;
}

describe("seat route", () => {
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

  it("양옆 중 걸어서 가까운 쪽으로 간다", () => {
    const [windowSide, doorSide] = chair.approaches ?? [];
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
