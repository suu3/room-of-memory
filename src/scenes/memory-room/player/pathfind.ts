import { isWalkable, type Vec2 } from "../world/spatial";
import type { Aabb2 } from "../world/types";

/*
 * 바닥 클릭의 경로 탐색.
 *
 * 예전에는 목표를 향해 곧장 걷고 막히면 섰다. 책상 뒤처럼 직선이 전부 가구에 막히는
 * 자리에서는 클릭이 아예 먹통이 됐고, 키로만 빠져나올 수 있었다. 이제 걷기 영역과
 * 가구 발자국을 격자로 깔고 A*로 길을 찾는다. 이 방 규모(거실까지 24 x 10 유닛)에서는
 * 0.25 격자로도 수천 칸이라 클릭 한 번에 다 돈다.
 *
 * 찾은 길은 보이는 대로 편다(string pulling). 격자를 그대로 따르면 계단처럼 꺾이며 걷는다.
 */

/** 격자 한 칸 (월드 유닛). 플레이어 지름(0.76)보다 훨씬 작아야 좁은 통로를 놓치지 않는다. */
export const PATH_CELL = 0.25;
/** 목표가 설 수 없는 자리(가구 위·벽)면 이 거리 안에서 가장 가까운 설 수 있는 칸으로 옮긴다. */
export const GOAL_SNAP_DISTANCE = 1.6;

interface Grid {
  minX: number;
  minZ: number;
  columns: number;
  rows: number;
  walkable: Uint8Array;
}

function buildGrid(radius: number, zones: readonly Aabb2[], obstacles: readonly Aabb2[]): Grid {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const zone of zones) {
    minX = Math.min(minX, zone.minX);
    minZ = Math.min(minZ, zone.minZ);
    maxX = Math.max(maxX, zone.maxX);
    maxZ = Math.max(maxZ, zone.maxZ);
  }
  const columns = Math.max(1, Math.ceil((maxX - minX) / PATH_CELL) + 1);
  const rows = Math.max(1, Math.ceil((maxZ - minZ) / PATH_CELL) + 1);
  const walkable = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = minX + column * PATH_CELL;
      const z = minZ + row * PATH_CELL;
      walkable[row * columns + column] = isWalkable(x, z, radius, zones, obstacles) ? 1 : 0;
    }
  }
  return { minX, minZ, columns, rows, walkable };
}

/** 격자 밖의 점이 격자 가장자리에서 얼마나 먼가 (안이면 0). */
function distanceOutside(grid: Grid, point: Vec2): number {
  const maxX = grid.minX + (grid.columns - 1) * PATH_CELL;
  const maxZ = grid.minZ + (grid.rows - 1) * PATH_CELL;
  const dx = Math.max(grid.minX - point.x, 0, point.x - maxX);
  const dz = Math.max(grid.minZ - point.z, 0, point.z - maxZ);
  return Math.hypot(dx, dz);
}

function cellOf(grid: Grid, point: Vec2): { column: number; row: number } {
  return {
    column: Math.min(grid.columns - 1, Math.max(0, Math.round((point.x - grid.minX) / PATH_CELL))),
    row: Math.min(grid.rows - 1, Math.max(0, Math.round((point.z - grid.minZ) / PATH_CELL))),
  };
}

function pointOf(grid: Grid, column: number, row: number): Vec2 {
  return { x: grid.minX + column * PATH_CELL, z: grid.minZ + row * PATH_CELL };
}

function isOpen(grid: Grid, column: number, row: number): boolean {
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return false;
  return grid.walkable[row * grid.columns + column] === 1;
}

/** 가장 가까운 설 수 있는 칸. 반지름 안에 없으면 null. */
function nearestOpen(
  grid: Grid,
  from: { column: number; row: number },
  maxDistance: number,
): { column: number; row: number } | null {
  const reach = Math.ceil(maxDistance / PATH_CELL);
  let best: { column: number; row: number; distance: number } | null = null;
  for (let dr = -reach; dr <= reach; dr += 1) {
    for (let dc = -reach; dc <= reach; dc += 1) {
      const column = from.column + dc;
      const row = from.row + dr;
      if (!isOpen(grid, column, row)) continue;
      const distance = Math.hypot(dc, dr) * PATH_CELL;
      if (distance > maxDistance) continue;
      if (!best || distance < best.distance) best = { column, row, distance };
    }
  }
  return best;
}

const NEIGHBORS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

/** A*. 대각선은 양옆 두 칸이 다 열려 있을 때만: 가구 모서리를 비스듬히 뚫지 않게. */
function search(
  grid: Grid,
  start: { column: number; row: number },
  goal: { column: number; row: number },
): { column: number; row: number }[] | null {
  const total = grid.columns * grid.rows;
  const index = (column: number, row: number) => row * grid.columns + column;
  const gScore = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heuristic = (column: number, row: number) => {
    const dx = Math.abs(column - goal.column);
    const dz = Math.abs(row - goal.row);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  // 이진 힙 없이 배열 스캔으로 뽑는다. 수천 칸에서는 이게 더 짧고, 클릭 한 번에 한 번 돈다.
  const open: number[] = [];
  const fScore = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
  const startIndex = index(start.column, start.row);
  const goalIndex = index(goal.column, goal.row);
  gScore[startIndex] = 0;
  fScore[startIndex] = heuristic(start.column, start.row);
  open.push(startIndex);

  while (open.length > 0) {
    let bestAt = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (fScore[open[i]] < fScore[open[bestAt]]) bestAt = i;
    }
    const current = open[bestAt];
    open[bestAt] = open[open.length - 1];
    open.pop();
    if (current === goalIndex) {
      const path: { column: number; row: number }[] = [];
      for (let at = current; at !== -1; at = cameFrom[at]) {
        path.push({ column: at % grid.columns, row: Math.floor(at / grid.columns) });
      }
      return path.reverse();
    }
    closed[current] = 1;
    const column = current % grid.columns;
    const row = Math.floor(current / grid.columns);
    for (const [dc, dr, cost] of NEIGHBORS) {
      const nextColumn = column + dc;
      const nextRow = row + dr;
      if (!isOpen(grid, nextColumn, nextRow)) continue;
      if (
        dc !== 0 &&
        dr !== 0 &&
        (!isOpen(grid, column + dc, row) || !isOpen(grid, column, row + dr))
      ) {
        continue;
      }
      const next = index(nextColumn, nextRow);
      if (closed[next]) continue;
      const tentative = gScore[current] + cost;
      if (tentative >= gScore[next]) continue;
      cameFrom[next] = current;
      gScore[next] = tentative;
      fScore[next] = tentative + heuristic(nextColumn, nextRow);
      if (!open.includes(next)) open.push(next);
    }
  }
  return null;
}

/** 두 점 사이를 촘촘히 짚어 전부 설 수 있는 자리인가. */
function lineClear(
  from: Vec2,
  to: Vec2,
  radius: number,
  zones: readonly Aabb2[],
  obstacles: readonly Aabb2[],
): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const samples = Math.max(1, Math.ceil(distance / (PATH_CELL / 2)));
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    if (!isWalkable(x, z, radius, zones, obstacles)) return false;
  }
  return true;
}

/**
 * 시작에서 목표까지의 경유점. 시작 자리는 빼고 목표까지 이어진다. 길이 없으면 null.
 *
 * 목표가 설 수 없는 자리면(가구·벽을 눌렀다) 그 근처의 설 수 있는 칸이 목표가 된다.
 * "저기로 가"의 뜻은 저 물건 앞까지 가라는 것이지 못 간다는 것이 아니다.
 */
export function findPath(
  start: Vec2,
  goal: Vec2,
  radius: number,
  zones: readonly Aabb2[],
  obstacles: readonly Aabb2[],
): Vec2[] | null {
  const grid = buildGrid(radius, zones, obstacles);
  // 바닥에서 한참 떨어진 곳(벽 너머·허공)은 목표가 아니다. 가장자리로 끌어다 붙이지 않는다
  if (distanceOutside(grid, goal) > GOAL_SNAP_DISTANCE) return null;
  const startCell = nearestOpen(grid, cellOf(grid, start), GOAL_SNAP_DISTANCE);
  const goalCell = nearestOpen(grid, cellOf(grid, goal), GOAL_SNAP_DISTANCE);
  if (!startCell || !goalCell) return null;

  const goalPoint = isWalkable(goal.x, goal.z, radius, zones, obstacles)
    ? goal
    : pointOf(grid, goalCell.column, goalCell.row);
  // 곧장 보이면 격자를 돌 이유가 없다
  if (lineClear(start, goalPoint, radius, zones, obstacles)) return [goalPoint];

  const cells = search(grid, startCell, goalCell);
  if (!cells) return null;
  const points = [start, ...cells.map((cell) => pointOf(grid, cell.column, cell.row)), goalPoint];

  // 보이는 데까지 한 번에: 현재 점에서 가장 먼 보이는 점으로 건너뛴다
  const waypoints: Vec2[] = [];
  let at = 0;
  while (at < points.length - 1) {
    let farthest = at + 1;
    for (let candidate = points.length - 1; candidate > at + 1; candidate -= 1) {
      if (lineClear(points[at], points[candidate], radius, zones, obstacles)) {
        farthest = candidate;
        break;
      }
    }
    waypoints.push(points[farthest]);
    at = farthest;
  }
  return waypoints;
}
