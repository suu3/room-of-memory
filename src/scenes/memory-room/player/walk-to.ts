import type { Vec2 } from "../world/spatial";

/*
 * 바닥을 눌러 걸어가기: 경유점 하나를 향한 한 걸음.
 *
 * 길은 pathfind.ts의 A*가 클릭할 때 한 번 찾는다. 여기는 그 경유점을 하나씩 따라가며
 * 이번 프레임의 이동량과 도착·막힘만 판정한다. 가구에 걸리면 평소 이동
 * (moveThroughZones)처럼 미끄러지다가 더 못 가는 자리에서 선다.
 */

/** 이 안에 들어오면 도착. 한 프레임 이동량(최대 0.12)보다 작게 잡으면 목표를 지나쳐 되돌아오며 떤다. */
export const WALK_ARRIVE_DISTANCE = 0.13;
/** 가려던 거리에 비해 이만큼도 못 갔으면 막힌 것이다. 벽·가구에 정면으로 걸렸다. */
const WALK_BLOCKED_RATIO = 0.05;

/**
 * 이번 프레임에 목표 쪽으로 갈 이동량을 `out`에 쓴다. 이미 도착했으면 0을 돌려주고
 * `out`은 건드리지 않는다. 돌려주는 값은 가려는 거리(막힘 판정의 기준)다.
 */
export function stepToward(origin: Vec2, target: Vec2, maxDistance: number, out: Vec2): number {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= WALK_ARRIVE_DISTANCE) return 0;
  const length = Math.min(distance, Math.max(0, maxDistance));
  out.x = (dx / distance) * length;
  out.z = (dz / distance) * length;
  return length;
}

/** 가려던 거리(`intended`)에 비해 실제로 간 거리(`traveled`)가 없다시피 하면 막힌 것이다. */
export function isWalkBlocked(intended: number, traveled: number): boolean {
  return intended > 0 && traveled < intended * WALK_BLOCKED_RATIO;
}
