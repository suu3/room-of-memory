"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, EffectGroup, N8AO, Outline } from "@react-three/postprocessing";
import { GodRaysEffect, KernelSize, type OutlineEffect, TiltShiftEffect } from "postprocessing";
import {
  Component,
  createContext,
  type MutableRefObject,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color, type Group, MathUtils, type Mesh, type Object3D } from "three";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { selectAct, selectViewpoint, useMemoryRoomStore } from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { AfterimagePass } from "./AfterimagePass";
import { afterimageDamp, movementSpeed } from "./afterimage";
import { cursorTarget, hoverGlowPulse } from "./cursor-target";
import { endingLight } from "./ending-light";
import { FilmLookDriver, prefersReducedMotion, useFilmLookEffects } from "./FilmLook";
import { ScreenTransitionDriver, useScreenTransitionEffect } from "./ScreenTransition";
import { tiltFocus } from "./tilt-focus";

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

/**
 * 손가락으로 노는 기기인가 (usePointerKind와 같은 질의). 이 컴포넌트는 캔버스 안에서만
 * 도니 첫 렌더부터 브라우저다: 마운트 뒤에 판정이 바뀌어 컴포저를 한 번 더 세우지 않도록
 * 여기서 바로 묻는다.
 */
function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

export function createMemoryOutlineSettings(color: string, { touch = false } = {}) {
  // 앰버가 밝아진 만큼(#D5AE78) 들어 올리는 폭을 줄인다. 더 올리면 윤곽이 흰 줄로 뜬다
  const edgeColor = new Color(color).offsetHSL(0, -0.05, 0.06).getHex();
  // 가려진 쪽 테두리는 한 단계 어둡게: 벽 너머까지 같은 밝기로 타오르지 않게 한다.
  const hiddenEdgeColor = new Color(color).offsetHSL(0, -0.12, -0.12).getHex();

  return {
    /*
     * stencilBuffer는 스텐실을 쓰려는 게 아니라 깊이 블릿의 포맷을 맞추려는 것이다. postprocessing
     * 6.39는 패스마다 입력 버퍼에만 깊이 텍스처(FloatType)를 붙였다 떼며 두 버퍼를 맞바꾸는데,
     * three r185는 그때 해상(resolve) FBO의 깊이만 다시 붙이고 MSAA 깊이 렌더버퍼는 처음 할당한
     * 포맷(32F)으로 둔다. 텍스처가 떼어진 차례에 해상 쪽이 24비트 렌더버퍼가 되어 MSAA 해상
     * 블릿이 "Depth/stencil buffer format combination not allowed"로 거부됐다 (프레임마다 경고).
     * 스텐실이 있으면 깊이 텍스처도 빈 상태의 렌더버퍼도 DEPTH24_STENCIL8로 같아져 블릿이 맞는다.
     * (6.39.2 기준. 6.39.5부터는 두 버퍼가 각자 깊이 텍스처를 늘 들고 있어 붙였다 떼는 교대가
     * 없다. 스텐실은 그대로 둔다: 깊이 포맷이 한 가지로 맞아 있으면 해가 없다.)
     */
    /*
     * MSAA는 터치 기기에서 끈다. 아이폰 Safari에서 윤곽선과 헤일로가 프레임마다 켜졌다
     * 꺼졌다 했다 (2026-09-28, 문제집·의자·에어컨이 서로 따로 깜빡였다). 데스크톱 크로미움에서는
     * 재현되지 않는다. 윤곽선의 가림 판정은 컴포저의 깊이 텍스처를 읽는데, MSAA가 켜져
     * 있으면 그 깊이가 프레임마다 해상(resolve) 블릿 → 안정 깊이 블릿 두 번을 거쳐 온다.
     * 그 경로를 통째로 뺀다. 폰 화면은 배율이 높아 MSAA 없이도 모서리가 거칠지 않다.
     */
    composer: { autoClear: false, multisampling: touch ? 0 : 2, stencilBuffer: true },
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

/**
 * 틸트 시프트 (docs/visual-experiments.md 6장). 화면 가운데 가로 띠만 초점이고 위아래가
 * 흐려져 방이 디오라마로 읽힌다. 수치는 tilt-focus.ts. 인스턴스를 직접 들고 값만 미는
 * 이유는 FilmLook과 같다: 래퍼는 프롭이 바뀌면 이펙트를 새로 만든다.
 *
 * postprocessing 본판의 TiltShiftEffect를 쓴다 (래퍼의 TiltShift2가 아니다). 본판은 반해상도
 * Kawase 블러라 상하좌우로 고르게 뭉개지고, 띠를 offset·focusArea·feather로 받는다. 래퍼 판은
 * 한 방향 스트릭 블러이고 `start`·`end`가 띠의 위아래가 아니라 초점선의 두 점이라, 띠의 위아래를
 * 넣었더니 왼쪽 가장자리를 지나는 세로선이 되어 화면 전체가 흐려졌다 (tilt-focus.ts 주석).
 */
function useTiltShiftEffect() {
  const effect = useMemo(() => {
    const initial = tiltFocus(1, false);
    const tilt = new TiltShiftEffect({
      offset: initial.offset,
      rotation: 0,
      focusArea: initial.focusArea,
      feather: initial.feather,
      kernelSize: KernelSize.MEDIUM,
      // 아웃라인 outer와 같은 반해상도. 흐려질 그림이라 해상도가 아깝지 않다
      resolutionScale: 0.5,
    });
    tilt.blurPass.scale = initial.blurScale;
    return tilt;
  }, []);
  useEffect(() => () => effect.dispose(), [effect]);
  return effect;
}

/** 초점 띠가 막과 앉기를 따라간다. 띠가 내려앉는 데 1초쯤: 앉는 동작과 같은 호흡이다. */
const TILT_LAMBDA = 3;
/** 이보다 작은 변화는 setter를 부르지 않는다. setter마다 maskParams를 다시 계산한다. */
const TILT_EPSILON = 1e-4;

function TiltShiftDriver({ effect }: { effect: TiltShiftEffect }) {
  const act = useMemoryRoomStore(selectAct);
  const seated = useMemoryRoomStore((state) => state.seatedAt !== null);
  /** damp로 굴리는 본값. 이펙트의 getter를 매 프레임 읽지 않으려고 따로 든다. */
  const current = useRef(tiltFocus(1, false));
  // 목표는 막·앉음이 바뀔 때만 새로 센다. 프레임마다 만들면 그만큼 쓰레기다
  const goal = useMemo(() => tiltFocus(act, seated), [act, seated]);

  useFrame((_, delta) => {
    const value = current.current;
    const offset = MathUtils.damp(value.offset, goal.offset, TILT_LAMBDA, delta);
    const focusArea = MathUtils.damp(value.focusArea, goal.focusArea, TILT_LAMBDA, delta);
    const feather = MathUtils.damp(value.feather, goal.feather, TILT_LAMBDA, delta);
    const blurScale = MathUtils.damp(value.blurScale, goal.blurScale, TILT_LAMBDA, delta);
    if (Math.abs(offset - value.offset) > TILT_EPSILON) effect.offset = offset;
    if (Math.abs(focusArea - value.focusArea) > TILT_EPSILON) effect.focusArea = focusArea;
    if (Math.abs(feather - value.feather) > TILT_EPSILON) effect.feather = feather;
    if (Math.abs(blurScale - value.blurScale) > TILT_EPSILON) effect.blurPass.scale = blurScale;
    value.offset = offset;
    value.focusArea = focusArea;
    value.feather = feather;
    value.blurScale = blurScale;
  });
  return null;
}

/**
 * 1인칭 구간의 잔상 (docs/visual-experiments.md 11장). 패스는 AfterimagePass, 양은 afterimage.ts.
 * 걷는 입력의 크기가 damp를 정한다. 몸이 서면 잔상도 몇 프레임 안에 걷힌다.
 */
function useAfterimagePass(active: boolean) {
  const pass = useMemo(() => (active ? new AfterimagePass() : null), [active]);
  useEffect(() => () => pass?.dispose(), [pass]);
  return pass;
}

function AfterimageDriver({
  pass,
  movementInputRef,
}: {
  pass: AfterimagePass;
  movementInputRef: MutableRefObject<MovementAxes>;
}) {
  const speed = useRef(0);
  useFrame((_, delta) => {
    // 속도는 damp로 따라간다. 키를 뗀 순간 잔상이 뚝 끊기면 끌린 것이 아니라 고장이다
    speed.current = MathUtils.damp(
      speed.current,
      movementSpeed(movementInputRef.current),
      4,
      delta,
    );
    pass.damp = afterimageDamp(speed.current);
  });
  return null;
}

/**
 * 엔딩의 빛기둥 (docs/visual-experiments.md 11장 "GodRays → 열리는 현관문"). 광원은 현관문
 * 밖의 판(LivingRoomShell의 EndingLightPlane, ending-light 채널)이다. 엔딩이 시작되는 순간
 * 만들어지고 화면이 타들어가는 1.5초 동안만 산다. 광원이 아직 없으면(거실 껍데기가
 * 안 서 있으면) 그냥 없는 것으로 친다.
 */
function useGodRaysEffect(active: boolean) {
  const camera = useThree((state) => state.camera);
  const effect = useMemo(() => {
    const light = active ? endingLight.mesh : null;
    if (!light) return null;
    return new GodRaysEffect(camera, light, {
      density: 0.92,
      decay: 0.94,
      weight: 0.5,
      exposure: 0.45,
      clampMax: 1,
      samples: 40,
      kernelSize: KernelSize.SMALL,
      resolutionScale: 0.5,
      blur: true,
    });
  }, [active, camera]);
  useEffect(() => () => effect?.dispose(), [effect]);
  return effect;
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
  firstPersonTrail = null,
  children,
}: PropsWithChildren<{
  color: string;
  /** 어둠의 양 (0 = 밝은 방, 1 = 가장 어두운 지점). 색수차가 이 축을 따라 조금 더 어긋난다. */
  dim?: number;
  /** 오클루전의 색. 주면 AO 패스를 켠다. 테스트의 가짜 렌더러에는 없다. */
  ambientOcclusion?: { color: string };
  /** 1인칭 구간의 이동 입력. 주면 그 동안 잔상 패스가 붙는다. null이면 없다. */
  firstPersonTrail?: MutableRefObject<MovementAxes> | null;
}>) {
  const aoColor = useMemo(
    () => (ambientOcclusion ? new Color(ambientOcclusion.color) : null),
    [ambientOcclusion],
  );
  const settings = useMemo(
    () => createMemoryOutlineSettings(color, { touch: isTouchDevice() }),
    [color],
  );
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const film = useFilmLookEffects(reducedMotion);
  const transition = useScreenTransitionEffect();
  // 틸트 시프트는 블러 패스 하나가 더 드는 무거운 효과다. 프레임이 떨어진 기기·폰에서는 빠진다
  const heavyEnabled = useEffectEnabled("heavy");
  const tiltEnabled = heavyEnabled;
  const tilt = useTiltShiftEffect();
  // 잔상은 1인칭 구간에만, 빛기둥은 엔딩에만 붙는다. 둘 다 렌더 타깃이 드는 무거운 효과다
  const afterimage = useAfterimagePass(heavyEnabled && firstPersonTrail !== null);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const godRays = useGodRaysEffect(heavyEnabled && endingStarted);
  const innerRef = useRef<OutlineEffect | null>(null);
  const outerRef = useRef<OutlineEffect | null>(null);
  const groupsRef = useRef<Record<MemoryGlowTier, Map<string, Object3D[]>>>({
    memory: new Map(),
    prop: new Map(),
  });
  const [selection, setSelection] = useState<TierSelection>(() => ({ memory: [], prop: [] }));
  const updateSelection = useCallback<SelectionUpdater>((tier, key, next) => {
    const groups = groupsRef.current[tier];
    /*
     * 빠지는 메쉬의 선택 레이어를 여기서 직접 끈다. 이펙트의 Selection.clear()는 **제** 멤버만
     * 끄는데, 카메라가 바뀌면(1인칭 진입·이탈) <Outline>이 이펙트를 새로 만들어 옛 이펙트가
     * 켜 둔 비트는 아무도 모르는 채 남는다. 마스크 패스는 레이어 비트만 보므로 그 메쉬는
     * 영원히 윤곽이 그려진다: 방문을 여는 순간(금빛이 꺼지는 순간 = 문 넘기 1인칭이 시작되는
     * 순간) 문짝이 그렇게 남아 벽 너머로 금빛 줄이 따라다녔다.
     */
    for (const object of groups.get(key) ?? []) {
      if (next?.includes(object)) continue;
      object.layers.disable(INNER_SELECTION_LAYER);
      object.layers.disable(OUTER_SELECTION_LAYER);
    }
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

  /*
   * 패스 목록은 메모해 둔다. EffectComposer(@react-three/postprocessing)는 children 배열이
   * 새로 오면 모든 패스를 떼고 EffectPass를 새로 만들어 붙이는데, 그때 렌더 타깃이 통째로
   * 다시 할당된다. 매 렌더 새 배열을 넘기면 공간을 옮기거나 커서가 물건에 닿을 때마다
   * 후처리가 재구성돼 화면이 멈칫했다.
   *
   * 같은 이유로 아웃라인 선택은 prop이 아니라 아래 effect가 이펙트에 직접 넣는다.
   * 선택은 호버마다 바뀐다.
   */
  const passes = useMemo(
    () => [
      ...(aoColor
        ? [<N8AO key="ao" halfRes quality="performance" color={aoColor} {...AO_SETTINGS} />]
        : []),
      // 잔상은 장면 바로 다음: 뒤의 패스들이 끌린 화면 위에 얹힌다
      ...(afterimage ? [<primitive key="afterimage" object={afterimage} />] : []),
      // 빛기둥은 제 패스에 따로 묶는다. 그냥 두면 컴포저가 틸트 시프트와 한 EffectPass로
      // 합치는데, 그 안에서 틸트의 블러는 빛기둥이 얹히기 전 화면을 읽는다. 흐려지는 위아래에는
      // 빛기둥이 없고 또렷한 가운데 띠에만 남아, 문턱 화면에 밝은 가로 띠가 섰다
      ...(godRays
        ? [
            <EffectGroup key="godrays">
              <primitive object={godRays} />
            </EffectGroup>,
          ]
        : []),
      // 초점 띠는 색수차보다 앞: 윤곽선·그레인은 흐려진 화면 위에 또렷하게 얹혀야 한다
      ...(tiltEnabled ? [<primitive key="tilt" object={tilt} />] : []),
      <primitive key="aberration" object={film.aberration} />,
      <Outline
        key="inner"
        ref={innerRef}
        visibleEdgeColor={settings.edgeColor}
        hiddenEdgeColor={settings.hiddenEdgeColor}
        {...settings.inner}
      />,
      // 숨쉬는 헤일로 + 벽 너머 투과는 기억만: 곁가지는 윤곽선 한 줄에서 멈춘다
      <Outline
        key="outer"
        ref={outerRef}
        visibleEdgeColor={settings.edgeColor}
        hiddenEdgeColor={settings.hiddenEdgeColor}
        {...settings.outer}
      />,
      <primitive key="grain" object={film.grain} />,
      <primitive key="transition" object={transition} />,
    ],
    [aoColor, afterimage, godRays, tiltEnabled, tilt, film, settings, transition],
  );
  /*
   * 패스가 다시 만들어지거나 카메라가 바뀌면(1인칭 진입·이탈: <Outline>이 카메라마다 이펙트를
   * 새로 만든다) Outline이 빈 선택으로 시작하므로 그때도 다시 넣는다. 정리 함수는 **그때의**
   * 이펙트에서 선택을 비운다: 이펙트가 바뀐 뒤에 새 이펙트만 비우면 옛 이펙트가 켜 둔 레이어
   * 비트가 메쉬에 남는다 (updateSelection 주석).
   */
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    void passes;
    void camera;
    const effect = innerRef.current;
    if (!effect) return;
    effect.selection.set(touchable);
    return () => {
      effect.selection.clear();
    };
  }, [touchable, passes, camera]);
  useEffect(() => {
    void passes;
    void camera;
    const effect = outerRef.current;
    if (!effect) return;
    effect.selection.set(selection.memory);
    return () => {
      effect.selection.clear();
    };
  }, [selection.memory, passes, camera]);

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
        {passes}
      </EffectComposer>
      <ScreenTransitionDriver effect={transition} reducedMotion={reducedMotion} />
      {tiltEnabled && <TiltShiftDriver effect={tilt} />}
      {afterimage && firstPersonTrail && (
        <AfterimageDriver pass={afterimage} movementInputRef={firstPersonTrail} />
      )}
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
   * 1인칭 구간(인트로·문 넘기)에서도 빛나는가. 기본은 "mute": 어둠 속에서 할 일은
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
