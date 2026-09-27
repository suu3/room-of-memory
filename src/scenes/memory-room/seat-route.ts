import { findPath } from "./pathfind";
import type { Seat } from "./seats";
import type { Vec2 } from "./spatial";
import type { Aabb2 } from "./types";

/**
 * 앉으러 가는 길. 서 있던 자리에서 다가서는 자리까지의 꺾은선이다.
 *
 * 예전에는 서 있던 자리에서 자리까지 곧장 미끄러졌다. 의자 반대편에 서 있으면 몸이 의자와
 * 책상을 뚫고 지나갔다. 바닥 클릭과 같은 길찾기(pathfind)로 가구를 돌아간다.
 */
export interface SeatRoute {
  /** 서 있던 자리부터 다가서는 자리까지. 첫 점이 서 있던 자리다. */
  points: Vec2[];
  /** 꺾은선의 길이 (월드 유닛). */
  length: number;
  /** 마지막 구간의 방향(rad). 다가서는 자리에 닿는 순간 보고 있는 쪽이다. */
  arrive: number;
}

function lengthOf(points: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}

function arriveOf(points: readonly Vec2[]): number {
  const to = points[points.length - 1];
  const from = points[points.length - 2] ?? to;
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** 다가서는 자리 후보. 없으면 앉는 자리로 곧장 간다. */
export function approachesOf(seat: Seat): readonly Vec2[] {
  return seat.approaches ?? [seat.anchor];
}

/**
 * 앉는 순간 의자가 빠져 나간다 (Seat.pull). 콜라이더는 제자리 의자만 막으므로, 걸어가는
 * 동안 빠진 의자를 스치지 않도록 빠진 자리의 발자국을 하나 더 막는다.
 */
function withPulledSeat(seat: Seat, obstacles: readonly Aabb2[]): readonly Aabb2[] {
  const { pull, near, footprintHalf } = seat;
  if (!pull || footprintHalf === undefined) return obstacles;
  const x = near.x + pull.x;
  const z = near.z + pull.z;
  return [
    ...obstacles,
    {
      minX: x - footprintHalf,
      maxX: x + footprintHalf,
      minZ: z - footprintHalf,
      maxZ: z + footprintHalf,
    },
  ];
}

/**
 * 후보 중 걸어서 가장 가까운 다가서는 자리와 그 길.
 *
 * 길찾기가 목표를 설 수 있는 칸으로 끌어다 붙이는 일이 있어서, 마지막 점은 후보 그대로
 * 둔다: 거기서 앉는 동작이 이어지므로 좌석 데이터와 같은 자리여야 한다. 길이 하나도
 * 없으면(앉는 자리가 콜라이더 안이라 막혔다) 첫 후보로 곧장 간다. 예전 동작이다.
 */
export function planSeatRoute(
  start: Vec2,
  seat: Seat,
  radius: number,
  zones: readonly Aabb2[],
  obstacles: readonly Aabb2[],
): SeatRoute {
  const blocked = withPulledSeat(seat, obstacles);
  let best: SeatRoute | null = null;
  for (const spot of approachesOf(seat)) {
    const path = findPath(start, spot, radius, zones, blocked);
    if (!path) continue;
    const points = [{ x: start.x, z: start.z }, ...path.slice(0, -1), { x: spot.x, z: spot.z }];
    const length = lengthOf(points);
    if (!best || length < best.length) best = { points, length, arrive: arriveOf(points) };
  }
  if (best) return best;
  const spot = approachesOf(seat)[0];
  const points = [
    { x: start.x, z: start.z },
    { x: spot.x, z: spot.z },
  ];
  return { points, length: lengthOf(points), arrive: arriveOf(points) };
}

/** 꺾은선을 따라 `t`(0~1) 만큼 간 자리. out에 담아 돌려준다 (프레임마다 새 객체를 안 만든다). */
export function pointAlong(route: SeatRoute, t: number, out: Vec2): Vec2 {
  const { points, length } = route;
  let remaining = Math.min(1, Math.max(0, t)) * length;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const segment = Math.hypot(to.x - from.x, to.z - from.z);
    if (remaining <= segment && segment > 0) {
      const k = remaining / segment;
      out.x = from.x + (to.x - from.x) * k;
      out.z = from.z + (to.z - from.z) * k;
      return out;
    }
    remaining -= segment;
  }
  const last = points[points.length - 1];
  out.x = last.x;
  out.z = last.z;
  return out;
}
