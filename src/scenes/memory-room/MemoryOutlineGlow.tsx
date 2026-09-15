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
import { FilmAberrationDriver, prefersReducedMotion, useFilmLookEffects } from "./FilmLook";

/**
 * 빛나는 방식의 두 등급.
 *
 * - `memory`: 기억 오브젝트와 엔딩 배트. 또렷한 윤곽선 + 숨쉬는 헤일로가 겹치고,
 *   가구에 가려져도 벽 너머로 비친다. "이건 이야기다"라고 말하는 빛.
 * - `prop`: 서랍·의자·커튼·전등 스위치처럼 진행에 끼지 않는 곁가지. 윤곽선 한 줄만.
 *   "만져진다"까지만 말하고 이야기인 척하지 않는다.
 *
 * DESIGN.md에서 금빛은 "기억을 모을수록 화면에서 비중이 늘어나는 것"이 핵심 연출이라
 * 했다. 곁가지가 기억과 같은 세기로 타오르면 그 비중이 진행과 무관하게 늘 차 있어
 * 연출이 죽는다. 같은 색을 쓰되 등급으로 양을 가른다.
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
const KERNEL_SIZE_VERY_LARGE = 4;

/*
 * 아웃라인 패스는 **정확히 둘**이고, 둘은 서로 다른 selection 레이어를 쓴다.
 *
 * postprocessing의 Selection은 원래 인스턴스마다 다른 레이어를 자동으로 배정한다.
 * 그런데 @react-three/postprocessing의 <Outline> 래퍼가 selectionLayer 기본값을
 * 10으로 못박아 덮어써서, 패스를 둘 두면 둘 다 10번을 쓴다.
 *
 * OutlineEffect의 마스크 패스는 `camera.layers.set(layer)` 하나로 그릴 대상을
 * 고른다. 레이어가 겹치면 "누가 어느 선택에 들어 있는지"가 통째로 사라져서,
 * 곁가지를 넣은 적이 없는 헤일로 패스가 곁가지까지 같이 그린다. 그 패스는 xRay라
 * 커튼·서랍 윤곽이 벽과 가구를 뚫고 화면을 가로지르는 금빛 줄로 남는다. 커튼처럼
 * 큰 물건이 켜지는 순간(창문을 열었을 때)이 제일 크게 보인다.
 *
 * 겹친 레이어는 지우는 쪽도 망가뜨린다. 한 selection이 set/clear로 레이어를 끄면
 * 다른 selection이 아직 들고 있는 오브젝트까지 같이 꺼진다.
 *
 * 그래서 등급은 "패스를 더 주는" 방식이 아니라 "어느 패스에 태우느냐"로 가르고,
 * 그 가름이 실제로 지켜지도록 레이어를 갈라 둔다: 윤곽선은 둘 다 타고, 헤일로는
 * 기억만 탄다.
 */
const INNER_SELECTION_LAYER = 11;
const OUTER_SELECTION_LAYER = 12;

export function createMemoryOutlineSettings(color: string) {
  // 앰버가 밝아진 만큼(#D5AE78) 들어 올리는 폭을 줄인다. 더 올리면 윤곽이 흰 줄로 뜬다
  const edgeColor = new Color(color).offsetHSL(0, -0.05, 0.06).getHex();
  // 가려진 쪽 테두리는 한 단계 어둡게: 벽 너머까지 같은 밝기로 타오르지 않게 한다.
  const hiddenEdgeColor = new Color(color).offsetHSL(0, -0.12, -0.12).getHex();

  return {
    composer: { autoClear: false, multisampling: 2 },
    edgeColor,
    hiddenEdgeColor,
    // inner는 윤곽선, outer는 그 바깥으로 번지는 숨쉬는 광량: 둘 다 약하면 화면에서 안 보인다.
    inner: {
      blur: false,
      edgeStrength: 5,
      kernelSize: KERNEL_SIZE_SMALL,
      pulseSpeed: 0,
      resolutionScale: 1,
      selectionLayer: INNER_SELECTION_LAYER,
      xRay: false,
    },
    // xRay는 가구에 가려진 오브젝트도 은은하게 비쳐 보이게 해 근접 활성화를 읽히게 한다.
    // 바로 그래서 이 패스의 대상은 레이어로 확실히 갈라 둬야 한다. 곁가지가 여기
    // 섞이면 곁가지 윤곽이 방 전체를 뚫고 나온다.
    outer: {
      blur: true,
      edgeStrength: 8,
      kernelSize: KERNEL_SIZE_VERY_LARGE,
      pulseSpeed: 0.45,
      resolutionScale: 0.5,
      selectionLayer: OUTER_SELECTION_LAYER,
      xRay: true,
    },
  } as const;
}

export function MemoryGlowRoot({
  color,
  dim = 0,
  children,
}: PropsWithChildren<{
  color: string;
  /** 어둠의 양 (0 = 밝은 방, 1 = 가장 어두운 지점). 색수차가 이 축을 따라 조금 더 어긋난다. */
  dim?: number;
}>) {
  const settings = useMemo(() => createMemoryOutlineSettings(color), [color]);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const film = useFilmLookEffects(reducedMotion);
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

  // 윤곽선은 만질 수 있는 것 전부가 받는다. 헤일로는 아래에서 기억만 받는다.
  const touchable = useMemo(
    () => [...selection.memory, ...selection.prop],
    [selection.memory, selection.prop],
  );

  return (
    <MemoryGlowSelectionContext.Provider value={updateSelection}>
      {children}
      {/*
        패스 순서가 곧 그림의 층이다. 색수차는 convolution 이펙트라 제 패스를 혼자 쓰고,
        그 뒤의 아웃라인 둘과 그레인은 한 패스로 합쳐진다. 색수차를 맨 앞에 두는 이유:
        금빛 윤곽선은 어긋나지 않고 또렷해야 하고, 그레인은 어긋난 화면 위에 마지막으로
        뿌려져야 필름이다.
      */}
      <EffectComposer {...settings.composer}>
        <primitive object={film.aberration} />
        <Outline
          selection={touchable}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.hiddenEdgeColor}
          {...settings.inner}
        />
        {/* 숨쉬는 헤일로 + 벽 너머 투과는 기억만: 곁가지는 윤곽선 한 줄에서 멈춘다 */}
        <Outline
          selection={selection.memory}
          visibleEdgeColor={settings.edgeColor}
          hiddenEdgeColor={settings.hiddenEdgeColor}
          {...settings.outer}
        />
        <primitive object={film.grain} />
      </EffectComposer>
      <FilmAberrationDriver effect={film.aberration} dim={dim} reducedMotion={reducedMotion} />
    </MemoryGlowSelectionContext.Provider>
  );
}

/**
 * 안쪽 메시들을 아웃라인 글로우 선택 대상으로 등록한다.
 *
 * `tier`는 기본값을 두지 않는다. 새 오브젝트를 달 때 "이게 이야기인가 곁가지인가"를
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

/** 기억 오브젝트 전용 묶음: 판정용 헬퍼는 글로우 밖에 두고 시각 요소만 빛낸다. */
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
