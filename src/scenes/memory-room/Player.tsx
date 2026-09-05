"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { type Group, MathUtils, Vector3 } from "three";
import { ASSETS } from "@/lib/assets";
import { selectSceneInputLocked, useMemoryRoomStore } from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import {
  DOORWAY_ZONE,
  LIVING_BOUNDS,
  LIVING_COLLIDERS,
  ROOM_BOUNDS,
  ROOM_COLLIDERS,
  ROOM_SHELL_BOUNDS,
} from "./layout";
import {
  createPlayerRig,
  disposePlayerRig,
  startPlayerRig,
  updatePlayerRig,
} from "./player-animation";
import { captureMovementKeyDown, MOVEMENT_KEYS, resolveMovementInput } from "./player-input";
import { STEP_RATE } from "./player-rig";
import { moveThroughZones, type Vec2 } from "./spatial";

/** 발이 바닥에 닿는 높이. 충돌·근접 판정은 x/z만 보므로 y는 순수 시각값이다. */
export const PLAYER_START = new Vector3(0, 0, 2.35);
const PLAYER_RADIUS = 0.38;
const PLAYER_SPEED = 2.35;
const MAX_FRAME_DELTA = 0.05;
/** 진행 방향으로 돌아서는 속도(damp lambda). */
const TURN_LAMBDA = 11;
/** 걷기 강도가 붙고 빠지는 속도. 낮추면 멈춘 뒤에도 다리가 한참 흔들린다. */
const WALK_BLEND_LAMBDA = 12;
const cameraForward = new Vector3();
const cameraRight = new Vector3();

/**
 * 걷기 영역. 방문이 닫혀 있으면 방뿐이고, 열리면 문간과 거실이 이어진다 —
 * 문 자체에 콜라이더가 없으므로 "문이 막는다"는 곧 "저 두 영역이 없다"이다.
 */
const CLOSED_ZONES = [ROOM_BOUNDS] as const;
const OPEN_ZONES = [ROOM_BOUNDS, DOORWAY_ZONE, LIVING_BOUNDS] as const;
/** 가구 발자국은 두 공간 것을 늘 합쳐 본다 — 문이 닫혀 있으면 거실 쪽은 어차피 못 닿는다. */
const ALL_COLLIDERS = [...ROOM_COLLIDERS, ...LIVING_COLLIDERS] as const;

useGLTF.preload(ASSETS.models.playerBlocky, true, true);

/** 최단 회전 방향으로 각도를 damp — -π/π 경계에서 한 바퀴 도는 걸 막는다. */
function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  const shortest = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + shortest * (1 - Math.exp(-lambda * delta));
}

export function Player({
  positionRef,
  movementInputRef,
}: {
  positionRef: MutableRefObject<Vector3>;
  movementInputRef: MutableRefObject<MovementAxes>;
}) {
  const groupRef = useRef<Group>(null);
  const facingRef = useRef<Group>(null);
  const keysRef = useRef(new Set<string>());
  const originRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const deltaRef = useRef<Vec2>({ x: 0, z: 0 });
  const resultRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const resolvedInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const phaseRef = useRef(0);
  const walkRef = useRef(0);
  const inputLocked = useMemoryRoomStore(selectSceneInputLocked);
  const { scene, animations } = useGLTF(ASSETS.models.playerBlocky, true, true);
  const rig = useMemo(() => createPlayerRig(scene, animations), [scene, animations]);

  useEffect(() => {
    startPlayerRig(rig);
    return () => disposePlayerRig(rig);
  }, [rig]);

  /*
   * 리셋(HUD "처음으로"·엔딩 화면)마다 몸도 시작 자리로 돌아간다.
   *
   * 진행은 스토어가 지우지만 위치는 이 그룹의 변환에만 있어서, 안 돌리면 거실까지
   * 걸어갔던 몸이 그 자리에 남는다 — 다음 "새 게임"이 닫힌 문 너머 거실에서
   * 시작되고, 방으로 돌아올 길이 없다 (엔딩이 거실 현관에서 나므로 완주 후
   * 새 게임이 정확히 이 꼴이 된다).
   */
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  useEffect(() => {
    // 값은 안 읽는다 — 리셋마다 다시 실행되게 하는 신호다 (MemoryOutlineGlow와 같은 패턴).
    void resetRevision;
    positionRef.current.copy(PLAYER_START);
    const group = groupRef.current;
    if (group) group.position.copy(PLAYER_START);
    if (facingRef.current) facingRef.current.rotation.y = 0;
    walkRef.current = 0;
    phaseRef.current = 0;
    updatePlayerRig(rig, 0, 0, 0);
  }, [resetRevision, positionRef, rig]);

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
    const facing = facingRef.current;
    if (!group || !facing) return;

    const step = Math.min(delta, MAX_FRAME_DELTA);
    // 입력이 잠겨도 포즈는 계속 돈다 — 대사 중에 다리가 걷다 만 자세로 굳지 않게.
    const locked = selectSceneInputLocked(useMemoryRoomStore.getState());
    const input = locked
      ? null
      : resolveMovementInput(keysRef.current, movementInputRef.current, resolvedInputRef.current);
    const horizontal = input?.horizontal ?? 0;
    const vertical = input?.vertical ?? 0;
    const moving = horizontal !== 0 || vertical !== 0;
    let speed = 0;

    if (moving) {
      camera.getWorldDirection(cameraForward);
      cameraForward.y = 0;
      cameraForward.normalize();
      cameraRight.crossVectors(cameraForward, camera.up).normalize();

      const frameDistance = PLAYER_SPEED * step;
      const movementDelta = deltaRef.current;
      movementDelta.x = (cameraRight.x * horizontal + cameraForward.x * vertical) * frameDistance;
      movementDelta.z = (cameraRight.z * horizontal + cameraForward.z * vertical) * frameDistance;

      const origin = originRef.current;
      origin.x = group.position.x;
      origin.z = group.position.z;
      const result = moveThroughZones(
        origin,
        movementDelta,
        PLAYER_RADIUS,
        useMemoryRoomStore.getState().doorOpened ? OPEN_ZONES : CLOSED_ZONES,
        ALL_COLLIDERS,
        resultRef.current,
      );
      group.position.x = result.x;
      group.position.z = result.z;
      positionRef.current.copy(group.position);

      // 문턱(공유벽 x)을 넘으면 알린다 — 공유벽 컬링이 이 사실을 본다.
      // setInLivingRoom은 값이 같으면 아무것도 안 하므로 프레임마다 불러도 싸다.
      useMemoryRoomStore.getState().setInLivingRoom(result.x < ROOM_SHELL_BOUNDS.minX);

      facing.rotation.y = dampAngle(
        facing.rotation.y,
        Math.atan2(movementDelta.x, movementDelta.z),
        TURN_LAMBDA,
        delta,
      );
      // 조이스틱은 아날로그라 살살 밀면 천천히 간다 — 보폭도 같이 느려져야 발이 안 미끄러진다.
      const traveled = Math.hypot(result.x - origin.x, result.z - origin.z);
      speed = step > 0 ? Math.min(1, traveled / (PLAYER_SPEED * step)) : 0;
      phaseRef.current += STEP_RATE * PLAYER_SPEED * speed * step;
    }

    walkRef.current = MathUtils.damp(walkRef.current, speed, WALK_BLEND_LAMBDA, delta);
    updatePlayerRig(rig, phaseRef.current, walkRef.current, step);
  });

  return (
    <group ref={groupRef} name="player" position={PLAYER_START}>
      <group ref={facingRef}>
        <primitive object={rig.root} dispose={null} />
      </group>
    </group>
  );
}
