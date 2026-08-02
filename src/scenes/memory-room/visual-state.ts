import type { MemoryId } from "@/data/memory-room";

type HighlightableStatus = "locked" | "available" | "done";

export const ROOM_LIGHTING = {
  ambient: [2.3, 2.5, 2.7],
  key: [3.8, 4.1, 4.4],
  windowGlow: [1.6, 1.9, 2.2],
  ceilingFill: 28,
  hemisphereFill: 1.25,
  /** 떠도는 먼지의 불투명도. 방이 밝아질수록 빛에 걸리는 먼지가 늘어난다. */
  dust: [0.3, 0.42, 0.55],
} as const;

/** 클릭 가능한(=available) 기억은 플레이어가 가까이 있거나 마우스를 올렸을 때 빛난다. */
export function shouldHighlightMemory(
  status: HighlightableStatus,
  id: MemoryId,
  nearbyMemoryId: MemoryId | null,
  hovered = false,
) {
  return status === "available" && (hovered || nearbyMemoryId === id);
}
