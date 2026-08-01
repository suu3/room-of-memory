import type { MemoryId } from "@/data/memory-room";

export type Vec3Tuple = readonly [x: number, y: number, z: number];
export type EulerTuple = readonly [x: number, y: number, z: number];

export interface Aabb2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CameraPreset {
  position: Vec3Tuple;
  target: Vec3Tuple;
}

export interface MemoryPlacement {
  id: MemoryId;
  position: Vec3Tuple;
  rotation: EulerTuple;
  scale: number;
  interactionRadius: number;
}
