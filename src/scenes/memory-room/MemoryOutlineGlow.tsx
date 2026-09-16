"use client";

import { useFrame } from "@react-three/fiber";
import { EffectComposer, N8AO, Outline } from "@react-three/postprocessing";
import type { OutlineEffect } from "postprocessing";
import {
  Component,
  createContext,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color, type Group, type Mesh, type Object3D } from "three";
import { selectViewpoint, useMemoryRoomStore } from "@/store/memory-room";
import { cursorTarget, hoverGlowPulse } from "./cursor-target";
import { FilmLookDriver, prefersReducedMotion, useFilmLookEffects } from "./FilmLook";
import { ScreenTransitionDriver, useScreenTransitionEffect } from "./ScreenTransition";

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

/**
 * 호버가 켜지는 순간 윤곽선이 한 번 밝아진다. 커서의 링이 그 오브젝트로 빨려드는 것과
 * 같은 박자라, "커서가 물건의 빛으로 옮겨 갔다"로 읽힌다. 상시 펄스가 아니다. 켜지는
 * 순간 한 번뿐이고 0.6초 남짓이면 제 밝기로 돌아온다 (DESIGN.md > Motion).
 *
 * @param gain 꼭대기에서 더해지는 배율. 1이면 두 배.
 */
function GlowHoverPulse({
  effectRef,
  baseStrength,
  gain,
  reducedMotion,
}: {
  effectRef: RefObject<OutlineEffect | null>;
  baseStrength: number;
  gain: number;
  reducedMotion: boolean;
}) {
  useFrame(() => {
    const effect = effectRef.current;
    if (!effect) return;
    const pulse = reducedMotion ? 0 : hoverGlowPulse(performance.now(), cursorTarget.hoverAt);
    effect.edgeStrength = baseStrength * (1 + pulse * gain);
  });
  return null;
}

/** 호버 순간 윤곽선이 더해지는 배율 (GlowHoverPulse). 윤곽선은 세게, 헤일로는 은은하게. */
const HOVER_PULSE_GAIN = { inner: 1.2, outer: 0.5 } as const;

/**
 * 앰비언트 오클루전 (N8AO). 가구가 바닥·벽에 붙은 자리와 방 구석이 살짝 눌린다.
 * 디오라마의 물건들이 "놓여 있다"로 읽히게 하는 값이다. 반경은 방 크기(≈14유닛)의
 * 1/20쯤, 세기는 은은한 쪽. 절반 해상도로 돌려 모바일 예산을 지킨다.
 */
const AO_SETTINGS = {
  aoRadius: 0.6,
  distanceFalloff: 0.8,
  intensity: 1.8,
  aoSamples: 8,
  denoiseSamples: 4,
  denoiseRadius: 6,
} as const;

export function MemoryGlowRoot({
  color,
  dim = 0,
  ambientOcclusion,
  children,
}: PropsWithChildren<{
  color: string;
  /** 어둠의 양 (0 = 밝은 방, 1 = 가장 어두운 지점). 색수차가 이 축을 따라 조금 더 어긋난다. */
  dim?: number;
  /** 오클루전의 색. 주면 AO 패스를 켠다. 테스트의 가짜 렌더러에는 없다. */
  ambientOcclusion?: { color: string };
}>) {
  const aoColor = useMemo(
    () => (ambientOcclusion ? new Color(ambientOcclusion.color) : null),
    [ambientOcclusion],
  );
  const settings = useMemo(() => createMemoryOutlineSettings(color), [color]);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const film = useFilmLookEffects(reducedMotion);
  const transition = useScreenTransitionEffect();
  const innerRef = useRef<OutlineEffect | null>(null);
  const outerRef = useRef<OutlineEffect | null>(null);
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
        {/*
          children 타입이 null을 받지 않아 배열로 짠다. 순서가 곧 층이다.
          AO는 장면을 그리는 패스라 맨 앞. 색수차는 convolution이라 제 패스를 혼자 쓴다.
          아웃라인 둘과 그레인은 한 패스로 합쳐진다. 화면 전환은 맨 마지막: 그레인까지
          얹힌 화면이 통째로 넘어간다.
        */}
        {[
          ...(aoColor
            ? [<N8AO key="ao" halfRes quality="performance" color={aoColor} {...AO_SETTINGS} />]
            : []),
          <primitive key="aberration" object={film.aberration} />,
          <Outline
            key="inner"
            ref={innerRef}
            selection={touchable}
            visibleEdgeColor={settings.edgeColor}
            hiddenEdgeColor={settings.hiddenEdgeColor}
            {...settings.inner}
          />,
          // 숨쉬는 헤일로 + 벽 너머 투과는 기억만: 곁가지는 윤곽선 한 줄에서 멈춘다
          <Outline
            key="outer"
            ref={outerRef}
            selection={selection.memory}
            visibleEdgeColor={settings.edgeColor}
            hiddenEdgeColor={settings.hiddenEdgeColor}
            {...settings.outer}
          />,
          <primitive key="grain" object={film.grain} />,
          <primitive key="transition" object={transition} />,
        ]}
      </EffectComposer>
      <ScreenTransitionDriver effect={transition} reducedMotion={reducedMotion} />
      <FilmLookDriver effects={film} dim={dim} reducedMotion={reducedMotion} />
      <GlowHoverPulse
        effectRef={innerRef}
        baseStrength={settings.inner.edgeStrength}
        gain={HOVER_PULSE_GAIN.inner}
        reducedMotion={reducedMotion}
      />
      <GlowHoverPulse
        effectRef={outerRef}
        baseStrength={settings.outer.edgeStrength}
        gain={HOVER_PULSE_GAIN.outer}
        reducedMotion={reducedMotion}
      />
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
  inFirstPerson = "mute",
  children,
}: PropsWithChildren<{
  selectionKey: string;
  tier: MemoryGlowTier;
  enabled: boolean;
  selectionVersion?: number;
  /**
   * 등 뒤 시점 구간(인트로·문 넘기)에서도 빛나는가. 기본은 "mute": 어둠 속에서 할 일은
   * 하나뿐이라 그것만 빛나야 찾는 게 된다. 전등 스위치만 "keep"이다.
   */
  inFirstPerson?: "keep" | "mute";
}>) {
  const groupRef = useRef<Group>(null);
  const updateSelection = useContext(MemoryGlowSelectionContext);
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  const active = enabled && (inFirstPerson === "keep" || !firstPerson);

  useLayoutEffect(() => {
    // This value is a refresh token: replacements re-traverse the mounted visual without gating it.
    void selectionVersion;
    if (!active || updateSelection === null) return;
    updateSelection(tier, selectionKey, selectedMeshes(groupRef.current));
    return () => updateSelection(tier, selectionKey, null);
  }, [active, selectionKey, selectionVersion, tier, updateSelection]);

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
