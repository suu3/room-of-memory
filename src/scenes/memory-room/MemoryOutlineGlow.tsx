"use client";

import { EffectComposer, Outline } from "@react-three/postprocessing";
import {
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color, type Group, type Mesh, type Object3D } from "three";

type SelectionUpdater = (selection: Object3D[]) => void;

const MemoryGlowSelectionContext = createContext<SelectionUpdater | null>(null);

function hasSameSelection(previous: Object3D[], next: Object3D[]) {
  return (
    previous.length === next.length && previous.every((object, index) => object === next[index])
  );
}

function selectedMeshes(group: Group | null) {
  const meshes: Object3D[] = [];
  group?.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object);
  });
  return meshes;
}

export function createMemoryOutlineSettings(color: string) {
  return {
    edgeColor: new Color(color).getHex(),
    inner: { blur: false, edgeStrength: 2.5, resolutionScale: 1, xRay: false },
    outer: { blur: true, edgeStrength: 6, resolutionScale: 0.5, xRay: false },
  } as const;
}

export function MemoryGlowRoot({ color, children }: PropsWithChildren<{ color: string }>) {
  const settings = useMemo(() => createMemoryOutlineSettings(color), [color]);
  const [selection, setSelection] = useState<Object3D[]>([]);
  const updateSelection = useCallback<SelectionUpdater>((next) => {
    setSelection((previous) => (hasSameSelection(previous, next) ? previous : next));
  }, []);

  return (
    <MemoryGlowSelectionContext.Provider value={updateSelection}>
      {children}
      <EffectComposer autoClear={false} multisampling={2}>
        <Outline
          selection={selection}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.edgeColor}
          {...settings.inner}
        />
        <Outline
          selection={selection}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.edgeColor}
          {...settings.outer}
        />
      </EffectComposer>
    </MemoryGlowSelectionContext.Provider>
  );
}

function MemoryGlowVisualSelection({
  enabled,
  selectionVersion,
  children,
}: PropsWithChildren<{ enabled: boolean; selectionVersion: number }>) {
  const groupRef = useRef<Group>(null);
  const updateSelection = useContext(MemoryGlowSelectionContext);

  useLayoutEffect(() => {
    const hasVisibleVisual = selectionVersion >= 0;
    if (!enabled || !hasVisibleVisual || updateSelection === null) return;
    updateSelection(selectedMeshes(groupRef.current));
    return () => updateSelection([]);
  }, [enabled, selectionVersion, updateSelection]);

  return <group ref={groupRef}>{children}</group>;
}

export function MemoryGlowLayers({
  enabled,
  selectionVersion,
  visual,
  helpers,
}: {
  enabled: boolean;
  selectionVersion: number;
  visual: ReactNode;
  helpers: ReactNode;
}) {
  return (
    <group>
      <MemoryGlowVisualSelection enabled={enabled} selectionVersion={selectionVersion}>
        {visual}
      </MemoryGlowVisualSelection>
      {helpers}
    </group>
  );
}
