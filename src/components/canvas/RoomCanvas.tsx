"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { LookButtons } from "@/components/ui/LookButtons";
import { CanvasMinigameSkip } from "@/components/ui/MinigameHost";
import { MovementJoystick } from "@/components/ui/MovementJoystick";
import { RoomInteractionPrompt } from "@/components/ui/RoomInteractionPrompt";
import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import { useControlHint, usePointerKind } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { MemoryRoomScene } from "@/scenes/MemoryRoomScene";
import {
  CURTAIN_CLOSED,
  type CurtainPull,
  type CurtainSide,
  isCurtainOpen,
  releaseProgress,
} from "@/scenes/memory-room/curtain-motion";
import type { LookAngles } from "@/scenes/memory-room/first-person";
import { CAMERA_PRESETS, MEMORY_PLACEMENTS } from "@/scenes/memory-room/layout";
import { PLAYER_START } from "@/scenes/memory-room/Player";
import { findNearestMemory } from "@/scenes/memory-room/spatial";
import { useEffectsStore } from "@/store/effects";
import {
  type HotspotStatus,
  hotspotStatus,
  selectActiveInteraction,
  selectSceneInputLocked,
  selectViewpoint,
  useMemoryRoomStore,
  viewpointOf,
} from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { RoomLoadReporter } from "./RoomLoadReporter";
import {
  canInitializeWebGL,
  dispatchMemoryInteraction,
  handleRoomInteractionKeyDown,
  handleRoomOrbitKeyDown,
  handleRoomZoomKeyDown,
  isInteractiveTarget,
  ORBIT_DRAG_THRESHOLD,
  roomOrbitFromDrag,
  roomOverviewZoomForViewport,
  roomZoomForViewport,
  roomZoomScaleFromPinch,
  roomZoomScaleFromWheel,
} from "./room-canvas-runtime";
import { useFirstPersonLook } from "./use-first-person-look";

const PROXIMITY_POLL_MS = 100;
const DIRECT_FOCUS_MS = 900;
/**
 * 화면 배율의 상한. 프레임이 떨어지는 기기에서는 1로 내린다 (PerformanceMonitor).
 * 아래 1은 그대로다: 그 밑으로 내리면 글씨보다 먼저 아웃라인이 깨진다.
 */
const DPR_CAP = { high: 1.5, low: 1 } as const;
/*
 * drei의 SoftShadows(PCSS)는 쓰지 않는다. three r185에서 사라진 unpackRGBAToDepth를
 * 셰이더에 심어 그림자를 받는 재질 전부가 컴파일에 실패한다. 방이 통째로 검게 나왔다
 * (2026-09-16). 부드러운 그림자가 필요하면 three 자체의 VSM 그림자 맵으로 간다.
 */
const MEMORY_TARGETS = Object.values(MEMORY_PLACEMENTS);

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallbackText: string;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

function WebGLFallback({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-fog">
      {children}
    </div>
  );
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unable to render the memory room Canvas.", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <WebGLFallback>{this.props.fallbackText}</WebGLFallback>;
    }

    return this.props.children;
  }
}

export function RoomCanvas() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  // 키 안내는 기기를 따라간다. 폰에는 누를 E도 WASD도 없다.
  const hint = useControlHint();
  // 조이스틱은 손가락용이다. 마우스는 바닥을 눌러 걷고, 키보드는 그대로 남는다.
  const pointerKind = usePointerKind();
  const playerPositionRef = useRef(PLAYER_START.clone());
  const movementInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const nearbyMemoryIdRef = useRef<MemoryId | null>(null);
  const directFocusTimer = useRef<number | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hadActiveInteraction = useRef(false);
  const zoomScaleRef = useRef(1);
  const orbitRef = useRef(0);
  /** 1인칭의 시선. 끌기·키가 쓰고 FirstPersonRig가 프레임마다 읽는다. */
  const lookRef = useRef<LookAngles>({ yaw: 0, pitch: 0 });
  const [webGLFailed, setWebGLFailed] = useState(() => !canInitializeWebGL());
  const [nearbyMemoryId, setNearbyMemoryId] = useState<MemoryId | null>(null);
  const [focusMemoryId, setFocusMemoryId] = useState<MemoryId | null>(null);
  /** 타이틀 구도(디오라마 전체)와 플레이 구도(플레이어 추적) 두 가지. */
  const [zoomByFraming, setZoomByFraming] = useState({ overview: 64, play: 96 });
  const [zoomScale, setZoomScale] = useState(1);
  const [orbitAzimuth, setOrbitAzimuth] = useState(0);
  /** 커튼은 쪽마다 따로 젖혀진다. 리셋하면 리비전이 어긋나 자동으로 닫힌 상태가 된다. */
  const [curtainState, setCurtainState] = useState<{ revision: number; pull: CurtainPull } | null>(
    null,
  );
  const activeInteraction = useMemoryRoomStore(selectActiveInteraction);
  const inputLocked = useMemoryRoomStore(selectSceneInputLocked);
  /** 시작 전에는 방 모형 전체를 보여주고, 시작하면 그 안으로 내려앉는다. */
  const started = useMemoryRoomStore((state) => state.started);
  const roomZoom = started ? zoomByFraming.play : zoomByFraming.overview;
  /** 1인칭 구간(인트로·2막 도입). 그동안 회전·배율 입력은 잠기고 시선 입력이 대신 선다. */
  const viewpoint = useMemoryRoomStore(selectViewpoint);
  const firstPerson = viewpoint !== null;
  /*
   * 성능 안전장치. 프레임이 목표(주사율) 아래로 떨어지면 배율 상한을 내리고, 다시
   * 오르면 돌려준다. 배열을 새로 만들면 r3f가 렌더마다 배율을 다시 잡으므로 묶어 둔다.
   */
  const [dprCap, setDprCap] = useState<number>(DPR_CAP.high);
  const dpr = useMemo<[number, number]>(() => [1, dprCap], [dprCap]);
  // 효과 예산(effect-budget)도 같은 판정을 본다. 배율이 내려간 기기에서는 무거운 효과가 빠진다
  const setDegraded = useEffectsStore((state) => state.setDegraded);
  const degrade = useCallback(() => {
    setDprCap(DPR_CAP.low);
    setDegraded(true);
  }, [setDegraded]);
  const restore = useCallback(() => {
    setDprCap(DPR_CAP.high);
    setDegraded(false);
  }, [setDegraded]);

  /*
   * Canvas의 camera 프롭은 마운트 때 한 번만 쓴다. 여기에 살아 있는 zoom을 물리면
   * r3f가 프롭이 바뀔 때마다 camera.zoom을 즉시 덮어써서, CameraRig의 damp가
   * 시작하기도 전에 목표값에 도달해 버린다 (타이틀→플레이 줌인이 통째로 사라졌다).
   * 이후 zoom은 CameraRig 혼자 굴린다.
   */
  const initialCamera = useMemo(
    () => ({
      position: [...CAMERA_PRESETS.room.position] as [number, number, number],
      zoom: roomOverviewZoomForViewport(window.innerWidth, window.innerHeight),
      near: 0.1,
      far: 60,
    }),
    [],
  );
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  // 2바퀴 재조사가 문 뒤에 있어서(hotspotStatus), 문이 열리는 순간 표식이 재점등된다
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const beginInteraction = useMemoryRoomStore((state) => state.beginInteraction);
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  const curtainPull = curtainState?.revision === resetRevision ? curtainState.pull : CURTAIN_CLOSED;
  const curtainsOpen = isCurtainOpen(curtainPull);

  const setPull = useCallback(
    (next: (current: CurtainPull) => CurtainPull) => {
      setCurtainState((state) => ({
        revision: resetRevision,
        pull: next(state?.revision === resetRevision ? state.pull : CURTAIN_CLOSED),
      }));
    },
    [resetRevision],
  );

  const handleCurtainPull = useCallback(
    (side: CurtainSide, progress: number) => setPull((pull) => ({ ...pull, [side]: progress })),
    [setPull],
  );

  const handleCurtainRelease = useCallback(
    // 진행도는 커튼이 준다. 몸이 창가에 닿기를 기다렸다가 끌기와 놓기가 같은 프레임에
    // 흘러들 수 있어서, 여기 상태를 읽으면 끌기 전 값을 본다.
    (side: CurtainSide, progress: number, tapped: boolean, velocity: number) => {
      // 손이 가던 속도까지 본다: 세게 튕기면 반쯤에서 놓아도 끝까지 간다 (관성)
      const settled = releaseProgress(progress, tapped, velocity);
      // 커튼이 실제로 자리를 옮길 때만 소리를 낸다. 끌다 말고 도로 붙는 건 아무 일도 아니다
      if (settled !== progress) playSound("wipe");
      setPull((pull) => ({ ...pull, [side]: settled }));
    },
    [setPull],
  );

  /** 키보드·프롬프트 버튼 경로: 드래그를 못 하는 사용자를 위해 양쪽을 한 번에 젖힌다. */
  const openBothCurtains = useCallback(() => setPull(() => ({ left: 1, right: 1 })), [setPull]);

  const handleWebGLFailure = useCallback((event: Event) => {
    if (event.cancelable) event.preventDefault();
    setWebGLFailed(true);
  }, []);

  const attachCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      const previousCanvas = canvasElementRef.current;
      if (previousCanvas === canvas) return;
      if (previousCanvas) {
        previousCanvas.removeEventListener("webglcontextcreationerror", handleWebGLFailure);
        previousCanvas.removeEventListener("webglcontextlost", handleWebGLFailure);
      }

      canvasElementRef.current = canvas;
      if (canvas) {
        canvas.addEventListener("webglcontextcreationerror", handleWebGLFailure);
        canvas.addEventListener("webglcontextlost", handleWebGLFailure);
      }
    },
    [handleWebGLFailure],
  );

  const labels = useMemo<Record<MemoryId, string>>(
    () => ({
      console: tRoom("memories.console.name"),
      window: tRoom("memories.window.name"),
      frame: tRoom("memories.frame.name"),
      computer: tRoom("memories.computer.name"),
      radio: tRoom("memories.radio.name"),
      phone: tRoom("memories.phone.name"),
      calendar: tRoom("memories.calendar.name"),
      ball: tRoom("memories.ball.name"),
      fridge: tRoom("memories.fridge.name"),
      duffel: tRoom("memories.duffel.name"),
      shoes: tRoom("memories.shoes.name"),
      cards: tRoom("memories.cards.name"),
      ampoule: tRoom("memories.ampoule.name"),
      "research-note": tRoom("memories.research-note.name"),
      "id-card": tRoom("memories.id-card.name"),
    }),
    [tRoom],
  );

  const statuses = useMemo(
    () =>
      Object.fromEntries(
        MEMORY_IDS.map((id) => [id, hotspotStatus({ collected, revisited, doorOpened }, id)]),
      ) as Record<MemoryId, HotspotStatus>,
    [collected, revisited, doorOpened],
  );

  /**
   * 스크린리더가 읽을 이름. 조사할 수 없는 물건은 이유까지 붙인다. 목록에서 이름만
   * 읽히고 눌러도 아무 일이 없으면, 잠긴 것인지 이미 본 것인지 알 길이 없다.
   */
  const memoryButtonLabels = useMemo<Record<MemoryId, string>>(
    () =>
      Object.fromEntries(
        MEMORY_IDS.map((id) => [
          id,
          statuses[id] === "available"
            ? labels[id]
            : t(`scene.memoryState.${statuses[id]}`, { name: labels[id] }),
        ]),
      ) as Record<MemoryId, string>,
    [labels, statuses, t],
  );

  const clearDirectFocusTimer = useCallback(() => {
    if (directFocusTimer.current === null) return;
    window.clearTimeout(directFocusTimer.current);
    directFocusTimer.current = null;
  }, []);

  const interact = useCallback(
    (id: MemoryId) => {
      // 1인칭에 있는 동안은 조사하지 않는다 (스토어도 막지만 소리까지 맞추려면 여기서 먼저)
      if (viewpointOf(useMemoryRoomStore.getState()) !== null) {
        playSound("deny");
        return false;
      }
      const accepted = dispatchMemoryInteraction(
        useMemoryRoomStore.getState(),
        id,
        () => {
          setFocusMemoryId(id);
          beginInteraction(id);
          clearDirectFocusTimer();
          if (useMemoryRoomStore.getState().activeInteraction === null) {
            directFocusTimer.current = window.setTimeout(
              () => setFocusMemoryId(null),
              DIRECT_FOCUS_MS,
            );
          }
        },
        {
          curtainsOpen,
          openCurtains: openBothCurtains,
        },
      );
      // 대사·미니게임이 떠 있어 입력이 잠긴 동안에는 아무 소리도 내지 않는다.
      // 그건 "안 되는 것"이 아니라 "지금 차례가 아닌 것"이다.
      if (accepted) playSound("select");
      else if (!selectSceneInputLocked(useMemoryRoomStore.getState())) playSound("deny");
      return accepted;
    },
    [beginInteraction, clearDirectFocusTimer, curtainsOpen, openBothCurtains],
  );

  useEffect(() => {
    if (activeInteraction) {
      clearDirectFocusTimer();
      setFocusMemoryId(activeInteraction.memoryId);
    } else if (hadActiveInteraction.current) {
      setFocusMemoryId(null);
    }
    hadActiveInteraction.current = activeInteraction !== null;
  }, [activeInteraction, clearDirectFocusTimer]);

  useEffect(() => clearDirectFocusTimer, [clearDirectFocusTimer]);

  useEffect(() => {
    let animationFrame: number | null = null;
    const applyViewportZoom = () => {
      animationFrame = null;
      setZoomByFraming({
        overview: roomOverviewZoomForViewport(window.innerWidth, window.innerHeight),
        play: roomZoomForViewport(window.innerWidth, window.innerHeight),
      });
    };
    const handleResize = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(applyViewportZoom);
    };

    applyViewportZoom();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const updateNearbyMemory = () => {
      const position = playerPositionRef.current;
      const state = useMemoryRoomStore.getState();
      // 1인칭에 있는 동안은 아무것도 조사 대상이 아니다. 근접 안내와 글로우가 같이 꺼진다
      const nextNearbyMemoryId =
        viewpointOf(state) !== null
          ? null
          : findNearestMemory(
              position,
              MEMORY_TARGETS,
              (id) => hotspotStatus(useMemoryRoomStore.getState(), id) === "available",
            );
      if (nextNearbyMemoryId === nearbyMemoryIdRef.current) return;

      nearbyMemoryIdRef.current = nextNearbyMemoryId;
      setNearbyMemoryId(nextNearbyMemoryId);
    };

    updateNearbyMemory();
    const interval = window.setInterval(updateNearbyMemory, PROXIMITY_POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleRoomInteractionKeyDown(event, {
        nearbyMemoryId: nearbyMemoryIdRef.current,
        inputLocked: selectSceneInputLocked(useMemoryRoomStore.getState()),
        interact,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interact]);

  // 포커스 연출·대사·미니게임 중에는 구도가 깨지지 않게 뷰를 되돌리고 입력을 잠근다.
  // 1인칭 동안도 같다: 회전·배율은 직교 카메라의 것이고, 그 카메라는 잠들어 있다.
  const viewLocked = inputLocked || focusMemoryId !== null || firstPerson;
  useFirstPersonLook(containerRef, firstPerson, lookRef);

  const applyZoomScale = useCallback((next: number) => {
    if (zoomScaleRef.current === next) return;
    zoomScaleRef.current = next;
    setZoomScale(next);
  }, []);

  const applyOrbit = useCallback((next: number) => {
    if (orbitRef.current === next) return;
    orbitRef.current = next;
    setOrbitAzimuth(next);
  }, []);

  /**
   * 잠기는 동안은 기본 구도로 돌아가고, 풀리면 **사용자가 잡아 둔 배율·각도로 돌아온다**.
   * 예전에는 되돌리기만 해서, 미니게임 하나 끝날 때마다 줌이 기본값으로 튕겼다.
   */
  const savedViewRef = useRef<{ zoom: number; orbit: number } | null>(null);
  useEffect(() => {
    if (viewLocked) {
      savedViewRef.current = { zoom: zoomScaleRef.current, orbit: orbitRef.current };
      applyZoomScale(1);
      applyOrbit(0);
      return;
    }
    const saved = savedViewRef.current;
    if (!saved) return;
    savedViewRef.current = null;
    applyZoomScale(saved.zoom);
    applyOrbit(saved.orbit);
  }, [viewLocked, applyZoomScale, applyOrbit]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewLocked) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyZoomScale(roomZoomScaleFromWheel(zoomScaleRef.current, event.deltaY));
    };

    // 좌클릭 드래그로 회전. 임계값을 넘긴 드래그는 뒤따르는 click을 캡처 단계에서 삼켜
    // 오브젝트가 잘못 선택되지 않게 한다.
    let drag: { pointerId: number; x: number; angle: number } | null = null;
    let swallowClick = false;
    const handlePointerDown = (event: PointerEvent) => {
      if (drag !== null || event.button !== 0 || isInteractiveTarget(event.target)) {
        drag = null;
        return;
      }
      drag = { pointerId: event.pointerId, x: event.clientX, angle: orbitRef.current };
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const travel = event.clientX - drag.x;
      if (!swallowClick && Math.abs(travel) < ORBIT_DRAG_THRESHOLD) return;
      swallowClick = true;
      applyOrbit(roomOrbitFromDrag(drag.angle, travel));
    };
    const endDrag = (event: PointerEvent) => {
      if (drag && event.pointerId !== drag.pointerId) return;
      drag = null;
    };
    const handleClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    let pinch: { distance: number; scale: number } | null = null;
    const pinchDistance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const handleTouchStart = (event: TouchEvent) => {
      pinch =
        event.touches.length === 2
          ? { distance: pinchDistance(event.touches), scale: zoomScaleRef.current }
          : null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      applyZoomScale(
        roomZoomScaleFromPinch(pinch.scale, pinch.distance, pinchDistance(event.touches)),
      );
    };
    const endPinch = () => {
      pinch = null;
      drag = null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      handleRoomZoomKeyDown(event, {
        locked: false,
        scale: zoomScaleRef.current,
        apply: applyZoomScale,
      });
      handleRoomOrbitKeyDown(event, {
        locked: false,
        angle: orbitRef.current,
        apply: applyOrbit,
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
    container.addEventListener("click", handleClickCapture, { capture: true });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", endPinch, { passive: true });
    container.addEventListener("touchcancel", endPinch, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.removeEventListener("click", handleClickCapture, { capture: true });
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", endPinch);
      container.removeEventListener("touchcancel", endPinch);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [applyZoomScale, applyOrbit, viewLocked]);

  const nearbyLabel = nearbyMemoryId
    ? hint("scene.interactHint", { name: labels[nearbyMemoryId] })
    : "";

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* 모델이 얼마나 들어왔는지를 타이틀 화면에 알린다. 그리는 것은 없다 */}
      <RoomLoadReporter failed={webGLFailed} />
      {/* 창밖으로 새어나가는 빛: 캔버스보다 아래라 방을 절대 덮지 않는다 */}
      <div aria-hidden className="room-backdrop pointer-events-none absolute inset-0" />
      {/* 타이틀에서만 디오라마 뒤에 깔리는 빛 웅덩이: 모형을 무대 위에 올린다. 시작하면 물러난다 */}
      <div
        aria-hidden
        className="room-stage-pool pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{ opacity: started ? 0 : 1 }}
      />
      {webGLFailed ? (
        <>
          <WebGLFallback>{t("scene.webglFallback")}</WebGLFallback>
          {/* 씬이 없으면 canvas 모드 미니게임이 설 자리도 없다. 건너뛰어 진행을 살린다 */}
          <CanvasMinigameSkip />
        </>
      ) : (
        <CanvasErrorBoundary fallbackText={t("scene.webglFallback")}>
          <Canvas
            ref={attachCanvasRef}
            className="absolute inset-0 z-0"
            orthographic
            // three r185에서 PCFSoftShadowMap(= shadows 기본값)이 deprecated라 PCF로 명시한다
            shadows="percentage"
            dpr={dpr}
            camera={initialCamera}
            // alpha: true: 캔버스 뒤 DOM 워시가 비쳐야 한다 (창밖 번짐을 3D에 두면
            // three가 투명 오브젝트를 항상 불투명 뒤에 그려서 벽을 뚫고 덧칠된다)
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          >
            <PerformanceMonitor
              onDecline={degrade}
              onIncline={restore}
              onFallback={degrade}
              flipflops={3}
            />
            <MemoryRoomScene
              playerPositionRef={playerPositionRef}
              movementInputRef={movementInputRef}
              focusMemoryId={focusMemoryId}
              nearbyMemoryId={nearbyMemoryId}
              curtainsOpen={curtainsOpen}
              curtainPull={curtainPull}
              onCurtainPull={handleCurtainPull}
              onCurtainRelease={handleCurtainRelease}
              roomZoom={roomZoom * zoomScale}
              zoomScale={zoomScale}
              orbitAzimuth={orbitAzimuth}
              following={started}
              viewpoint={viewpoint}
              lookRef={lookRef}
              onInteract={interact}
            />
          </Canvas>
        </CanvasErrorBoundary>
      )}

      <RoomInteractionPrompt
        nearbyMemoryId={nearbyMemoryId}
        nearbyLabel={nearbyLabel}
        legend={t("hud.scattered")}
        labels={memoryButtonLabels}
        statuses={statuses}
        onInteract={interact}
      />
      {pointerKind === "touch" && (
        <MovementJoystick
          inputRef={movementInputRef}
          disabled={inputLocked}
          label={hint("scene.moveHint")}
          caption={t("scene.moveCaption")}
        />
      )}
      {/* 1인칭에서만: 조이스틱의 짝. 끌기가 어려운 손에도 돌아볼 길을 준다 */}
      {pointerKind === "touch" && firstPerson && (
        <LookButtons
          lookRef={lookRef}
          disabled={inputLocked}
          labels={{ left: t("scene.turnLeft"), right: t("scene.turnRight") }}
          caption={t("scene.lookCaption")}
        />
      )}
    </div>
  );
}
