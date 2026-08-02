import { describe, expect, it } from "vitest";
import { ROOM_LIGHTING, shouldHighlightMemory } from "./visual-state";

describe("memory-room visual state", () => {
  it("highlights only an available memory within the player's interaction range", () => {
    expect(shouldHighlightMemory("available", "bat", "bat")).toBe(true);
    expect(shouldHighlightMemory("available", "bat", null)).toBe(false);
    expect(shouldHighlightMemory("available", "bat", "ball")).toBe(false);
    expect(shouldHighlightMemory("locked", "bat", "bat")).toBe(false);
    expect(shouldHighlightMemory("done", "bat", "bat")).toBe(false);
  });

  it("also highlights an available memory the mouse is hovering from anywhere", () => {
    expect(shouldHighlightMemory("available", "bat", null, true)).toBe(true);
    expect(shouldHighlightMemory("available", "bat", "ball", true)).toBe(true);
    // 클릭할 수 없는 기억은 호버해도 빛나지 않는다
    expect(shouldHighlightMemory("locked", "bat", null, true)).toBe(false);
    expect(shouldHighlightMemory("done", "bat", null, true)).toBe(false);
  });

  it("keeps the opening room readable and brightens later stages", () => {
    expect(ROOM_LIGHTING.ambient[0]).toBeGreaterThanOrEqual(2.2);
    expect(ROOM_LIGHTING.key[0]).toBeGreaterThanOrEqual(3.6);
    expect(ROOM_LIGHTING.ceilingFill).toBeGreaterThanOrEqual(26);
    expect(ROOM_LIGHTING.hemisphereFill).toBeGreaterThanOrEqual(1.2);

    for (const channel of [ROOM_LIGHTING.ambient, ROOM_LIGHTING.key, ROOM_LIGHTING.windowGlow]) {
      expect(channel[1]).toBeGreaterThanOrEqual(channel[0]);
      expect(channel[2]).toBeGreaterThanOrEqual(channel[1]);
    }
  });
});
