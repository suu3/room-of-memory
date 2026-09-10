import { describe, expect, it } from "vitest";
import {
  DOORWAY_ZONE,
  LIVING_BOUNDS,
  LIVING_COLLIDERS,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
} from "./layout";
import { findPath } from "./pathfind";
import { isWalkable, moveThroughZones, type Vec2 } from "./spatial";

const RADIUS = 0.38;
const ZONES = [ROOM_BOUNDS, DOORWAY_ZONE, LIVING_BOUNDS];
const COLLIDERS = [...ROOM_COLLIDERS, ...LIVING_COLLIDERS];

/** 경유점을 실제 이동 경로(축 분리 미끄러짐)로 따라가 보고 도착하는지 본다. */
function walk(start: Vec2, waypoints: Vec2[]): Vec2 {
  const position = { ...start };
  for (const target of waypoints) {
    for (let step = 0; step < 4000; step += 1) {
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= 0.13) break;
      const length = Math.min(distance, 0.1);
      const next = moveThroughZones(
        position,
        { x: (dx / distance) * length, z: (dz / distance) * length },
        RADIUS,
        ZONES,
        COLLIDERS,
      );
      if (Math.hypot(next.x - position.x, next.z - position.z) < length * 0.05) break;
      position.x = next.x;
      position.z = next.z;
    }
  }
  return position;
}

describe("findPath", () => {
  it("walks around the chair from the pocket beside the desk", () => {
    // 책상(x -5.48~-3.72)과 캐비닛 사이 뒷벽 쪽 구석: 방 한가운데로 가는 직선이 의자에 막힌다
    const start = { x: -3.72 + RADIUS + 0.05, z: -3.1 };
    expect(isWalkable(start.x, start.z, RADIUS, ZONES, COLLIDERS)).toBe(true);
    const goal = { x: 1, z: 3 };
    const path = findPath(start, goal, RADIUS, ZONES, COLLIDERS);
    expect(path).not.toBeNull();
    const end = walk(start, path ?? []);
    expect(Math.hypot(end.x - goal.x, end.z - goal.z)).toBeLessThan(0.2);
  });

  it("goes straight when nothing is in the way", () => {
    const path = findPath({ x: 0, z: 2 }, { x: 2, z: 4 }, RADIUS, ZONES, COLLIDERS);
    expect(path).toEqual([{ x: 2, z: 4 }]);
  });

  it("stops in front of furniture that was clicked", () => {
    // 캐비닛(x 0.15~4.7, z -3.35~-2.25) 위를 눌렀다: 그 앞의 설 수 있는 자리가 목표가 된다
    const path = findPath({ x: 0, z: 2 }, { x: 2, z: -2.8 }, RADIUS, ZONES, COLLIDERS);
    expect(path).not.toBeNull();
    const last = path?.at(-1);
    expect(last).toBeDefined();
    if (!last) return;
    expect(isWalkable(last.x, last.z, RADIUS, ZONES, COLLIDERS)).toBe(true);
    expect(Math.hypot(last.x - 2, last.z + 2.8)).toBeLessThan(1.6);
  });

  it("threads the doorway into the living room", () => {
    const start = { x: 0, z: 2 };
    const goal = { x: -12, z: 1 };
    const path = findPath(start, goal, RADIUS, ZONES, COLLIDERS);
    expect(path).not.toBeNull();
    const end = walk(start, path ?? []);
    expect(Math.hypot(end.x - goal.x, end.z - goal.z)).toBeLessThan(0.2);
  });

  it("gives up on a target nowhere near the floor", () => {
    expect(findPath({ x: 0, z: 2 }, { x: 40, z: 40 }, RADIUS, ZONES, COLLIDERS)).toBeNull();
  });
});
