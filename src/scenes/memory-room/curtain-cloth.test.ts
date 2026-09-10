import { describe, expect, it } from "vitest";
import { createCurtainCloth } from "./curtain-cloth";
import { CURTAIN_X } from "./curtain-motion";

describe("curtain cloth", () => {
  for (const side of ["left", "right"] as const) {
    it(`${side} keeps the outer hanging edge fixed while gathering clear of the window`, () => {
      const geometry = createCurtainCloth(side);
      const closed = geometry.getAttribute("position");
      const open = geometry.morphAttributes.position?.[0];
      if (!open) throw new Error("Missing gathered cloth positions");
      const xs = (attribute: typeof closed) =>
        Array.from({ length: attribute.count }, (_, index) => attribute.getX(index));
      const closedX = xs(closed);
      const openX = xs(open);
      const outer = side === "left" ? Math.min : Math.max;
      expect(outer(...closedX) + CURTAIN_X[side].closed).toBeCloseTo(
        outer(...openX) + CURTAIN_X[side].open,
        3,
      );
      if (side === "left") {
        expect(Math.max(...closedX) + CURTAIN_X.left.closed).toBeGreaterThanOrEqual(1.15);
        expect(Math.max(...openX) + CURTAIN_X.left.open).toBeLessThan(-0.27);
      } else {
        expect(Math.min(...closedX) + CURTAIN_X.right.closed).toBeLessThanOrEqual(1.15);
        expect(Math.min(...openX) + CURTAIN_X.right.open).toBeGreaterThan(2.57);
      }
      geometry.dispose();
    });
  }

  it("has real non-planar folds, valid morph normals and a bounded mesh budget", () => {
    const geometry = createCurtainCloth("left");
    const closed = geometry.getAttribute("position");
    const depth = Array.from({ length: closed.count }, (_, i) => closed.getZ(i));
    expect(Math.max(...depth) - Math.min(...depth)).toBeGreaterThan(0.15);
    expect(Math.min(...depth) - 3.72).toBeGreaterThan(-3.91);
    expect(geometry.index?.count ?? 0).toBeLessThanOrEqual(15_000);
    expect(geometry.morphAttributes.normal?.[0]?.count).toBe(closed.count);
    for (const attribute of [
      closed,
      ...(geometry.morphAttributes.position ?? []),
      ...(geometry.morphAttributes.normal ?? []),
    ]) {
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
    geometry.dispose();
  });
});
