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
