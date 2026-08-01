import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createMemoryOutlineSettings, MemoryGlowLayers } from "./MemoryOutlineGlow";

describe("memory outline glow", () => {
  it("derives an occluded crisp-inner and soft-outer glow from the memory color", () => {
    const settings = createMemoryOutlineSettings("#b89a5e");

    expect(settings.edgeColor).toBe(0xb89a5e);
    expect(settings.inner).toMatchObject({ blur: false, resolutionScale: 1, xRay: false });
    expect(settings.outer).toMatchObject({ blur: true, resolutionScale: 0.5, xRay: false });
    expect(settings.outer.edgeStrength).toBeGreaterThan(settings.inner.edgeStrength);
    expect(settings).toHaveProperty("composer.autoClear", false);
    expect(settings).toHaveProperty("composer.multisampling", 2);
  });

  it("isolates the selected visual from helper geometry", () => {
    const visual = {} as ReactNode;
    const helpers = {} as ReactNode;

    const layer = MemoryGlowLayers({ enabled: true, selectionVersion: 1, visual, helpers });

    expect(layer.type).toBe("group");
    expect(layer.props.children[0].props.selectionVersion).toBe(1);
    expect(layer.props.children[0].props.children).toBe(visual);
    expect(layer.props.children[1]).toBe(helpers);
  });
});
