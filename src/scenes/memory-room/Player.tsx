"use client";

import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { type Group, Vector3 } from "three";
import { selectSceneInputLocked, useMemoryRoomStore } from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { ROOM_BOUNDS, ROOM_COLLIDERS } from "./layout";
import { resolveRoomPalette } from "./palette";
import { captureMovementKeyDown, MOVEMENT_KEYS, resolveMovementInput } from "./player-input";
import { moveCircle, type Vec2 } from "./spatial";

const PLAYER_START = new Vector3(0, 0.45, 2.35);
const PLAYER_RADIUS = 0.38;
const PLAYER_SPEED = 2.35;
const MAX_FRAME_DELTA = 0.05;
const cameraForward = new Vector3();
const cameraRight = new Vector3();

export function Player({
  positionRef,
  movementInputRef,
}: {
  positionRef: MutableRefObject<Vector3>;
  movementInputRef: MutableRefObject<MovementAxes>;
}) {
  const groupRef = useRef<Group>(null);
  const keysRef = useRef(new Set<string>());
  const originRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const deltaRef = useRef<Vec2>({ x: 0, z: 0 });
  const resultRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const resolvedInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const inputLocked = useMemoryRoomStore(selectSceneInputLocked);
  const palette = useMemo(resolveRoomPalette, []);

  useEffect(() => {
    positionRef.current.copy(PLAYER_START);
  }, [positionRef]);

  useEffect(() => {
    const keys = keysRef.current;
    const clearInputs = () => {
      keys.clear();
      movementInputRef.current.horizontal = 0;
      movementInputRef.current.vertical = 0;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      captureMovementKeyDown(event, keys, selectSceneInputLocked(useMemoryRoomStore.getState()));
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (MOVEMENT_KEYS.has(event.code)) keys.delete(event.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInputs);
    document.addEventListener("visibilitychange", clearInputs);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInputs);
      document.removeEventListener("visibilitychange", clearInputs);
      clearInputs();
    };
  }, [movementInputRef]);

  useEffect(() => {
    if (!inputLocked) return;
    keysRef.current.clear();
    movementInputRef.current.horizontal = 0;
    movementInputRef.current.vertical = 0;
  }, [inputLocked, movementInputRef]);

  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    if (!group || selectSceneInputLocked(useMemoryRoomStore.getState())) return;

    const input = resolveMovementInput(
      keysRef.current,
      movementInputRef.current,
      resolvedInputRef.current,
    );
    const horizontal = input.horizontal;
    const vertical = input.vertical;
    if (horizontal === 0 && vertical === 0) return;

    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();
    cameraRight.crossVectors(cameraForward, camera.up).normalize();

    const frameDistance = PLAYER_SPEED * Math.min(delta, MAX_FRAME_DELTA);
    const movementDelta = deltaRef.current;
    movementDelta.x = (cameraRight.x * horizontal + cameraForward.x * vertical) * frameDistance;
    movementDelta.z = (cameraRight.z * horizontal + cameraForward.z * vertical) * frameDistance;

    const origin = originRef.current;
    origin.x = group.position.x;
    origin.z = group.position.z;
    const result = moveCircle(
      origin,
      movementDelta,
      PLAYER_RADIUS,
      ROOM_BOUNDS,
      ROOM_COLLIDERS,
      resultRef.current,
    );
    group.position.x = result.x;
    group.position.z = result.z;
    positionRef.current.copy(group.position);
  });

  return (
    <group ref={groupRef} name="player" position={PLAYER_START}>
      <mesh castShadow>
        <sphereGeometry args={[PLAYER_RADIUS, 24, 16]} />
        <meshStandardMaterial color={palette.paper} roughness={0.74} />
      </mesh>
    </group>
  );
}
