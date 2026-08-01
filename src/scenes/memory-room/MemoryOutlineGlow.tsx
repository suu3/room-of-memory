"use client";

import { EffectComposer, Outline, Select, Selection } from "@react-three/postprocessing";
import { type PropsWithChildren, type ReactNode, useMemo } from "react";
import { Color } from "three";

export function createMemoryOutlineSettings(color: string) {
  return {
    edgeColor: new Color(color).getHex(),
    inner: { blur: false, edgeStrength: 2.5, resolutionScale: 1, xRay: false },
    outer: { blur: true, edgeStrength: 6, resolutionScale: 0.5, xRay: false },
  } as const;
}

export function MemoryGlowRoot({ color, children }: PropsWithChildren<{ color: string }>) {
  const settings = useMemo(() => createMemoryOutlineSettings(color), [color]);

  return (
    <Selection>
      {children}
      <EffectComposer multisampling={2}>
        <Outline
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.edgeColor}
          {...settings.inner}
        />
        <Outline
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.edgeColor}
          {...settings.outer}
        />
      </EffectComposer>
    </Selection>
  );
}

export function MemoryGlowLayers({
  enabled,
  visual,
  helpers,
}: {
  enabled: boolean;
  visual: ReactNode;
  helpers: ReactNode;
}) {
  return (
    <>
      <Select enabled={enabled}>{visual}</Select>
      {helpers}
    </>
  );
}
