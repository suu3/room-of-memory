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
import type { MemoryId } from "@/data/memory-room";
import {
  gamePhaseOf,
  MEMORY_TOTAL,
  REVISIT_TOTAL,
  selectCollectedCount,
  selectEndingReady,
  selectRevisitedCount,
  useMemoryRoomStore,
} from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { CameraRig } from "./memory-room/CameraRig";
import type { CurtainPull, CurtainSide } from "./memory-room/curtain-motion";
import { DustMotes } from "./memory-room/DustMotes";
import { EndingTrigger } from "./memory-room/EndingTrigger";
import { MemoryObjects } from "./memory-room/MemoryObjects";
import { MemoryGlowRoot } from "./memory-room/MemoryOutlineGlow";
import { Player } from "./memory-room/Player";
import { resolveRoomPalette } from "./memory-room/palette";
import { RoomFurniture } from "./memory-room/RoomFurniture";
import { RoomShell } from "./memory-room/RoomShell";
import {
  outsideDecay,
  ROOM_LIGHT_RAMP,
  ROOM_LIGHTING,
  roomLightLevel,
  roomLightValue,
} from "./memory-room/visual-state";
import { WindowLight } from "./memory-room/WindowLight";

function StageLighting({
  lightLevel,
  memoryColor,
  fillColor,
  groundColor,
}: {
  /** 0=바닥, 1=완성. 1바퀴는 깎이고 2바퀴는 채워진다. */
  lightLevel: number;
  memoryColor: string;
  fillColor: string;
  groundColor: string;
}) {
  const ambientRef = useRef<AmbientLight>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const windowGlowRef = useRef<PointLight>(null);
  const initialLevel = useRef(lightLevel).current;

  useFrame((_, delta) => {
    const ambient = ambientRef.current;
    const key = keyRef.current;
    const windowGlow = windowGlowRef.current;
    if (!ambient || !key || !windowGlow) return;

    ambient.intensity = MathUtils.damp(
      ambient.intensity,
      roomLightValue(ROOM_LIGHT_RAMP.ambient, lightLevel),
      4,
      delta,
    );
    key.intensity = MathUtils.damp(
      key.intensity,
      roomLightValue(ROOM_LIGHT_RAMP.key, lightLevel),
      4,
      delta,
    );
    windowGlow.intensity = MathUtils.damp(
      windowGlow.intensity,
      roomLightValue(ROOM_LIGHT_RAMP.windowGlow, lightLevel),
      4,
      delta,
    );
  });

  return (
    <>
      <ambientLight
        ref={ambientRef}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.ambient, initialLevel)}
      />
      <hemisphereLight
        color={fillColor}
        groundColor={groundColor}
        intensity={ROOM_LIGHTING.hemisphereFill}
      />
      <directionalLight
        ref={keyRef}
        position={[3, 8, 5]}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.key, initialLevel)}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight
        ref={windowGlowRef}
        position={[1.2, 3.1, -3.2]}
        color={memoryColor}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.windowGlow, initialLevel)}
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
  curtainPull,
  onCurtainPull,
  onCurtainRelease,
  roomZoom,
  orbitAzimuth,
  onInteract,
}: {
  playerPositionRef: MutableRefObject<Vector3>;
  movementInputRef: MutableRefObject<MovementAxes>;
  focusMemoryId: MemoryId | null;
  nearbyMemoryId: MemoryId | null;
  curtainsOpen: boolean;
  curtainPull: CurtainPull;
  onCurtainPull: (side: CurtainSide, progress: number) => void;
  onCurtainRelease: (side: CurtainSide) => void;
  roomZoom: number;
  orbitAzimuth: number;
  onInteract: (id: MemoryId) => void;
}) {
  const palette = useMemo(resolveRoomPalette, []);
  const isEndingReady = useMemoryRoomStore(selectEndingReady);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const gamePhase = useMemoryRoomStore(gamePhaseOf);
  const collectedCount = useMemoryRoomStore(selectCollectedCount);
  const revisitedCount = useMemoryRoomStore(selectRevisitedCount);
  const lightLevel = roomLightLevel({
    collected: collectedCount,
    memoryTotal: MEMORY_TOTAL,
    revisited: revisitedCount,
    revisitTotal: REVISIT_TOTAL,
  });

  return (
    <>
      <StageLighting
        lightLevel={lightLevel}
        memoryColor={palette.memory}
        fillColor={palette.paper}
        groundColor={palette.deep}
      />
      <RoomShell
        palette={palette}
        doorReady={isEndingReady}
        doorOpen={endingStarted}
        outsideDecay={outsideDecay({
          collected: collectedCount,
          memoryTotal: MEMORY_TOTAL,
          phase: gamePhase,
        })}
      />
      {/* 커튼도 클릭 가능한 오브젝트라 기억들과 같은 아웃라인 글로우를 쓴다 — 같은 루트 안에 있어야 한다 */}
      <MemoryGlowRoot color={palette.memory}>
        <RoomFurniture
          palette={palette}
          curtainPull={curtainPull}
          onCurtainPull={onCurtainPull}
          onCurtainRelease={onCurtainRelease}
        />
        <MemoryObjects palette={palette} nearbyMemoryId={nearbyMemoryId} onInteract={onInteract} />
        {/* 문 옆 배트 — 수집 대상이 아니라 2바퀴를 다 돌면 켜지는 엔딩 트리거 */}
        <EndingTrigger palette={palette} />
      </MemoryGlowRoot>
      {/* 글로우 루트 밖 — 빛·먼지는 아웃라인 선택 대상이 아니다 */}
      <WindowLight
        color={palette.memory}
        intensity={roomLightValue(ROOM_LIGHT_RAMP.windowLight, lightLevel)}
        curtainsOpen={curtainsOpen}
      />
      {/* 먼지는 빛줄기 안의 반짝임이라 커튼이 닫히면 같이 사라져야 한다 */}
      <DustMotes
        color={palette.memory}
        opacity={curtainsOpen ? roomLightValue(ROOM_LIGHT_RAMP.dust, lightLevel) : 0}
      />
      <Player positionRef={playerPositionRef} movementInputRef={movementInputRef} />
      {/* 배트를 쥐면 카메라도 문 쪽으로 붙는다 — 엔딩 영상의 첫 컷과 이어지는 구도 */}
      <CameraRig
        focusId={endingStarted ? "ending" : focusMemoryId}
        roomZoom={roomZoom}
        orbitAzimuth={orbitAzimuth}
      />
    </>
  );
}
