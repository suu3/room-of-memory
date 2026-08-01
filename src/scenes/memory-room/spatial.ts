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

function intersects(center: Vec2, radius: number, box: Aabb2): boolean {
  const closestX = Math.max(box.minX, Math.min(center.x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(center.z, box.maxZ));
  return (center.x - closestX) ** 2 + (center.z - closestZ) ** 2 < radius ** 2;
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
): Vec2 {
  const clamped = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  const nextX = {
    x: clamped(origin.x + delta.x, bounds.minX + radius, bounds.maxX - radius),
    z: origin.z,
  };
  const afterX = obstacles.some((box) => intersects(nextX, radius, box)) ? origin : nextX;
  const nextZ = {
    x: afterX.x,
    z: clamped(origin.z + delta.z, bounds.minZ + radius, bounds.maxZ - radius),
  };
  return obstacles.some((box) => intersects(nextZ, radius, box)) ? afterX : nextZ;
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
