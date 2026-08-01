import { describe, expect, it } from "vitest";
import { MEMORY_IDS } from "@/data/memory-room";
import { CAMERA_PRESETS, MEMORY_PLACEMENTS, ROOM_BOUNDS, ROOM_COLLIDERS } from "./layout";

describe("memory-room layout", () => {
  it("places every memory exactly once and gives it a camera preset", () => {
    expect(Object.keys(MEMORY_PLACEMENTS).sort()).toEqual([...MEMORY_IDS].sort());
    for (const id of MEMORY_IDS) {
      expect(MEMORY_PLACEMENTS[id].id).toBe(id);
      expect(MEMORY_PLACEMENTS[id].interactionRadius).toBeGreaterThan(0);
      expect(CAMERA_PRESETS[id]).toBeDefined();
    }
  });

  it("defines valid room and obstacle bounds", () => {
    for (const bounds of [ROOM_BOUNDS, ...ROOM_COLLIDERS]) {
      expect(bounds.minX).toBeLessThan(bounds.maxX);
      expect(bounds.minZ).toBeLessThan(bounds.maxZ);
    }
  });
});
