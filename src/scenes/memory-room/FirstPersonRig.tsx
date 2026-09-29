"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import { MathUtils, PerspectiveCamera, type Vector3 } from "three";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import type { Viewpoint } from "@/store/memory-room";
import {
  EYE_HEIGHT,
  exitWalkAt,
  FIRST_PERSON_FOV,
  initialLook,
  type LookAngles,
} from "./first-person";

/** 시선이 입력을 따라붙는 속도. 끌기가 곧바로 붙되 한 프레임씩 튀지는 않게. */
const LOOK_LAMBDA = 16;

/**
 * 1인칭 카메라. 인트로(스위치 찾기)와 2막 도입(문 넘기), 엔딩의 문턱이 같은 리그를 쓴다.
 *
 * 엔딩(exit)만 다르다: 플레이어를 따라가지도, 시선 입력을 읽지도 않는다. 정해 둔 길
 * (exitWalkAt)을 제 시계로 걸어 문 밖 빛 속으로 들어간다.
 *
 * 위치는 플레이어의 머리다 (positionRef + 눈높이). 몸은 Player가 메인 카메라가 안 보는
 * 층으로 옮긴다(거울에는 비친다). "일부만 보인다"는 인상은 조명이 아니라 화면 가운데만
 * 남기는 비네트(MemoryRoom)가 만든다. 조명을 깎아 만들면 방이 통째로 검어진다.
 *
 * 마운트되면 제 원근 카메라를 기본 카메라로 세우고, 언마운트되면 원래(아이소메트릭
 * 직교) 카메라를 돌려놓는다. 두 카메라는 서로 보간되지 않는다. 직교와 원근 사이에
 * 연속된 길은 없으므로 전환은 컷이고, 화면 위의 번쩍임(ViewpointTransition)이 그 컷을
 * 덮는다. 잠들어 있는 동안 직교 카메라는 CameraRig가 건드리지 않아 마지막 자리에
 * 남고, 돌아오면 거기서부터 damp로 따라온다.
 */
export function FirstPersonRig({
  viewpoint,
  playerPositionRef,
  lookRef,
}: {
  viewpoint: Exclude<Viewpoint, null>;
  playerPositionRef: MutableRefObject<Vector3>;
  /** DOM 입력(use-first-person-look)이 쓰는 시선. 여기서는 읽고 damp만 한다. */
  lookRef: MutableRefObject<LookAngles>;
}) {
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);
  const camera = useMemo(() => {
    const perspective = new PerspectiveCamera(FIRST_PERSON_FOV, 1, 0.05, 60);
    // yaw(Y)를 먼저, pitch(X)를 나중에: 고개를 돌린 뒤 끄덕여야 수평이 안 기운다
    perspective.rotation.order = "YXZ";
    perspective.name = "first-person-camera";
    return perspective;
  }, []);
  /** damp로 굴리는 현재 시선. 목표는 lookRef다. */
  const smoothRef = useRef<LookAngles>({ yaw: 0, pitch: 0 });
  /** 엔딩 문턱 넘기가 시작된 뒤 흐른 시간(초). 걷는 길은 이 시계 하나로 정해진다. */
  const exitElapsedRef = useRef(0);
  const exitMovingRef = useRef(true);

  // 구간에 들어서는 순간 시선을 놓는다. damp 없이 곧장: 첫 프레임에 휙 도는 건 연출이 아니라 멀미다
  useLayoutEffect(() => {
    const player = playerPositionRef.current;
    const look = initialLook(viewpoint, { x: player.x, z: player.z });
    lookRef.current.yaw = look.yaw;
    lookRef.current.pitch = look.pitch;
    smoothRef.current.yaw = look.yaw;
    smoothRef.current.pitch = look.pitch;
    if (viewpoint === "exit") {
      exitElapsedRef.current = 0;
      // 모션을 줄인 판에서는 걸어 나가지 않는다. 화면이 앞으로 밀려드는 건 멀미의 대표 꼴이다
      exitMovingRef.current = !prefersReducedMotion();
      exitWalkAt(0, exitMovingRef.current, camera.position);
    } else {
      camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
    }
    camera.rotation.set(look.pitch, look.yaw, 0);
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
    if (viewpoint === "exit") {
      exitElapsedRef.current += delta;
      exitWalkAt(exitElapsedRef.current, exitMovingRef.current, camera.position);
      // 시선은 들어설 때 정한 그대로다. 걸어 나가는 동안 고개를 돌릴 일은 없다
      return;
    }
    const player = playerPositionRef.current;
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
    const smooth = smoothRef.current;
    const goal = lookRef.current;
    smooth.yaw = MathUtils.damp(smooth.yaw, goal.yaw, LOOK_LAMBDA, delta);
    smooth.pitch = MathUtils.damp(smooth.pitch, goal.pitch, LOOK_LAMBDA, delta);
    camera.rotation.set(smooth.pitch, smooth.yaw, 0);
  });

  return <primitive object={camera} />;
}
