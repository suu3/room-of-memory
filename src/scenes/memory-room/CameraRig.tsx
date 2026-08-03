"use client";

import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { MathUtils, type OrthographicCamera, Vector3 } from "three";
import { focusZoomFor } from "@/components/canvas/room-canvas-runtime";
import type { MemoryId } from "@/data/memory-room";
import { CAMERA_PRESETS, ROOM_BOUNDS } from "./layout";

const cameraPositionGoal = new Vector3();
const cameraTargetGoal = new Vector3();
const orbitOffset = new Vector3();
const ORBIT_AXIS = new Vector3(0, 1, 0);
const roomTarget = CAMERA_PRESETS.room.target;

/**
 * 따라다닐 때 카메라가 보는 높이. 발밑(y=0)을 보면 화면 위쪽이 벽만 남고,
 * 머리 위를 보면 캐릭터가 화면 아래로 처진다. 가슴께가 구도가 가장 안정적이다.
 */
const FOLLOW_TARGET_Y = 1.5;

/**
 * 타깃이 방 밖으로 나가지 않게 하는 여유. 플레이어가 방 모서리에 붙으면 화면
 * 아래쪽에 방 바깥(받침·배경)이 크게 들어오므로, 타깃을 방 안쪽으로 붙들어 둔다.
 * 카메라는 여전히 플레이어 쪽으로 따라가되 모서리에서만 조금 덜 따라간다.
 */
const FOLLOW_INSET = 1.6;
const FOLLOW_LIMITS = {
  minX: ROOM_BOUNDS.minX + FOLLOW_INSET,
  maxX: ROOM_BOUNDS.maxX - FOLLOW_INSET,
  minZ: ROOM_BOUNDS.minZ + FOLLOW_INSET,
  maxZ: ROOM_BOUNDS.maxZ - FOLLOW_INSET,
} as const;

/** 따라붙는 속도. 프리셋 전환(7)보다 느슨해야 걸을 때 화면이 덜 출렁인다. */
const FOLLOW_LAMBDA = 3.2;

/**
 * 타이틀에서 방 안으로 내려앉는 동안의 속도와 그 구간의 길이(초).
 *
 * 평소 추적 속도(3.2)로 전환하면 0.6초 만에 끝나서, 모형을 보여주고 그 안으로
 * 들어간다는 연출이 통째로 날아간다. 시작 직후 잠깐만 훨씬 느리게 간다.
 */
const ENTER_LAMBDA = 1.25;
const ENTER_DURATION_S = 2.2;

/** 카메라가 붙을 수 있는 대상 — 기억 오브젝트와 엔딩(문 옆 배트). */
export type CameraFocusId = MemoryId | "ending";

export function CameraRig({
  focusId,
  roomZoom,
  orbitAzimuth,
  following,
  playerPositionRef,
}: {
  focusId: CameraFocusId | null;
  roomZoom: number;
  orbitAzimuth: number;
  /**
   * 플레이어를 따라갈지. 타이틀 화면에서는 false — 방 모형 전체를 정면으로 잡아
   * 놓고, 시작 버튼을 누르면 true가 되면서 카메라가 방 안으로 내려앉는다.
   * 전환 애니메이션은 따로 없다. 목표값이 바뀌면 아래 damp가 알아서 데려간다.
   */
  following: boolean;
  /** 따라갈 대상. */
  playerPositionRef: MutableRefObject<Vector3>;
}) {
  const targetRef = useRef(new Vector3(...roomTarget));
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const preset = CAMERA_PRESETS[focusId ?? "room"];
  const follows = following && focusId === null;
  const zoomGoal = focusZoomFor(roomZoom, focusId !== null);
  /** 방 안으로 내려앉기 시작한 뒤 흐른 시간. following이 켜질 때 0으로 되감는다. */
  const enterElapsed = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: following은 값이 아니라 "구도가 바뀌었다"는 신호로만 쓴다.
  useEffect(() => {
    enterElapsed.current = 0;
  }, [following]);

  useFrame(({ camera }, delta) => {
    if (follows) enterElapsed.current += delta;
    const entering = follows && enterElapsed.current < ENTER_DURATION_S;
    const lambda = reducedMotion ? 18 : entering ? ENTER_LAMBDA : follows ? FOLLOW_LAMBDA : 7;

    if (follows) {
      // 자유 이동 중 — 방 한가운데 고정이 아니라 플레이어를 따라본다.
      const player = playerPositionRef.current;
      cameraTargetGoal.set(
        MathUtils.clamp(player.x, FOLLOW_LIMITS.minX, FOLLOW_LIMITS.maxX),
        FOLLOW_TARGET_Y,
        MathUtils.clamp(player.z, FOLLOW_LIMITS.minZ, FOLLOW_LIMITS.maxZ),
      );
    } else {
      cameraTargetGoal.set(preset.target[0], preset.target[1], preset.target[2]);
    }
    // 프리셋 위치를 타깃 기준으로 Y축 회전시킨다 — 타깃은 그대로라 구도 중심이 유지된다.
    orbitOffset
      .set(
        preset.position[0] - preset.target[0],
        preset.position[1] - preset.target[1],
        preset.position[2] - preset.target[2],
      )
      .applyAxisAngle(ORBIT_AXIS, orbitAzimuth);
    cameraPositionGoal.copy(cameraTargetGoal).add(orbitOffset);

    camera.position.x = MathUtils.damp(camera.position.x, cameraPositionGoal.x, lambda, delta);
    camera.position.y = MathUtils.damp(camera.position.y, cameraPositionGoal.y, lambda, delta);
    camera.position.z = MathUtils.damp(camera.position.z, cameraPositionGoal.z, lambda, delta);

    if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
      const orthographicCamera = camera as OrthographicCamera;
      orthographicCamera.zoom = MathUtils.damp(orthographicCamera.zoom, zoomGoal, lambda, delta);
      orthographicCamera.updateProjectionMatrix();
    }

    const target = targetRef.current;
    target.x = MathUtils.damp(target.x, cameraTargetGoal.x, lambda, delta);
    target.y = MathUtils.damp(target.y, cameraTargetGoal.y, lambda, delta);
    target.z = MathUtils.damp(target.z, cameraTargetGoal.z, lambda, delta);
    camera.lookAt(target);
  });

  return null;
}
