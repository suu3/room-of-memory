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

/**
 * 빛나는 방식의 두 등급.
 *
 * - `memory` — 기억 오브젝트와 엔딩 배트. 또렷한 윤곽선 + 숨쉬는 헤일로가 겹치고,
 *   가구에 가려져도 벽 너머로 비친다. "이건 이야기다"라고 말하는 빛.
 * - `prop` — 서랍·의자·커튼·전등 스위치처럼 진행에 끼지 않는 곁가지. 번짐 한 겹만
 *   은은하게. "만져진다"까지만 말하고 이야기인 척하지 않는다.
 *
 * DESIGN.md에서 금빛은 "기억을 모을수록 화면에서 비중이 늘어나는 것"이 핵심 연출이라
 * 했다. 곁가지가 기억과 같은 세기로 타오르면 그 비중이 진행과 무관하게 늘 차 있어
 * 연출이 죽는다 — 같은 색을 쓰되 등급으로 양을 가른다.
 */
export type MemoryGlowTier = "memory" | "prop";

type TierSelection = Record<MemoryGlowTier, Object3D[]>;

/** 여러 오브젝트가 동시에 빛날 수 있으므로 선택은 등급·키별로 등록하고 루트가 합친다. */
type SelectionUpdater = (tier: MemoryGlowTier, key: string, selection: Object3D[] | null) => void;

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
const KERNEL_SIZE_MEDIUM = 2;
const KERNEL_SIZE_VERY_LARGE = 4;

export function createMemoryOutlineSettings(color: string) {
  const edgeColor = new Color(color).offsetHSL(0, -0.08, 0.16).getHex();
  // 가려진 쪽 테두리는 한 단계 어둡게 — 벽 너머까지 같은 밝기로 타오르지 않게 한다.
  const hiddenEdgeColor = new Color(color).offsetHSL(0, -0.12, -0.12).getHex();
  /*
   * 곁가지의 빛. 색상(hue)은 기억과 같은 금빛을 유지한다 — 색을 갈라 버리면
   * "만질 수 있다"는 신호가 두 갈래로 읽혀서, 어느 쪽이 만져지는 건지 매번 배워야 한다.
   * 채도와 밝기만 낮춰서 같은 말을 작은 목소리로 하게 둔다.
   */
  const propEdgeColor = new Color(color).offsetHSL(0, -0.24, -0.02).getHex();

  return {
    composer: { autoClear: false, multisampling: 2 },
    edgeColor,
    hiddenEdgeColor,
    propEdgeColor,
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
    /*
     * 곁가지는 이 한 겹이 전부다. 기억과 갈리는 지점이 셋이다.
     *
     * 1. 또렷한 윤곽선(inner)이 없다 — 선이 아니라 번짐이라 "조준할 것"이 아니라
     *    "거기 있는 것"으로 읽힌다.
     * 2. pulseSpeed 0 — 숨쉬지 않는다. 움직이는 빛은 시선을 끌어당기는데, 그 몫은
     *    기억이 가져가야 한다.
     * 3. xRay false — 벽이나 가구에 가리면 그냥 가린다. 곁가지를 찾아 방을 헤맬
     *    이유는 없다.
     *
     * 패스가 하나 늘어나는 값은 치른다. resolutionScale을 반으로 낮추고 커널도
     * 중간 크기로 잡아 outer보다 싸게 굴린다.
     */
    prop: {
      blur: true,
      edgeStrength: 3,
      kernelSize: KERNEL_SIZE_MEDIUM,
      pulseSpeed: 0,
      resolutionScale: 0.5,
      xRay: false,
    },
  } as const;
}

export function MemoryGlowRoot({ color, children }: PropsWithChildren<{ color: string }>) {
  const settings = useMemo(() => createMemoryOutlineSettings(color), [color]);
  const groupsRef = useRef<Record<MemoryGlowTier, Map<string, Object3D[]>>>({
    memory: new Map(),
    prop: new Map(),
  });
  const [selection, setSelection] = useState<TierSelection>(() => ({ memory: [], prop: [] }));
  const updateSelection = useCallback<SelectionUpdater>((tier, key, next) => {
    const groups = groupsRef.current[tier];
    if (next === null || next.length === 0) {
      if (!groups.delete(key)) return;
    } else {
      groups.set(key, next);
    }
    const merged = [...groups.values()].flat();
    setSelection((previous) =>
      hasSameSelection(previous[tier], merged) ? previous : { ...previous, [tier]: merged },
    );
  }, []);

  return (
    <MemoryGlowSelectionContext.Provider value={updateSelection}>
      {children}
      {/*
        패스 순서 = 등급 순서. 기억은 윤곽선 위에 헤일로가 겹쳐 두 겹으로 타오르고,
        곁가지는 마지막 한 겹만 은은하게 받는다.
      */}
      <EffectComposer {...settings.composer}>
        <Outline
          selection={selection.memory}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.hiddenEdgeColor}
          {...settings.inner}
        />
        <Outline
          selection={selection.memory}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.hiddenEdgeColor}
          {...settings.outer}
        />
        <Outline
          selection={selection.prop}
          visibleEdgeColor={settings.propEdgeColor}
          // 가려진 쪽을 따로 두지 않는다 — xRay가 꺼져 있어 벽 너머는 아예 안 그린다.
          hiddenEdgeColor={settings.propEdgeColor}
          {...settings.prop}
        />
      </EffectComposer>
    </MemoryGlowSelectionContext.Provider>
  );
}

/**
 * 안쪽 메시들을 아웃라인 글로우 선택 대상으로 등록한다.
 *
 * `tier`는 기본값을 두지 않는다 — 새 오브젝트를 달 때 "이게 이야기인가 곁가지인가"를
 * 한 번은 정하게 만드는 자리다. 빠뜨리면 조용히 기억처럼 타오르는 쪽이 더 나쁘다.
 */
export function MemoryGlowSelection({
  selectionKey,
  tier,
  enabled,
  selectionVersion = 0,
  children,
}: PropsWithChildren<{
  selectionKey: string;
  tier: MemoryGlowTier;
  enabled: boolean;
  selectionVersion?: number;
}>) {
  const groupRef = useRef<Group>(null);
  const updateSelection = useContext(MemoryGlowSelectionContext);

  useLayoutEffect(() => {
    // This value is a refresh token: replacements re-traverse the mounted visual without gating it.
    void selectionVersion;
    if (!enabled || updateSelection === null) return;
    updateSelection(tier, selectionKey, selectedMeshes(groupRef.current));
    return () => updateSelection(tier, selectionKey, null);
  }, [enabled, selectionKey, selectionVersion, tier, updateSelection]);

  return <group ref={groupRef}>{children}</group>;
}

/** 기억 오브젝트 전용 묶음 — 판정용 헬퍼는 글로우 밖에 두고 시각 요소만 빛낸다. */
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
        tier="memory"
        enabled={enabled}
        selectionVersion={selectionVersion}
      >
        {visual}
      </MemoryGlowSelection>
      {helpers}
    </group>
  );
}
