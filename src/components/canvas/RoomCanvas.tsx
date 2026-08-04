"use client";

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
import { MovementJoystick } from "@/components/ui/MovementJoystick";
import { RoomInteractionPrompt } from "@/components/ui/RoomInteractionPrompt";
import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { MemoryRoomScene } from "@/scenes/MemoryRoomScene";
import {
  CURTAIN_CLOSED,
  type CurtainPull,
  type CurtainSide,
  isCurtainOpen,
  settleProgress,
} from "@/scenes/memory-room/curtain-motion";
import { CAMERA_PRESETS, MEMORY_PLACEMENTS } from "@/scenes/memory-room/layout";
import { PLAYER_START } from "@/scenes/memory-room/Player";
import { findNearestMemory } from "@/scenes/memory-room/spatial";
import {
  hotspotStatus,
  selectActiveInteraction,
  selectSceneInputLocked,
  useMemoryRoomStore,
} from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
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

const PROXIMITY_POLL_MS = 100;
const DIRECT_FOCUS_MS = 900;
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
  // 키 안내는 기기를 따라간다 — 폰에는 누를 E도 WASD도 없다.
  const hint = useControlHint();
  const playerPositionRef = useRef(PLAYER_START.clone());
  const movementInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const nearbyMemoryIdRef = useRef<MemoryId | null>(null);
  const directFocusTimer = useRef<number | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hadActiveInteraction = useRef(false);
  const zoomScaleRef = useRef(1);
  const orbitRef = useRef(0);
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
    (side: CurtainSide) =>
      setPull((pull) => ({ ...pull, [side]: settleProgress(pull[side] ?? 0) })),
    [setPull],
  );

  /** 키보드·프롬프트 버튼 경로 — 드래그를 못 하는 사용자를 위해 양쪽을 한 번에 젖힌다. */
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
      radio: tRoom("memories.radio.name"),
      phone: tRoom("memories.phone.name"),
      calendar: tRoom("memories.calendar.name"),
      ball: tRoom("memories.ball.name"),
    }),
    [tRoom],
  );

  const availableIds = useMemo(
    () => MEMORY_IDS.filter((id) => hotspotStatus({ collected, revisited }, id) === "available"),
    [collected, revisited],
  );

  const clearDirectFocusTimer = useCallback(() => {
    if (directFocusTimer.current === null) return;
    window.clearTimeout(directFocusTimer.current);
    directFocusTimer.current = null;
  }, []);

  const interact = useCallback(
    (id: MemoryId) => {
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
      // 대사·미니게임이 떠 있어 입력이 잠긴 동안에는 아무 소리도 내지 않는다 —
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
      const nextNearbyMemoryId = findNearestMemory(
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
  const viewLocked = inputLocked || focusMemoryId !== null;

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

  useEffect(() => {
    if (!viewLocked) return;
    applyZoomScale(1);
    applyOrbit(0);
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
      {/* 창밖으로 새어나가는 빛 — 캔버스보다 아래라 방을 절대 덮지 않는다 */}
      <div aria-hidden className="room-backdrop pointer-events-none absolute inset-0" />
      {webGLFailed ? (
        <WebGLFallback>{t("scene.webglFallback")}</WebGLFallback>
      ) : (
        <CanvasErrorBoundary fallbackText={t("scene.webglFallback")}>
          <Canvas
            ref={attachCanvasRef}
            className="absolute inset-0 z-0"
            orthographic
            // three r185에서 PCFSoftShadowMap(= shadows 기본값)이 deprecated라 PCF로 명시한다
            shadows="percentage"
            dpr={[1, 1.5]}
            camera={initialCamera}
            // alpha: true — 캔버스 뒤 DOM 워시가 비쳐야 한다 (창밖 번짐을 3D에 두면
            // three가 투명 오브젝트를 항상 불투명 뒤에 그려서 벽을 뚫고 덧칠된다)
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          >
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
              orbitAzimuth={orbitAzimuth}
              following={started}
              onInteract={interact}
            />
          </Canvas>
        </CanvasErrorBoundary>
      )}

      <RoomInteractionPrompt
        nearbyMemoryId={nearbyMemoryId}
        nearbyLabel={nearbyLabel}
        labels={labels}
        availableIds={availableIds}
        onInteract={interact}
      />
      <MovementJoystick
        inputRef={movementInputRef}
        disabled={inputLocked}
        label={hint("scene.moveHint")}
        caption={t("scene.moveCaption")}
      />
    </div>
  );
}
