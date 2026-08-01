"use client";

import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useMemo, useRef } from "react";
import {
  type AmbientLight,
  type DirectionalLight,
  MathUtils,
  type PointLight,
  type Vector3,
} from "three";
import { type MemoryId, stageIndexFromCount } from "@/data/memory-room";
import { selectCollected, selectEndingReady, useMemoryRoomStore } from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { CameraRig } from "./memory-room/CameraRig";
import { MemoryObjects } from "./memory-room/MemoryObjects";
import { Player } from "./memory-room/Player";
import { resolveRoomPalette } from "./memory-room/palette";
import { RoomFurniture } from "./memory-room/RoomFurniture";
import { RoomShell } from "./memory-room/RoomShell";
import { ROOM_LIGHTING } from "./memory-room/visual-state";

function StageLighting({
  stageIndex,
  memoryColor,
  fillColor,
  groundColor,
}: {
  stageIndex: number;
  memoryColor: string;
  fillColor: string;
  groundColor: string;
}) {
  const ambientRef = useRef<AmbientLight>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const windowGlowRef = useRef<PointLight>(null);
  const initialStageIndex = useRef(stageIndex).current;

  useFrame((_, delta) => {
    const ambient = ambientRef.current;
    const key = keyRef.current;
    const windowGlow = windowGlowRef.current;
    if (!ambient || !key || !windowGlow) return;

    ambient.intensity = MathUtils.damp(
      ambient.intensity,
      ROOM_LIGHTING.ambient[stageIndex],
      4,
      delta,
    );
    key.intensity = MathUtils.damp(key.intensity, ROOM_LIGHTING.key[stageIndex], 4, delta);
    windowGlow.intensity = MathUtils.damp(
      windowGlow.intensity,
      ROOM_LIGHTING.windowGlow[stageIndex],
      4,
      delta,
    );
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={ROOM_LIGHTING.ambient[initialStageIndex]} />
      <hemisphereLight
        color={fillColor}
        groundColor={groundColor}
        intensity={ROOM_LIGHTING.hemisphereFill}
      />
      <directionalLight
        ref={keyRef}
        position={[3, 8, 5]}
        intensity={ROOM_LIGHTING.key[initialStageIndex]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight
        ref={windowGlowRef}
        position={[1.2, 3.1, -3.2]}
        color={memoryColor}
        intensity={ROOM_LIGHTING.windowGlow[initialStageIndex]}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[0, 4.2, 0.8]}
        color={fillColor}
        intensity={ROOM_LIGHTING.ceilingFill}
        distance={13}
        decay={2}
      />
    </>
  );
}

export function MemoryRoomScene({
  playerPositionRef,
  movementInputRef,
  focusMemoryId,
  nearbyMemoryId,
  curtainsOpen,
  roomZoom,
  onInteract,
}: {
  playerPositionRef: MutableRefObject<Vector3>;
  movementInputRef: MutableRefObject<MovementAxes>;
  focusMemoryId: MemoryId | null;
  nearbyMemoryId: MemoryId | null;
  curtainsOpen: boolean;
  roomZoom: number;
  onInteract: (id: MemoryId) => void;
}) {
  const palette = useMemo(resolveRoomPalette, []);
  const collectedCount = useMemoryRoomStore(selectCollected).length;
  const isEndingReady = useMemoryRoomStore(selectEndingReady);
  const stageIndex = stageIndexFromCount(collectedCount);

  return (
    <>
      <color attach="background" args={[palette.deep]} />
      <StageLighting
        stageIndex={stageIndex}
        memoryColor={palette.memory}
        fillColor={palette.paper}
        groundColor={palette.deep}
      />
      <RoomShell palette={palette} doorReady={isEndingReady} />
      <RoomFurniture
        palette={palette}
        curtainsOpen={curtainsOpen}
        onCurtainInteract={() => onInteract("window")}
      />
      <MemoryObjects palette={palette} nearbyMemoryId={nearbyMemoryId} onInteract={onInteract} />
      <Player positionRef={playerPositionRef} movementInputRef={movementInputRef} />
      <CameraRig focusMemoryId={focusMemoryId} roomZoom={roomZoom} />
    </>
  );
}
