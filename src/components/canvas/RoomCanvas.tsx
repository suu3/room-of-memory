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
import { Vector3 } from "three";
import { MovementJoystick } from "@/components/ui/MovementJoystick";
import { RoomInteractionPrompt } from "@/components/ui/RoomInteractionPrompt";
import { MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import { MemoryRoomScene } from "@/scenes/MemoryRoomScene";
import { CAMERA_PRESETS, MEMORY_PLACEMENTS } from "@/scenes/memory-room/layout";
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
  roomZoomForViewport,
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
  const playerPositionRef = useRef(new Vector3(0, 0.45, 2.35));
  const movementInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const nearbyMemoryIdRef = useRef<MemoryId | null>(null);
  const directFocusTimer = useRef<number | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const hadActiveInteraction = useRef(false);
  const [webGLFailed, setWebGLFailed] = useState(() => !canInitializeWebGL());
  const [nearbyMemoryId, setNearbyMemoryId] = useState<MemoryId | null>(null);
  const [focusMemoryId, setFocusMemoryId] = useState<MemoryId | null>(null);
  const [roomZoom, setRoomZoom] = useState(64);
  const [curtainsOpenedAtRevision, setCurtainsOpenedAtRevision] = useState<number | null>(null);
  const activeInteraction = useMemoryRoomStore(selectActiveInteraction);
  const inputLocked = useMemoryRoomStore(selectSceneInputLocked);
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const beginInteraction = useMemoryRoomStore((state) => state.beginInteraction);
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  const curtainsOpen = curtainsOpenedAtRevision === resetRevision;

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
      bat: tRoom("memories.bat.name"),
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
    (id: MemoryId) =>
      dispatchMemoryInteraction(
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
          openCurtains: () => setCurtainsOpenedAtRevision(resetRevision),
        },
      ),
    [beginInteraction, clearDirectFocusTimer, curtainsOpen, resetRevision],
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
      setRoomZoom(roomZoomForViewport(window.innerWidth, window.innerHeight));
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

  const nearbyLabel = nearbyMemoryId
    ? t("scene.interactHint", { name: labels[nearbyMemoryId] })
    : "";

  return (
    <div className="absolute inset-0">
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
            camera={{
              position: [...CAMERA_PRESETS.room.position],
              zoom: roomZoom,
              near: 0.1,
              far: 60,
            }}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          >
            <MemoryRoomScene
              playerPositionRef={playerPositionRef}
              movementInputRef={movementInputRef}
              focusMemoryId={focusMemoryId}
              nearbyMemoryId={nearbyMemoryId}
              curtainsOpen={curtainsOpen}
              roomZoom={roomZoom}
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
        label={t("scene.moveHint")}
      />
    </div>
  );
}
