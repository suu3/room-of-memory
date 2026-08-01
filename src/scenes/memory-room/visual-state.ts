import type { MemoryId } from "@/data/memory-room";

type HighlightableStatus = "locked" | "available" | "done";

export const ROOM_LIGHTING = {
  ambient: [2.3, 2.5, 2.7],
  key: [3.8, 4.1, 4.4],
  windowGlow: [1.6, 1.9, 2.2],
  ceilingFill: 28,
  hemisphereFill: 1.25,
} as const;

export function shouldHighlightMemory(
  status: HighlightableStatus,
  id: MemoryId,
  nearbyMemoryId: MemoryId | null,
) {
  return status === "available" && nearbyMemoryId === id;
}
