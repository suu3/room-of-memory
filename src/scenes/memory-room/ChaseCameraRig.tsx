"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import { MathUtils, PerspectiveCamera, type Vector3 } from "three";
import type { Viewpoint } from "@/store/memory-room";
import {
  CAMERA_DISTANCE,
  CHASE_FOV,
  cameraBounds,
  cameraDistanceWithin,
  initialLook,
  type LookAngles,
  lookDirection,
  PIVOT_HEIGHT,
} from "./chase-camera";

/** 시선이 입력을 따라붙는 속도. 끌기가 곧바로 붙되 한 프레임씩 튀지는 않게. */
const LOOK_LAMBDA = 16;
/** 벽에 막혀 당겨진 거리가 되돌아오는 속도. 당길 때는 즉시, 풀릴 때는 이 속도로. */
const DISTANCE_LAMBDA = 6;

const direction = { x: 0, y: 0, z: 0 };

/**
 * 등 뒤 카메라. 인트로(스위치 찾기)와 2막 도입(문 넘기)이 같은 리그를 쓴다.
 *
 * 캐릭터의 가슴께(PIVOT_HEIGHT)를 축으로 뒤에서 따라붙는 원근 카메라다. 끌면 축을 돌며
 * 둘러보고, 걸으면 캐릭터가 화면 아래에서 등을 보인 채 앞서간다. 벽에 몰리면 축 쪽으로
 * 당겨져 벽을 뚫지 않는다 (cameraDistanceWithin).
 *
 * 마운트되면 제 카메라를 기본 카메라로 세우고, 언마운트되면 원래(아이소메트릭 직교)
 * 카메라를 돌려놓는다. 두 카메라는 서로 보간되지 않는다. 직교와 원근 사이에 연속된
 * 길은 없으므로 전환은 컷이고, 화면 위의 번쩍임(ViewpointTransition)이 그 컷을 덮는다.
 * 잠들어 있는 동안 직교 카메라는 CameraRig가 건드리지 않아 마지막 자리에 남고,
 * 돌아오면 거기서부터 damp로 따라온다.
 */
export function ChaseCameraRig({
  viewpoint,
  playerPositionRef,
  lookRef,
}: {
  viewpoint: Exclude<Viewpoint, null>;
  playerPositionRef: MutableRefObject<Vector3>;
  /** DOM 입력(use-chase-look)이 쓰는 시선. 여기서는 읽고 damp만 한다. */
  lookRef: MutableRefObject<LookAngles>;
}) {
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);
  const camera = useMemo(() => {
    const perspective = new PerspectiveCamera(CHASE_FOV, 1, 0.05, 60);
    // yaw(Y)를 먼저, pitch(X)를 나중에: 고개를 돌린 뒤 끄덕여야 수평이 안 기운다
    perspective.rotation.order = "YXZ";
    perspective.name = "chase-camera";
    return perspective;
  }, []);
  /** damp로 굴리는 현재 시선. 목표는 lookRef다. */
  const smoothRef = useRef<LookAngles>({ yaw: 0, pitch: 0 });
  const distanceRef = useRef(CAMERA_DISTANCE);
  const bounds = useMemo(() => cameraBounds(viewpoint), [viewpoint]);

  const place = (look: LookAngles, distance: number) => {
    const player = playerPositionRef.current;
    lookDirection(look, direction);
    camera.position.set(
      player.x - direction.x * distance,
      player.y + PIVOT_HEIGHT - direction.y * distance,
      player.z - direction.z * distance,
    );
    camera.rotation.set(look.pitch, look.yaw, 0);
  };

  // 구간에 들어서는 순간 시선을 놓는다. damp 없이 곧장: 첫 프레임에 휙 도는 건 연출이 아니라 멀미다
  // biome-ignore lint/correctness/useExhaustiveDependencies: place는 렌더마다 새 함수지만 ref만 읽는다. viewpoint가 바뀔 때만 다시 놓는다.
  useLayoutEffect(() => {
    const player = playerPositionRef.current;
    const look = initialLook(viewpoint, { x: player.x, z: player.z });
    lookRef.current.yaw = look.yaw;
    lookRef.current.pitch = look.pitch;
    smoothRef.current.yaw = look.yaw;
    smoothRef.current.pitch = look.pitch;
    distanceRef.current = CAMERA_DISTANCE;
    place(look, CAMERA_DISTANCE);
    camera.updateMatrixWorld();
  }, [viewpoint, camera, lookRef, playerPositionRef]);

  useLayoutEffect(() => {
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [camera, size]);

  // 기본 카메라를 바꿔 끼운다. 되돌리는 것까지가 이 리그의 몫이다
  useLayoutEffect(() => {
    let previous: PerspectiveCamera | null = null;
    set((state) => {
      previous = state.camera as PerspectiveCamera;
      return { camera };
    });
    return () => {
      if (previous) set({ camera: previous });
    };
  }, [camera, set]);

  useFrame((_, delta) => {
    const smooth = smoothRef.current;
    const goal = lookRef.current;
    smooth.yaw = MathUtils.damp(smooth.yaw, goal.yaw, LOOK_LAMBDA, delta);
    smooth.pitch = MathUtils.damp(smooth.pitch, goal.pitch, LOOK_LAMBDA, delta);

    const player = playerPositionRef.current;
    lookDirection(smooth, direction);
    const allowed = cameraDistanceWithin(player, direction, CAMERA_DISTANCE, bounds);
    // 벽에 닿으면 즉시 당기고, 벽에서 멀어지면 천천히 되돌아온다. 즉시 되돌리면 벽을 스칠 때마다 튄다
    distanceRef.current =
      allowed < distanceRef.current
        ? allowed
        : MathUtils.damp(distanceRef.current, allowed, DISTANCE_LAMBDA, delta);
    place(smooth, distanceRef.current);
  });

  return <primitive object={camera} />;
}
