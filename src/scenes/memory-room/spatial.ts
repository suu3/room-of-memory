import type { MemoryId } from "@/data/memory-room";
import type { Aabb2, Vec3Tuple } from "./types";

export interface Vec2 {
  x: number;
  z: number;
}

export interface ProximityTarget {
  id: MemoryId;
  position: Vec3Tuple;
  interactionRadius: number;
}

function intersects(x: number, z: number, radius: number, box: Aabb2): boolean {
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function collides(x: number, z: number, radius: number, obstacles: readonly Aabb2[]): boolean {
  for (let index = 0; index < obstacles.length; index += 1) {
    const box = obstacles[index];
    if (intersects(x, z, radius, box)) return true;
  }
  return false;
}

function distanceSquaredToBox(x: number, z: number, box: Aabb2): number {
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2;
}

/**
 * (fromX, fromZ)에서 (toX, toZ)로 한 걸음 가는 것을 막는가.
 *
 * 이미 파묻혀 있는 상자는 더 파고드는 쪽만 막는다. 콜라이더가 몸 위에 새로 생기는
 * 경우가 있다: 방문을 열면 열린 문짝(OPEN_DOOR_LEAF_COLLIDERS)이 문 옆에 서 있던 몸과
 * 겹친다. "도착점이 겹치면 막는다"만 보면 거기서 어느 쪽으로도 한 걸음에 다 빠져나갈 수
 * 없어 제자리에 갇힌다 (1인칭 문 넘기에서 문 쪽으로 못 걷던 버그).
 */
function blocksStep(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number,
  obstacles: readonly Aabb2[],
): boolean {
  for (let index = 0; index < obstacles.length; index += 1) {
    const box = obstacles[index];
    if (!intersects(toX, toZ, radius, box)) continue;
    if (!intersects(fromX, fromZ, radius, box)) return true;
    if (distanceSquaredToBox(toX, toZ, box) < distanceSquaredToBox(fromX, fromZ, box)) return true;
  }
  return false;
}

export function normalizeMovement(input: Vec2): Vec2 {
  const length = Math.hypot(input.x, input.z);
  if (length <= 1) return input;
  if (Math.abs(input.x) === Math.abs(input.z)) {
    return { x: Math.sign(input.x) * Math.SQRT1_2, z: Math.sign(input.z) * Math.SQRT1_2 };
  }
  return { x: input.x / length, z: input.z / length };
}

export function moveCircle(
  origin: Vec2,
  delta: Vec2,
  radius: number,
  bounds: Aabb2,
  obstacles: readonly Aabb2[],
  output?: Vec2,
): Vec2 {
  const nextX = clamp(origin.x + delta.x, bounds.minX + radius, bounds.maxX - radius);
  const afterX = collides(nextX, origin.z, radius, obstacles) ? origin.x : nextX;
  const nextZ = clamp(origin.z + delta.z, bounds.minZ + radius, bounds.maxZ - radius);
  const afterZ = collides(afterX, nextZ, radius, obstacles) ? origin.z : nextZ;
  const result = output ?? { x: 0, z: 0 };
  result.x = afterX;
  result.z = afterZ;
  return result;
}

/** 반지름을 뺀 안쪽에 중심이 들어가는가. */
function insideZone(x: number, z: number, radius: number, zone: Aabb2): boolean {
  return (
    x >= zone.minX + radius &&
    x <= zone.maxX - radius &&
    z >= zone.minZ + radius &&
    z <= zone.maxZ - radius
  );
}

/**
 * 한 축의 이동을 여러 영역에 대해 푼다.
 *
 * 후보 지점이 어느 영역 안이든 들어가면 그대로 통과: 문간처럼 영역이 겹치는
 * 자리에서 옆 영역으로 넘어가는 게 이 경로다. 아무 데도 못 들어가면, **지금 서
 * 있는 영역들** 안으로만 클램프해서 벽을 따라 미끄러진다. 지금 서 있지 않은
 * 영역까지 클램프 후보로 삼으면 반대편 공간으로 순간이동할 수 있다.
 */
function slideAxis(
  candidate: number,
  cross: number,
  origin: number,
  radius: number,
  zones: readonly Aabb2[],
  axis: "x" | "z",
): number {
  for (const zone of zones) {
    const valid =
      axis === "x"
        ? insideZone(candidate, cross, radius, zone)
        : insideZone(cross, candidate, radius, zone);
    if (valid) return candidate;
  }

  let best = origin;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const zone of zones) {
    const standing =
      axis === "x"
        ? insideZone(origin, cross, radius, zone)
        : insideZone(cross, origin, radius, zone);
    if (!standing) continue;
    const clamped =
      axis === "x"
        ? clamp(candidate, zone.minX + radius, zone.maxX - radius)
        : clamp(candidate, zone.minZ + radius, zone.maxZ - radius);
    const distance = Math.abs(clamped - candidate);
    if (distance < bestDistance) {
      best = clamped;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * 여러 걷기 영역(방·문간·거실)에 걸친 이동. 영역들이 넉넉히 겹쳐 있어야 한다.
 * 겹침이 지름보다 얇으면 중심이 어느 쪽에도 못 들어가는 틈이 생긴다 (layout.test).
 *
 * 축을 하나씩 푸는 것은 moveCircle과 같다. x를 먼저 확정하고 그 자리에서 z를
 * 푼다. 대각선 입력으로 문간 모서리를 파고들 때 두 축이 서로를 무효화하지 않게.
 */
export function moveThroughZones(
  origin: Vec2,
  delta: Vec2,
  radius: number,
  zones: readonly Aabb2[],
  obstacles: readonly Aabb2[],
  output?: Vec2,
): Vec2 {
  const nextX = slideAxis(origin.x + delta.x, origin.z, origin.x, radius, zones, "x");
  const afterX = blocksStep(origin.x, origin.z, nextX, origin.z, radius, obstacles)
    ? origin.x
    : nextX;
  const nextZ = slideAxis(origin.z + delta.z, afterX, origin.z, radius, zones, "z");
  const afterZ = blocksStep(afterX, origin.z, afterX, nextZ, radius, obstacles) ? origin.z : nextZ;
  const result = output ?? { x: 0, z: 0 };
  result.x = afterX;
  result.z = afterZ;
  return result;
}

/**
 * 그 자리에 몸이 설 수 있는가: 걷기 영역 안이면서 어떤 가구 발자국에도 안 걸리는가.
 *
 * 이동은 축을 하나씩 푸는 경로라 "갈 수 있는가"를 이걸로 대신 재지 않는다. 어떤 자리가
 * **원래 설 수 있는 자리인지**를 묻는 검사용이다 (앉는 자리까지 걸어갈 수 있는지 등).
 */
export function isWalkable(
  x: number,
  z: number,
  radius: number,
  zones: readonly Aabb2[],
  obstacles: readonly Aabb2[],
): boolean {
  if (collides(x, z, radius, obstacles)) return false;
  return zones.some((zone) => insideZone(x, z, radius, zone));
}

export function findNearestMemory(
  position: Vec2,
  targets: readonly ProximityTarget[],
  isAvailable: (id: MemoryId) => boolean,
): MemoryId | null {
  let nearest: { id: MemoryId; distanceSquared: number } | null = null;
  for (const target of targets) {
    const distanceSquared =
      (position.x - target.position[0]) ** 2 + (position.z - target.position[2]) ** 2;
    if (
      isAvailable(target.id) &&
      distanceSquared <= target.interactionRadius ** 2 &&
      (!nearest || distanceSquared < nearest.distanceSquared)
    ) {
      nearest = { id: target.id, distanceSquared };
    }
  }
  return nearest?.id ?? null;
}
