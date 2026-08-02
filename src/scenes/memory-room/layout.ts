import type { MemoryId } from "@/data/memory-room";
import type { Aabb2, CameraPreset, MemoryPlacement } from "./types";

export const ROOM_SHELL_BOUNDS: Aabb2 = { minX: -6, maxX: 8, minZ: -4, maxZ: 6.5 };
export const ROOM_SHELL_CENTER = [
  (ROOM_SHELL_BOUNDS.minX + ROOM_SHELL_BOUNDS.maxX) / 2,
  (ROOM_SHELL_BOUNDS.minZ + ROOM_SHELL_BOUNDS.maxZ) / 2,
] as const;
export const REFERENCE_ROOM_LAYOUT = {
  openEdge: "front",
  hasVisibleWallDoor: true,
  doorSide: "left",
  deskSide: "left",
  bedSide: "right",
} as const;
export const ROOM_DOOR_POSITION = [ROOM_SHELL_BOUNDS.minX + 0.14, 1.7, 5.35] as const;
export const ROOM_DOOR_ROTATION = [0, Math.PI / 2, 0] as const;
export const DESK_POSITION = [-4.6, 0, -1.2] as const;
export const DESK_ROTATION = [0, Math.PI / 2, 0] as const;
// 책상이 커지면서 다리가 x=-4.0까지 나온다 — 의자를 그만큼 안쪽으로 물린다.
export const CHAIR_POSITION = [-3.3, 0, -1.2] as const;
export const CHAIR_ROTATION = [0, Math.PI / 2, 0] as const;

export const ROOM_BOUNDS: Aabb2 = { minX: -5.55, maxX: 7.55, minZ: -3.55, maxZ: 6.05 };

export const ROOM_COLLIDERS = [
  { minX: -5.48, maxX: -3.72, minZ: -3.35, maxZ: 0.95 }, // desk
  { minX: 3, maxX: 6.3, minZ: 0.1, maxZ: 5.6 }, // bed
  { minX: 0.15, maxX: 4.7, minZ: -3.35, maxZ: -2.25 }, // cabinet
  { minX: 6.3, maxX: 7.25, minZ: 0.3, maxZ: 1.2 }, // nightstand
  // 의자 — CHAIR_POSITION의 좌석/등받이 발자국(±0.525)에서 살짝 안쪽으로 잡는다
  { minX: -3.78, maxX: -2.82, minZ: -1.68, maxZ: -0.72 }, // chair
] as const satisfies readonly Aabb2[];

export const MEMORY_PLACEMENTS = {
  bat: {
    id: "bat",
    position: [-5.25, 1.48, 4.15],
    rotation: [0, 0, Math.PI - 0.22],
    scale: 1.6,
    interactionRadius: 1.35,
  },
  window: {
    id: "window",
    position: [1.15, 2.55, -3.88],
    rotation: [0, 0, 0],
    scale: 1,
    interactionRadius: 1.6,
  },
  frame: {
    id: "frame",
    position: [2.15, 1.36, -2.72],
    rotation: [0, -0.3, 0],
    scale: 1,
    interactionRadius: 1.05,
  },
  radio: {
    id: "radio",
    // y는 책상 상판 윗면(1.11) — 라디오 로컬 원점이 밑면이라 그대로 얹힌다.
    // 넓어진 책상 한가운데에 두면 플레이어가 반경 안으로 들어올 수 없다.
    // 통로 쪽(+X) 모서리로, 의자를 피해 앞쪽(+Z)에 얹는다.
    position: [-4.05, 1.11, 0.1],
    rotation: [0, Math.PI / 2 + 0.2, 0],
    scale: 0.72,
    interactionRadius: 1.05,
  },
  phone: {
    id: "phone",
    position: [3.45, 1.05, -2.25],
    rotation: [0, -0.2, 0],
    scale: 1,
    interactionRadius: 1.05,
  },
  calendar: {
    id: "calendar",
    position: [-5.88, 2.55, 0.9],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    interactionRadius: 1.25,
  },
  ball: {
    id: "ball",
    // glb는 반지름 1 구 — scale이 곧 반지름이라 y도 같은 값이어야 바닥에 닿는다
    position: [-5.1, 0.19, 3.75],
    rotation: [0, 0, 0],
    scale: 0.19,
    interactionRadius: 1.05,
  },
} as const satisfies Record<MemoryId, MemoryPlacement>;

export const CAMERA_PRESETS = {
  // room.target.y를 올리면 시선 중심이 위로 가면서 방이 화면 아래쪽으로 내려온다
  room: { position: [14.2, 10.4, 15.4], target: [0.8, 2.35, 1.2] },
  bat: { position: [-1.4, 3.0, 6.7], target: [-5.25, 0.8, 4.15] },
  window: { position: [4.7, 4.2, 2.1], target: [1.15, 2.4, -3.7] },
  frame: { position: [4.8, 2.6, 0.7], target: [2.15, 1.36, -2.55] },
  radio: { position: [-1.1, 2.5, 2.1], target: [-4.05, 1.31, 0.1] },
  phone: { position: [6.2, 2.6, 1.3], target: [3.45, 1.0, -2.25] },
  calendar: { position: [-1.1, 3.6, 3.2], target: [-5.75, 2.5, 0.9] },
  ball: { position: [-1.4, 2.1, 6.6], target: [-5.1, 0.19, 3.75] },
} as const satisfies Record<"room" | MemoryId, CameraPreset>;
