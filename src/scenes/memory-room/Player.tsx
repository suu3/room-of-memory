"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { Group, MathUtils, type Mesh, type Object3D, Vector3 } from "three";
import { ASSETS } from "@/lib/assets";
import { selectSceneInputLocked, useMemoryRoomStore } from "@/store/memory-room";
import type { MovementAxes } from "@/types/movement";
import { ROOM_BOUNDS, ROOM_COLLIDERS } from "./layout";
import { type RoomPalette, resolveRoomPalette } from "./palette";
import { captureMovementKeyDown, MOVEMENT_KEYS, resolveMovementInput } from "./player-input";
import {
  isJointPart,
  PLAYER_JOINTS,
  PLAYER_MODEL_SCALE,
  type PlayerJointName,
  playerPose,
  STEP_RATE,
} from "./player-rig";
import { moveCircle, type Vec2 } from "./spatial";

/** 발이 바닥에 닿는 높이. 충돌·근접 판정은 x/z만 보므로 y는 순수 시각값이다. */
export const PLAYER_START = new Vector3(0, 0, 2.35);
const PLAYER_RADIUS = 0.38;
const PLAYER_SPEED = 2.35;
const MAX_FRAME_DELTA = 0.05;
/** 진행 방향으로 돌아서는 속도(damp lambda). */
const TURN_LAMBDA = 11;
/** 걷기 강도가 붙고 빠지는 속도. 낮추면 멈춘 뒤에도 다리가 한참 흔들린다. */
const WALK_BLEND_LAMBDA = 12;
const BREATHE_RATE = 1.8;
const cameraForward = new Vector3();
const cameraRight = new Vector3();

useGLTF.preload(ASSETS.models.playerBlocky, true, true);

/**
 * 옷 색 — 전부 DESIGN.md 토큰. 머리·팔(bone)과 몸통을 같은 밝은 색으로 두면
 * 실루엣이 한 덩어리로 뭉쳐 보여서, 몸통만 방의 강조색(ember)으로 띄운다.
 */
function partColor(name: string, palette: RoomPalette): string {
  if (name === "LegLeft1" || name === "LegRight1") return palette.ink;
  if (name === "Body1") return palette.ember;
  return palette.bone;
}

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
  const bodyRef = useRef<Group>(null);
  const jointsRef = useRef<Partial<Record<PlayerJointName, Object3D>>>({});
  const keysRef = useRef(new Set<string>());
  const originRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const deltaRef = useRef<Vec2>({ x: 0, z: 0 });
  const resultRef = useRef<Vec2>({ x: PLAYER_START.x, z: PLAYER_START.z });
  const resolvedInputRef = useRef<MovementAxes>({ horizontal: 0, vertical: 0 });
  const phaseRef = useRef(0);
  const breatheRef = useRef(0);
  const walkRef = useRef(0);
  const inputLocked = useMemoryRoomStore(selectSceneInputLocked);
  const palette = useMemo(resolveRoomPalette, []);

  const { scene } = useGLTF(ASSETS.models.playerBlocky, true, true);

  /**
   * glb에는 스켈레톤이 없고 파트가 변환 없는 별개 노드로 들어 있다. 관절 위치에 그룹을
   * 하나씩 끼워 회전축을 만들고, 메쉬를 그만큼 반대로 밀어 원래 자리에 되돌린다.
   */
  const rig = useMemo(() => {
    const root = scene.clone(true);
    const joints: Partial<Record<PlayerJointName, Object3D>> = {};

    for (const child of [...root.children]) {
      child.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((material) => material.clone())
          : mesh.material.clone();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const tinted = material as { color?: { set: (value: string) => void } };
          tinted.color?.set(partColor(child.name, palette));
        }
      });

      if (!isJointPart(child.name)) continue;
      const [x, y, z] = PLAYER_JOINTS[child.name];
      const pivot = new Group();
      pivot.name = `${child.name}-pivot`;
      pivot.position.set(x, y, z);
      // 파트 노드는 이미 자기 위치와 스케일을 갖고 있다 (양자화가 남긴 변환).
      // 덮어쓰면 안 되고, 관절만큼만 빼서 pivot과 합쳐 원래 자리가 되게 한다.
      child.position.sub(pivot.position);
      root.remove(child);
      pivot.add(child);
      root.add(pivot);
      joints[child.name] = pivot;
    }

    return { root, joints };
  }, [scene, palette]);

  useEffect(() => {
    jointsRef.current = rig.joints;
  }, [rig]);

  useEffect(
    () => () => {
      rig.root.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
    },
    [rig],
  );

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
    const facing = facingRef.current;
    const body = bodyRef.current;
    if (!group || !facing || !body) return;

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

      facing.rotation.y = dampAngle(
        facing.rotation.y,
        Math.atan2(movementDelta.x, movementDelta.z),
        TURN_LAMBDA,
        delta,
      );
      // 조이스틱은 아날로그라 살살 밀면 천천히 간다 — 보폭도 같이 느려져야 발이 안 미끄러진다.
      speed = Math.min(1, Math.hypot(horizontal, vertical));
      phaseRef.current += STEP_RATE * PLAYER_SPEED * speed * step;
    }

    walkRef.current = MathUtils.damp(walkRef.current, speed, WALK_BLEND_LAMBDA, delta);
    breatheRef.current += BREATHE_RATE * step;

    const pose = playerPose(phaseRef.current, walkRef.current, breatheRef.current);
    const joints = jointsRef.current;
    if (joints.LegLeft1) joints.LegLeft1.rotation.x = pose.legLeft;
    if (joints.LegRight1) joints.LegRight1.rotation.x = pose.legRight;
    if (joints.ArmLeft1) joints.ArmLeft1.rotation.x = pose.armLeft;
    if (joints.ArmRight1) joints.ArmRight1.rotation.x = pose.armRight;
    body.position.y = pose.bob;
    body.rotation.z = pose.sway;
  });

  return (
    <group ref={groupRef} name="player" position={PLAYER_START}>
      <group ref={facingRef}>
        <group scale={PLAYER_MODEL_SCALE}>
          {/* bob·sway는 모델 단위 값이라 스케일 안쪽에서 적용해야 한다 */}
          <group ref={bodyRef}>
            <primitive object={rig.root} />
          </group>
        </group>
      </group>
    </group>
  );
}
