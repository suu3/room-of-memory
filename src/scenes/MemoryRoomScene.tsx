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
import { CameraRig } from "./memory-room/CameraRig";
import { MemoryObjects } from "./memory-room/MemoryObjects";
import { Player } from "./memory-room/Player";
import { resolveRoomPalette } from "./memory-room/palette";
import { RoomFurniture } from "./memory-room/RoomFurniture";
import { RoomShell } from "./memory-room/RoomShell";

const STAGE_AMBIENT = [0.38, 0.52, 0.68] as const;
const STAGE_KEY = [0.75, 0.95, 1.15] as const;
const STAGE_WINDOW_GLOW = [0.4, 0.75, 1.15] as const;

function StageLighting({ stageIndex, memoryColor }: { stageIndex: number; memoryColor: string }) {
  const ambientRef = useRef<AmbientLight>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const windowGlowRef = useRef<PointLight>(null);
  const initialStageIndex = useRef(stageIndex).current;

  useFrame((_, delta) => {
    const ambient = ambientRef.current;
    const key = keyRef.current;
    const windowGlow = windowGlowRef.current;
    if (!ambient || !key || !windowGlow) return;

    ambient.intensity = MathUtils.damp(ambient.intensity, STAGE_AMBIENT[stageIndex], 4, delta);
    key.intensity = MathUtils.damp(key.intensity, STAGE_KEY[stageIndex], 4, delta);
    windowGlow.intensity = MathUtils.damp(
      windowGlow.intensity,
      STAGE_WINDOW_GLOW[stageIndex],
      4,
      delta,
    );
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={STAGE_AMBIENT[initialStageIndex]} />
      <directionalLight
        ref={keyRef}
        position={[3, 8, 5]}
        intensity={STAGE_KEY[initialStageIndex]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight
        ref={windowGlowRef}
        position={[1.2, 3.1, -3.2]}
        color={memoryColor}
        intensity={STAGE_WINDOW_GLOW[initialStageIndex]}
      />
    </>
  );
}

export function MemoryRoomScene({
  playerPositionRef,
  focusMemoryId,
  onInteract,
}: {
  playerPositionRef: MutableRefObject<Vector3>;
  focusMemoryId: MemoryId | null;
  onInteract: (id: MemoryId) => void;
}) {
  const palette = useMemo(resolveRoomPalette, []);
  const collectedCount = useMemoryRoomStore(selectCollected).length;
  const isEndingReady = useMemoryRoomStore(selectEndingReady);
  const stageIndex = stageIndexFromCount(collectedCount);

  return (
    <>
      <color attach="background" args={[palette.deep]} />
      <StageLighting stageIndex={stageIndex} memoryColor={palette.memory} />
      <RoomShell palette={palette} doorReady={isEndingReady} />
      <RoomFurniture palette={palette} />
      <MemoryObjects palette={palette} onInteract={onInteract} />
      <Player positionRef={playerPositionRef} />
      <CameraRig focusMemoryId={focusMemoryId} />
    </>
  );
}
