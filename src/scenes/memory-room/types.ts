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
  /** 이 거리 안에 서면 조사할 수 있다 (근접 판정·E 키). */
  interactionRadius: number;
  /**
   * 클릭을 받는 보이지 않는 구의 반지름. 비우면 interactionRadius와 같다.
   *
   * 둘을 갈라야 하는 물건이 있다. 다른 가구 위에 놓인 물건(침대 위의 폰)은 다가서는
   * 거리는 넓어야 하지만(콜라이더 밖에서 닿아야 하므로) 클릭 구까지 넓으면 그 가구를
   * 통째로 덮어, 침대를 눌러도 폰이 눌리고 폰이 잠겨 있으면 클릭이 그냥 사라진다.
   */
  hitRadius?: number;
}
