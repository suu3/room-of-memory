import type { MemoryId } from "@/data/memory-room";
import type { Aabb2, CameraPreset, MemoryPlacement } from "./types";

export const ROOM_BOUNDS: Aabb2 = { minX: -5.55, maxX: 5.55, minZ: -3.55, maxZ: 3.55 };

export const ROOM_COLLIDERS = [
  { minX: -4.7, maxX: -1.25, minZ: -3.35, maxZ: -1.65 }, // desk
  { minX: 1.55, maxX: 5.25, minZ: -0.65, maxZ: 3.15 }, // bed
  { minX: 0.15, maxX: 4.7, minZ: -3.35, maxZ: -2.25 }, // cabinet
  { minX: 4.35, maxX: 5.3, minZ: 2.3, maxZ: 3.3 }, // nightstand
] as const satisfies readonly Aabb2[];

export const MEMORY_PLACEMENTS = {
  bat: {
    id: "bat",
    position: [-4.7, 0.55, 2.35],
    rotation: [0, 0, -0.32],
    scale: 0.85,
    interactionRadius: 1.15,
  },
  window: {
    id: "window",
    position: [1.15, 2.55, -3.88],
    rotation: [0, 0, 0],
    scale: 1,
    interactionRadius: 1.55,
  },
  frame: {
    id: "frame",
    position: [-2.15, 1.33, -2.55],
    rotation: [0, 0.35, 0],
    scale: 0.55,
    interactionRadius: 1.05,
  },
  radio: {
    id: "radio",
    position: [-3.7, 1.28, -2.55],
    rotation: [0, 0.2, 0],
    scale: 1,
    interactionRadius: 1.05,
  },
  phone: {
    id: "phone",
    position: [2.9, 1.05, -2.25],
    rotation: [0, -0.2, 0],
    scale: 1,
    interactionRadius: 1.05,
  },
  calendar: {
    id: "calendar",
    position: [-4.55, 2.55, -3.87],
    rotation: [0, 0, 0],
    scale: 1,
    interactionRadius: 1.25,
  },
  ball: {
    id: "ball",
    position: [-4.55, 0.24, 3.05],
    rotation: [0, 0, 0],
    scale: 0.38,
    interactionRadius: 1.05,
  },
} as const satisfies Record<MemoryId, MemoryPlacement>;

export const CAMERA_PRESETS = {
  room: { position: [10.8, 9.2, 12.5], target: [0, 0.8, -0.2] },
  bat: { position: [-1.4, 3.0, 6.4], target: [-4.45, 0.7, 2.25] },
  window: { position: [4.7, 4.2, 2.1], target: [1.15, 2.4, -3.7] },
  frame: { position: [0.4, 2.6, 1.0], target: [-2.15, 1.3, -2.55] },
  radio: { position: [-0.8, 2.5, 1.3], target: [-3.7, 1.25, -2.55] },
  phone: { position: [5.8, 2.6, 1.3], target: [2.9, 1.0, -2.25] },
  calendar: { position: [-1.1, 3.6, 1.0], target: [-4.55, 2.5, -3.75] },
  ball: { position: [-1.4, 2.1, 5.6], target: [-4.55, 0.3, 3.05] },
} as const satisfies Record<"room" | MemoryId, CameraPreset>;
