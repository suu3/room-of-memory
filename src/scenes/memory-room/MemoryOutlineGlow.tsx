"use client";

import { EffectComposer, Outline } from "@react-three/postprocessing";
import {
  Component,
  createContext,
  type PropsWithChildren,
  type ReactNode,
  Suspense,
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

export type MemoryGlowContentKind = "suspense-fallback" | "error-fallback" | "model";

type MemoryGlowVisibleContentProps = PropsWithChildren<{
  kind: MemoryGlowContentKind;
  onVisible: (kind: MemoryGlowContentKind) => void;
}>;

function MemoryGlowVisibleContent({ kind, onVisible, children }: MemoryGlowVisibleContentProps) {
  useLayoutEffect(() => {
    onVisible(kind);
  }, [kind, onVisible]);
  return children;
}

class MemoryGlowErrorBoundary extends Component<
  PropsWithChildren<{ fallback: ReactNode }>,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MemoryGlowVisualBoundary({
  fallback,
  onVisible,
  children,
}: PropsWithChildren<{
  fallback: ReactNode;
  onVisible: (kind: MemoryGlowContentKind) => void;
}>) {
  return (
    <MemoryGlowErrorBoundary
      fallback={
        <MemoryGlowVisibleContent kind="error-fallback" onVisible={onVisible}>
          {fallback}
        </MemoryGlowVisibleContent>
      }
    >
      <Suspense
        fallback={
          <MemoryGlowVisibleContent kind="suspense-fallback" onVisible={onVisible}>
            {fallback}
          </MemoryGlowVisibleContent>
        }
      >
        <MemoryGlowVisibleContent kind="model" onVisible={onVisible}>
          {children}
        </MemoryGlowVisibleContent>
      </Suspense>
    </MemoryGlowErrorBoundary>
  );
}

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
  const edgeColor = new Color(color).offsetHSL(0, -0.08, 0.16).getHex();

  return {
    composer: { autoClear: false, multisampling: 2 },
    edgeColor,
    inner: { blur: false, edgeStrength: 1.2, resolutionScale: 1, xRay: false },
    outer: { blur: true, edgeStrength: 2.4, resolutionScale: 0.75, xRay: false },
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
      <EffectComposer {...settings.composer}>
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
    // This value is a refresh token: replacements re-traverse the mounted visual without gating it.
    void selectionVersion;
    if (!enabled || updateSelection === null) return;
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
