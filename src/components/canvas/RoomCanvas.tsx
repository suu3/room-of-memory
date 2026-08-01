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

const PROXIMITY_POLL_MS = 100;
const DIRECT_FOCUS_MS = 900;
const INTERACTIVE_TARGET_SELECTOR =
  "button, a, input, select, textarea, summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link']";
const MEMORY_TARGETS = Object.values(MEMORY_PLACEMENTS);

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallbackText: string;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
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
      return (
        <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-fog">
          {this.props.fallbackText}
        </div>
      );
    }

    return this.props.children;
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}

export function RoomCanvas() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const playerPositionRef = useRef(new Vector3(0, 0.45, 2.35));
  const nearbyMemoryIdRef = useRef<MemoryId | null>(null);
  const directFocusTimer = useRef<number | null>(null);
  const hadActiveInteraction = useRef(false);
  const [nearbyMemoryId, setNearbyMemoryId] = useState<MemoryId | null>(null);
  const [focusMemoryId, setFocusMemoryId] = useState<MemoryId | null>(null);
  const activeInteraction = useMemoryRoomStore(selectActiveInteraction);
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const beginInteraction = useMemoryRoomStore((state) => state.beginInteraction);

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
    (id: MemoryId) => {
      const state = useMemoryRoomStore.getState();
      if (selectSceneInputLocked(state) || hotspotStatus(state, id) !== "available") return;

      setFocusMemoryId(id);
      beginInteraction(id);
      clearDirectFocusTimer();
      if (useMemoryRoomStore.getState().activeInteraction === null) {
        directFocusTimer.current = window.setTimeout(() => setFocusMemoryId(null), DIRECT_FOCUS_MS);
      }
    },
    [beginInteraction, clearDirectFocusTimer],
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
      if (event.code !== "KeyE" && event.key !== "Enter") return;
      if (
        event.repeat ||
        isInteractiveTarget(event.target) ||
        selectSceneInputLocked(useMemoryRoomStore.getState())
      ) {
        return;
      }

      const id = nearbyMemoryIdRef.current;
      if (!id) return;
      event.preventDefault();
      interact(id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interact]);

  const nearbyLabel = nearbyMemoryId
    ? t("scene.interactHint", { name: labels[nearbyMemoryId] })
    : "";

  return (
    <div className="absolute inset-0">
      <CanvasErrorBoundary fallbackText={t("scene.webglFallback")}>
        <Canvas
          className="absolute inset-0 z-0"
          orthographic
          shadows
          dpr={[1, 1.5]}
          camera={{
            position: [...CAMERA_PRESETS.room.position],
            zoom: 72,
            near: 0.1,
            far: 60,
          }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <MemoryRoomScene
            playerPositionRef={playerPositionRef}
            focusMemoryId={focusMemoryId}
            onInteract={interact}
          />
        </Canvas>
      </CanvasErrorBoundary>

      <RoomInteractionPrompt
        nearbyMemoryId={nearbyMemoryId}
        nearbyLabel={nearbyLabel}
        labels={labels}
        availableIds={availableIds}
        onInteract={interact}
      />
    </div>
  );
}
