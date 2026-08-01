import { describe, expect, it } from "vitest";
import { findNearestMemory, moveCircle, normalizeMovement } from "./spatial";

describe("normalizeMovement", () => {
  it("keeps diagonal movement at unit length", () => {
    expect(normalizeMovement({ x: 1, z: 1 })).toEqual({
      x: Math.SQRT1_2,
      z: Math.SQRT1_2,
    });
  });
});

describe("moveCircle", () => {
  const room = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const obstacle = { minX: 0.5, maxX: 1.5, minZ: -0.5, maxZ: 0.5 };

  it("clamps to room bounds and slides on obstacle axes", () => {
    expect(moveCircle({ x: 1.8, z: 0 }, { x: 1, z: 0 }, 0.2, room, [])).toEqual({
      x: 1.8,
      z: 0,
    });
    expect(moveCircle({ x: 0, z: 0 }, { x: 0.8, z: 0.4 }, 0.2, room, [obstacle])).toEqual({
      x: 0,
      z: 0.4,
    });
  });
});

describe("findNearestMemory", () => {
  it("ignores locked and out-of-range targets", () => {
    const targets = [
      { id: "bat" as const, position: [0, 0, 0] as const, interactionRadius: 1 },
      { id: "ball" as const, position: [0.5, 0, 0] as const, interactionRadius: 1 },
    ];
    expect(findNearestMemory({ x: 0, z: 0 }, targets, (id) => id === "ball")).toBe("ball");
    expect(findNearestMemory({ x: 3, z: 0 }, targets, () => true)).toBeNull();
  });
});
