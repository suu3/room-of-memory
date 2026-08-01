import { describe, expect, it } from "vitest";
import { createMemoryOutlineSettings } from "./MemoryOutlineGlow";

describe("memory outline glow", () => {
  it("derives an occluded crisp-inner and soft-outer glow from the memory color", () => {
    const settings = createMemoryOutlineSettings("#b89a5e");

    expect(settings.edgeColor).toBe(0xb89a5e);
    expect(settings.inner).toMatchObject({ blur: false, resolutionScale: 1, xRay: false });
    expect(settings.outer).toMatchObject({ blur: true, resolutionScale: 0.5, xRay: false });
    expect(settings.outer.edgeStrength).toBeGreaterThan(settings.inner.edgeStrength);
  });
});
