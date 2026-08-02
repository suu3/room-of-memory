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

/** 여러 오브젝트가 동시에 빛날 수 있으므로 선택은 키별로 등록하고 루트가 합친다. */
type SelectionUpdater = (key: string, selection: Object3D[] | null) => void;

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

/** postprocessing의 KernelSize 열거값. 패키지가 직접 의존성이 아니라 숫자로 고정한다. */
const KERNEL_SIZE_SMALL = 1;
const KERNEL_SIZE_VERY_LARGE = 4;

export function createMemoryOutlineSettings(color: string) {
  const edgeColor = new Color(color).offsetHSL(0, -0.08, 0.16).getHex();
  // 가려진 쪽 테두리는 한 단계 어둡게 — 벽 너머까지 같은 밝기로 타오르지 않게 한다.
  const hiddenEdgeColor = new Color(color).offsetHSL(0, -0.12, -0.12).getHex();

  return {
    composer: { autoClear: false, multisampling: 2 },
    edgeColor,
    hiddenEdgeColor,
    // inner는 윤곽선, outer는 그 바깥으로 번지는 숨쉬는 광량 — 둘 다 약하면 화면에서 안 보인다.
    inner: {
      blur: false,
      edgeStrength: 5,
      kernelSize: KERNEL_SIZE_SMALL,
      pulseSpeed: 0,
      resolutionScale: 1,
      xRay: false,
    },
    // xRay는 가구에 가려진 오브젝트도 은은하게 비쳐 보이게 해 근접 활성화를 읽히게 한다.
    outer: {
      blur: true,
      edgeStrength: 11,
      kernelSize: KERNEL_SIZE_VERY_LARGE,
      pulseSpeed: 0.45,
      resolutionScale: 0.5,
      xRay: true,
    },
  } as const;
}

export function MemoryGlowRoot({ color, children }: PropsWithChildren<{ color: string }>) {
  const settings = useMemo(() => createMemoryOutlineSettings(color), [color]);
  const groupsRef = useRef(new Map<string, Object3D[]>());
  const [selection, setSelection] = useState<Object3D[]>([]);
  const updateSelection = useCallback<SelectionUpdater>((key, next) => {
    const groups = groupsRef.current;
    if (next === null || next.length === 0) {
      if (!groups.delete(key)) return;
    } else {
      groups.set(key, next);
    }
    const merged = [...groups.values()].flat();
    setSelection((previous) => (hasSameSelection(previous, merged) ? previous : merged));
  }, []);

  return (
    <MemoryGlowSelectionContext.Provider value={updateSelection}>
      {children}
      <EffectComposer {...settings.composer}>
        <Outline
          selection={selection}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.hiddenEdgeColor}
          {...settings.inner}
        />
        <Outline
          selection={selection}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.hiddenEdgeColor}
          {...settings.outer}
        />
      </EffectComposer>
    </MemoryGlowSelectionContext.Provider>
  );
}

/**
 * 안쪽 메시들을 아웃라인 글로우 선택 대상으로 등록한다.
 * 클릭 가능한 오브젝트면 기억이든 가구든 전부 이걸로 같은 이펙트를 받는다.
 */
export function MemoryGlowSelection({
  selectionKey,
  enabled,
  selectionVersion = 0,
  children,
}: PropsWithChildren<{ selectionKey: string; enabled: boolean; selectionVersion?: number }>) {
  const groupRef = useRef<Group>(null);
  const updateSelection = useContext(MemoryGlowSelectionContext);

  useLayoutEffect(() => {
    // This value is a refresh token: replacements re-traverse the mounted visual without gating it.
    void selectionVersion;
    if (!enabled || updateSelection === null) return;
    updateSelection(selectionKey, selectedMeshes(groupRef.current));
    return () => updateSelection(selectionKey, null);
  }, [enabled, selectionKey, selectionVersion, updateSelection]);

  return <group ref={groupRef}>{children}</group>;
}

export function MemoryGlowLayers({
  selectionKey,
  enabled,
  selectionVersion,
  visual,
  helpers,
}: {
  selectionKey: string;
  enabled: boolean;
  selectionVersion: number;
  visual: ReactNode;
  helpers: ReactNode;
}) {
  return (
    <group>
      <MemoryGlowSelection
        selectionKey={selectionKey}
        enabled={enabled}
        selectionVersion={selectionVersion}
      >
        {visual}
      </MemoryGlowSelection>
      {helpers}
    </group>
  );
}
