"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MathUtils, type OrthographicCamera, Vector3 } from "three";
import type { MemoryId } from "@/data/memory-room";
import { CAMERA_PRESETS } from "./layout";

const cameraPositionGoal = new Vector3();
const cameraTargetGoal = new Vector3();
const orbitOffset = new Vector3();
const ORBIT_AXIS = new Vector3(0, 1, 0);
const roomTarget = CAMERA_PRESETS.room.target;

export function CameraRig({
  focusMemoryId,
  roomZoom,
  orbitAzimuth,
}: {
  focusMemoryId: MemoryId | null;
  roomZoom: number;
  orbitAzimuth: number;
}) {
  const targetRef = useRef(new Vector3(...roomTarget));
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const preset = CAMERA_PRESETS[focusMemoryId ?? "room"];
  const lambda = reducedMotion ? 18 : 7;

  useFrame(({ camera }, delta) => {
    cameraTargetGoal.set(preset.target[0], preset.target[1], preset.target[2]);
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
      orthographicCamera.zoom = MathUtils.damp(orthographicCamera.zoom, roomZoom, lambda, delta);
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
