import { describe, expect, it } from "vitest";
import { CURTAIN_X, curtainTargetX } from "./curtain-motion";

describe("curtain motion", () => {
  it("starts with two panels meeting at the center of the window", () => {
    expect(curtainTargetX("left", false)).toBe(CURTAIN_X.left.closed);
    expect(curtainTargetX("right", false)).toBe(CURTAIN_X.right.closed);
    expect((CURTAIN_X.left.closed + CURTAIN_X.right.closed) / 2).toBeCloseTo(1.15);
  });

  it("moves each panel away from the window center when opened", () => {
    expect(curtainTargetX("left", true)).toBeLessThan(CURTAIN_X.left.closed);
    expect(curtainTargetX("right", true)).toBeGreaterThan(CURTAIN_X.right.closed);
  });
});
