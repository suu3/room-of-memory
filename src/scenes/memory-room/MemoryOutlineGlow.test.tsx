import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createMemoryOutlineSettings, MemoryGlowLayers, MemoryGlowRoot } from "./MemoryOutlineGlow";

vi.mock("@react-three/postprocessing", () => ({
  EffectComposer: ({ autoClear, children }: { autoClear?: boolean; children: ReactNode }) => (
    <div data-auto-clear={String(autoClear)}>{children}</div>
  ),
  Outline: () => null,
}));

describe("memory outline glow", () => {
  it("derives an occluded crisp-inner and soft-outer glow from the memory color", () => {
    const settings = createMemoryOutlineSettings("#b89a5e");

    expect(settings.edgeColor).toBe(0xb89a5e);
    expect(settings.inner).toMatchObject({ blur: false, resolutionScale: 1, xRay: false });
    expect(settings.outer).toMatchObject({ blur: true, resolutionScale: 0.5, xRay: false });
    expect(settings.outer.edgeStrength).toBeGreaterThan(settings.inner.edgeStrength);
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

  it("preserves the outline mask clear before rendering the selected geometry", () => {
    const markup = renderToStaticMarkup(<MemoryGlowRoot color="#b89a5e" />);

    expect(markup).toContain('data-auto-clear="false"');
  });
});
