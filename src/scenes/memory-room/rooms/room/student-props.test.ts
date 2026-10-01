import { describe, expect, it } from "vitest";
import { ROOM_BOUNDS, ROOM_COLLIDERS } from "../../world/layout";
import { isWalkable, moveCircle } from "../../world/spatial";

describe("student bookshelf placement", () => {
  it("blocks walking through the bookshelf while keeping the aisle open", () => {
    const radius = 0.38;
    expect(isWalkable(6.4, -3.15, radius, [ROOM_BOUNDS], ROOM_COLLIDERS)).toBe(false);
    expect(isWalkable(6.4, -2.25, radius, [ROOM_BOUNDS], ROOM_COLLIDERS)).toBe(true);
    expect(
      moveCircle({ x: 6.4, z: -2.62 }, { x: 0, z: -0.12 }, radius, ROOM_BOUNDS, ROOM_COLLIDERS).z,
    ).toBe(-2.62);
  });
});
